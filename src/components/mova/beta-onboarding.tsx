'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Rocket,
  User,
  Shield,
  Car,
  Bike,
  Plane,
  GraduationCap,
  Gift,
  Package,
  Users,
  Star,
  Zap,
  Globe,
} from 'lucide-react'

const FEATURE_LIST = [
  { icon: Car, label: 'VTC et moto-taxi', color: 'text-emerald-500' },
  { icon: Bike, label: 'Moto-taxi rapide', color: 'text-amber-500' },
  { icon: Plane, label: 'Transport interurbain', color: 'text-emerald-500' },
  { icon: GraduationCap, label: 'Transport scolaire', color: 'text-amber-500' },
  { icon: Package, label: 'Livraison colis', color: 'text-emerald-500' },
  { icon: Gift, label: 'Promotions exclusives', color: 'text-amber-500' },
  { icon: Users, label: 'Parrainage', color: 'text-emerald-500' },
  { icon: Star, label: 'Programme fidelite', color: 'text-amber-500' },
]

export default function BetaOnboarding() {
  const { setView } = useAppStore()
  const [step, setStep] = useState(1)
  const [betaCode, setBetaCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [zone, setZone] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const handleCodeSubmit = async () => {
    if (!betaCode.trim()) {
      toast.error('Veuillez entrer votre code beta')
      return
    }
    setIsValidating(true)
    try {
      const res = await fetch('/api/mova/beta/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: betaCode.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Code beta valide ! Bienvenue dans le programme.')
        setStep(3)
      } else {
        toast.error(data.error || 'Code beta invalide')
      }
    } catch {
      toast.error('Erreur de connexion. Veuillez reessayer.')
    } finally {
      setIsValidating(false)
    }
  }

  /** Validation du numéro de téléphone guinéen */
  const validatePhone = (phoneNumber: string): boolean => {
    const cleaned = phoneNumber.replace(/\s/g, '')
    // Le numéro doit commencer par +224 ou 224 et avoir entre 10 et 14 caractères
    const guineanPattern = /^(\+224|224)\d{8,12}$/
    return guineanPattern.test(cleaned)
  }

  const handleProfileSubmit = async () => {
    if (!name || !phone) {
      toast.error('Veuillez remplir votre nom et telephone')
      return
    }
    // Validation du numéro de téléphone
    if (!validatePhone(phone)) {
      toast.error('Numero de telephone invalide. Il doit commencer par +224 ou 224 (10-14 caracteres).')
      return
    }
    if (!acceptTerms) {
      toast.error("Veuillez accepter les conditions d'utilisation")
      return
    }

    // Sauvegarder le profil utilisateur localement
    try {
      localStorage.setItem('mova_user_profile', JSON.stringify({
        name,
        phone,
        zone: zone || undefined,
        betaCodeValidated: true,
        createdAt: new Date().toISOString(),
      }))
    } catch { /* ignore */ }

    // Appeler l'API d'inscription en arrière-plan (non bloquant)
    try {
      await fetch('/api/mova/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, zone, locale: 'fr' }),
      })
    } catch {
      // Ne pas bloquer l'onboarding si l'inscription échoue
    }

    toast.success('Bienvenue sur MOVA ! Votre compte est pret.')
    setView('passenger')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 mova-glass border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => step > 1 ? setStep(step - 1) : setView('landing')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Programme Beta</h1>
              <p className="text-xs text-muted-foreground">
                Etape {step} sur 3
              </p>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="p-4 pb-24">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center py-6 space-y-4">
                <div className="w-24 h-24 mx-auto rounded-3xl mova-gradient flex items-center justify-center">
                  <Rocket className="h-12 w-12 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Bienvenue sur MOVA</h2>
                  <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                    La super-app de mobilite africaine qui simplifie vos deplacements en Guinee.
                  </p>
                </div>
              </div>

              {/* Features Grid */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-center">Decouvrez nos services</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {FEATURE_LIST.map((feature, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-3 rounded-xl bg-muted/50"
                      >
                        <feature.icon className={`h-4 w-4 ${feature.color}`} />
                        <span className="text-sm">{feature.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Key Benefits */}
              <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-center">Pourquoi MOVA ?</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm">Tarifs transparents et competitifs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm">Chauffeurs verifies et assures</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm">Paiement Mobile Money et especes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm">Support disponible 24h/24, 7j/7</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold mova-gradient"
                onClick={() => setStep(2)}
              >
                Continuer
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Beta Code */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center py-6 space-y-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Shield className="h-10 w-10 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Code d'acces beta</h2>
                  <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                    Entrez votre code d'invitation au programme beta MOVA
                  </p>
                </div>
              </div>

              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Code beta</Label>
                    <Input
                      placeholder="Ex: MOVA-BETA"
                      value={betaCode}
                      onChange={(e) => setBetaCode(e.target.value.toUpperCase())}
                      className="text-center text-xl tracking-widest font-mono h-14 uppercase"
                      onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Le code beta est fourni par l'equipe MOVA ou un parrain
                    </p>
                  </div>

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold mova-gradient"
                    onClick={handleCodeSubmit}
                    disabled={!betaCode.trim() || isValidating}
                  >
                    <Shield className="h-5 w-5 mr-2" />
                    {isValidating ? 'Verification...' : 'Verifier le code'}
                  </Button>
                </CardContent>
              </Card>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Vous n'avez pas de code ?
                </p>
                <Button
                  variant="link"
                  className="text-emerald-600"
                  onClick={() => toast.info('Contactez support@mova.gn pour obtenir un code beta')}
                >
                  Demander un code
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Profile Setup */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center py-4 space-y-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <User className="h-10 w-10 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Votre profil</h2>
                  <p className="text-muted-foreground mt-2">
                    Derniere etape ! Creez votre profil pour commencer.
                  </p>
                </div>
              </div>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nom complet *</Label>
                    <Input
                      placeholder="Ex: Abdoulaye Camara"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Telephone *</Label>
                    <Input
                      type="tel"
                      placeholder="+224 6xx xx xx xx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Zone (facultatif)</Label>
                    <Input
                      placeholder="Ex: Kaloum, Ratoma, Dixinn..."
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                    />
                  </div>

                  <Separator />

                  {/* Terms */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Checkbox
                      id="terms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                      J'accepte les conditions d'utilisation et la politique de confidentialite de MOVA.
                      Je comprends que mes donnees seront traitees conformement a la legislation guineenne.
                    </Label>
                  </div>

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold mova-gradient"
                    onClick={handleProfileSubmit}
                    disabled={!name || !phone || !acceptTerms}
                  >
                    <Rocket className="h-5 w-5 mr-2" />
                    Commencer
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  s === step ? 'bg-emerald-500 w-8' : s < step ? 'bg-emerald-300' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
