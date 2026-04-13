import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import { z } from 'zod/v4'

// Schema de validation pour le message de l'assistant
const messageSchema = z.object({
  message: z.string().min(1, 'Le message ne peut pas etre vide').max(2000, 'Le message est trop long'),
})

// Stockage en memoire des conversations (Map userId -> message[])
const conversations = new Map<string, Array<{ role: string; content: string; timestamp: string }>>()

// Limite de messages par conversation
const MAX_CONVERSATION_MESSAGES = 50

// GET /api/mova/assistant - Recuperer l'historique de conversation
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const history = conversations.get(auth.id) ?? []

    return NextResponse.json({
      success: true,
      data: {
        history,
        messageCount: history.length,
      },
    })
  } catch (error) {
    console.error('[ASSISTANT] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/assistant - Envoyer un message a l'assistant IA
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = messageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { message } = parsed.data

    // Recuperer ou initialiser la conversation
    let history = conversations.get(auth.id) ?? []
    const now = new Date().toISOString()

    // Ajouter le message de l'utilisateur
    history.push({
      role: 'user',
      content: message,
      timestamp: now,
    })

    // Limiter la taille de la conversation
    if (history.length > MAX_CONVERSATION_MESSAGES) {
      history = history.slice(-MAX_CONVERSATION_MESSAGES)
    }

    // Tenter d'utiliser le SDK IA pour generer une reponse
    let aiResponse: string

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default

      // Construire le contexte a partir de l'historique
      const contextMessages = history.slice(-10).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))

      const response = await ZAI.chat({
        messages: [
          {
            role: 'system',
            content: `Tu es l'assistant virtuel MOVA, une super-application de mobilite pour Conakry, Guinee.
Tu aides les utilisateurs avec les courses de vehicules, commandes alimentaires, livraisons, portefeuille et autres services MOVA.
Reponds toujours en francais, de maniere concise et utile.
Si tu ne connais pas la reponse, indique-le clairement.`,
          },
          ...contextMessages,
        ],
      })

      aiResponse = typeof response === 'string' ? response : JSON.stringify(response)
    } catch (sdkError) {
      console.warn('[ASSISTANT] SDK IA indisponible, utilisation du mode basique:', sdkError)
      aiResponse = generateFallbackResponse(message)
    }

    // Ajouter la reponse de l'assistant
    history.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
    })

    // Sauvegarder la conversation
    conversations.set(auth.id, history)

    return NextResponse.json({
      success: true,
      data: {
        response: aiResponse,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[ASSISTANT] Erreur lors du traitement:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// Generer une reponse de secours si le SDK IA n'est pas disponible
function generateFallbackResponse(message: string): string {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('course') || lowerMessage.includes('trajet') || lowerMessage.includes('taxi')) {
    return 'Pour commander une course, allez dans la section Courses de l\'application, entrez votre adresse de depart et de destination, puis choisissez le type de vehicule. Le tarif estime s\'affichera automatiquement.'
  }

  if (lowerMessage.includes('restaurant') || lowerMessage.includes('nourriture') || lowerMessage.includes('commande')) {
    return 'Pour passer une commande alimentaire, accedez a la section Restaurants, choisissez un restaurant, selectionnez vos plats et confirmez la commande. Vous pouvez suivre votre livraison en temps reel.'
  }

  if (lowerMessage.includes('livraison') || lowerMessage.includes('colis') || lowerMessage.includes('envoyer')) {
    return 'Pour envoyer un colis, allez dans la section Livraisons, renseignez les adresses de ramassage et de depot, les informations du destinataire, et choisissez votre moyen de paiement.'
  }

  if (lowerMessage.includes('paiement') || lowerMessage.includes('portefeuille') || lowerMessage.includes('wallet') || lowerMessage.includes('argent')) {
    return 'MOVA offre plusieurs moyens de paiement : Orange Money, MTN MoMo, Wave, carte bancaire et portefeuille MOVA. Vous pouvez recharger votre portefeuille depuis la section Mon Compte.'
  }

  if (lowerMessage.includes('tarif') || lowerMessage.includes('prix') || lowerMessage.includes('combien')) {
    return 'Les tarifs dependent de la distance entre les zones, du type de vehicule et de la demande. Les courses en moto commencent a 2 000 GNF, les taxis a 5 000 GNF. Les livraisons commencent a 8 000 GNF.'
  }

  if (lowerMessage.includes('aide') || lowerMessage.includes('support') || lowerMessage.includes('probleme')) {
    return 'Pour toute assistance, vous pouvez contacter notre support via l\'application dans la section Aide, ou signaler un incident directement. Notre equipe est disponible pour vous aider.'
  }

  return 'Je suis l\'assistant MOVA. Je peux vous aider avec les courses, commandes alimentaires, livraisons, paiements et autres services. Comment puis-je vous aider aujourd\'hui ?'
}
