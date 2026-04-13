import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// Intercity fare calculation constants
const INTERCITY_BASE_FARE: Record<string, number> = {
  bus_shared: 15000,
  car_shared: 25000,
  car_private: 80000,
};

const INTERCITY_PER_KM: Record<string, number> = {
  bus_shared: 150,
  car_shared: 250,
  car_private: 500,
};

// Popular intercity routes with distances (km)
const POPULAR_ROUTES = [
  { id: 'r1', departure: 'Conakry', arrival: 'Kindia', distance: 150, estimatedDuration: 150, frequency: 'quotidien', departures: ['06:00', '08:00', '10:00', '14:00', '16:00'] },
  { id: 'r2', departure: 'Conakry', arrival: 'Labe', distance: 350, estimatedDuration: 350, frequency: 'quotidien', departures: ['06:00', '07:30', '19:00'] },
  { id: 'r3', departure: 'Conakry', arrival: 'Kankan', distance: 600, estimatedDuration: 600, frequency: 'journalier', departures: ['05:30', '07:00', '18:00'] },
  { id: 'r4', departure: 'Conakry', arrival: 'Nzerekore', distance: 900, estimatedDuration: 900, frequency: 'journalier', departures: ['05:00', '17:00'] },
  { id: 'r5', departure: 'Conakry', arrival: 'Boke', distance: 200, estimatedDuration: 200, frequency: 'quotidien', departures: ['06:00', '08:00', '10:00', '14:00'] },
  { id: 'r6', departure: 'Conakry', arrival: 'Mamou', distance: 250, estimatedDuration: 250, frequency: 'quotidien', departures: ['06:30', '08:00', '15:00'] },
  { id: 'r7', departure: 'Conakry', arrival: 'Faranah', distance: 450, estimatedDuration: 450, frequency: 'journalier', departures: ['06:00', '07:30', '18:00'] },
  { id: 'r8', departure: 'Conakry', arrival: 'Siguiri', distance: 700, estimatedDuration: 700, frequency: 'hebdomadaire', departures: ['05:00', '17:00'] },
  { id: 'r9', departure: 'Conakry', arrival: 'Dubreka', distance: 70, estimatedDuration: 70, frequency: 'quotidien', departures: ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00'] },
  { id: 'r10', departure: 'Conakry', arrival: 'Coyah', distance: 50, estimatedDuration: 50, frequency: 'quotidien', departures: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'] },
  { id: 'r11', departure: 'Conakry', arrival: 'Fria', distance: 160, estimatedDuration: 160, frequency: 'quotidien', departures: ['07:00', '09:00', '14:00'] },
  { id: 'r12', departure: 'Conakry', arrival: 'Forecariah', distance: 100, estimatedDuration: 100, frequency: 'quotidien', departures: ['06:30', '08:00', '10:00', '14:00', '16:00'] },
  { id: 'r13', departure: 'Conakry', arrival: 'Kissidougou', distance: 700, estimatedDuration: 700, frequency: 'hebdomadaire', departures: ['06:00', '18:00'] },
  { id: 'r14', departure: 'Conakry', arrival: 'Macenta', distance: 800, estimatedDuration: 800, frequency: 'hebdomadaire', departures: ['05:30', '17:30'] },
  { id: 'r15', departure: 'Conakry', arrival: 'Lola', distance: 950, estimatedDuration: 950, frequency: 'hebdomadaire', departures: ['05:00'] },
  { id: 'r16', departure: 'Conakry', arrival: 'Beyla', distance: 850, estimatedDuration: 850, frequency: 'hebdomadaire', departures: ['05:00', '17:00'] },
];

const AVAILABLE_VEHICLES = [
  { type: 'bus_shared', label: 'Bus partage', icon: 'bus', capacity: 50, comfort: 'standard' },
  { type: 'car_shared', label: 'Voiture partagee', icon: 'car', capacity: 4, comfort: 'confortable' },
  { type: 'car_private', label: 'Voiture privee', icon: 'car', capacity: 4, comfort: 'premium' },
];

const DEMO_CITIES = [
  { name: 'Conakry', region: 'Conakry' },
  { name: 'Kindia', region: 'Kindia' },
  { name: 'Labe', region: 'Labe' },
  { name: 'Kankan', region: 'Kankan' },
  { name: 'Nzerekore', region: 'Nzerekore' },
  { name: 'Boke', region: 'Boke' },
  { name: 'Mamou', region: 'Mamou' },
  { name: 'Faranah', region: 'Faranah' },
  { name: 'Siguiri', region: 'Siguiri' },
  { name: 'Dubreka', region: 'Kindia' },
  { name: 'Coyah', region: 'Kindia' },
  { name: 'Fria', region: 'Boke' },
  { name: 'Forecariah', region: 'Kindia' },
  { name: 'Kissidougou', region: 'Nzerekore' },
  { name: 'Macenta', region: 'Nzerekore' },
  { name: 'Lola', region: 'Nzerekore' },
  { name: 'Beyla', region: 'Nzerekore' },
];

function calculateFare(distance: number, vehicleType: string): number {
  const base = INTERCITY_BASE_FARE[vehicleType] || INTERCITY_BASE_FARE.bus_shared;
  const perKm = INTERCITY_PER_KM[vehicleType] || INTERCITY_PER_KM.bus_shared;
  return Math.round(base + distance * perKm);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const departureCity = searchParams.get('departureCity');
    const arrivalCity = searchParams.get('arrivalCity');

    // Return available routes with fares
    let routes = POPULAR_ROUTES.map((route) => ({
      id: route.id,
      route: `${route.departure}-${route.arrival}`,
      departureCity: route.departure,
      arrivalCity: route.arrival,
      distance: route.distance,
      estimatedDuration: route.estimatedDuration,
      frequency: route.frequency,
      departures: route.departures,
      fares: {
        bus_shared: calculateFare(route.distance, 'bus_shared'),
        car_shared: calculateFare(route.distance, 'car_shared'),
        car_private: calculateFare(route.distance, 'car_private'),
      },
    }));

    // Filter by departure city if provided
    if (departureCity) {
      routes = routes.filter(
        (r) =>
          r.departureCity.toLowerCase() === departureCity.toLowerCase()
      );
    }

    // Filter by arrival city if provided
    if (arrivalCity) {
      routes = routes.filter(
        (r) =>
          r.arrivalCity.toLowerCase() === arrivalCity.toLowerCase()
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        routes,
        vehicles: AVAILABLE_VEHICLES,
        cities: DEMO_CITIES,
        totalRoutes: routes.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la recuperation des trajets: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      departureCity,
      arrivalCity,
      scheduledDate,
      vehicleType,
      seats,
      passengerName,
      passengerPhone,
      estimatedFare,
      paymentMethod,
    } = body;

    // Validate required fields
    if (!departureCity || !arrivalCity || !scheduledDate) {
      return NextResponse.json(
        { success: false, error: 'Champs requis manquants: departureCity, arrivalCity, scheduledDate' },
        { status: 400 }
      );
    }

    if (!passengerName || !passengerPhone) {
      return NextResponse.json(
        { success: false, error: 'Champs requis manquants: passengerName, passengerPhone' },
        { status: 400 }
      );
    }

    // Validate vehicle type
    const validTypes = ['bus_shared', 'car_shared', 'car_private'];
    const vType = vehicleType || 'bus_shared';
    if (!validTypes.includes(vType)) {
      return NextResponse.json(
        { success: false, error: 'Type de vehicule invalide. Choisissez: bus_shared, car_shared, car_private' },
        { status: 400 }
      );
    }

    // Validate payment method
    const validPaymentMethods = ['cash', 'mobile_money', 'wallet', 'card'];
    const pMethod = paymentMethod || 'cash';
    if (pMethod && !validPaymentMethods.includes(pMethod)) {
      return NextResponse.json(
        { success: false, error: 'Methode de paiement invalide. Choisissez: cash, mobile_money, wallet, card' },
        { status: 400 }
      );
    }

    // Find the route to get distance
    const route = POPULAR_ROUTES.find(
      (r) =>
        (r.departure.toLowerCase() === departureCity.toLowerCase() &&
          r.arrival.toLowerCase() === arrivalCity.toLowerCase()) ||
        (r.arrival.toLowerCase() === departureCity.toLowerCase() &&
          r.departure.toLowerCase() === arrivalCity.toLowerCase())
    );
    const distance = route?.distance || 300;
    const duration = route?.estimatedDuration || Math.round(distance * 1); // ~60 km/h average
    const fare = estimatedFare || calculateFare(distance, vType);

    // Validate scheduled date is in the future
    const scheduled = new Date(scheduledDate);
    if (isNaN(scheduled.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Date invalide. Format attendu: YYYY-MM-DDTHH:mm:ss.sssZ' },
        { status: 400 }
      );
    }
    if (scheduled <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'La date prevue doit etre dans le futur' },
        { status: 400 }
      );
    }

    // Validate seats
    const numSeats = parseInt(seats, 10) || 1;
    if (numSeats < 1 || numSeats > 10) {
      return NextResponse.json(
        { success: false, error: 'Le nombre de places doit etre entre 1 et 10' },
        { status: 400 }
      );
    }

    // Find or create passenger user by phone
    let user = await db.user.findUnique({ where: { phone: passengerPhone } });
    if (!user) {
      user = await db.user.create({
        data: {
          name: passengerName,
          email: `${passengerPhone}@mova-intercity.local`,
          phone: passengerPhone,
          role: 'passenger',
        },
      });
    }

    const bookingRef = `MOVA-IC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Persist booking to database
    const booking = await db.booking.create({
      data: {
        passengerId: user.id,
        vehicleType: vType,
        pickupAddress: departureCity,
        pickupLat: 0,
        pickupLng: 0,
        pickupZone: departureCity,
        dropoffAddress: arrivalCity,
        dropoffLat: 0,
        dropoffLng: 0,
        dropoffZone: arrivalCity,
        scheduledFor: scheduled,
        estimatedFare: fare,
        notes: JSON.stringify({
          type: 'intercity',
          bookingRef,
          passengerName,
          passengerPhone,
          distance,
          estimatedDuration: duration,
          seats: numSeats,
          totalFare: fare * numSeats,
          paymentMethod: pMethod,
        }),
        status: 'confirmed',
      },
      include: {
        passenger: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...booking,
        bookingRef,
        departureCity,
        arrivalCity,
        distance,
        estimatedDuration: duration,
        seats: numSeats,
        totalFare: fare * numSeats,
        paymentMethod: pMethod,
      },
      message: 'Reservation interurbaine creee avec succes',
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la reservation du trajet: ${message}` },
      { status: 500 }
    );
  }
}
