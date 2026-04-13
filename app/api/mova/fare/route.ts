import { NextRequest, NextResponse } from 'next/server';
import { estimateFare } from '@/lib/mova/zone-distances';

// GET /api/mova/fare
// Endpoint public - pas d'authentification requise
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const pickupZone = searchParams.get('pickupZone');
    const dropoffZone = searchParams.get('dropoffZone');
    const vehicleType = searchParams.get('vehicleType') ?? 'auto';

    if (!pickupZone || !dropoffZone) {
      return NextResponse.json(
        { success: false, error: 'Les zones de depart et d\'arrivee sont requises' },
        { status: 400 }
      );
    }

    const validVehicleTypes = ['moto', 'auto', 'van', 'premium'];
    if (!validVehicleTypes.includes(vehicleType)) {
      return NextResponse.json(
        { success: false, error: 'Type de vehicule invalide' },
        { status: 400 }
      );
    }

    const result = estimateFare(pickupZone, dropoffZone, vehicleType);

    return NextResponse.json({
      success: true,
      data: {
        pickupZone,
        dropoffZone,
        vehicleType,
        distanceKm: result.distanceKm,
        durationMinutes: result.durationMinutes,
        estimatedFare: result.fareAmount,
        currency: result.currency,
      },
    });
  } catch (error) {
    console.error('[FARE] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
