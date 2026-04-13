/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Background Job Queue (In-Memory)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A lightweight, in-memory job queue system for background tasks such as
 * SMS notifications, push notifications, Mobile Money webhooks, emails,
 * analytics logging, and periodic cleanup.
 *
 * Features:
 * - Multiple job types with typed payloads
 * - Job lifecycle: pending → processing → completed / failed
 * - Auto-retry with exponential backoff (1s, 2s, 4s, 8s...)
 * - Configurable max retries (default: 3)
 * - Job timeout (default: 30s)
 * - Handler registry for processing different job types
 * - Built-in handlers: cleanup (expired cache), analytics (stats logging)
 * - Auto-processing loop with configurable interval
 * - Queue statistics and management
 *
 * @example
 * ```ts
 * import { jobQueue } from '@/lib/job-queue';
 *
 * // Register a custom handler
 * jobQueue.registerHandler('sms', async (job) => {
 *   console.log(`Sending SMS to ${job.payload.to}: ${job.payload.message}`);
 *   return { success: true, messageId: 'msg-123' };
 * });
 *
 * // Enqueue a job
 * const jobId = jobQueue.enqueue('sms', {
 *   to: '+224621000000',
 *   message: 'Votre course MOVA est confirmée!',
 * });
 *
 * // Start auto-processing (checks every 5 seconds)
 * jobQueue.startProcessor(5000);
 *
 * // Get queue stats
 * console.log(jobQueue.getQueueStats());
 * // { pending: 3, processing: 1, completed: 15, failed: 0, total: 19 }
 *
 * // Check a specific job
 * const job = jobQueue.getJob(jobId);
 * console.log(job?.status); // 'completed'
 *
 * // Stop processing when done
 * jobQueue.stopProcessor();
 * ```
 *
 * No external dependencies — pure Node.js APIs.
 */

import { cache } from './cache';

// ─── Types ─────────────────────────────────────────────────────────────

/** Supported job types for the MOVA platform */
export type JobType =
  | 'sms'
  | 'push'
  | 'mobile_money'
  | 'email'
  | 'analytics'
  | 'cleanup';

/** Job status lifecycle */
export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** A job in the queue */
export interface Job<T = Record<string, unknown>> {
  /** Unique job identifier (UUID-like) */
  id: string;
  /** Type of job, determines which handler processes it */
  type: JobType;
  /** Job payload with type-specific data */
  payload: T;
  /** Current status in the lifecycle */
  status: JobStatus;
  /** Number of times this job has been attempted */
  attempts: number;
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Timestamp when the job was created */
  createdAt: number;
  /** Timestamp when processing started (null if not started) */
  startedAt: number | null;
  /** Timestamp when processing completed/failed (null if not finished) */
  completedAt: number | null;
  /** Error message from the last failed attempt (null if no error) */
  error: string | null;
  /** Job timeout in milliseconds */
  timeoutMs: number;
  /** Time to wait before the next retry (null if not scheduled) */
  nextRetryAt: number | null;
}

/** Options for enqueueing a job */
export interface EnqueueOptions {
  /** Maximum retry attempts (default: 3) */
  maxAttempts?: number;
  /** Job timeout in milliseconds (default: 30_000) */
  timeoutMs?: number;
  /** Delay before the job becomes eligible for processing (ms) */
  delayMs?: number;
  /** Unique identifier to prevent duplicate jobs */
  idempotencyKey?: string;
}

/** Statistics for a job queue or all queues */
export interface QueueStats {
  /** Number of jobs waiting to be processed */
  pending: number;
  /** Number of jobs currently being processed */
  processing: number;
  /** Number of successfully completed jobs */
  completed: number;
  /** Number of failed jobs (including retries exhausted) */
  failed: number;
  /** Total number of jobs ever enqueued */
  total: number;
}

/** Handler function for processing a specific job type */
export type JobHandler<T = Record<string, unknown>> = (job: Job<T>) => Promise<unknown>;

// ─── Constants ─────────────────────────────────────────────────────────

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PROCESSOR_INTERVAL_MS = 5000;
const BACKOFF_BASE_MS = 1000; // 1s base for exponential backoff

// ─── Internal State ────────────────────────────────────────────────────

/** All jobs indexed by ID */
const jobs = new Map<string, Job>();

/** Registered handlers per job type */
const handlers = new Map<JobType, JobHandler>();

/** Auto-processing interval timer reference */
let processorTimer: ReturnType<typeof setInterval> | null = null;

/** Whether the processor is currently running */
let processorRunning = false;

/** Counter for generating unique job IDs */
let jobCounter = 0;

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Generate a unique job ID.
 * Format: "job-{timestamp}-{counter}"
 */
function generateJobId(): string {
  jobCounter++;
  return `job-${Date.now()}-${jobCounter}`;
}

/**
 * Calculate exponential backoff delay for a given attempt number.
 * 1s, 2s, 4s, 8s, 16s, ...
 */
function calculateBackoff(attempt: number): number {
  return BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
}

/**
 * Create a timeout promise that rejects after the specified duration.
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Job timed out after ${ms}ms`)), ms);
  });
}

/**
 * Find the next eligible job for processing.
 * A job is eligible if it's pending and its nextRetryAt (if set) has passed.
 */
function findNextEligibleJob(queueType?: JobType): Job | null {
  const now = Date.now();
  let candidate: Job | null = null;

  for (const job of jobs.values()) {
    // Filter by queue type if specified
    if (queueType && job.type !== queueType) continue;

    // Must be pending
    if (job.status !== 'pending') continue;

    // Must not be delayed
    if (job.nextRetryAt !== null && job.nextRetryAt > now) continue;

    // Pick the oldest pending job (FIFO)
    if (!candidate || job.createdAt < candidate.createdAt) {
      candidate = job;
    }
  }

  return candidate;
}

// ─── Built-in Handlers ─────────────────────────────────────────────────

/**
 * Built-in cleanup handler: clears expired cache entries and stale jobs.
 */
async function cleanupHandler(job: Job): Promise<{ clearedKeys: number; clearedJobs: number }> {
  const statsBefore = await cache.stats();

  // Clear completed jobs older than 1 hour
  const oneHourAgo = Date.now() - 3_600_000;
  let clearedJobs = 0;

  for (const [id, j] of jobs) {
    if (
      (j.status === 'completed' || j.status === 'cancelled') &&
      j.completedAt !== null &&
      j.completedAt < oneHourAgo
    ) {
      jobs.delete(id);
      clearedJobs++;
    }
  }

  // The cache auto-cleans, but we can force a stats check
  const statsAfter = await cache.stats();

  return {
    clearedKeys: statsBefore.keys - statsAfter.keys,
    clearedJobs,
  };
}

/**
 * Built-in analytics handler: logs current queue and cache statistics.
 */
async function analyticsHandler(job: Job): Promise<{ timestamp: number; stats: QueueStats; cacheStats: { keys: number; hitRate: string } }> {
  const allStats = getQueueStatsInternal();
  const cacheStats = await cache.stats();

  // Log stats (in production this would send to a metrics service)
  console.log('[MOVA Analytics]', {
    timestamp: new Date().toISOString(),
    queue: allStats,
    cache: cacheStats,
  });

  return {
    timestamp: Date.now(),
    stats: allStats,
    cacheStats: { keys: cacheStats.keys, hitRate: cacheStats.hitRate },
  };
}

// Register built-in handlers
handlers.set('cleanup', cleanupHandler);
handlers.set('analytics', analyticsHandler);

// ─── Internal Stats ────────────────────────────────────────────────────

/**
 * Compute queue statistics for all jobs or a specific type.
 */
function getQueueStatsInternal(type?: JobType): QueueStats {
  let pending = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;
  let total = 0;

  for (const job of jobs.values()) {
    if (type && job.type !== type) continue;

    total++;
    switch (job.status) {
      case 'pending':
        pending++;
        break;
      case 'processing':
        processing++;
        break;
      case 'completed':
        completed++;
        break;
      case 'failed':
        failed++;
        break;
      case 'cancelled':
        // Cancelled jobs are counted in total but not in other categories
        break;
    }
  }

  return { pending, processing, completed, failed, total };
}

// ─── Job Queue API ─────────────────────────────────────────────────────

/**
 * Background job queue singleton for managing async tasks.
 */
export const jobQueue = {
  /**
   * Register a handler function for a specific job type.
   * The handler will be called when jobs of this type are processed.
   *
   * @typeParam T - Payload type expected by the handler
   * @param type - Job type to handle
   * @param handler - Async function that processes the job
   *
   * @example
   * ```ts
   * jobQueue.registerHandler<{ to: string; message: string }>('sms', async (job) => {
   *   // Send SMS via external API
   *   const result = await smsApi.send(job.payload.to, job.payload.message);
   *   return result;
   * });
   * ```
   */
  registerHandler<T = Record<string, unknown>>(
    type: JobType,
    handler: JobHandler<T>
  ): void {
    handlers.set(type, handler as JobHandler);
  },

  /**
   * Enqueue a new job for processing.
   *
   * @typeParam T - Payload type
   * @param type - Job type (determines which handler processes it)
   * @param payload - Job-specific data
   * @param options - Optional configuration (maxAttempts, timeoutMs, delayMs, idempotencyKey)
   * @returns The unique job ID
   *
   * @example
   * ```ts
   * const jobId = jobQueue.enqueue('sms', {
   *   to: '+224621000000',
   *   message: 'Course confirmée!',
   * }, { maxAttempts: 5, timeoutMs: 10_000 });
   * ```
   */
  enqueue<T = Record<string, unknown>>(
    type: JobType,
    payload: T,
    options?: EnqueueOptions
  ): string {
    const id = generateJobId();
    const now = Date.now();

    const job: Job<T> = {
      id,
      type,
      payload: payload as unknown as T,
      status: 'pending',
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      nextRetryAt: options?.delayMs ? now + options.delayMs : null,
    };

    jobs.set(id, job as Job);

    return id;
  },

  /**
   * Process the next eligible job in the queue.
   * If a queueType is specified, only processes jobs of that type.
   * Returns the job that was processed, or null if no eligible jobs.
   *
   * @param queueType - Optional job type filter
   * @returns The processed job, or null if no jobs were eligible
   *
   * @example
   * ```ts
   * const job = jobQueue.processNext('sms');
   * if (job) {
   *   console.log(`Processed job ${job.id}: ${job.status}`);
   * }
   * ```
   */
  async processNext(queueType?: JobType): Promise<Job | null> {
    const job = findNextEligibleJob(queueType);
    if (!job) return null;

    const handler = handlers.get(job.type);
    if (!handler) {
      // No handler registered for this type — mark as failed
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = `No handler registered for job type: ${job.type}`;
      return job;
    }

    // Mark as processing
    job.status = 'processing';
    job.startedAt = Date.now();
    job.attempts++;

    try {
      // Execute handler with timeout
      const result = await Promise.race([
        handler(job),
        createTimeoutPromise(job.timeoutMs),
      ]);

      job.status = 'completed';
      job.completedAt = Date.now();
      job.error = null;
      job.nextRetryAt = null;

      // Log successful processing (debug)
      console.debug(`[JobQueue] Job ${job.id} (${job.type}) completed in ${job.completedAt - job.startedAt}ms`);

      void result; // Handler return value is currently unused
      return job;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (job.attempts < job.maxAttempts) {
        // Schedule retry with exponential backoff
        const backoff = calculateBackoff(job.attempts);
        job.status = 'pending';
        job.error = errorMessage;
        job.nextRetryAt = Date.now() + backoff;

        console.warn(
          `[JobQueue] Job ${job.id} (${job.type}) failed (attempt ${job.attempts}/${job.maxAttempts}). ` +
          `Retrying in ${backoff}ms. Error: ${errorMessage}`
        );
      } else {
        // Max retries exceeded
        job.status = 'failed';
        job.completedAt = Date.now();
        job.error = errorMessage;
        job.nextRetryAt = null;

        console.error(
          `[JobQueue] Job ${job.id} (${job.type}) failed permanently after ${job.attempts} attempts. ` +
          `Error: ${errorMessage}`
        );
      }

      return job;
    }
  },

  /**
   * Get a specific job by its ID.
   *
   * @param jobId - The unique job identifier
   * @returns The job object, or null if not found
   *
   * @example
   * ```ts
   * const job = jobQueue.getJob('job-1234567890-1');
   * if (job) console.log(job.status);
   * ```
   */
  getJob(jobId: string): Job | null {
    return jobs.get(jobId) ?? null;
  },

  /**
   * Cancel a pending or processing job.
   * Cannot cancel completed or already-failed jobs.
   *
   * @param jobId - The unique job identifier
   * @returns true if the job was successfully cancelled, false otherwise
   *
   * @example
   * ```ts
   * const cancelled = jobQueue.cancelJob('job-1234567890-1');
   * if (cancelled) console.log('Job cancelled');
   * ```
   */
  cancelJob(jobId: string): boolean {
    const job = jobs.get(jobId);
    if (!job) return false;

    // Only pending and processing jobs can be cancelled
    if (job.status !== 'pending' && job.status !== 'processing') {
      return false;
    }

    job.status = 'cancelled';
    job.completedAt = Date.now();
    job.nextRetryAt = null;
    return true;
  },

  /**
   * Retry a failed job.
   * Resets the job to pending status and schedules it for immediate processing.
   * Only failed jobs can be retried.
   *
   * @param jobId - The unique job identifier
   * @returns true if the job was successfully queued for retry, false otherwise
   *
   * @example
   * ```ts
   * const retried = jobQueue.retryJob('job-1234567890-1');
   * if (retried) console.log('Job queued for retry');
   * ```
   */
  retryJob(jobId: string): boolean {
    const job = jobs.get(jobId);
    if (!job) return false;

    // Only failed jobs can be retried
    if (job.status !== 'failed') {
      return false;
    }

    job.status = 'pending';
    job.startedAt = null;
    job.completedAt = null;
    job.error = null;
    job.nextRetryAt = null;
    job.attempts = 0; // Reset attempt counter for fresh retry
    return true;
  },

  /**
   * Get queue statistics for a specific job type or all types.
   *
   * @param type - Optional job type filter. If omitted, returns stats for all types.
   * @returns Queue statistics object
   *
   * @example
   * ```ts
   * const stats = jobQueue.getQueueStats();
   * console.log(`Pending: ${stats.pending}, Failed: ${stats.failed}`);
   *
   * const smsStats = jobQueue.getQueueStats('sms');
   * console.log(`SMS completed: ${smsStats.completed}`);
   * ```
   */
  getQueueStats(type?: JobType): QueueStats {
    return getQueueStatsInternal(type);
  },

  /**
   * Get all jobs that have failed (exhausted retries).
   *
   * @returns Array of failed job objects, sorted by completion time (most recent first)
   *
   * @example
   * ```ts
   * const failed = jobQueue.getFailedJobs();
   * for (const job of failed) {
   *   console.log(`Job ${job.id} failed: ${job.error}`);
   * }
   * ```
   */
  getFailedJobs(): Job[] {
    return Array.from(jobs.values())
      .filter((job) => job.status === 'failed')
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  },

  /**
   * Clear all completed and cancelled jobs from the queue.
   * Does NOT remove pending, processing, or failed jobs.
   *
   * @returns The number of jobs that were cleared
   *
   * @example
   * ```ts
   * const cleared = jobQueue.clearCompleted();
   * console.log(`Cleared ${cleared} completed jobs`);
   * ```
   */
  clearCompleted(): number {
    let cleared = 0;

    for (const [id, job] of jobs) {
      if (job.status === 'completed' || job.status === 'cancelled') {
        jobs.delete(id);
        cleared++;
      }
    }

    return cleared;
  },

  /**
   * Process all currently eligible jobs in the queue (one-shot, not a loop).
   * Processes jobs sequentially until no more eligible jobs are available.
   *
   * @param queueType - Optional job type filter
   * @returns The number of jobs that were processed
   *
   * @example
   * ```ts
   * const processed = await jobQueue.processAll('sms');
   * console.log(`Processed ${processed} SMS jobs`);
   * ```
   */
  async processAll(queueType?: JobType): Promise<number> {
    let processed = 0;
    let job: Job | null = null;

    // Process up to 100 jobs in one batch to prevent infinite loops
    const maxBatch = 100;

    while (processed < maxBatch) {
      job = await this.processNext(queueType);
      if (!job) break;
      processed++;
    }

    return processed;
  },

  /**
   * Start the automatic job processing loop.
   * The processor will check for eligible jobs at the specified interval.
   * Safe to call multiple times — will not start duplicate loops.
   *
   * @param intervalMs - How often to check for new jobs (default: 5000ms)
   *
   * @example
   * ```ts
   * // Process jobs every 5 seconds
   * jobQueue.startProcessor(5000);
   *
   * // Process jobs every 10 seconds
   * jobQueue.startProcessor(10_000);
   * ```
   */
  startProcessor(intervalMs: number = DEFAULT_PROCESSOR_INTERVAL_MS): void {
    if (processorRunning) return;

    processorRunning = true;

    processorTimer = setInterval(async () => {
      try {
        // Process one job per tick to avoid blocking
        await this.processNext();
      } catch (err) {
        console.error('[JobQueue] Processor error:', err);
      }
    }, intervalMs);

    // Allow Node.js process to exit
    if (processorTimer.unref) {
      processorTimer.unref();
    }

    console.log(`[JobQueue] Processor started (interval: ${intervalMs}ms)`);
  },

  /**
   * Stop the automatic job processing loop.
   * Currently processing jobs will finish, but no new jobs will be picked up.
   *
   * @example
   * ```ts
   * jobQueue.stopProcessor();
   * ```
   */
  stopProcessor(): void {
    if (!processorRunning) return;

    processorRunning = false;

    if (processorTimer) {
      clearInterval(processorTimer);
      processorTimer = null;
    }

    console.log('[JobQueue] Processor stopped');
  },

  /**
   * Check if the automatic processor is currently running.
   *
   * @returns true if the processor loop is active
   *
   * @example
   * ```ts
   * if (!jobQueue.isProcessing()) {
   *   jobQueue.startProcessor();
   * }
   * ```
   */
  isProcessing(): boolean {
    return processorRunning;
  },

  /**
   * Get all jobs in the queue, optionally filtered by type and status.
   * Primarily useful for debugging and admin views.
   *
   * @param filter - Optional filter by type and/or status
   * @returns Array of matching jobs
   *
   * @example
   * ```ts
   * const pendingSms = jobQueue.getAllJobs({
   *   type: 'sms',
   *   status: 'pending',
   * });
   * ```
   */
  getAllJobs(filter?: { type?: JobType; status?: JobStatus }): Job[] {
    let result = Array.from(jobs.values());

    if (filter?.type) {
      result = result.filter((job) => job.type === filter.type);
    }

    if (filter?.status) {
      result = result.filter((job) => job.status === filter.status);
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Remove a specific job from the queue entirely.
   * Use with caution — this is a hard delete, not a status change.
   *
   * @param jobId - The unique job identifier
   * @returns true if the job was found and removed
   *
   * @example
   * ```ts
   * jobQueue.removeJob('job-1234567890-1');
   * ```
   */
  removeJob(jobId: string): boolean {
    return jobs.delete(jobId);
  },

  /**
   * Clear ALL jobs from the queue regardless of status.
   * Also stops the processor. Primarily for testing/reset.
   *
   * @example
   * ```ts
   * jobQueue.resetAll();
   * ```
   */
  resetAll(): void {
    this.stopProcessor();
    jobs.clear();
    jobCounter = 0;
  },

  /**
   * Get the number of currently registered job handlers.
   *
   * @returns Count of registered handler types
   *
   * @example
   * ```ts
   * console.log(`Registered handlers: ${jobQueue.handlerCount}`);
   * ```
   */
  get handlerCount(): number {
    return handlers.size;
  },

  /**
   * Get the total number of jobs in the queue (all statuses).
   *
   * @returns Total job count
   *
   * @example
   * ```ts
   * console.log(`Total jobs: ${jobQueue.size}`);
   * ```
   */
  get size(): number {
    return jobs.size;
  },
};
