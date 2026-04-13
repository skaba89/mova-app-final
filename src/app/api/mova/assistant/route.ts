import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const runtime = 'nodejs';

// ─── System Prompt ──────────────────────────────────────────────────────────────

const MOVA_SYSTEM_PROMPT = `Tu es MOVA Assistant, le chatbot intelligent de MOVA, la super-app de mobilite pour Conakry, Guinee.

Tu connais parfaitement tous les aspects de MOVA:

SERVICES:
- VTC Standard: a partir de 3 000 GNF, vehicules confortables
- VTC Premium: a partir de 8 000 GNF, vehicules haut de gamme avec chauffeur professionnel
- Van: a partir de 15 000 GNF, pour groupes jusqu'a 6 passagers
- Livraison colis et documents: tarif selon distance et taille
- Covoiturage: partagez vos trajets et economisez

ZONES DE CONAKRY (5 communes):
- Kaloum: centre-ville, Almamya, Sandervalia, Boulbinet
- Dixinn: Corniche Nord, Belle Vue, Cosa, Kipe
- Matam: Marche Madina, Niger Ferry, Hamdallaye
- Ratoma: Cosa, Kipe, Koloma, Boulbinet extension
- Matoto: Aeroport Gbessia, Dubreka road, Zone industrielle

TARIFICATION:
- Base + distance + temps
- Surge pricing aux heures de pointe (7h-9h et 17h-19h)
- Estimation en temps reel avant confirmation

PAIEMENTS:
- Cash (especes)
- Mobile Money: Orange Money et MTN MoMo
- Wallet MOVA: recharge via Mobile Money ou cash

PROGRAMME FIDELITE (5 niveaux):
- Bronze (0-499 pts): cashback 1%
- Silver (500-1 999 pts): cashback 2%
- Gold (2 000-4 999 pts): cashback 3%
- Platinum (5 000-14 999 pts): cashback 5%
- Diamond (15 000+ pts): cashback 8% + courses prioritaires

SECURITE:
- Bouton SOS: contact immediate Police (117), SAMU (115), Pompiers (118)
- Partage de trajet en direct avec contacts de confiance
- Courses femmes uniquement: option disponible
- Verification conducteur: photo, plaque, nom affiches
- Code de securite: 4 chiffres a confirmer en debut de course

PARRAINAGE:
- Invitez un ami et gagnez 5 000 GNF de credit
- Le filleul obtient 50% de reduction sur sa premiere course
- Suivez vos gains dans l'onglet Parrainage

CONSEILS PRATIQUES:
- Reservez en avance pour les trajets a l'aeroport
- Le trafic est plus fluide entre 10h et 16h
- Activez le partage de trajet pour votre securite

REGLES DE REPONSE:
- Reponds TOUJOURS en francais
- Sois concis: max 2-3 phrases par reponse
- Sois amical et professionnel
- Si tu ne connais pas la reponse, oriente vers le support MOVA
- Utilise des montants en GNF (Francs guineens)
- Ne mentionne jamais les concurrents (Uber, Bolt, Yango, Heetch)
- Propose des actions concretes quand c'est possible`;

// ─── In-memory conversation store ───────────────────────────────────────────────

interface ConversationMessage {
  role: 'assistant' | 'user';
  content: string;
}

const conversations = new Map<string, ConversationMessage[]>();

function getConversationKey(userId?: string): string {
  return userId || 'anonymous';
}

// ─── POST Handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context } = body as {
      message: string;
      context?: {
        userId?: string;
        currentView?: string;
        lastRide?: string;
      };
    };

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message est requis' },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Message trop long (max 500 caracteres)' },
        { status: 400 }
      );
    }

    const convKey = getConversationKey(context?.userId);
    let history = conversations.get(convKey) || [];

    // Initialize conversation with system prompt if new
    if (history.length === 0) {
      history = [
        {
          role: 'assistant',
          content: MOVA_SYSTEM_PROMPT,
        },
      ];
    }

    // Add context prefix if available
    let userMessage = message.trim();
    if (context?.currentView) {
      const viewLabels: Record<string, string> = {
        passenger: 'L\'utilisateur est sur la vue passager/reservation de course.',
        driver: 'L\'utilisateur est un chauffeur sur sa vue conducteur.',
        wallet: 'L\'utilisateur consulte son wallet MOVA.',
        delivery: 'L\'utilisateur est sur la vue livraison.',
        carpool: 'L\'utilisateur cherche un covoiturage.',
        corporate: 'L\'utilisateur est sur le portail entreprise.',
        admin: 'L\'utilisateur est administrateur MOVA.',
      };
      const viewLabel = viewLabels[context.currentView];
      if (viewLabel) {
        userMessage = `[Contexte: ${viewLabel}] ${userMessage}`;
      }
    }

    if (context?.lastRide) {
      userMessage = `[Derniere course: ${context.lastRide}] ${userMessage}`;
    }

    // Add user message to history
    history.push({
      role: 'user',
      content: userMessage,
    });

    // Trim conversation to keep last 20 messages (preserve system prompt)
    if (history.length > 21) {
      history = [
        history[0], // Keep system prompt
        ...history.slice(-20), // Keep last 20 messages
      ];
    }

    // Call z-ai-web-dev-sdk LLM
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: history,
      thinking: { type: 'disabled' },
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse || aiResponse.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Aucune reponse generee' },
        { status: 500 }
      );
    }

    // Add AI response to history
    history.push({
      role: 'assistant',
      content: aiResponse,
    });

    // Save updated history
    conversations.set(convKey, history);

    // Cleanup old conversations (keep max 1000 entries)
    if (conversations.size > 1000) {
      const oldestKey = conversations.keys().next().value;
      if (oldestKey) {
        conversations.delete(oldestKey);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        response: aiResponse,
        messageCount: history.length - 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('MOVA Assistant error:', message);

    // Return a graceful fallback response
    return NextResponse.json(
      {
        success: true,
        data: {
          response:
            'Desole, une erreur technique est survenue. Veuillez reessayer dans un instant ou contacter le support MOVA au +224 620 00 00 00.',
          fallback: true,
        },
      },
      { status: 200 }
    );
  }
}

// ─── DELETE Handler (clear conversation) ────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      conversations.delete(userId);
    } else {
      // Clear all anonymous conversations
      conversations.delete('anonymous');
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Conversation effacee' },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'effacement' },
      { status: 500 }
    );
  }
}
