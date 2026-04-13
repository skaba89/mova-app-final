import { toast } from 'sonner'

export function handleApiError(error: unknown, context?: string): string {
  let message = 'Erreur inattendue. Veuillez reessayer.'
  if (error instanceof Error) {
    message = error.message
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      message = 'Erreur de connexion. Verifiez votre internet.'
    } else if (message.includes('timeout')) {
      message = 'La requete a expire. Reessayez.'
    } else if (message.includes('401')) {
      message = 'Session expiree. Reconnectez-vous.'
    } else if (message.includes('403')) {
      message = 'Acces refuse.'
    } else if (message.includes('404')) {
      message = 'Ressource introuvable.'
    }
  }
  if (context) message = `${context}: ${message}`
  toast.error(message)
  return message
}
