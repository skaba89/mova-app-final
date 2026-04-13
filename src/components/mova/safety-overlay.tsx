'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  ShieldAlert,
  Phone,
  AlertTriangle,
  Share2,
  MapPin,
  CheckCircle2,
  CircleDot,
  Lock,
  Eye,
  Star,
  MessageSquare,
  FileText,
  HeartPulse,
  CircleHelp,
  Route,
  PhoneCall,
  MessageCircle,
  UserPlus,
  Clock,
  Users,
  ToggleLeft,
  Shield,
  ShieldCheck,
  FileWarning,
  Contact2,
  Car,
  DollarSign,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Shared state (allows programmatic open/close from any component)
// ---------------------------------------------------------------------------
const safetyState = {
  open: false,
  listeners: new Set<() => void>(),
  setOpen(v: boolean) {
    safetyState.open = v
    safetyState.listeners.forEach((fn) => fn())
  },
}

/** Hook to open / close the safety overlay programmatically from any view. */
export function useSafetyOverlay() {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const fn = () => forceRender((n) => n + 1)
    safetyState.listeners.add(fn)
    return () => {
      safetyState.listeners.delete(fn)
    }
  }, [])

  const isOpen = safetyState.open

  const open = useCallback(() => {
    safetyState.setOpen(true)
  }, [])

  const close = useCallback(() => {
    safetyState.setOpen(false)
  }, [])

  const toggle = useCallback(() => {
    safetyState.setOpen(!safetyState.open)
  }, [])

  return { isOpen, open, close, toggle }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EmergencyContact {
  id: string
  name: string
  phone: string
}

interface IncidentReport {
  type: string
  severity: string
  description: string
  role: string
}

// ---------------------------------------------------------------------------
// SOS Button (always visible, floating)
// ---------------------------------------------------------------------------
function SosButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-1 cursor-pointer"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Ouvrir le panneau de securite"
    >
      {/* Pulsing rings behind the button */}
      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.span
          className="absolute h-16 w-16 rounded-full bg-red-500/30"
          animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.span
          className="absolute h-14 w-14 rounded-full bg-red-500/25"
          animate={{ scale: [1, 1.45], opacity: [0.4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
        />
      </span>

      {/* Main circle */}
      <motion.div
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-600/40"
        animate={{ boxShadow: ['0 0 0 0 rgba(220,38,38,0.5)', '0 0 0 12px rgba(220,38,38,0)'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      >
        <ShieldAlert className="h-7 w-7 text-white" />
      </motion.div>

      {/* Label */}
      <span className="font-bold text-xs text-red-600 tracking-wide">SOS</span>
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// Section 1 - Emergency Actions
// ---------------------------------------------------------------------------
function EmergencyActions({ onReport }: { onReport: () => void }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-red-600">
        <AlertTriangle className="h-4 w-4" />
        Actions d&apos;urgence
      </h3>

      <div className="space-y-2">
        <Button
          variant="destructive"
          className="w-full justify-start gap-3 bg-red-600 hover:bg-red-700 text-white"
          onClick={() => window.open('tel:117', '_self')}
        >
          <Phone className="h-4 w-4" />
          Appeler les secours (Police - 117)
        </Button>

        <Button
          variant="destructive"
          className="w-full justify-start gap-3 bg-red-600 hover:bg-red-700 text-white"
          onClick={onReport}
        >
          <AlertTriangle className="h-4 w-4" />
          Signaler un incident
        </Button>

        <Button
          variant="destructive"
          className="w-full justify-start gap-3 bg-red-600 hover:bg-red-700 text-white"
          onClick={() => {
            if (navigator.share && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  navigator.share({
                    title: 'MOVA — Urgence',
                    text: `Urgence MOVA ! Ma position: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
                  })
                },
                () => {
                  toast.success('Position partagee avec vos contacts d\'urgence')
                }
              )
            } else {
              toast.success('Position partagee avec vos contacts d\'urgence')
            }
          }}
        >
          <Share2 className="h-4 w-4" />
          Partager ma position
        </Button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 2 - Trip Sharing
// ---------------------------------------------------------------------------
function TripSharing({
  liveSharing,
  setLiveSharing,
  contacts,
  setContacts,
}: {
  liveSharing: boolean
  setLiveSharing: (v: boolean) => void
  contacts: EmergencyContact[]
  setContacts: (v: EmergencyContact[]) => void
}) {
  const [addContactOpen, setAddContactOpen] = useState(false)

  const removeContact = (id: string) => {
    setContacts(contacts.filter((c) => c.id !== id))
    toast('Contact d\'urgence supprime')
  }

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Share2 className="h-4 w-4 text-emerald-600" />
        Partage de trajet
      </h3>

      {/* Toggle live sharing */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-3 mova-card-hover">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium">Partager le trajet en direct</span>
        </div>
        <Switch
          checked={liveSharing}
          onCheckedChange={setLiveSharing}
          className="data-[state=checked]:bg-emerald-600"
        />
      </div>

      {/* Contact list */}
      {contacts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Partager avec :
          </p>
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between rounded-lg border bg-card p-3 mova-card-hover"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Contact2 className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {contact.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  onClick={() => window.open(`tel:${contact.phone.replace(/\s/g, '')}`, '_self')}
                >
                  <PhoneCall className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  onClick={() => window.open(`sms:${contact.phone.replace(/\s/g, '')}`, '_self')}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => removeContact(contact.id)}
                >
                  <ToggleLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        className="w-full justify-center gap-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        onClick={() => setAddContactOpen(true)}
      >
        <UserPlus className="h-4 w-4" />
        Ajouter un contact d&apos;urgence
      </Button>

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        onSave={(contact) => {
          setContacts([...contacts, contact])
          toast.success(`${contact.name} ajoute aux contacts d'urgence`)
          setAddContactOpen(false)
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Add Contact Dialog
// ---------------------------------------------------------------------------
function AddContactDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (contact: EmergencyContact) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const handleSave = () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('Veuillez remplir tous les champs')
      return
    }
    onSave({
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim(),
    })
    setName('')
    setPhone('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mova-glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            Ajouter un contact d&apos;urgence
          </DialogTitle>
          <DialogDescription>
            Ce contact sera informe en cas d&apos;urgence.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Nom complet</Label>
            <Input
              id="contact-name"
              placeholder="Ex: Mamadou Diallo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Numero de telephone</Label>
            <Input
              id="contact-phone"
              placeholder="Ex: +224 661 00 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSave}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Section 3 - Live Tracking
// ---------------------------------------------------------------------------
function LiveTracking({
  isSharing,
  stopSharing,
}: {
  isSharing: boolean
  stopSharing: () => void
}) {
  const [lastUpdate] = useState(12)
  const [informedCount] = useState(2)

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-4 w-4 text-emerald-600" />
        Suivi en direct
      </h3>

      {isSharing ? (
        <div className="space-y-3">
          {/* Status badge */}
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <motion.div
              className="h-2.5 w-2.5 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-sm font-medium text-emerald-800">
              Votre position est partagee en temps reel
            </span>
          </div>

          {/* Map placeholder */}
          <div className="relative flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 overflow-hidden">
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#10b981" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* Location pin */}
            <div className="flex flex-col items-center gap-2 relative z-10">
              <motion.div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 shadow-lg shadow-emerald-600/30"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <MapPin className="h-5 w-5 text-white" />
              </motion.div>
              <span className="text-xs font-medium text-emerald-700">
                Position actuelle
              </span>
            </div>

            {/* Simulated road lines */}
            <div className="absolute bottom-4 left-4 right-4 h-px bg-emerald-300/40" />
            <div className="absolute top-6 left-8 bottom-8 w-px bg-emerald-300/30" />
          </div>

          {/* Tracking details */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Derniere mise a jour
                </p>
                <p className="text-xs font-medium">
                  il y a {lastUpdate} secondes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Personnes informees
                </p>
                <p className="text-xs font-medium">{informedCount}</p>
              </div>
            </div>
          </div>

          {/* Stop sharing */}
          <div className="flex items-center justify-between rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              <ToggleLeft className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-600">
                Arreter le partage
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={stopSharing}
            >
              Arreter
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted bg-muted/30 p-6 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Le suivi n&apos;est pas actif
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Activez le partage de trajet pour commencer le suivi
          </p>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 4 - Safety Verification
// ---------------------------------------------------------------------------
function SafetyVerification() {
  const verificationCode = '4-7-2-1'

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Lock className="h-4 w-4 text-emerald-600" />
        Verification de securite
      </h3>

      <Card className="mova-card-hover p-4 border-emerald-200 bg-emerald-50/50">
        <div className="space-y-3">
          {/* Verification code display */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Code de verification
            </p>
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-white border-2 border-emerald-300 px-4 py-2.5 shadow-sm">
              {verificationCode.split('-').map((digit, i) => (
                <span key={i} className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-emerald-700 tabular-nums">
                    {digit}
                  </span>
                  {i < 3 && (
                    <span className="text-emerald-400 text-xs mt-0.5">-</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Ce code est verifie au debut de chaque course
          </p>

          <Separator className="bg-emerald-200/50" />

          <div className="flex items-start gap-2 rounded-lg bg-white/80 p-2.5">
            <Shield className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Verrouillage automatique a 60 km/h en zone urbaine
            </p>
          </div>
        </div>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 5 - Safety Features List
// ---------------------------------------------------------------------------
function SafetyFeaturesList() {
  const features = [
    {
      label: 'Verification conducteur',
      description: 'Controle des documents',
      active: true,
      icon: FileText,
    },
    {
      label: 'Partage de trajet en direct',
      description: 'Suivi GPS en temps reel',
      active: true,
      icon: MapPin,
    },
    {
      label: 'Contacts d\'urgence',
      description: 'Jusqu\'a 5 contacts',
      active: true,
      icon: Contact2,
    },
    {
      label: 'Bouton SOS',
      description: 'Acces rapide aux secours',
      active: true,
      icon: ShieldAlert,
    },
    {
      label: 'Code de verification passager',
      description: 'Code unique par course',
      active: true,
      icon: Lock,
    },
    {
      label: 'Masquage numero de telephone',
      description: 'Protection de vos donnees',
      active: true,
      icon: Eye,
    },
    {
      label: 'Evaluation apres chaque course',
      description: 'Notez votre experience',
      active: true,
      icon: Star,
    },
    {
      label: 'Signalement incidents',
      description: 'Signalez tout incident',
      active: true,
      icon: AlertTriangle,
    },
    {
      label: 'Numero d\'urgence integre',
      description: 'Police, SAMU, Pompiers',
      active: true,
      icon: Phone,
    },
    {
      label: 'Route securisee',
      description: 'Evitement zones dangereuses',
      active: false,
      icon: Route,
    },
  ]

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        Fonctionnalites de securite
      </h3>

      <div className="space-y-1.5 max-h-72 overflow-y-auto mova-scrollbar pr-1">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <div
              key={feature.label}
              className={`flex items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                feature.active
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-muted bg-muted/20 opacity-70'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  feature.active ? 'bg-emerald-100' : 'bg-muted'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    feature.active ? 'text-emerald-700' : 'text-muted-foreground'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {feature.label}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {feature.description}
                </p>
              </div>
              {feature.active ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  Bientot
                </Badge>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 6 - Incident Report Dialog
// ---------------------------------------------------------------------------
function IncidentReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [report, setReport] = useState<IncidentReport>({
    type: '',
    severity: '',
    description: '',
    role: '',
  })

  const resetForm = () => {
    setReport({ type: '', severity: '', description: '', role: '' })
  }

  const handleSubmit = () => {
    if (!report.type || !report.severity || !report.role) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    toast.success(
      'Signalement envoye. Notre equipe vous contactera dans l\'heure.',
      { duration: 5000 }
    )
    resetForm()
    onOpenChange(false)
  }

  const handleSupport = () => {
    toast.success('Demande de support envoyee. Un agent vous contactera.')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="mova-glass max-h-[85vh] overflow-y-auto mova-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-red-500" />
            Signaler un incident
          </DialogTitle>
          <DialogDescription>
            Decrivez la situation afin que nous puissions vous aider rapidement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Type d'incident */}
          <div className="space-y-2">
            <Label htmlFor="incident-type" className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Type d&apos;incident
            </Label>
            <Select
              value={report.type}
              onValueChange={(v) => setReport({ ...report, type: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selectionnez le type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accident">
                  <CarIcon /> Accident
                </SelectItem>
                <SelectItem value="comportement">
                  <UsersIcon /> Comportement inapproprie
                </SelectItem>
                <SelectItem value="fraude">
                  <DollarIcon /> Fraude
                </SelectItem>
                <SelectItem value="urgence">
                  <HeartPulse className="h-4 w-4" /> Urgence medicale
                </SelectItem>
                <SelectItem value="autre">
                  <CircleHelp className="h-4 w-4" /> Autre
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Severite */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Severite
            </Label>
            <RadioGroup
              value={report.severity}
              onValueChange={(v) => setReport({ ...report, severity: v })}
              className="grid grid-cols-2 gap-2"
            >
              {[
                { value: 'faible', label: 'Faible', color: 'text-amber-600' },
                { value: 'moyen', label: 'Moyen', color: 'text-orange-600' },
                { value: 'eleve', label: 'Eleve', color: 'text-red-500' },
                { value: 'critique', label: 'Critique', color: 'text-red-700' },
              ].map((item) => (
                <Label
                  key={item.value}
                  htmlFor={`severity-${item.value}`}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${
                    report.severity === item.value
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : ''
                  }`}
                >
                  <RadioGroupItem value={item.value} id={`severity-${item.value}`} />
                  <span className={`text-sm font-medium ${item.color}`}>
                    {item.label}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="incident-desc" className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Description
            </Label>
            <Textarea
              id="incident-desc"
              placeholder="Decrivez l'incident en detail..."
              value={report.description}
              onChange={(e) => setReport({ ...report, description: e.target.value })}
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CircleDot className="h-3.5 w-3.5" />
              Vous etes
            </Label>
            <RadioGroup
              value={report.role}
              onValueChange={(v) => setReport({ ...report, role: v })}
              className="grid grid-cols-3 gap-2"
            >
              {[
                { value: 'passager', label: 'Passager' },
                { value: 'conducteur', label: 'Conducteur' },
                { value: 'temoin', label: 'Temoin' },
              ].map((item) => (
                <Label
                  key={item.value}
                  htmlFor={`role-${item.value}`}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${
                    report.role === item.value
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : ''
                  }`}
                >
                  <RadioGroupItem value={item.value} id={`role-${item.value}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col pt-2">
          <Button
            variant="destructive"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={handleSubmit}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Envoyer le signalement
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleSupport}
          >
            <Phone className="h-4 w-4 mr-2" />
            Contacter le support
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Tiny icon stubs for Select items (Lucide doesn't allow fragments inside)
// We inline the actual Lucide icons directly in the select items above.
// These are helper components to avoid the JSX syntax issues.
// ---------------------------------------------------------------------------
function CarIcon() {
  return (
    <span className="inline-flex items-center">
      <Car className="h-4 w-4 mr-1" />
    </span>
  )
}
function UsersIcon() {
  return (
    <span className="inline-flex items-center">
      <Users className="h-4 w-4 mr-1" />
    </span>
  )
}
function DollarIcon() {
  return (
    <span className="inline-flex items-center">
      <DollarSign className="h-4 w-4 mr-1" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main SafetyOverlay component
// ---------------------------------------------------------------------------
export function SafetyOverlay() {
  const { open } = useSafetyOverlay()

  // Local state for contacts and sharing
  const [liveSharing, setLiveSharing] = useState(true)
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    {
      id: 'c1',
      name: 'Mamadou',
      phone: '+224 661 00 01 00',
    },
    {
      id: 'c2',
      name: 'Fatou',
      phone: '+224 661 00 02 00',
    },
  ])
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false)

  const handleStopSharing = useCallback(() => {
    setLiveSharing(false)
    toast.success('Partage de position arreter')
  }, [])

  return (
    <>
      {/* Floating SOS button - always visible */}
      <SosButton onClick={() => safetyState.setOpen(true)} />

      {/* Safety Sheet */}
      <Sheet open={safetyState.open} onOpenChange={(v) => safetyState.setOpen(v)}>
        <SheetContent side="bottom" className="mova-glass rounded-t-2xl max-h-[90vh]">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <ShieldAlert className="h-4 w-4 text-emerald-700" />
              </div>
              Centre de Securite
            </SheetTitle>
            <SheetDescription>
              Gerez votre securite et celle de vos proches
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto mova-scrollbar px-4 pb-8 space-y-5 -mt-1">
            {/* Section 1: Emergency Actions */}
            <EmergencyActions onReport={() => setIncidentDialogOpen(true)} />

            <Separator />

            {/* Section 2: Trip Sharing */}
            <TripSharing
              liveSharing={liveSharing}
              setLiveSharing={setLiveSharing}
              contacts={contacts}
              setContacts={setContacts}
            />

            <Separator />

            {/* Section 3: Live Tracking */}
            <LiveTracking
              isSharing={liveSharing}
              stopSharing={handleStopSharing}
            />

            <Separator />

            {/* Section 4: Safety Verification */}
            <SafetyVerification />

            <Separator />

            {/* Section 5: Safety Features */}
            <SafetyFeaturesList />
          </div>
        </SheetContent>
      </Sheet>

      {/* Incident Report Dialog */}
      <IncidentReportDialog
        open={incidentDialogOpen}
        onOpenChange={setIncidentDialogOpen}
      />
    </>
  )
}
