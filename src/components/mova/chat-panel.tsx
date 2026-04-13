"use client"

import { useState, useEffect, useRef } from "react"
import { useAppStore } from "@/lib/mova/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Send,
  X,
  MessageCircle,
  Check,
  CheckCheck,
  Smile,
  Paperclip,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  text: string
  timestamp: Date
  sent: boolean
  read: boolean
  failed?: boolean
}

interface ChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactName: string
  contactPhone: string
  vehiclePlate?: string
  rideId?: string
  receiverId?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

const quickReplies = ["J'arrive", "5 minutes", "Je suis la", "Merci"]

// Demo messages used when no rideId/receiverId (API unavailable)
function createDemoMessages(contactName: string): ChatMessage[] {
  const now = new Date()
  return [
    { id: "demo-1", text: `Bonjour, je suis votre chauffeur ${contactName}. Je suis en route vers votre position.`, timestamp: new Date(now.getTime() - 18 * 60_000), sent: false, read: true },
    { id: "demo-2", text: "D'accord, merci. Je suis au coin de la rue.", timestamp: new Date(now.getTime() - 15 * 60_000), sent: true, read: true },
    { id: "demo-3", text: "J'arrive dans environ 5 minutes. Le trafic est normal sur cette zone.", timestamp: new Date(now.getTime() - 10 * 60_000), sent: false, read: true },
    { id: "demo-4", text: "Parfait, je vous attends ici.", timestamp: new Date(now.getTime() - 8 * 60_000), sent: true, read: true },
    { id: "demo-5", text: "Je vois votre position, j'arrive maintenant.", timestamp: new Date(now.getTime() - 3 * 60_000), sent: false, read: true },
    { id: "demo-6", text: "Je suis la, a cote du restaurant.", timestamp: new Date(now.getTime() - 1 * 60_000), sent: true, read: true },
  ]
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ChatPanel({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  vehiclePlate,
  rideId,
  receiverId,
}: ChatPanelProps) {
  const { user, token } = useAppStore()
  const userId = user?.id

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [useDemo, setUseDemo] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const hasRealChat = !!(rideId && receiverId)

  // ── Fetch messages from API when panel opens ──
  async function fetchMessages() {
    if (!rideId || !userId) return

    setIsLoadingMessages(true)
    setSendError(null)
    try {
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`
      headers["x-user-id"] = userId

      const res = await fetch(
        `/api/mova/chat?rideId=${rideId}&userId=${userId}`,
        { headers }
      )

      if (res.ok) {
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          const mapped: ChatMessage[] = json.data.map((m: Record<string, unknown>) => ({
            id: m.id as string,
            text: m.content as string,
            timestamp: new Date(m.createdAt as string),
            sent: m.senderId === userId,
            read: (m.read as boolean) ?? false,
          }))
          setMessages(mapped)
          setUseDemo(false)
        }
      } else {
        // API returned error — fall back to demo
        setUseDemo(true)
        setMessages(createDemoMessages(contactName))
      }
    } catch {
      // Network error — fall back to demo messages
      setUseDemo(true)
      setMessages(createDemoMessages(contactName))
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Fetch messages or load demo when panel opens
  useEffect(() => {
    if (open) {
      if (hasRealChat) {
        fetchMessages()
      } else {
        // No rideId/receiverId — use demo messages
        setUseDemo(true)
        setMessages(createDemoMessages(contactName))
        setIsLoadingMessages(false)
      }
    }
  }, [open, rideId, receiverId, userId, contactName, hasRealChat])

  // Auto-scroll to bottom on new messages or typing indicator
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending])

  // ── Send message via API ──
  async function sendMessage(text: string) {
    if (!text.trim()) return
    const trimmed = text.trim()

    if (!rideId || !userId || !receiverId) {
      // Demo mode — simulate send
      const sentMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        text: trimmed,
        timestamp: new Date(),
        sent: true,
        read: true,
      }
      setMessages((prev) => [...prev, sentMessage])
      setInputValue("")

      // Simulate auto-reply in demo mode
      setIsSending(true)
      setTimeout(() => {
        const replies = [
          "Bien recu, j'arrive bientot.",
          "D'accord, merci pour l'information.",
          "Parfait, a tout de suite.",
          "Je suis a 2 minutes de votre position.",
          "Oui, je vois votre position sur la carte.",
          "Merci de patienter, j'arrive.",
          "Je me gare maintenant, je suis la dans un instant.",
          "Pas de souci, je vous attends ici.",
        ]
        const reply: ChatMessage = {
          id: `msg-${Date.now()}-reply`,
          text: replies[Math.floor(Math.random() * replies.length)],
          timestamp: new Date(),
          sent: false,
          read: true,
        }
        setMessages((prev) => [...prev, reply])
        setIsSending(false)
      }, 2500)
      return
    }

    setIsSending(true)
    setSendError(null)

    // Optimistically add the message to the UI
    const optimisticMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      text: trimmed,
      timestamp: new Date(),
      sent: true,
      read: false,
    }
    setMessages((prev) => [...prev, optimisticMessage])
    setInputValue("")

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      headers["x-user-id"] = userId

      const res = await fetch("/api/mova/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          rideId,
          senderId: userId,
          receiverId,
          content: trimmed,
          type: "text",
        }),
      })

      if (res.ok) {
        const json = await res.json()
        // Replace optimistic message with server-confirmed one
        if (json.success && json.data) {
          const confirmed = json.data
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticMessage.id
                ? {
                    ...m,
                    id: confirmed.id,
                    read: confirmed.read ?? true,
                  }
                : m
            )
          )
        }
        // Mark sent message as read after a short delay
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticMessage.id ? { ...m, read: true } : m
            )
          )
        }, 1000)
      } else {
        // Mark optimistic message as failed instead of removing it
        const errorJson = await res.json().catch(() => null)
        const errorMsg = errorJson?.error || "Erreur lors de l'envoi du message"
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMessage.id ? { ...m, failed: true } : m
          )
        )
        setSendError(errorMsg)
        toast.error(errorMsg)
      }
    } catch {
      // Mark optimistic message as failed instead of removing it
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMessage.id ? { ...m, failed: true } : m
        )
      )
      setSendError("Erreur de connexion")
      toast.error("Erreur de connexion avec le serveur")
    } finally {
      setIsSending(false)
    }
  }

  // ── Retry a failed message ──
  async function retryMessage(messageId: string) {
    const failedMsg = messages.find((m) => m.id === messageId)
    if (!failedMsg) return

    // Remove failed message and resend
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    setSendError(null)
    await sendMessage(failedMsg.text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  // ── Shared Chat Body (rendered inside both Sheet and Desktop panel) ──

  const chatBody = (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 mova-glass shrink-0">
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold text-sm">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          {/* Online status dot */}
          <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-background" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{contactName}</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <MessageCircle className="size-3 shrink-0 text-emerald-500" />
            <span className="truncate">
              {vehiclePlate || contactPhone}
            </span>
            <span className="shrink-0 text-border mx-0.5" />
            <span className="shrink-0">En ligne</span>
          </div>
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full shrink-0"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* ── Messages Area ── */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-3 mova-scrollbar">
          {/* Loading skeleton while fetching from API */}
          {isLoadingMessages && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="size-6 text-emerald-500 animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">
                Chargement des messages...
              </p>
            </div>
          )}

          {/* Demo mode banner */}
          {useDemo && !isLoadingMessages && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs shrink-0">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="truncate">Mode demonstration — messages simules</span>
            </div>
          )}

          {/* Empty state */}
          {!isLoadingMessages && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Aucun message
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px] leading-relaxed">
                Envoyez un message pour commencer la conversation.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sent ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[80%] min-w-0">
                {/* Message bubble */}
                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    message.failed
                      ? "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-2xl rounded-br-md"
                      : message.sent
                        ? "bg-emerald-600 text-white rounded-2xl rounded-br-md"
                        : "bg-muted text-foreground rounded-2xl rounded-bl-md"
                  }`}
                >
                  {message.text}
                </div>

                {/* Timestamp + Read receipt / Failed indicator */}
                <div
                  className={`flex items-center gap-1 mt-1 px-1 ${
                    message.sent ? "justify-end" : "justify-start"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(message.timestamp)}
                  </span>
                  {message.failed ? (
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-400 transition-colors ml-1"
                      onClick={() => retryMessage(message.id)}
                      aria-label="Reessayer l'envoi"
                    >
                      <AlertCircle className="size-3.5" />
                    </button>
                  ) : message.sent ? (
                    message.read ? (
                      <CheckCheck className="size-3.5 text-emerald-500" />
                    ) : (
                      <Check className="size-3.5 text-muted-foreground" />
                    )
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator (demo auto-reply or real waiting) */}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* ── Error banner with retry ── */}
      {sendError && (
        <div className="px-4 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs text-center shrink-0 flex items-center justify-center gap-2">
          <AlertCircle className="size-3 shrink-0" />
          <span className="truncate">{sendError}</span>
          <button
            type="button"
            className="shrink-0 underline hover:no-underline"
            onClick={() => {
              setSendError(null)
              fetchMessages()
            }}
          >
            Reessayer
          </button>
        </div>
      )}

      {/* ── Quick Replies ── */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto shrink-0 mova-scrollbar border-t border-border/30">
        {quickReplies.map((reply) => (
          <Button
            key={reply}
            variant="outline"
            size="sm"
            disabled={isSending}
            className="rounded-full text-xs whitespace-nowrap shrink-0 h-8 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-40"
            onClick={() => sendMessage(reply)}
          >
            {reply}
          </Button>
        ))}
      </div>

      {/* ── Input Area ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50 mova-glass shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Emoji"
          onClick={() => {
            // Emoji picker to be implemented
          }}
        >
          <Smile className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Joindre un fichier"
          onClick={() => {
            // File attachment to be implemented
          }}
        >
          <Paperclip className="size-5" />
        </Button>
        <Input
          placeholder="Votre message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          className="flex-1 rounded-full border-border/50 bg-muted/50 h-9 text-sm focus-visible:ring-emerald-500/30 disabled:opacity-50"
        />
        <Button
          size="icon"
          className="h-9 w-9 rounded-full shrink-0 mova-gradient text-white shadow-md disabled:opacity-40 transition-opacity"
          onClick={() => sendMessage(inputValue)}
          disabled={!inputValue.trim() || isSending}
          aria-label="Envoyer"
        >
          {isSending ? (
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
      {/* ── Mobile: Bottom Sheet (slide-up) ── */}
      <div className="sm:hidden">
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            className="h-[85vh] rounded-t-2xl p-0 gap-0 [&>button:last-child]:hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Accessibility: visually hidden title and description */}
            <SheetTitle className="sr-only">
              Discussion avec {contactName}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Conversation pendant la course
            </SheetDescription>

            {chatBody}
          </SheetContent>
        </Sheet>
      </div>

      {/* ── Desktop: Fixed Right Panel ── */}
      {open && (
        <div className="hidden sm:flex fixed right-0 top-0 h-full w-[380px] z-50 border-l border-border/50 bg-background shadow-2xl flex-col animate-in slide-in-from-right duration-300">
          {chatBody}
        </div>
      )}
    </>
  )
}
