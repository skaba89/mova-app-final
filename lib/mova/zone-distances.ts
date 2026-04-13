// Liste des zones de Conakry et environs
export const CONAKRY_ZONES = [
  'Kaloum',
  'Dixinn',
  'Matam',
  'Ratoma',
  'Matoto',
  'Kassa',
  'Dubreka',
  'Coyah',
  'Kindia',
] as const

export type ConakryZone = (typeof CONAKRY_ZONES)[number]

// Matrice des distances entre les zones (en kilometres)
// Distances reelles estimees entre les centres des zones
export const ZONE_DISTANCES: Record<ConakryZone, Record<ConakryZone, number>> = {
  Kaloum: {
    Kaloum: 0,
    Dixinn: 5.2,
    Matam: 8.1,
    Ratoma: 10.5,
    Matoto: 16.3,
    Kassa: 12.0,
    Dubreka: 42.0,
    Coyah: 50.0,
    Kindia: 135.0,
  },
  Dixinn: {
    Kaloum: 5.2,
    Dixinn: 0,
    Matam: 4.5,
    Ratoma: 7.8,
    Matoto: 14.0,
    Kassa: 8.5,
    Dubreka: 38.0,
    Coyah: 46.0,
    Kindia: 132.0,
  },
  Matam: {
    Kaloum: 8.1,
    Dixinn: 4.5,
    Matam: 0,
    Ratoma: 5.0,
    Matoto: 10.5,
    Kassa: 12.5,
    Dubreka: 35.0,
    Coyah: 43.0,
    Kindia: 129.0,
  },
  Ratoma: {
    Kaloum: 10.5,
    Dixinn: 7.8,
    Matam: 5.0,
    Ratoma: 0,
    Matoto: 8.2,
    Kassa: 15.0,
    Dubreka: 33.0,
    Coyah: 41.0,
    Kindia: 127.0,
  },
  Matoto: {
    Kaloum: 16.3,
    Dixinn: 14.0,
    Matam: 10.5,
    Ratoma: 8.2,
    Matoto: 0,
    Kassa: 22.0,
    Dubreka: 28.0,
    Coyah: 35.0,
    Kindia: 122.0,
  },
  Kassa: {
    Kaloum: 12.0,
    Dixinn: 8.5,
    Matam: 12.5,
    Ratoma: 15.0,
    Matoto: 22.0,
    Kassa: 0,
    Dubreka: 52.0,
    Coyah: 60.0,
    Kindia: 145.0,
  },
  Dubreka: {
    Kaloum: 42.0,
    Dixinn: 38.0,
    Matam: 35.0,
    Ratoma: 33.0,
    Matoto: 28.0,
    Kassa: 52.0,
    Dubreka: 0,
    Coyah: 22.0,
    Kindia: 105.0,
  },
  Coyah: {
    Kaloum: 50.0,
    Dixinn: 46.0,
    Matam: 43.0,
    Ratoma: 41.0,
    Matoto: 35.0,
    Kassa: 60.0,
    Dubreka: 22.0,
    Coyah: 0,
    Kindia: 87.0,
  },
  Kindia: {
    Kaloum: 135.0,
    Dixinn: 132.0,
    Matam: 129.0,
    Ratoma: 127.0,
    Matoto: 122.0,
    Kassa: 145.0,
    Dubreka: 105.0,
    Coyah: 87.0,
    Kindia: 0,
  },
}

// Types de vehicules et leurs tarifs
export interface VehicleFare {
  basePrice: number // Prix de base en FG (Francs Guineens)
  perKm: number     // Prix par kilometre en FG
  minimumFare: number // Tarif minimum
}

export const VEHICLE_FARES: Record<string, VehicleFare> = {
  // Moto-taxi (okada)
  moto: {
    basePrice: 2000,
    perKm: 500,
    minimumFare: 2000,
  },
  // Taxi classique (auto)
  auto: {
    basePrice: 5000,
    perKm: 800,
    minimumFare: 5000,
  },
  // Van spacieux
  van: {
    basePrice: 7000,
    perKm: 1000,
    minimumFare: 7000,
  },
  // Premium haut de gamme
  premium: {
    basePrice: 10000,
    perKm: 1500,
    minimumFare: 10000,
  },
  // Taxi classique (alias)
  taxi: {
    basePrice: 5000,
    perKm: 800,
    minimumFare: 5000,
  },
  // Vehicule partage (clando)
  clando: {
    basePrice: 3000,
    perKm: 600,
    minimumFare: 3000,
  },
  // Vehicule de livraison
  livraison: {
    basePrice: 8000,
    perKm: 1200,
    minimumFare: 8000,
  },
  // Bus / transport en commun
  bus: {
    basePrice: 1500,
    perKm: 200,
    minimumFare: 1500,
  },
}

// Recuperer la distance entre deux zones
export function getDistance(fromZone: string, toZone: string): number {
  const from = fromZone.charAt(0).toUpperCase() + fromZone.slice(1).toLowerCase()
  const to = toZone.charAt(0).toUpperCase() + toZone.slice(1).toLowerCase()

  const fromRecord = ZONE_DISTANCES[from as ConakryZone]
  if (!fromRecord) {
    console.warn(`[ZoneDistances] Zone de depart inconnue: ${fromZone}`)
    return 0
  }

  const distance = fromRecord[to as ConakryZone]
  if (distance === undefined) {
    console.warn(`[ZoneDistances] Zone d'arrivee inconnue: ${toZone}`)
    return 0
  }

  return distance
}

// Calculer le tarif entre deux zones selon le type de vehicule
export function getFare(fromZone: string, toZone: string, vehicleType: string): number {
  const distance = getDistance(fromZone, toZone)

  // Meme zone : tarif minimum
  if (distance === 0) {
    const fare = VEHICLE_FARES[vehicleType]
    if (!fare) {
      console.warn(`[ZoneDistances] Type de vehicule inconnu: ${vehicleType}, utilisation du taxi par defaut`)
      return VEHICLE_FARES.taxi.minimumFare
    }
    return fare.minimumFare
  }

  const fare = VEHICLE_FARES[vehicleType]
  if (!fare) {
    console.warn(`[ZoneDistances] Type de vehicule inconnu: ${vehicleType}, utilisation du taxi par defaut`)
    return Math.max(VEHICLE_FARES.taxi.basePrice + VEHICLE_FARES.taxi.perKm * distance, VEHICLE_FARES.taxi.minimumFare)
  }

  // Calcul : prix de base + distance * prix/km, avec un minimum
  const calculatedFare = fare.basePrice + fare.perKm * distance
  return Math.round(Math.max(calculatedFare, fare.minimumFare))
}

// Interface pour le resultat de l'estimation complete
export interface FareEstimate {
  fareAmount: number
  distanceKm: number
  durationMinutes: number
  currency: string
}

// Estimer le tarif complet entre deux zones (utilise par les API rides et fare)
export function estimateFare(
  pickupZone: string,
  dropoffZone: string,
  vehicleType: string = 'auto'
): FareEstimate {
  const distanceKm = getDistance(pickupZone, dropoffZone)
  const fareAmount = getFare(pickupZone, dropoffZone, vehicleType)

  // Estimation de la duree : ~2 min par km en ville, 1.5 min/km hors ville
  const avgSpeedKmH = distanceKm <= 10 ? 25 : 40
  const durationMinutes = Math.max(5, Math.round((distanceKm / avgSpeedKmH) * 60))

  return {
    fareAmount,
    distanceKm,
    durationMinutes,
    currency: 'GNF',
  }
}
