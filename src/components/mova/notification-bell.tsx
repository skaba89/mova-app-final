'use client'

/**
 * MOVA Notification Bell
 * ========================
 * Compact bell button with unread badge that opens the full NotificationCenter Sheet.
 * Uses the shared useNotificationCount() hook for real-time badge updates.
 */

import { useState } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'
import NotificationCenter, { useNotificationCount } from '@/components/mova/notification-center'

// ─── Component ──────────────────────────────────────────────────────────

export default function NotificationBell() {
  const { user } = useAppStore()
  const userId = user?.id
  const unreadCount = useNotificationCount()

  const [open, setOpen] = useState(false)

  // Don't render if no user
  if (!userId) return null

  return (
    <>
      {/* ── Bell button ── */}
      <Button
        variant="ghost"
        size="icon"
        className="relative rounded-full"
        onClick={() => setOpen(true)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-background animate-[notificationPulse_2s_ease-in-out_infinite]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* ── Notification Center Sheet ── */}
      <NotificationCenter open={open} onOpenChange={setOpen} />
    </>
  )
}
