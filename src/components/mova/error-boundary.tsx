'use client'
import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useAppStore } from '@/lib/mova/store'

interface Props { children: ReactNode }

interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      const { setView } = useAppStore.getState()
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
            <AlertTriangle className="size-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Une erreur est survenue</h2>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
            {this.state.error?.message || "Une erreur inattendue s'est produite. Veuillez reessayer."}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { this.setState({ hasError: false, error: null }) }}>
              <RefreshCw className="size-4 mr-2" /> Reessayer
            </Button>
            <Button onClick={() => { this.setState({ hasError: false, error: null }); setView('hub') }}>
              <Home className="size-4 mr-2" /> Accueil
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
