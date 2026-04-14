'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  ShieldAlert,
  AlertTriangle,
  Car,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  Send,
} from 'lucide-react'

// --- Types ---

interface Incident {
  id: string
  type: string
  severity: string
  status: string
  description: string
  rideId?: string
  deliveryId?: string
  createdAt: string
  resolution?: string
}

// --- Constantes ---

const INCIDENT_TYPES = [
  { id: 'accident', label: 'Accident', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' },
  { id: 'harassment', label: 'Harcèlement', icon: ShieldAlert, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { id: 'theft', label: 'Vol', icon: AlertTriangle, color: 'text-red-700', bgColor: 'bg-red-100' },
  { id: 'fraud', label: 'Fraude', icon: ShieldAlert, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'safety_violation', label: 'Non-respect sécurité', icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  { id: 'vehicle_damage', label: 'Dommage véhicule', icon: Car, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'dispute', label: 'Litige', icon: MessageSquare, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  { id: 'other', label: 'Autre', icon: AlertTriangle, color: 'text-gray-600', bgColor: 'bg-gray-50' },
] as const

const SEVERITY_OPTIONS = [
  { id: 'low', label: 'Faible', color: 'bg-green-100 text-green-800' },
  { id: 'medium', label: 'Moyen', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'high', label: 'Élevé', color: 'bg-orange-100 text-orange-800' },
  { id: 'critical', label: 'Critique', color: 'bg-red-100 text-red-800' },
] as const

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  reported: { label: 'Signalé', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
  investigating: { label: 'En investigation', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  resolved: { label: 'Résolu', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  dismissed: { label: 'Classé', color: 'bg-gray-100 text-gray-800', icon: CheckCircle2 },
  escalated: { label: 'Escaladé', color: 'bg-red-100 text-red-800', icon: ShieldAlert },
}

const TYPE_LABELS: Record<string, string> = {
  accident: 'Accident',
  harassment: 'Harcèlement',
  theft: 'Vol',
  fraud: 'Fraude',
  safety_violation: 'Sécurité',
  vehicle_damage: 'Véhicule',
  dispute: 'Litige',
  other: 'Autre',
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// --- Composant principal ---

export function IncidentsView() {
  const { setCurrentView } = useMovaStore()

  // États
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Formulaire
  const [incidentType, setIncidentType] = useState('other')
  const [severity, setSeverity] = useState('medium')
  const [description, setDescription] = useState('')
  const [relatedRideId, setRelatedRideId] = useState('')
  const [relatedDeliveryId, setRelatedDeliveryId] = useState('')

  // Soumission
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Charger les incidents
  const fetchIncidents = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/api/mova/incidents')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.incidents) {
          setIncidents(data.data.incidents)
        }
      }
    } catch {
      // Silencieux
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  // Soumettre l'incident
  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Décrivez l\'incident')
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await apiFetch('/api/mova/incidents', {
        method: 'POST',
        body: JSON.stringify({
          type: incidentType,
          severity,
          description: description.trim(),
          rideId: relatedRideId.trim() || undefined,
          deliveryId: relatedDeliveryId.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Incident signalé avec succès ! Notre équipe va l\'examiner.')
        setShowForm(false)
        setDescription('')
        setIncidentType('other')
        setSeverity('medium')
        setRelatedRideId('')
        setRelatedDeliveryId('')
        fetchIncidents()
      } else {
        setError(data.error || 'Impossible de signaler l\'incident')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête */}
      <header className="bg-red-600 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('hub')}
            className="p-2 -ml-2 rounded-xl bg-white/10 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ShieldAlert className="w-5 h-5" />
          <h1 className="text-lg font-bold">SOS & Incidents</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/30 transition-colors active:scale-[0.97]"
        >
          {showForm ? 'Fermer' : 'Signaler'}
        </button>
      </header>

      <div className="px-4 py-5 space-y-5 pb-8">
        {/* Bouton SOS d'urgence */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base">Besoin d&apos;aide immédiate ?</h3>
              <p className="text-red-100 text-sm mt-0.5">
                Signalez un incident ou contactez le support
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-full mt-4 py-3 bg-white text-red-700 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <ShieldAlert className="w-5 h-5" />
            Signaler un incident
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Formulaire de signalement */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Nouveau signalement
            </h2>

            {/* Type d'incident */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Type d&apos;incident</label>
              <div className="grid grid-cols-2 gap-2">
                {INCIDENT_TYPES.slice(0, 6).map((t) => {
                  const Icon = t.icon
                  const isSelected = incidentType === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setIncidentType(t.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left active:scale-[0.97] ${
                        isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-red-600' : 'text-gray-400'}`} />
                      <span className={`text-xs font-semibold truncate ${isSelected ? 'text-red-600' : 'text-gray-700'}`}>
                        {t.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sévérité */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Sévérité</label>
              <div className="flex gap-2">
                {SEVERITY_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSeverity(s.id)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border active:scale-[0.97] ${
                      severity === s.id
                        ? `border-transparent ${s.color}`
                        : 'border-gray-200 text-gray-600 bg-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'incident en détail..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-colors resize-none"
              />
            </div>

            {/* Référence course/livraison */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  <Car className="w-3 h-3 inline mr-1" />
                  ID Course (optionnel)
                </label>
                <input
                  type="text"
                  value={relatedRideId}
                  onChange={(e) => setRelatedRideId(e.target.value)}
                  placeholder="ID course"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  <Package className="w-3 h-3 inline mr-1" />
                  ID Livraison (optionnel)
                </label>
                <input
                  type="text"
                  value={relatedDeliveryId}
                  onChange={(e) => setRelatedDeliveryId(e.target.value)}
                  placeholder="ID livraison"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
              </div>
            </div>

            {/* Bouton soumettre */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !description.trim()}
              className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-red-900/20"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Signaler l&apos;incident
                </>
              )}
            </button>
          </div>
        )}

        {/* Chargement */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            <span className="ml-2 text-sm text-gray-500">Chargement des incidents...</span>
          </div>
        )}

        {/* Liste des incidents */}
        {!isLoading && incidents.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Mes signalements ({incidents.length})
            </h2>
            <div className="space-y-3">
              {incidents.map((incident) => {
                const statusInfo = STATUS_LABELS[incident.status] || STATUS_LABELS.reported
                const StatusIcon = statusInfo.icon
                const severityInfo = SEVERITY_OPTIONS.find((s) => s.id === incident.severity)

                return (
                  <div key={incident.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-3">
                      {/* En-tête */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${severityInfo?.color || 'bg-gray-100 text-gray-800'}`}>
                            {incident.severity}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            {TYPE_LABELS[incident.type] || incident.type}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-700 line-clamp-3">{incident.description}</p>

                      {/* Résolution */}
                      {incident.resolution && (
                        <div className="mt-2 p-2 bg-green-50 rounded-lg">
                          <p className="text-xs text-green-700">
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                            {incident.resolution}
                          </p>
                        </div>
                      )}

                      {/* Pied */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(incident.createdAt)}</span>
                        {incident.rideId && (
                          <span className="ml-auto">
                            <Car className="w-3 h-3 inline mr-0.5" />
                            Course
                          </span>
                        )}
                        {incident.deliveryId && (
                          <span className="ml-auto">
                            <Package className="w-3 h-3 inline mr-0.5" />
                            Livraison
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* État vide */}
        {!isLoading && incidents.length === 0 && !showForm && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">Aucun incident signalé</h3>
            <p className="text-sm text-gray-500">
              En cas de problème, n&apos;hésitez pas à nous contacter
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
