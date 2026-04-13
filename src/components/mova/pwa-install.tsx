'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function getInitialDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('mova_pwa_dismissed')
}

export default function PwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà installé la PWA
    const wasInstalled = localStorage.getItem('mova_pwa_installed')
    if (wasInstalled) {
      queueMicrotask(() => setIsInstalled(true))
      return
    }

    // Vérifier si l'utilisateur a déjà fermé la bannière
    const wasDismissed = localStorage.getItem('mova_pwa_dismissed')
    if (wasDismissed) {
      queueMicrotask(() => setDismissed(true))
      return
    }

    // Abonnement à l'événement beforeinstallprompt du navigateur
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Afficher la bannière personnalisée après un court délai
      setTimeout(() => setShowBanner(true), 3000)
    }

    // Écouter l'événement appinstalled pour nettoyer l'état
    const installedHandler = () => {
      setIsInstalled(true)
      setShowBanner(false)
      setDeferredPrompt(null)
      localStorage.setItem('mova_pwa_installed', 'true')
      // Supprimer l'écouteur beforeinstallprompt car l'app est installée
      window.removeEventListener('beforeinstallprompt', handler)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  // Invitation automatique après 30s si non installé et non fermé
  useEffect(() => {
    if (dismissed || !deferredPrompt || isInstalled) return

    const timer = setTimeout(() => {
      if (!localStorage.getItem('mova_pwa_installed')) {
        setShowBanner(true)
      }
    }, 30000)

    return () => clearTimeout(timer)
  }, [deferredPrompt, dismissed, isInstalled])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        localStorage.setItem('mova_pwa_installed', 'true')
        setShowBanner(false)
      }
    } catch {
      // User cancelled or error occurred
    }

    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShowBanner(false)
    setDismissed(true)
    localStorage.setItem('mova_pwa_dismissed', 'true')
  }, [])

  // Ne pas afficher si: pas de prompt, fermé, déjà installé ou bannière masquée
  if (!deferredPrompt || dismissed || isInstalled || !showBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-[mova-slide-up_0.3s_ease-out] md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2">
      <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-lg dark:border-emerald-800 dark:bg-emerald-950">
        <div className="flex items-start gap-3">
          {/* MOVA icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl mova-gradient">
            <svg width="24" height="24" viewBox="0 0 512 512" fill="none">
              <path d="M256 80L100 400H412L256 80Z" fill="white" fillOpacity="0.9" />
              <circle cx="256" cy="320" r="48" fill="white" fillOpacity="0.7" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground">
              Installer MOVA
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ajoutez MOVA à votre écran d&apos;accueil pour un accès rapide.
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            onClick={handleInstall}
            className="flex-1 mova-gradient text-white text-sm font-medium rounded-lg h-9"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Installer
          </Button>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="text-sm text-muted-foreground h-9"
          >
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  )
}
