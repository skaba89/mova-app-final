'use client'

import { useState, useEffect, useRef } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  Bot,
  Send,
  Loader2,
  Sparkles,
  User,
} from 'lucide-react'

// --- Types ---

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// --- Constantes ---

const SUGGESTION_CHIPS = [
  'Tarifs des courses',
  'Statut de ma commande',
  'Aide paiement',
  'Contacter le support',
]

// --- Helpers ---

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// --- Composant principal ---

export function AssistantView() {
  const { setCurrentView } = useMovaStore()

  // Etats
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Message d'accueil au montage
  useEffect(() => {
    if (!hasLoaded) {
      setHasLoaded(true)
      setMessages([
        {
          id: generateId(),
          role: 'assistant',
          content: 'Bonjour ! Je suis votre assistant MOVA. Comment puis-je vous aider ?',
          timestamp: Date.now(),
        },
      ])
    }
  }, [hasLoaded])

  // Auto-scroll en bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Envoyer un message
  const handleSend = async (text?: string) => {
    const messageText = (text || input).trim()
    if (!messageText || isLoading) return

    // Ajouter le message de l'utilisateur
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await apiFetch('/api/mova/assistant', {
        method: 'POST',
        body: JSON.stringify({
          message: messageText,
          conversationId,
        }),
      })
      const data = await res.json()

      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: data.data?.reply || data.data?.message || 'Je n\'ai pas pu traiter votre demande. Veuillez reessayer.',
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Sauvegarder l'ID de conversation
        if (data.data?.conversationId) {
          setConversationId(data.data.conversationId)
        }
      } else {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: data.error || 'Desole, une erreur est survenue. Veuillez reessayer.',
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Erreur de connexion au serveur. Verifiez votre connexion internet et reessayez.',
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  // Touche Entree
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* En-tete gradient */}
      <header className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-lg">
        <button
          onClick={() => setCurrentView('hub')}
          className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Assistant MOVA</h1>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[11px] text-emerald-100">En ligne</span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </div>
      </header>

      {/* Zone de messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                msg.role === 'user'
                  ? 'bg-[#1e40af] text-white'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
              }`}
            >
              {msg.role === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Bulle */}
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[#1e40af] text-white rounded-br-md'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
              <p
                className={`text-[10px] text-gray-400 mt-1 ${
                  msg.role === 'user' ? 'text-right mr-1' : 'ml-1'
                }`}
              >
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {/* Indicateur de saisie AI */}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions chips (affichees uniquement si peu de messages et pas en chargement) */}
      {messages.length <= 1 && !isLoading && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                className="px-3.5 py-2 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barre de saisie */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ecrivez votre message..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:opacity-50 placeholder:text-gray-400"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40 disabled:active:scale-100 shadow-md"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
