// Types pour la file d'attente des travaux
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface Job<T = unknown> {
  id: string
  type: string
  data: T
  status: JobStatus
  attempts: number
  maxAttempts: number
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  completedAt: Date | null
  error: string | null
  nextRetryAt: Date | null
}

export interface JobOptions {
  maxAttempts?: number
  delayMs?: number
  priority?: number
}

export interface JobHandler<T = unknown> {
  (data: T, job: Job<T>): Promise<void>
}

export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  cancelled: number
  total: number
}

// Generateur d'identifiant simple
let jobIdCounter = 0
function generateJobId(): string {
  jobIdCounter++
  return `job_${Date.now()}_${jobIdCounter}`
}

// Classe de file d'attente des travaux en memoire
class JobQueue {
  private queue: Map<string, Job> = new Map()
  private handlers: Map<string, JobHandler> = new Map()
  private processorInterval: ReturnType<typeof setInterval> | null = null
  private isProcessing = false

  // Ajouter un travail a la file
  enqueue<T = unknown>(
    type: string,
    data: T,
    options: JobOptions = {}
  ): string {
    const id = generateJobId()
    const now = new Date()

    const job: Job<T> = {
      id,
      type,
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      nextRetryAt: options.delayMs ? new Date(now.getTime() + options.delayMs) : null,
    }

    this.queue.set(id, job as Job)
    return id
  }

  // Enregistrer un gestionnaire pour un type de travail
  registerHandler<T = unknown>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler)
  }

  // Recuperer le prochain travail en attente
  private getNextJob(type?: string): Job | null {
    const now = new Date()
    let nextJob: Job | null = null

    for (const job of this.queue.values()) {
      if (job.status !== 'pending') continue
      if (type && job.type !== type) continue

      // Verifier si le delai est passe
      if (job.nextRetryAt && job.nextRetryAt > now) continue

      // Prendre le travail le plus ancien
      if (!nextJob || job.createdAt < nextJob.createdAt) {
        nextJob = job
      }
    }

    return nextJob
  }

  // Calculer le delai avant la prochaine tentative (backoff exponentiel)
  private calculateBackoff(attempt: number): number {
    // 2^attempt * 1000ms, plafonne a 30 secondes
    const delay = Math.min(Math.pow(2, attempt) * 1000, 30000)
    // Ajouter un facteur aleatoire (jitter) entre 0 et 500ms
    const jitter = Math.floor(Math.random() * 500)
    return delay + jitter
  }

  // Traiter le prochain travail
  async processNext(type?: string): Promise<boolean> {
    if (this.isProcessing) return false

    const job = this.getNextJob(type)
    if (!job) return false

    const handler = this.handlers.get(job.type)
    if (!handler) {
      console.warn(`[File] Aucun gestionnaire enregistre pour le type: ${job.type}`)
      return false
    }

    this.isProcessing = true
    job.status = 'processing'
    job.startedAt = new Date()
    job.updatedAt = new Date()
    job.attempts++

    try {
      await handler(job.data, job)

      job.status = 'completed'
      job.completedAt = new Date()
      job.error = null
      job.updatedAt = new Date()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (job.attempts < job.maxAttempts) {
        // Retenter avec un backoff exponentiel
        const backoff = this.calculateBackoff(job.attempts)
        job.status = 'pending'
        job.error = errorMessage
        job.nextRetryAt = new Date(Date.now() + backoff)
        job.updatedAt = new Date()

        console.warn(
          `[File] Echec du travail ${job.id} (tentative ${job.attempts}/${job.maxAttempts}), ` +
          `nouvelle tentative dans ${backoff}ms: ${errorMessage}`
        )
      } else {
        // Nombre maximal de tentatives atteint
        job.status = 'failed'
        job.completedAt = new Date()
        job.error = errorMessage
        job.updatedAt = new Date()

        console.error(
          `[File] Echec definitif du travail ${job.id} apres ${job.attempts} tentatives: ${errorMessage}`
        )
      }
    } finally {
      this.isProcessing = false
      this.queue.set(job.id, job)
    }

    return true
  }

  // Annuler un travail
  cancelJob(id: string): boolean {
    const job = this.queue.get(id)
    if (!job) return false
    if (job.status === 'completed' || job.status === 'cancelled') return false

    job.status = 'cancelled'
    job.updatedAt = new Date()
    this.queue.set(id, job)
    return true
  }

  // Retenter un travail echoue
  retryJob(id: string): boolean {
    const job = this.queue.get(id)
    if (!job) return false
    if (job.status !== 'failed') return false

    job.status = 'pending'
    job.attempts = 0
    job.error = null
    job.startedAt = null
    job.completedAt = null
    job.nextRetryAt = null
    job.updatedAt = new Date()
    this.queue.set(id, job)
    return true
  }

  // Obtenir les statistiques de la file
  getQueueStats(type?: string): QueueStats {
    const stats: QueueStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    }

    for (const job of this.queue.values()) {
      if (type && job.type !== type) continue
      stats[job.status]++
      stats.total++
    }

    return stats
  }

  // Recuperer les travaux echoues
  getFailedJobs(type?: string): Job[] {
    const failed: Job[] = []
    for (const job of this.queue.values()) {
      if (job.status !== 'failed') continue
      if (type && job.type !== type) continue
      failed.push(job)
    }
    return failed.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  // Nettoyer les travaux termines ou annules
  clearCompleted(): number {
    let count = 0
    for (const [id, job] of this.queue.entries()) {
      if (job.status === 'completed' || job.status === 'cancelled') {
        this.queue.delete(id)
        count++
      }
    }
    return count
  }

  // Demarrer le processeur automatique
  startProcessor(intervalMs: number = 5000): void {
    if (this.processorInterval) {
      console.warn('[File] Le processeur est deja en cours d\'execution')
      return
    }

    console.log(`[File] Demarrage du processeur (intervalle: ${intervalMs}ms)`)

    this.processorInterval = setInterval(async () => {
      try {
        await this.processNext()
      } catch (error) {
        console.error('[File] Erreur du processeur:', error)
      }
    }, intervalMs)
  }

  // Arreter le processeur automatique
  stopProcessor(): void {
    if (this.processorInterval) {
      clearInterval(this.processorInterval)
      this.processorInterval = null
      console.log('[File] Processeur arrete')
    }
  }

  // Traiter tous les travaux en attente
  async processAll(type?: string): Promise<number> {
    let processed = 0

    while (true) {
      const result = await this.processNext(type)
      if (!result) break
      processed++
    }

    return processed
  }

  // Reinitialiser toute la file
  resetAll(): void {
    this.stopProcessor()
    this.queue.clear()
    this.isProcessing = false
    jobIdCounter = 0
  }
}

// Instance singleton de la file d'attente
export const jobQueue = new JobQueue()
export default jobQueue
