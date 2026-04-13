'use client'

import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  variant?: 'default' | 'subtle' | 'gradient'
}

/**
 * Reusable empty state component with icon illustration, message, and optional CTA.
 * Used across passenger, driver, delivery, and admin views.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <div className="mova-animate-fadeInUp flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon illustration */}
      <div
        className={`relative mb-5 ${
          variant === 'gradient'
            ? 'w-24 h-24 rounded-3xl mova-gradient flex items-center justify-center shadow-lg shadow-emerald-500/20'
            : variant === 'subtle'
              ? 'w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center'
              : 'w-20 h-20 rounded-full bg-muted flex items-center justify-center'
        }`}
      >
        <Icon
          className={
            variant === 'gradient'
              ? 'w-10 h-10 text-white'
              : 'w-9 h-9 text-muted-foreground/60'
          }
        />
        {/* Decorative rings */}
        {variant === 'gradient' && (
          <>
            <div className="absolute -inset-2 rounded-[1.75rem] border-2 border-emerald-200 dark:border-emerald-800/50 animate-pulse" />
            <div className="absolute -inset-4 rounded-[2.25rem] border border-emerald-100 dark:border-emerald-900/30" />
          </>
        )}
      </div>

      {/* Title */}
      <p className="text-base font-semibold text-foreground mb-1.5">{title}</p>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          {description}
        </p>
      )}

      {/* CTA button */}
      {actionLabel && onAction && (
        <div className="mova-animate-fadeInUp mt-5" style={{ animationDelay: '150ms' }}>
          <Button
            onClick={onAction}
            className="mova-gradient text-white font-semibold shadow-md shadow-emerald-500/20 hover:opacity-90 transition-opacity"
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
