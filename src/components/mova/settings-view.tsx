'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Settings,
  Bell,
  Lock,
  Globe,
  Moon,
  Shield,
  Trash2,
  HardDrive,
  Info,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Vibrate,
  MapPin,
  Eye,
} from 'lucide-react'

export default function SettingsView() {
  const { goBack, logout, locale, setLocale } = useAppStore()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showLicenses, setShowLicenses] = useState(false)

  // Load persisted settings from localStorage
  const loadSettings = () => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(localStorage.getItem('mova_settings') || '{}')
    } catch { return {} }
  }
  const persisted = typeof window !== 'undefined' ? loadSettings() : {}

  // General settings
  const [autoLocation, setAutoLocation] = useState(persisted.autoLocation ?? true)
  const [autoDetectZone, setAutoDetectZone] = useState(persisted.autoDetectZone ?? true)

  // Notification settings
  const [pushNotifications, setPushNotifications] = useState(persisted.pushNotifications ?? true)
  const [smsNotifications, setSmsNotifications] = useState(persisted.smsNotifications ?? false)
  const [emailNotifications, setEmailNotifications] = useState(persisted.emailNotifications ?? true)
  const [promoNotifications, setPromoNotifications] = useState(persisted.promoNotifications ?? true)
  const [rideUpdates, setRideUpdates] = useState(persisted.rideUpdates ?? true)

  // Privacy settings
  const [shareLocation, setShareLocation] = useState(persisted.shareLocation ?? false)
  const [showOnlineStatus, setShowOnlineStatus] = useState(persisted.showOnlineStatus ?? true)
  const [dataAnalytics, setDataAnalytics] = useState(persisted.dataAnalytics ?? true)

  // Language & Theme
  const [language, setLanguage] = useState(persisted.language ?? 'fr')
  const [darkMode, setDarkMode] = useState(persisted.darkMode ?? false)

  // Persist all settings to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('mova_settings', JSON.stringify({
        autoLocation,
        autoDetectZone,
        pushNotifications,
        smsNotifications,
        emailNotifications,
        promoNotifications,
        rideUpdates,
        shareLocation,
        showOnlineStatus,
        dataAnalytics,
        language,
        darkMode,
      }))
    } catch { /* ignore quota errors */ }
  }, [
    autoLocation, autoDetectZone,
    pushNotifications, smsNotifications, emailNotifications,
    promoNotifications, rideUpdates,
    shareLocation, showOnlineStatus, dataAnalytics,
    language, darkMode,
  ])

  // Apply dark mode to the document when it changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const handleClearCache = async () => {
    localStorage.removeItem('mova_settings')
    localStorage.removeItem('mova_token')
    localStorage.removeItem('mova_delivery_favorites')
    localStorage.removeItem('mova_merchants')
    sessionStorage.clear()
    if ('caches' in window) {
      caches.keys().then((names) => names.forEach((name) => caches.delete(name)))
    }
    toast.success('Cache efface')
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') {
      toast.error('Veuillez taper SUPPRIMER pour confirmer')
      return
    }
    const token = localStorage.getItem('mova_token')
    try {
      const res = await fetch('/api/mova/auth/account', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (res.ok) {
        setShowDeleteDialog(false)
        setDeleteConfirmText('')
        logout()
        toast.success('Compte supprime')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur reseau')
    }
  }

  const languageNames: Record<string, string> = {
    fr: 'Francais',
    pul: 'Pular',
    sus: 'Susu',
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
              <Settings className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold">Parametres</h1>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-4 space-y-4 pb-24">
          {/* General */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-600" />
                General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Localisation automatique</p>
                    <p className="text-xs text-muted-foreground">Detecter votre position</p>
                  </div>
                </div>
                <Switch
                  checked={autoLocation}
                  onCheckedChange={(checked) => {
                    setAutoLocation(checked)
                    toast.success(checked ? 'Localisation automatique activee' : 'Localisation automatique desactivee')
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Detection de zone</p>
                    <p className="text-xs text-muted-foreground">Identifier automatiquement votre zone</p>
                  </div>
                </div>
                <Switch
                  checked={autoDetectZone}
                  onCheckedChange={(checked) => {
                    setAutoDetectZone(checked)
                    toast.success(checked ? 'Detection de zone activee' : 'Detection de zone desactivee')
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Notifications push</p>
                    <p className="text-xs text-muted-foreground">Alertes sur votre telephone</p>
                  </div>
                </div>
                <Switch
                  checked={pushNotifications}
                  onCheckedChange={(checked) => setPushNotifications(checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Vibrate className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Notifications SMS</p>
                    <p className="text-xs text-muted-foreground">Alertes par SMS</p>
                  </div>
                </div>
                <Switch
                  checked={smsNotifications}
                  onCheckedChange={(checked) => setSmsNotifications(checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Notifications email</p>
                    <p className="text-xs text-muted-foreground">Mises a jour par email</p>
                  </div>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={(checked) => setEmailNotifications(checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Offres promotionnelles</p>
                    <p className="text-xs text-muted-foreground">Recevoir les offres speciales</p>
                  </div>
                </div>
                <Switch
                  checked={promoNotifications}
                  onCheckedChange={(checked) => {
                    setPromoNotifications(checked)
                    toast.success(checked ? 'Offres promotionnelles activees' : 'Offres promotionnelles desactivees')
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Mises a jour de course</p>
                    <p className="text-xs text-muted-foreground">Statut en temps reel</p>
                  </div>
                </div>
                <Switch
                  checked={rideUpdates}
                  onCheckedChange={(checked) => setRideUpdates(checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                Confidentialite
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Partager ma position</p>
                    <p className="text-xs text-muted-foreground">Avec les chauffeurs et contacts d'urgence</p>
                  </div>
                </div>
                <Switch
                  checked={shareLocation}
                  onCheckedChange={(checked) => setShareLocation(checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Statut en ligne</p>
                    <p className="text-xs text-muted-foreground">Afficher quand vous etes en ligne</p>
                  </div>
                </div>
                <Switch
                  checked={showOnlineStatus}
                  onCheckedChange={(checked) => setShowOnlineStatus(checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Analyse de donnees</p>
                    <p className="text-xs text-muted-foreground">Aider a ameliorer MOVA</p>
                  </div>
                </div>
                <Switch
                  checked={dataAnalytics}
                  onCheckedChange={(checked) => {
                    setDataAnalytics(checked)
                    toast.success(checked ? 'Analyse de donnees activee' : 'Analyse de donnees desactivee')
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-600" />
                Langue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={language} onValueChange={(val) => {
                setLanguage(val)
                setLocale(val as 'fr' | 'pul' | 'sus')
                toast.success(`Langue changee : ${languageNames[val]}`)
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Francais</SelectItem>
                  <SelectItem value="pul">Pular</SelectItem>
                  <SelectItem value="sus">Susu</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Moon className="h-4 w-4 text-amber-500" />
                Apparence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Mode sombre</p>
                    <p className="text-xs text-muted-foreground">Reduire la luminosite de l'ecran</p>
                  </div>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={(checked) => {
                    setDarkMode(checked)
                    toast.success(checked ? 'Mode sombre active' : 'Mode clair active')
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-3"
                onClick={handleClearCache}
              >
                <div className="flex items-center gap-3">
                  <HardDrive className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Effacer le cache</p>
                    <p className="text-xs text-muted-foreground">Liberer de l'espace de stockage</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Separator />
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-3 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowDeleteDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Supprimer le compte</p>
                    <p className="text-xs text-muted-foreground">Action irreversible</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-red-400" />
              </Button>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-600" />
                A propos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Version de l'application</span>
                <Badge variant="secondary">2.1.0</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm">Build</span>
                <span className="text-sm text-muted-foreground">2025.01.15</span>
              </div>
              <Separator />
              <button className="flex items-center justify-between w-full text-left"
                onClick={() => setShowTerms(true)}>
                <span className="text-sm">Conditions d&apos;utilisation</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <Separator />
              <button className="flex items-center justify-between w-full text-left"
                onClick={() => setShowPrivacy(true)}>
                <span className="text-sm">Politique de confidentialite</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <Separator />
              <button className="flex items-center justify-between w-full text-left"
                onClick={() => setShowLicenses(true)}>
                <span className="text-sm">Licences</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="pt-2 text-center">
                <p className="text-xs text-muted-foreground">
                  MOVA — Super-App Mobilite Africaine
                </p>
                <p className="text-xs text-muted-foreground">
                  Conakry, Guinee
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Terms of Service Dialog */}
          <Dialog open={showTerms} onOpenChange={setShowTerms}>
            <DialogContent className="max-w-lg max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Conditions d&apos;utilisation</DialogTitle>
                <DialogDescription>Derniere mise a jour : 15 janvier 2025</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[50vh] pr-4">
                <div className="space-y-4 text-sm leading-relaxed">
                  <div>
                    <h4 className="font-semibold text-foreground">1. Objet du service</h4>
                    <p className="text-muted-foreground mt-1">MOVA est une super-application de mobilite basee en Guinee, offrant des services de transport de personnes (VTC), livraison de colis et documents, covoiturage et portefeuille numerique. L&apos;application met en relation des utilisateurs avec des chauffeurs et livreurs independants.</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground">2. Utilisation</h4>
                    <p className="text-muted-foreground mt-1">L&apos;utilisation de MOVA est reservee aux personnes agees de 18 ans et plus. Vous vous engagez a fournir des informations exactes et a respecter les lois guineennes en vigueur. Toute utilisation frauduleuse ou abusive entrainera la suspension de votre compte.</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground">3. Responsabilite</h4>
                    <p className="text-muted-foreground mt-1">MOVA agit en tant qu&apos;intermediaire entre les utilisateurs et les prestataires de services. Nous ne garantissons pas la disponibilite permanente du service. MOVA ne saurait etre tenu responsable des dommages indirects resultant de l&apos;utilisation de la plateforme.</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground">4. Donnees personnelles</h4>
                    <p className="text-muted-foreground mt-1">Vos donnees sont traitees conformement au RGPD et a la legislation guineenne relative a la protection des donnees personnelles. Vous disposez d&apos;un droit d&apos;acces, de rectification et de suppression de vos donnees. Consultez notre Politique de confidentialite pour plus de details.</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground">5. Modifications</h4>
                    <p className="text-muted-foreground mt-1">MOVA se reserve le droit de modifier les presentes conditions a tout moment. Les utilisateurs seront informes de toute modification par notification dans l&apos;application. La poursuite de l&apos;utilisation du service apres modification vaut acceptation des nouvelles conditions.</p>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button onClick={() => setShowTerms(false)} className="mova-gradient text-white">Fermer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Privacy Policy Dialog */}
          <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
            <DialogContent className="max-w-lg max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Politique de confidentialite</DialogTitle>
                <DialogDescription>Derniere mise a jour : 15 janvier 2025</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[50vh] pr-4">
                <div className="space-y-4 text-sm leading-relaxed">
                  <div>
                    <h4 className="font-semibold text-foreground">1. Donnees collectees</h4>
                    <p className="text-muted-foreground mt-1">Nous collectons les donnees necessaires au fonctionnement du service : nom, numero de telephone, position geographique, historique de courses et paiements. Ces donnees sont collectees avec votre consentement explicite lors de l&apos;inscription.</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground">2. Utilisation</h4>
                    <p className="text-muted-foreground mt-1">Vos donnees sont utilisees pour : fournir nos services de mobilite, ameliorer l&apos;experience utilisateur, assurer la securite des trajets, detecter les fraudes, et communiquer avec vous concernant votre compte.</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground">3. Partage</h4>
                    <p className="text-muted-foreground mt-1">Vos donnees ne sont jamais vendues a des tiers. Elles peuvent etre partagees avec les chauffeurs et livreurs dans le cadre d&apos;une course en cours, avec les autorites competentes en cas de requete legale, et avec nos partenaires de paiement securise.</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground">4. Securite</h4>
                    <p className="text-muted-foreground mt-1">Nous mettons en oeuvre des mesures de securite techniques et organisationnelles conformes au RGPD et a la loi guineenne L/2019/057/CNT relative a la protection des donnees personnelles. Toutes les donnees sont chiffrees en transit et au repos.</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground">5. Vos droits</h4>
                    <p className="text-muted-foreground mt-1">Conformement au RGPD et a la legislation guineenne, vous disposez des droits suivants : acces, rectification, effacement, portabilite, limitation du traitement et opposition. Pour exercer vos droits, contactez-nous a privacy@mova.gn.</p>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button onClick={() => setShowPrivacy(false)} className="mova-gradient text-white">Fermer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Open Source Licenses Dialog */}
          <Dialog open={showLicenses} onOpenChange={setShowLicenses}>
            <DialogContent className="max-w-lg max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Licences open source</DialogTitle>
                <DialogDescription>Librairies utilisees par MOVA</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[50vh] pr-4">
                <div className="space-y-3 text-sm">
                  {[
                    { name: 'React', license: 'MIT' },
                    { name: 'Next.js', license: 'MIT' },
                    { name: 'TypeScript', license: 'Apache 2.0' },
                    { name: 'Tailwind CSS', license: 'MIT' },
                    { name: 'shadcn/ui', license: 'MIT' },
                    { name: 'Socket.IO', license: 'MIT' },
                    { name: 'Prisma', license: 'Apache 2.0' },
                    { name: 'Recharts', license: 'MIT' },
                    { name: 'Lucide React', license: 'ISC' },
                    { name: 'Framer Motion', license: 'MIT' },
                    { name: 'Zustand', license: 'MIT' },
                    { name: 'Sonner', license: 'MIT' },
                    { name: 'React Hook Form', license: 'MIT' },
                    { name: 'Zod', license: 'MIT' },
                    { name: 'class-variance-authority', license: 'Apache 2.0' },
                    { name: 'clsx', license: 'MIT' },
                    { name: 'tailwind-merge', license: 'MIT' },
                    { name: 'date-fns', license: 'MIT' },
                    { name: 'Commander.js', license: 'MIT' },
                    { name: 'Vite', license: 'MIT' },
                  ].map((lib) => (
                    <div key={lib.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="font-medium text-foreground">{lib.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{lib.license}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button onClick={() => setShowLicenses(false)} className="mova-gradient text-white">Fermer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Account Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Supprimer le compte
                </DialogTitle>
                <DialogDescription>
                  Cette action est irreversible. Toutes vos donnees, historique de courses,
                  abonnements et informations de paiement seront definitivement supprimes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 border border-red-200">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    Pour confirmer, tapez <strong>SUPPRIMER</strong> ci-dessous
                  </p>
                </div>
                <Label>Tapez SUPPRIMER pour confirmer</Label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowDeleteDialog(false)
                  setDeleteConfirmText('')
                }}>
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'SUPPRIMER'}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer definitivement
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ScrollArea>
    </div>
  )
}
