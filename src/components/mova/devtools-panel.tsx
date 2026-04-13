'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Wrench, Bell, Trash2, Wifi, Monitor, Eye, EyeOff,
  Smartphone, HardDrive, Globe, Cpu, Info
} from 'lucide-react'
import { useAppStore } from '@/lib/mova/store'

// ── System info helper ──────────────────────────────────────────────────

function getSystemInfo() {
  const nav = navigator as unknown as Record<string, unknown>
  const conn = nav.connection as Record<string, unknown> | undefined
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    language: typeof navigator !== 'undefined' ? navigator.language : 'N/A',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'N/A',
    screen: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'N/A',
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A',
    pixelRatio: typeof window !== 'undefined' ? String(window.devicePixelRatio) : 'N/A',
    connection: conn ? `${conn.effectiveType || 'N/A'} (${conn.downlink || '?'}Mbps)` : 'N/A',
    onLine: typeof navigator !== 'undefined' ? navigator.onLine : true,
    cores: nav.hardwareConcurrency || 'N/A',
    memory: (nav.deviceMemory as number) ? `${nav.deviceMemory}GB` : 'N/A',
    touchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
  }
}

// ── DevTools Panel Component ────────────────────────────────────────────

export default function DevToolsPanel() {
  const [open, setOpen] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [connStatus, setConnStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [sysInfo, setSysInfo] = useState<ReturnType<typeof getSystemInfo> | null>(null)
  const { user, isAuthenticated, currentView, token } = useAppStore()

  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development'

  // Refresh system info when panel opens
  useEffect(() => {
    if (open) {
      queueMicrotask(() => setSysInfo(getSystemInfo()))
    }
  }, [open])

  // Simulate a browser notification
  const handleSimulateNotification = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Les notifications ne sont pas supportées par ce navigateur.')
      return
    }

    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }

    if (Notification.permission === 'granted') {
      const notification = new Notification('MOVA — Test de notification', {
        body: 'Ceci est une notification de test depuis les DevTools.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'mova-devtools-test',
      })
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
      toast.success('Notification envoyée avec succès !')
    } else {
      toast.warning('Permission de notification refusée.')
    }
  }, [])

  // Clear all storage
  const handleClearCache = useCallback(() => {
    localStorage.clear()
    sessionStorage.clear()
    toast.success('Cache vidé avec succès !', {
      description: 'localStorage + sessionStorage effacés.',
    })
  }, [])

  // Test connection to auth/me
  const handleTestConnection = useCallback(async () => {
    setConnStatus('loading')
    try {
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      const res = await fetch('/api/mova/auth/me', { headers })
      const data = await res.json()
      if (res.ok && data.success) {
        setConnStatus('success')
        toast.success('Connexion API OK', {
          description: `Utilisateur : ${data.user?.name || 'N/A'}`,
        })
      } else {
        setConnStatus('error')
        toast.error('Erreur API', {
          description: data.error || `Status ${res.status}`,
        })
      }
    } catch {
      setConnStatus('error')
      toast.error('Erreur de connexion au serveur.')
    }
  }, [token])

  if (!isDev) return null

  return (
    <div className="fixed bottom-4 left-4 z-[100]">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 shadow-lg border border-gray-700 transition-all hover:scale-105"
            title="DevTools"
          >
            <Wrench className="h-4 w-4" />
          </Button>
        </SheetTrigger>

        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto mova-scrollbar rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-purple-500" />
              DevTools
              <Badge variant="outline" className="text-[10px] font-normal ml-1">
                Développement
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 pb-4">
            {/* ── Actions ────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="justify-start h-10 text-sm"
                  onClick={handleSimulateNotification}
                >
                  <Bell className="h-4 w-4 mr-2 text-purple-500" />
                  Simuler une notification
                </Button>

                <Button
                  variant="outline"
                  className="justify-start h-10 text-sm"
                  onClick={handleClearCache}
                >
                  <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                  Vider le cache
                </Button>

                <Button
                  variant="outline"
                  className="justify-start h-10 text-sm"
                  onClick={handleTestConnection}
                  disabled={connStatus === 'loading'}
                >
                  <Wifi className={`h-4 w-4 mr-2 ${
                    connStatus === 'success' ? 'text-emerald-500' :
                    connStatus === 'error' ? 'text-red-500' :
                    connStatus === 'loading' ? 'animate-pulse text-amber-500' :
                    'text-purple-500'
                  }`} />
                  {connStatus === 'loading' ? 'Test en cours...' : 'Tester la connexion'}
                </Button>

                <div className="flex items-center justify-between h-10 px-3 rounded-md border border-border bg-card">
                  <div className="flex items-center gap-2 text-sm">
                    {demoMode ? (
                      <Eye className="h-4 w-4 text-purple-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    Mode démo
                  </div>
                  <Switch
                    checked={demoMode}
                    onCheckedChange={setDemoMode}
                    className="data-[state=checked]:bg-purple-600"
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* ── Auth Info ──────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Session</h3>
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connecté</span>
                  <Badge variant={isAuthenticated ? 'default' : 'secondary'} className="text-[10px]">
                    {isAuthenticated ? 'Oui' : 'Non'}
                  </Badge>
                </div>
                {user && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Utilisateur</span>
                      <span className="font-medium">{user.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rôle</span>
                      <Badge variant="outline" className="text-[10px]">{user.role}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID</span>
                      <span className="font-mono text-muted-foreground">{user.id}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vue actuelle</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{currentView}</Badge>
                </div>
                {token && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token</span>
                    <span className="font-mono text-muted-foreground text-[10px]">{token.slice(0, 12)}...</span>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* ── System Info ─────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
                Info système
              </h3>
              {sysInfo ? (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
                  <InfoRow icon={<Smartphone className="h-3.5 w-3.5" />} label="Plateforme" value={sysInfo.platform} />
                  <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Langue" value={sysInfo.language} />
                  <InfoRow icon={<Monitor className="h-3.5 w-3.5" />} label="Écran" value={sysInfo.screen} />
                  <InfoRow icon={<Monitor className="h-3.5 w-3.5" />} label="Viewport" value={sysInfo.viewport} />
                  <InfoRow icon={<Cpu className="h-3.5 w-3.5" />} label="Pixel Ratio" value={sysInfo.pixelRatio} />
                  <InfoRow icon={<Wifi className="h-3.5 w-3.5" />} label="Réseau" value={sysInfo.connection} />
                  <InfoRow icon={<Cpu className="h-3.5 w-3.5" />} label="Cœurs CPU" value={String(sysInfo.cores)} />
                  <InfoRow icon={<HardDrive className="h-3.5 w-3.5" />} label="RAM" value={sysInfo.memory} />
                  <InfoRow icon={<Smartphone className="h-3.5 w-3.5" />} label="Touch" value={String(sysInfo.touchPoints)} />
                  <InfoRow
                    icon={<Wifi className="h-3.5 w-3.5" />}
                    label="En ligne"
                    value={sysInfo.onLine ? 'Oui' : 'Non'}
                    valueColor={sysInfo.onLine ? 'text-emerald-600' : 'text-red-500'}
                  />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Chargement des informations système...
                </div>
              )}
            </section>

            {/* ── Demo mode indicator ────────────────── */}
            {demoMode && (
              <>
                <Separator />
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-xs text-purple-700 dark:text-purple-300">
                  <Info className="h-4 w-4 inline mr-1" />
                  <strong>Mode démo actif</strong> — Les indicateurs de données de démonstration seront affichés dans l&apos;interface.
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Info Row Sub-component ──────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <span className={`font-mono text-right truncate ${valueColor || 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}
