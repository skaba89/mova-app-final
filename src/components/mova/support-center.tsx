'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  ArrowLeft,
  HelpCircle,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Send,
  Shield,
  CreditCard,
  MapPin,
  Car,
  Users,
  FileText,
  Zap,
  Headphones,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

interface SupportTicket {
  id: string
  userId: string
  subject: string
  description: string
  category: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  response?: string
}

// ─── Constants ──────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    question: 'Comment creer un compte MOVA ?',
    answer: 'Pour creer un compte, telechargez l\'application MOVA, entrez votre numero de telephone Guineen (+224), et suivez les etapes de verification OTP. Vous pouvez aussi utiliser le mode demo pour tester l\'application.',
    category: 'Compte',
  },
  {
    question: 'Comment reserver une course ?',
    answer: 'Ouvrez l\'application, entrez votre point de depart et destination, choisissez le type de vehicule (standard, premium, van ou moto), confirmez le tarif estime et attendez qu\'un chauffeur accepte votre course.',
    category: 'Courses',
  },
  {
    question: 'Quels moyens de paiement sont acceptes ?',
    answer: 'MOVA accepte le paiement en especes, via Mobile Money (Orange Money, MTN Mobile Money, Wave), par portefeuille MOVA, et par carte bancaire. Le paiement est effectue a la fin de la course ou lors de la reservation.',
    category: 'Paiement',
  },
  {
    question: 'Comment fonctionne le service MOVA Moto ?',
    answer: 'MOVA Moto vous connecte avec des motards verifies et assures. Commandez un moto-taxi comme une course classique. Tous nos motards portent un casque de rechange pour le passager et sont equipes d\'un gilet de securite.',
    category: 'Services',
  },
  {
    question: 'Comment annuler une course ?',
    answer: 'Vous pouvez annuler une course gratuitement tant qu\'un chauffeur ne l\'a pas encore acceptee. Apres acceptation, des frais d\'annulation de 1 000 GNF peuvent s\'appliquer. Selectionnez une raison d\'annulation pour une meilleure experience.',
    category: 'Courses',
  },
  {
    question: 'Comment utiliser un code promo ?',
    answer: 'Entrez votre code promo dans la section "Promotions" de l\'application ou directement lors de la reservation. Le code sera automatiquement applique a votre prochaine course si les conditions sont remplies.',
    category: 'Promotions',
  },
  {
    question: 'Comment fonctionne le programme de parrainage ?',
    answer: 'Partagez votre code de parrainage avec vos proches. Lorsqu\'un ami s\'inscrit avec votre code et effectue sa premiere course, vous gagnez 5 000 GNF et votre ami obtient 50% de reduction sur sa premiere course.',
    category: 'Parrainage',
  },
  {
    question: 'Le transport interurbain est-il disponible ?',
    answer: 'Oui, MOVA Interurbain propose des trajets vers Kindia, Labe, Nzerekore, Kankan, Mamou, Boke et d\'autres villes de Guinee. Choisissez entre bus partage, covoiturage ou voiture privee.',
    category: 'Services',
  },
  {
    question: 'Que faire en cas de probleme de securite ?',
    answer: 'Utilisez le bouton SOS dans l\'application pour contacter les urgences (Police 117, SAMU 115, Pompiers 118). Vous pouvez aussi signaler un incident directement depuis votre course en cours. MOVA offre un suivi GPS en temps reel et le partage de trajet avec vos contacts.',
    category: 'Securite',
  },
  {
    question: 'Comment contacter le support client ?',
    answer: 'Vous pouvez nous contacter via le formulaire ci-dessous, par email a support@mova.gn, par telephone au +224 620 00 00 00, ou directement depuis l\'application via le chat en direct. Notre equipe est disponible 24h/24, 7j/7.',
    category: 'Support',
  },
]

const TICKET_CATEGORIES = [
  { value: 'course', label: 'Probleme de course', icon: Car },
  { value: 'paiement', label: 'Probleme de paiement', icon: CreditCard },
  { value: 'compte', label: 'Probleme de compte', icon: Users },
  { value: 'securite', label: 'Incident de securite', icon: Shield },
  { value: 'technique', label: 'Bug technique', icon: Zap },
  { value: 'autre', label: 'Autre', icon: FileText },
]

// ─── Helpers ────────────────────────────────────────────────────────────

function statusLabel(status: string) {
  switch (status) {
    case 'open': return 'Ouvert'
    case 'in_progress': return 'En cours'
    case 'resolved': return 'Resolu'
    case 'closed': return 'Ferme'
    default: return status
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'open': return 'bg-amber-100 text-amber-700'
    case 'in_progress': return 'bg-emerald-100 text-emerald-700'
    case 'resolved': return 'bg-gray-100 text-gray-600'
    case 'closed': return 'bg-gray-100 text-gray-500'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function timeAgo(iso: string): string {
  const now = Date.now()
  const date = new Date(iso).getTime()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'A l\'instant'
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHr < 24) return `il y a ${diffHr}h`
  if (diffDay < 7) return `il y a ${diffDay}j`
  return formatDate(iso)
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SupportCenter() {
  const { goBack, user } = useAppStore()
  const userId = user?.id

  // Ticket list state
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketsError, setTicketsError] = useState(false)

  // Form state
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Action states
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Helper to build auth headers ──
  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const store = useAppStore.getState() as unknown as Record<string, unknown>
    const token = store.token as string | undefined
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  // ── Fetch tickets from API ──
  async function fetchTickets() {
    if (!userId) {
      setTickets([])
      return
    }

    setTicketsLoading(true)
    setTicketsError(false)

    try {
      const res = await fetch(
        `/api/mova/support?userId=${userId}`,
        { headers: authHeaders() }
      )

      if (res.ok) {
        const json = await res.json()
        const fetched: SupportTicket[] = json.data?.tickets ?? []
        setTickets(fetched)
      } else {
        setTicketsError(true)
      }
    } catch {
      setTicketsError(true)
    } finally {
      setTicketsLoading(false)
    }
  }

  // ── Fetch on mount ──
  useEffect(() => {
    queueMicrotask(() => fetchTickets())
  }, [userId])

  // ── Create ticket ──
  async function handleSubmit() {
    if (!subject || !message || !category) {
      toast.error('Veuillez remplir tous les champs')
      return
    }

    setSubmitting(true)

    try {
      if (!userId) {
        throw new Error('Utilisateur non connecte')
      }

      const res = await fetch('/api/mova/support', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          userId,
          subject,
          description: message,
          category,
          priority: 'medium',
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const created: SupportTicket = json.data
        setTickets((prev) => [created, ...prev])
        setSubject('')
        setMessage('')
        setCategory('')
        toast.success('Message envoye ! Notre equipe vous repondra sous 24h.')
      } else {
        const json = await res.json().catch(() => null)
        toast.error(json?.error ?? 'Erreur lors de l\'envoi du message')
      }
    } catch {
      toast.error('Erreur de connexion. Veuillez reessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Mark ticket as resolved ──
  async function handleResolve(ticketId: string) {
    setResolvingId(ticketId)

    try {
      const res = await fetch(
        `/api/mova/support/${ticketId}?userId=${userId}`,
        {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status: 'resolved' }),
        }
      )

      if (res.ok) {
        const json = await res.json()
        const updated: SupportTicket = json.data
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? updated : t))
        )
        toast.success('Ticket marque comme resolu')
      } else {
        const json = await res.json().catch(() => null)
        toast.error(json?.error ?? 'Erreur lors de la mise a jour')
      }
    } catch {
      toast.error('Erreur de connexion. Veuillez reessayer.')
    } finally {
      setResolvingId(null)
    }
  }

  // ── Delete ticket ──
  async function handleDelete(ticketId: string) {
    setDeletingId(ticketId)

    try {
      const res = await fetch(
        `/api/mova/support/${ticketId}?userId=${userId}`,
        {
          method: 'DELETE',
          headers: authHeaders(),
        }
      )

      if (res.ok) {
        setTickets((prev) => prev.filter((t) => t.id !== ticketId))
        toast.success('Ticket supprime')
      } else {
        const json = await res.json().catch(() => null)
        toast.error(json?.error ?? 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur de connexion. Veuillez reessayer.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 mova-glass border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Headphones className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Aide & Support</h1>
              <p className="text-xs text-muted-foreground">Nous sommes la pour vous aider</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-4 space-y-4 pb-24">
          {/* Emergency Contacts */}
          <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                <Shield className="h-4 w-4" />
                Contacts d'urgence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1 border-red-200 hover:bg-red-50"
                  onClick={() => window.open('tel:117', '_self')}
                >
                  <Shield className="h-5 w-5 text-red-500" />
                  <span className="text-xs font-medium">Police</span>
                  <span className="text-lg font-bold text-red-600">117</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1 border-red-200 hover:bg-red-50"
                  onClick={() => window.open('tel:115', '_self')}
                >
                  <Phone className="h-5 w-5 text-red-500" />
                  <span className="text-xs font-medium">SAMU</span>
                  <span className="text-lg font-bold text-red-600">115</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1 border-red-200 hover:bg-red-50"
                  onClick={() => window.open('tel:118', '_self')}
                >
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-xs font-medium">Pompiers</span>
                  <span className="text-lg font-bold text-red-600">118</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Tickets */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Vos tickets</CardTitle>
                {tickets.length > 0 && (
                  <Badge variant="secondary">
                    {tickets.length} ticket{tickets.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Loading state */}
              {ticketsLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                  <p className="text-sm text-muted-foreground">Chargement des tickets...</p>
                </div>
              )}

              {/* Error state */}
              {!ticketsLoading && ticketsError && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Impossible de charger les tickets. Veuillez reessayer.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchTickets()}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Reessayer
                  </Button>
                </div>
              )}

              {/* Ticket list */}
              {!ticketsLoading && !ticketsError && tickets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <HelpCircle className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Aucun ticket de support
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Utilisez le formulaire ci-dessous pour nous contacter.
                  </p>
                </div>
              )}

              {!ticketsLoading && tickets.length > 0 && (
                <div className="space-y-2">
                  {tickets.map((ticket) => {
                    const isResolving = resolvingId === ticket.id
                    const isDeleting = deletingId === ticket.id
                    const canResolve = ticket.status === 'open' || ticket.status === 'in_progress'

                    return (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium truncate">{ticket.subject}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {timeAgo(ticket.createdAt)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              #{ticket.id}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canResolve && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleResolve(ticket.id)}
                              disabled={isResolving}
                              aria-label="Marquer comme resolu"
                            >
                              {isResolving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Badge variant="secondary" className={statusColor(ticket.status)}>
                            {statusLabel(ticket.status)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(ticket.id)}
                            disabled={isDeleting}
                            aria-label="Supprimer le ticket"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-emerald-600" />
                Questions frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {FAQ_ITEMS.map((item, idx) => (
                  <AccordionItem key={idx} value={`faq-${idx}`}>
                    <AccordionTrigger className="text-sm text-left hover:no-underline">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground mt-0.5 shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span>{item.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground pl-7">
                      {item.answer}
                      <div className="mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {item.category}
                        </Badge>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Contact Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-600" />
                Nous contacter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Categorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <cat.icon className="h-4 w-4 text-muted-foreground" />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Sujet</Label>
                <Input
                  placeholder="Resume de votre demande"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Message</Label>
                <Textarea
                  placeholder="Decrivez votre probleme en detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 mova-gradient"
                onClick={handleSubmit}
                disabled={!subject || !message || !category || submitting}
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi en cours...
                  </div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer le message
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">Telephone</p>
                    <p className="text-sm text-muted-foreground">+224 620 00 00 00</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">support@mova.gn</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Disponibilite</p>
                    <p className="text-sm text-muted-foreground">24h/24, 7j/7</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
