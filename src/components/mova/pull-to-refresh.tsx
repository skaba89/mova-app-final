'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  isRefreshing: boolean
  onRefresh: () => void
  children: React.ReactNode
  className?: string
}

/**
 * A subtle refresh indicator that appears at the top of scrollable content.
 * Shows "Mise à jour..." text while data is being fetched.
 * Auto-disappears after refresh completes.
 */
export function PullToRefresh({
  isRefreshing,
  onRefresh,
  children,
  className,
}: PullToRefreshProps) {
  return (
    <div className={`relative ${className ?? ''}`}>
      {/* Refresh indicator */}
      {isRefreshing && (
        <div className="mova-animate-slideDown flex items-center justify-center gap-2 overflow-hidden h-[44px]">
          <RefreshCw className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Mise à jour...
          </span>
        </div>
      )}

      {children}
    </div>
  )
}

/**
 * Hook to add pull-to-refresh behavior to a scrollable container.
 * Returns a ref to attach to the scroll container and refresh handlers.
 */
export function usePullToRefresh(onRefresh: () => void, { threshold = 80 } = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLElement
    if (target.scrollTop <= 0) {
      startY.current = e.touches[0].clientY
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const target = e.currentTarget as HTMLElement
      const currentY = e.touches[0].clientY
      const diff = currentY - startY.current

      if (target.scrollTop <= 0 && diff > threshold && !isRefreshing) {
        setIsRefreshing(true)
        onRefresh()
        // Auto-hide after reasonable timeout
        setTimeout(() => setIsRefreshing(false), 2000)
      }
    },
    [isRefreshing, onRefresh, threshold]
  )

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return
    setIsRefreshing(true)
    onRefresh()
    setTimeout(() => setIsRefreshing(false), 2000)
  }, [isRefreshing, onRefresh])

  return {
    isRefreshing,
    setIsRefreshing,
    handleRefresh,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
    },
  }
}
