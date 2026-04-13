"use client"

import React, { useState, useCallback, useMemo } from "react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

import {
  Share2,
  Copy,
  MessageSquare,
  QrCode,
  Shield,
  MapPin,
  Phone,
  Car,
  ExternalLink,
  Check,
  Navigation,
  Clock,
  CircleDot,
  CircleCheckBig,
  Loader2,
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TripSharePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ride: {
    id: string
    pickupAddress: string
    dropoffAddress: string
    status: string
    driverName?: string
    driverPhone?: string
    vehiclePlate?: string
    estimatedFare?: number
    pickupLat?: number
    pickupLng?: number
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGNF(amount: number): string {
  return new Intl.NumberFormat("fr-GN").format(amount) + " GNF"
}

function getStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case "in_progress":
      return {
        label: "En cours",
        color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      }
    case "accepted":
    case "confirmed":
      return {
        label: "Confirmée",
        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      }
    case "completed":
      return {
        label: "Terminée",
        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      }
    default:
      return {
        label: status,
        color: "bg-muted text-muted-foreground",
      }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TripSharePanel({
  open,
  onOpenChange,
  ride,
}: TripSharePanelProps) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [smsSending, setSmsSending] = useState(false)

  // Generate shareable tracking URL
  const trackingUrl = useMemo(() => {
    if (!ride) return ""
    const base = typeof window !== "undefined" ? window.location.origin : "https://mova.gn"
    return `${base}?share=ride-${ride.id}`
  }, [ride])

  // Generate SMS link
  const smsBody = useMemo(() => {
    if (!ride) return ""
    const parts = [
      "Je suis en course MOVA.",
      `Trajet: ${ride.pickupAddress} → ${ride.dropoffAddress}`,
    ]
    if (ride.driverName) parts.push(`Chauffeur: ${ride.driverName}`)
    if (ride.vehiclePlate) parts.push(`Plaque: ${ride.vehiclePlate}`)
    if (ride.estimatedFare) parts.push(`Tarif estimé: ${formatGNF(ride.estimatedFare)}`)
    return parts.join(". ")
  }, [ride])

  const smsHref = useMemo(() => {
    if (!ride) return ""
    return `sms:?body=${encodeURIComponent(smsBody)}`
  }, [ride, smsBody])

  // Handle copy to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!trackingUrl) return
    try {
      await navigator.clipboard.writeText(trackingUrl)
      setCopied(true)
      toast.success("Lien copié dans le presse-papiers !", {
        description: "Votre proche peut suivre votre trajet en temps réel.",
      })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea")
      textarea.value = trackingUrl
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      toast.success("Lien copié !")
      setTimeout(() => setCopied(false), 2500)
    }
  }, [trackingUrl])

  // Handle native Web Share API
  const handleNativeShare = useCallback(async () => {
    if (!ride) return
    setSharing(true)
    try {
      if (navigator.share) {
        await navigator.share({
          title: "MOVA — Suivi de trajet en direct",
          text: smsBody,
          url: trackingUrl,
        })
        toast.success("Trajet partagé avec succès !")
      } else {
        // Fallback: copy to clipboard
        await handleCopyLink()
      }
    } catch (err) {
      // User cancelled the share dialog — not an error
      if ((err as Error).name !== "AbortError") {
        await handleCopyLink()
      }
    } finally {
      setSharing(false)
    }
  }, [ride, smsBody, trackingUrl, handleCopyLink])

  // Handle SMS sending
  const handleSendSMS = useCallback(() => {
    if (!smsHref) return
    setSmsSending(true)
    // Small delay to show the loading state
    setTimeout(() => {
      window.location.href = smsHref
      toast.info("Ouverture de l'application SMS...")
      setSmsSending(false)
    }, 600)
  }, [smsHref])

  if (!ride) return null

  const statusConfig = getStatusLabel(ride.status)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto mova-scrollbar">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <div className="size-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Share2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            Partager le trajet
          </SheetTitle>
          <SheetDescription>
            Permettez a vos proches de suivre votre course en temps réel.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pb-8 pt-2">
          {/* ── Safety Note ── */}
          <div className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800">
            <Shield className="size-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
              Partager votre trajet permet a vos proches de vous suivre en temps réel pour votre sécurité.
            </p>
          </div>

          {/* ── Trip Details Card ── */}
          <Card className="border-emerald-200/60 dark:border-emerald-800/60 overflow-hidden">
            <CardContent className="p-0">
              {/* Status header */}
              <div className="mova-gradient px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-medium text-white/80">Course MOVA</span>
                <Badge className={`${statusConfig.color} text-[10px] border-0`}>
                  {statusConfig.label}
                </Badge>
              </div>

              <div className="p-4 space-y-3">
                {/* Route info */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <CircleDot className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground">Départ</p>
                      <p className="text-sm font-medium truncate">{ride.pickupAddress}</p>
                    </div>
                  </div>
                  <div className="ml-1.5 w-px h-4 bg-border" />
                  <div className="flex items-start gap-2.5">
                    <CircleCheckBig className="size-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground">Arrivée</p>
                      <p className="text-sm font-medium truncate">{ride.dropoffAddress}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Driver & vehicle info */}
                {(ride.driverName || ride.vehiclePlate) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                        <Car className="size-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {ride.driverName && (
                          <p className="text-sm font-semibold truncate">{ride.driverName}</p>
                        )}
                        <div className="flex items-center gap-2">
                          {ride.vehiclePlate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Navigation className="size-3" />
                              {ride.vehiclePlate}
                            </span>
                          )}
                          {ride.driverPhone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="size-3" />
                              {ride.driverPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fare */}
                {ride.estimatedFare && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Tarif estimé
                      </span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        {formatGNF(ride.estimatedFare)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── QR-Code-Like Tracking Visual ── */}
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <QrCode className="size-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs font-semibold text-foreground">Lien de suivi en direct</p>
              </div>

              {/* Visual QR-code-like pattern */}
              <div className="flex items-center gap-4">
                <div className="shrink-0 size-20 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-800 flex items-center justify-center relative overflow-hidden">
                  {/* Decorative grid pattern simulating QR code */}
                  <div className="absolute inset-0 opacity-20">
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                      <rect x="4" y="4" width="24" height="24" rx="3" stroke="currentColor" strokeWidth="3" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="52" y="4" width="24" height="24" rx="3" stroke="currentColor" strokeWidth="3" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="4" y="52" width="24" height="24" rx="3" stroke="currentColor" strokeWidth="3" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="10" y="10" width="12" height="12" rx="1" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="58" y="10" width="12" height="12" rx="1" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="10" y="58" width="12" height="12" rx="1" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="32" y="4" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="44" y="4" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="32" y="12" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="40" y="12" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="32" y="32" width="16" height="16" rx="4" fill="currentColor" className="text-emerald-500 dark:text-emerald-500" />
                      <rect x="4" y="32" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="4" y="44" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="72" y="32" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="72" y="44" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="32" y="72" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="44" y="72" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="58" y="58" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="66" y="66" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="72" y="58" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="58" y="72" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                      <rect x="72" y="72" width="4" height="4" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" />
                    </svg>
                  </div>
                  {/* MOVA logo overlay */}
                  <div className="relative z-10 size-8 rounded-lg bg-white dark:bg-emerald-950 flex items-center justify-center shadow-sm">
                    <MapPin className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-[10px] text-muted-foreground">Partagez ce lien avec vos proches</p>
                  <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-2">
                    <p className="text-xs text-foreground truncate flex-1 font-mono">
                      ?share=ride-{ride.id}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-6 px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Action Buttons ── */}
          <div className="grid gap-2">
            {/* Copy link — primary action */}
            <Button
              className="w-full mova-gradient text-white font-semibold h-11 shadow-md"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="size-4 mr-2" />
                  Lien copié !
                </>
              ) : (
                <>
                  <Copy className="size-4 mr-2" />
                  Copier le lien de suivi
                </>
              )}
            </Button>

            {/* Native share */}
            <Button
              variant="outline"
              className="w-full h-11 gap-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              onClick={handleNativeShare}
              disabled={sharing}
            >
              {sharing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Share2 className="size-4" />
              )}
              Partager via...
            </Button>

            {/* SMS */}
            <a href={smsHref} className="block" onClick={(e) => { e.preventDefault(); handleSendSMS() }}>
              <Button
                variant="outline"
                className="w-full h-11 gap-2"
                disabled={smsSending}
              >
                {smsSending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquare className="size-4 text-amber-500" />
                )}
                <span>Envoyer par SMS</span>
              </Button>
            </a>

            {/* Open link in browser */}
            <Button
              variant="ghost"
              className="w-full gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                window.open(trackingUrl, "_blank")
                toast.info("Lien ouvert dans un nouvel onglet")
              }}
            >
              <ExternalLink className="size-3.5" />
              Ouvrir le lien
            </Button>
          </div>

          {/* ── Recipients Hint ── */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Conseils de partage
            </p>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mt-0.5 shrink-0">
                  <Phone className="size-2.5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Envoyez le lien a un proche de confiance
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="size-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mt-0.5 shrink-0">
                  <MapPin className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ils pourront voir votre position en direct sur la carte
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="size-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mt-0.5 shrink-0">
                  <Shield className="size-2.5 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Le lien expire automatiquement a la fin de la course
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
