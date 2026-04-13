import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// School transport pricing (GNF)
const SCHOOL_PRICING: Record<string, { price: number; months: number; label: string }> = {
  monthly: { price: 150000, months: 1, label: 'Mensuel' },
  quarterly: { price: 400000, months: 3, label: 'Trimestriel' },
  yearly: { price: 1400000, months: 12, label: 'Annuel' },
};

// Demo schools
const DEMO_SCHOOLS = [
  { id: 's1', name: 'Lycee Sainte-Marie', commune: 'Dixinn', levels: ['6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'Tle'], type: 'prive' },
  { id: 's2', name: 'Lycee Kipé', commune: 'Ratoma', levels: ['6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'Tle'], type: 'public' },
  { id: 's3', name: 'College Saint-Joseph', commune: 'Kaloum', levels: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2', '6eme', '5eme'], type: 'prive' },
  { id: 's4', name: 'Ecole Almamya', commune: 'Matam', levels: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'], type: 'prive' },
  { id: 's5', name: 'Complexe Scolaire Nongo', commune: 'Ratoma', levels: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2', '6eme', '5eme', '4eme', '3eme'], type: 'prive' },
  { id: 's6', name: 'Lycee Donka', commune: 'Dixinn', levels: ['2nde', '1ere', 'Tle'], type: 'public' },
  { id: 's7', name: 'Ecole Primaire Kassa', commune: 'Kaloum', levels: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'], type: 'public' },
  { id: 's8', name: 'Groupe Scolaire Source d\'Or', commune: 'Matoto', levels: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2', '6eme', '5eme', '4eme', '3eme'], type: 'prive' },
];

// Demo subscriptions
const DEMO_SUBSCRIPTIONS = [
  {
    id: 'st-001',
    childName: 'Aminata Diallo',
    school: 'Lycee Sainte-Marie',
    commune: 'Dixinn',
    gradeLevel: '5eme',
    schedule: 'morning',
    pickupTime: '06:45',
    serviceType: 'monthly',
    status: 'active',
    startsAt: '2024-09-01T00:00:00.000Z',
    expiresAt: '2024-10-01T00:00:00.000Z',
    price: 150000,
    createdAt: '2024-08-28T10:30:00.000Z',
  },
  {
    id: 'st-002',
    childName: 'Ibrahima Bah',
    school: 'College Saint-Joseph',
    commune: 'Kaloum',
    gradeLevel: 'CM2',
    schedule: 'both',
    pickupTime: '06:30',
    serviceType: 'quarterly',
    status: 'active',
    startsAt: '2024-09-01T00:00:00.000Z',
    expiresAt: '2024-12-01T00:00:00.000Z',
    price: 400000,
    createdAt: '2024-08-25T14:00:00.000Z',
  },
  {
    id: 'st-003',
    childName: 'Fatoumata Sylla',
    school: 'Complexe Scolaire Nongo',
    commune: 'Ratoma',
    gradeLevel: '4eme',
    schedule: 'afternoon',
    pickupTime: '15:30',
    serviceType: 'yearly',
    status: 'active',
    startsAt: '2024-09-01T00:00:00.000Z',
    expiresAt: '2025-09-01T00:00:00.000Z',
    price: 1400000,
    createdAt: '2024-08-20T09:15:00.000Z',
  },
];

// Available features
const FEATURES = [
  { id: 'f1', label: 'Courses suivies en temps reel', included: true },
  { id: 'f2', label: 'Chauffeurs verifies et experimentes', included: true },
  { id: 'f3', label: 'Notifications en temps reel', included: true },
  { id: 'f4', label: 'Assurance passagers incluse', included: true },
  { id: 'f5', label: 'Support client prioritaire', included: true },
  { id: 'f6', label: 'Controle parental', included: true },
  { id: 'f7', label: 'Geolocalisation enfants', included: true },
  { id: 'f8', label: 'Confirmation de prise en charge', included: true },
  { id: 'f9', label: 'Alerte arrivee a l\'ecole', included: true },
  { id: 'f10', label: 'Alerte arrivee au domicile', included: true },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const commune = searchParams.get('commune');

    // Filter subscriptions
    let subscriptions = [...DEMO_SUBSCRIPTIONS];

    if (status) {
      subscriptions = subscriptions.filter((s) => s.status === status);
    }

    if (commune) {
      subscriptions = subscriptions.filter(
        (s) => s.commune.toLowerCase() === commune.toLowerCase()
      );
    }

    // Summary stats
    const activeCount = subscriptions.filter((s) => s.status === 'active').length;
    const totalSpent = subscriptions
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + s.price, 0);

    return NextResponse.json({
      success: true,
      data: {
        subscriptions,
        totalSubscriptions: subscriptions.length,
        schools: DEMO_SCHOOLS,
        pricing: Object.entries(SCHOOL_PRICING).map(([type, info]) => ({
          type,
          price: info.price,
          months: info.months,
          label: info.label,
        })),
        features: FEATURES,
        summary: {
          activeSubscriptions: activeCount,
          totalActiveSpent: totalSpent,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la recuperation: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      childName,
      school,
      commune,
      gradeLevel,
      schedule,
      pickupTime,
      serviceType,
      parentName,
      parentPhone,
      paymentMethod,
    } = body;

    // Validate required fields
    if (!childName || !school || !commune) {
      return NextResponse.json(
        { success: false, error: 'Champs requis manquants: childName, school, commune' },
        { status: 400 }
      );
    }

    if (!parentName || !parentPhone) {
      return NextResponse.json(
        { success: false, error: 'Champs requis manquants: parentName, parentPhone' },
        { status: 400 }
      );
    }

    // Validate schedule
    const validSchedules = ['morning', 'afternoon', 'both'];
    const sched = schedule || 'both';
    if (!validSchedules.includes(sched)) {
      return NextResponse.json(
        { success: false, error: 'Horaire invalide. Choisissez: morning, afternoon, both' },
        { status: 400 }
      );
    }

    // Validate service type (package)
    const validPackages = ['monthly', 'quarterly', 'yearly'];
    const pkgType = serviceType || 'monthly';
    if (!validPackages.includes(pkgType)) {
      return NextResponse.json(
        { success: false, error: 'Type de forfait invalide. Choisissez: monthly, quarterly, yearly' },
        { status: 400 }
      );
    }

    // Validate payment method
    const validPaymentMethods = ['cash', 'mobile_money', 'wallet', 'card'];
    const pMethod = paymentMethod || 'mobile_money';
    if (pMethod && !validPaymentMethods.includes(pMethod)) {
      return NextResponse.json(
        { success: false, error: 'Methode de paiement invalide. Choisissez: cash, mobile_money, wallet, card' },
        { status: 400 }
      );
    }

    // Validate pickup time format
    if (pickupTime && !/^\d{2}:\d{2}$/.test(pickupTime)) {
      return NextResponse.json(
        { success: false, error: 'Format d\'heure invalide. Utilisez le format HH:MM' },
        { status: 400 }
      );
    }

    // Calculate pricing and dates
    const pricing = SCHOOL_PRICING[pkgType];
    const price = pricing.price;
    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setMonth(expiresAt.getMonth() + pricing.months);

    // Determine default pickup time based on schedule
    const defaultPickupTime = sched === 'morning' ? '06:30' : sched === 'afternoon' ? '15:00' : '06:30';

    // Find or create parent user by phone
    let user = await db.user.findUnique({ where: { phone: parentPhone } });
    if (!user) {
      user = await db.user.create({
        data: {
          name: parentName,
          email: `${parentPhone}@mova-school.local`,
          phone: parentPhone,
          role: 'passenger',
        },
      });
    }

    const bookingRef = `MOVA-SC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const finalPickupTime = pickupTime || defaultPickupTime;

    // Persist school subscription as a Booking record with SCHOOL: prefix in notes
    const booking = await db.booking.create({
      data: {
        passengerId: user.id,
        vehicleType: 'school_bus',
        pickupAddress: `Domicile - ${commune}`,
        pickupLat: 0,
        pickupLng: 0,
        pickupZone: commune,
        dropoffAddress: `${school} - ${commune}`,
        dropoffLat: 0,
        dropoffLng: 0,
        dropoffZone: commune,
        scheduledFor: startsAt,
        estimatedFare: price,
        notes: `SCHOOL:${JSON.stringify({
          bookingRef,
          childName,
          school,
          commune,
          gradeLevel: gradeLevel || 'non-specifie',
          schedule: sched,
          pickupTime: finalPickupTime,
          serviceType: pkgType,
          parentName,
          parentPhone,
          paymentMethod: pMethod,
          expiresAt: expiresAt.toISOString(),
        })}`,
        status: 'scheduled',
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
        childName,
        school,
        commune,
        gradeLevel: gradeLevel || 'non-specifie',
        schedule: sched,
        pickupTime: finalPickupTime,
        serviceType: pkgType,
        parentName,
        parentPhone,
        paymentMethod: pMethod,
        price,
        status: 'active',
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      message: 'Inscription scolaire creee avec succes',
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la creation de l'inscription: ${message}` },
      { status: 500 }
    );
  }
}
