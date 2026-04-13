'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  MessageCircle,
  Send,
  X,
  Sparkles,
  Loader2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  text: string
  timestamp: Date
  isUser: boolean
}

interface AssistantPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Quick Action Chips ────────────────────────────────────────────────────────

const quickActions = [
  { label: 'Tarifs', message: 'Quels sont les tarifs des courses MOVA ?' },
  { label: 'Services', message: 'Quels sont les services disponibles sur MOVA ?' },
  { label: 'Paiement', message: 'Comment puis-je payer ma course sur MOVA ?' },
  { label: 'Securite', message: 'Quelles sont les fonctionnalites de securite MOVA ?' },
  { label: 'Parrainage', message: 'Comment fonctionne le programme de parrainage MOVA ?' },
  { label: 'Mon compte', message: 'Comment fonctionne le programme fidelite MOVA ?' },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AssistantPanel({
  open,
  onOpenChange,
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom on new messages or loading state
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // ── Send message to API ──

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        text: trimmed,
        timestamp: new Date(),
        isUser: true,
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue('')
      setIsLoading(true)

      // Abort any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch('/api/mova/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
          signal: abortControllerRef.current.signal,
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Erreur de communication')
        }

        const botMessage: ChatMessage = {
          id: `msg-${Date.now()}-bot`,
          text: data.data.response,
          timestamp: new Date(),
          isUser: false,
        }

        setMessages((prev) => [...prev, botMessage])

        // If panel is closed, increment unread count
        if (!open) {
          setUnreadCount((prev) => prev + 1)
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return

        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}-error`,
          text: 'Desole, une erreur est survenue. Veuillez reessayer.',
          timestamp: new Date(),
          isUser: false,
        }
        setMessages((prev) => [...prev, errorMessage])
        toast.error('Erreur de connexion avec MOVA Assistant')
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, open]
  )

  // ── Clear conversation ──

  const clearConversation = useCallback(async () => {
    setMessages([])
    setUnreadCount(0)
    abortControllerRef.current?.abort()

    try {
      await fetch('/api/mova/assistant', { method: 'DELETE' })
    } catch {
      // Silently fail - local state is already cleared
    }

    toast.success('Conversation effacee')
  }, [])

  // ── Keyboard handler ──

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  // ── Handle quick action ──

  const handleQuickAction = useCallback(
    (message: string) => {
      sendMessage(message)
    },
    [sendMessage]
  )

  // ── Reset unread when opening panel ──

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setUnreadCount(0)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  // ── MOVA Logo SVG ──

  const movaLogo = (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
      <path
        d="M6 22L16 6L26 22H6Z"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <circle cx="16" cy="20" r="3" fill="currentColor" fillOpacity="0.7" />
    </svg>
  )

  // ── Shared Panel Body ──

  const panelBody = (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 mova-glass shrink-0">
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="mova-gradient text-white font-bold text-sm">
              {movaLogo}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-amber-500 shrink-0" />
            MOVA Assistant
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            Votre assistant intelligent
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
          onClick={clearConversation}
          aria-label="Effacer la conversation"
          title="Effacer"
        >
          <Trash2 className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full shrink-0"
          onClick={() => handleOpenChange(false)}
          aria-label="Fermer"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* ── Messages Area ── */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-3 mova-scrollbar">
          {/* Welcome message when no messages */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center py-8"
            >
              <div className="w-14 h-14 rounded-2xl mova-gradient flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                {movaLogo}
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-1">
                Bienvenue sur MOVA Assistant
              </h4>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                Posez-moi vos questions sur les services, tarifs, paiements ou securite MOVA.
              </p>
            </motion.div>
          )}

          {/* Message list */}
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[85%] min-w-0">
                {/* Bot avatar for bot messages */}
                {!message.isUser && index > 0 && messages[index - 1]?.isUser && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-md mova-gradient flex items-center justify-center">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 32 32"
                        fill="none"
                      >
                        <path
                          d="M6 22L16 6L26 22H6Z"
                          fill="white"
                          fillOpacity="0.95"
                        />
                      </svg>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      MOVA Assistant
                    </span>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    message.isUser
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md'
                      : 'bg-muted text-foreground rounded-2xl rounded-bl-md'
                  }`}
                >
                  {message.text}
                </div>

                {/* Timestamp */}
                <div
                  className={`flex items-center gap-1 mt-1 px-1 ${
                    message.isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground">
                    {message.timestamp.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-md mova-gradient flex items-center justify-center">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 32 32"
                      fill="none"
                    >
                      <path
                        d="M6 22L16 6L26 22H6Z"
                        fill="white"
                        fillOpacity="0.95"
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    MOVA Assistant
                  </span>
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* ── Quick Action Chips ── */}
      {messages.length === 0 && !isLoading && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto shrink-0 mova-scrollbar border-t border-border/30">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="rounded-full text-xs whitespace-nowrap shrink-0 h-8 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              onClick={() => handleQuickAction(action.message)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* ── Input Area ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50 mova-glass shrink-0">
        <Input
          ref={inputRef}
          placeholder="Posez votre question..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1 rounded-full border-border/50 bg-muted/50 h-9 text-sm focus-visible:ring-emerald-500/30 disabled:opacity-50"
        />
        <Button
          size="icon"
          className="h-9 w-9 rounded-full shrink-0 mova-gradient text-white shadow-md disabled:opacity-40 transition-opacity"
          onClick={() => sendMessage(inputValue)}
          disabled={!inputValue.trim() || isLoading}
          aria-label="Envoyer"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Floating Button (always visible) ── */}
      <motion.button
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[60] w-14 h-14 rounded-full mova-gradient text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:shadow-xl hover:shadow-emerald-500/40 transition-shadow"
        onClick={() => handleOpenChange(!open)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Ouvrir MOVA Assistant"
      >
        {/* Pulse animation ring */}
        {!open && (
          <span className="absolute inset-0 rounded-full mova-gradient animate-ping opacity-20" />
        )}

        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="size-6" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <MessageCircle className="size-6" />

              {/* Unread badge */}
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold px-1 border-2 border-background"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Mobile: Bottom Sheet (slide-up) ── */}
      <div className="sm:hidden">
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent
            side="bottom"
            className="h-[85vh] rounded-t-2xl p-0 gap-0 [&>button:last-child]:hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Accessibility */}
            <SheetTitle className="sr-only">MOVA Assistant</SheetTitle>
            <SheetDescription className="sr-only">
              Assistant intelligent MOVA pour toutes vos questions
            </SheetDescription>

            {panelBody}
          </SheetContent>
        </Sheet>
      </div>

      {/* ── Desktop: Fixed Right Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="hidden sm:flex fixed right-6 bottom-24 w-[400px] h-[540px] z-[55] rounded-2xl border border-border/50 bg-background shadow-2xl overflow-hidden flex-col"
          >
            {panelBody}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
