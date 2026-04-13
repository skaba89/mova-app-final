import Redis from 'ioredis'

// Interfaces pour le gestionnaire de cache
interface CacheEntry<T = unknown> {
  value: T
  expiresAt: number | null
}

interface CacheStats {
  hits: number
  misses: number
  keys: number
  hitRate: number
}

// Classe de gestion du cache avec basculement memoire
class CacheManager {
  private redis: Redis | null = null
  private memoryCache = new Map<string, CacheEntry>()
  private hits = 0
  private misses = 0
  private redisConnected = false

  constructor() {
    this.initRedis()
  }

  // Initialiser la connexion Redis
  private initRedis(): void {
    try {
      const redisUrl = process.env.REDIS_URL

      if (!redisUrl) {
        console.warn('[Cache] REDIS_URL non defini, basculement vers le cache memoire')
        return
      }

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 200, 5000)
          return delay
        },
        lazyConnect: true,
      })

      this.redis.on('connect', () => {
        this.redisConnected = true
        console.log('[Cache] Connecte a Redis avec succes')
      })

      this.redis.on('error', (err) => {
        this.redisConnected = false
        console.warn('[Cache] Erreur Redis, basculement vers le cache memoire:', err.message)
      })

      this.redis.on('close', () => {
        this.redisConnected = false
        console.warn('[Cache] Connexion Redis fermee')
      })

      // Connexion silencieuse
      this.redis.connect().catch(() => {
        this.redisConnected = false
      })
    } catch {
      console.warn('[Cache] Impossible d\'initialiser Redis, basculement vers le cache memoire')
      this.redis = null
    }
  }

  // Recuperer une valeur du cache
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      // Essayer Redis en premier
      if (this.redis && this.redisConnected) {
        const raw = await this.redis.get(key)
        if (raw) {
          this.hits++
          const entry: CacheEntry<T> = JSON.parse(raw)

          // Verifier si l'entree n'est pas expiree
          if (entry.expiresAt && entry.expiresAt < Date.now()) {
            await this.del(key)
            this.misses++
            return null
          }

          return entry.value
        }
      }

      // Basculement vers la memoire
      const memoryEntry = this.memoryCache.get(key)
      if (memoryEntry) {
        // Verifier si l'entree memoire n'est pas expiree
        if (memoryEntry.expiresAt && memoryEntry.expiresAt < Date.now()) {
          this.memoryCache.delete(key)
          this.misses++
          return null
        }

        this.hits++
        return memoryEntry.value as T
      }

      this.misses++
      return null
    } catch (error) {
      console.warn('[Cache] Erreur lors de la lecture:', error)

      // Basculement memoire en cas d'erreur Redis
      const memoryEntry = this.memoryCache.get(key)
      if (memoryEntry) {
        if (memoryEntry.expiresAt && memoryEntry.expiresAt < Date.now()) {
          this.memoryCache.delete(key)
          return null
        }
        this.hits++
        return memoryEntry.value as T
      }

      this.misses++
      return null
    }
  }

  // Definir une valeur dans le cache
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    const entry: CacheEntry = { value, expiresAt }
    const serialized = JSON.stringify(entry)

    // Ecrire dans les deux couches
    if (this.redis && this.redisConnected) {
      try {
        if (ttlSeconds) {
          await this.redis.setex(key, ttlSeconds, serialized)
        } else {
          await this.redis.set(key, serialized)
        }
      } catch (error) {
        console.warn('[Cache] Erreur d\'ecriture Redis:', error)
      }
    }

    this.memoryCache.set(key, entry)
  }

  // Supprimer une cle du cache
  async del(key: string): Promise<void> {
    this.memoryCache.delete(key)

    if (this.redis && this.redisConnected) {
      try {
        await this.redis.del(key)
      } catch (error) {
        console.warn('[Cache] Erreur de suppression Redis:', error)
      }
    }
  }

  // Vider tout le cache
  async clear(): Promise<void> {
    this.memoryCache.clear()

    if (this.redis && this.redisConnected) {
      try {
        await this.redis.flushdb()
      } catch (error) {
        console.warn('[Cache] Erreur de vidage Redis:', error)
      }
    }
  }

  // Obtenir les statistiques du cache
  getStats(): CacheStats {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      keys: this.memoryCache.size,
      hitRate: total > 0 ? Math.round((this.hits / total) * 10000) / 100 : 0,
    }
  }

  // Reinitialiser les statistiques
  resetStats(): void {
    this.hits = 0
    this.misses = 0
  }

  // Fermer la connexion Redis proprement
  async disconnect(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit()
      } catch {
        // Ignorer les erreurs de deconnexion
      }
      this.redis = null
      this.redisConnected = false
    }
  }
}

// Instance singleton du gestionnaire de cache
export const cache = new CacheManager()
export default cache
