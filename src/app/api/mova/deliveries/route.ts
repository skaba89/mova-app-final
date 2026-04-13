export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Generate a 4-digit OTP
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Approximate distance matrix between Conakry zones (km) — 13 communes CNT (Law L/2024/003/CNT)
const ZONE_DISTANCES: Record<string, Record<string, number>> = {
  Kaloum:    { Kaloum: 3, Dixinn: 4, Matam: 6, Ratoma: 12, Matoto: 14, Gbessia: 15, Tombolia: 16, Lambanyi: 11, Sonfonia: 13, Kagbelene: 18, Dubreka: 22, Maneah: 20, Sanoyah: 22 },
  Dixinn:    { Kaloum: 4, Dixinn: 3, Matam: 4, Ratoma: 9, Matoto: 11, Gbessia: 12, Tombolia: 13, Lambanyi: 8, Sonfonia: 10, Kagbelene: 15, Dubreka: 19, Maneah: 17, Sanoyah: 19 },
  Matam:     { Kaloum: 6, Dixinn: 4, Matam: 3, Ratoma: 6, Matoto: 7, Gbessia: 8, Tombolia: 9, Lambanyi: 5, Sonfonia: 7, Kagbelene: 12, Dubreka: 16, Maneah: 14, Sanoyah: 16 },
  Ratoma:    { Kaloum: 12, Dixinn: 9, Matam: 6, Ratoma: 3, Matoto: 5, Gbessia: 6, Tombolia: 4, Lambanyi: 3, Sonfonia: 5, Kagbelene: 10, Dubreka: 14, Maneah: 12, Sanoyah: 14 },
  Matoto:    { Kaloum: 14, Dixinn: 11, Matam: 7, Ratoma: 5, Matoto: 3, Gbessia: 4, Tombolia: 5, Lambanyi: 5, Sonfonia: 6, Kagbelene: 11, Dubreka: 15, Maneah: 13, Sanoyah: 15 },
  Gbessia:   { Kaloum: 15, Dixinn: 12, Matam: 8, Ratoma: 6, Matoto: 4, Gbessia: 2, Tombolia: 3, Lambanyi: 5, Sonfonia: 7, Kagbelene: 12, Dubreka: 16, Maneah: 14, Sanoyah: 16 },
  Tombolia:  { Kaloum: 16, Dixinn: 13, Matam: 9, Ratoma: 4, Matoto: 5, Gbessia: 3, Tombolia: 2, Lambanyi: 4, Sonfonia: 6, Kagbelene: 11, Dubreka: 15, Maneah: 13, Sanoyah: 15 },
  Lambanyi:  { Kaloum: 11, Dixinn: 8, Matam: 5, Ratoma: 3, Matoto: 5, Gbessia: 5, Tombolia: 4, Lambanyi: 2, Sonfonia: 3, Kagbelene: 9, Dubreka: 13, Maneah: 11, Sanoyah: 13 },
  Sonfonia:  { Kaloum: 13, Dixinn: 10, Matam: 7, Ratoma: 5, Matoto: 6, Gbessia: 7, Tombolia: 6, Lambanyi: 3, Sonfonia: 2, Kagbelene: 10, Dubreka: 14, Maneah: 12, Sanoyah: 14 },
  Kagbelene: { Kaloum: 18, Dixinn: 15, Matam: 12, Ratoma: 10, Matoto: 11, Gbessia: 12, Tombolia: 11, Lambanyi: 9, Sonfonia: 10, Kagbelene: 2, Dubreka: 5, Maneah: 4, Sanoyah: 6 },
  Dubreka:   { Kaloum: 22, Dixinn: 19, Matam: 16, Ratoma: 14, Matoto: 15, Gbessia: 16, Tombolia: 15, Lambanyi: 13, Sonfonia: 14, Kagbelene: 5, Dubreka: 2, Maneah: 6, Sanoyah: 8 },
  Maneah:    { Kaloum: 20, Dixinn: 17, Matam: 14, Ratoma: 12, Matoto: 13, Gbessia: 14, Tombolia: 13, Lambanyi: 11, Sonfonia: 12, Kagbelene: 4, Dubreka: 6, Maneah: 2, Sanoyah: 4 },
  Sanoyah:   { Kaloum: 22, Dixinn: 19, Matam: 16, Ratoma: 14, Matoto: 15, Gbessia: 16, Tombolia: 15, Lambanyi: 13, Sonfonia: 14, Kagbelene: 6, Dubreka: 8, Maneah: 4, Sanoyah: 2 },
};

// Estimate delivery price based on package details
function estimateDeliveryPrice(data: {
  pickupZone: string;
  deliveryZone: string;
  packageType: string;
  packageSize?: string;
  weight?: number;
  declaredValue?: number;
}): number {
  const zonePricing: Record<string, number> = {
    same: 3000,    // Same zone (distance <= 3 km)
    nearby: 5000,  // Adjacent zones (distance <= 7 km)
    far: 8000,     // Cross-city (distance > 7 km)
  };

  const distance = ZONE_DISTANCES[data.pickupZone]?.[data.deliveryZone] ?? 8;

  let basePrice: number;
  if (distance <= 3) {
    basePrice = zonePricing.same;
  } else if (distance <= 7) {
    basePrice = zonePricing.nearby;
  } else {
    basePrice = zonePricing.far;
  }

  // Package type multiplier
  const typeMultiplier: Record<string, number> = {
    standard: 1,
    fragile: 1.3,
    oversized: 1.5,
  };
  const typeMult = typeMultiplier[data.packageType] || 1;

  // Size multiplier
  const sizeMultiplier: Record<string, number> = {
    small: 0.8,
    medium: 1,
    large: 1.3,
  };
  const sizeMult = data.packageSize ? (sizeMultiplier[data.packageSize] || 1) : 1;

  // Weight surcharge (over 5kg)
  const weightSurcharge = data.weight && data.weight > 5 ? (data.weight - 5) * 500 : 0;

  // Insurance on declared value
  const insurance = data.declaredValue ? data.declaredValue * 0.02 : 0;

  return Math.round((basePrice * typeMult * sizeMult) + weightSurcharge + insurance);
}

// GET /api/mova/deliveries?senderId=xxx&status=in_transit
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const senderId = searchParams.get('senderId');
    const courierId = searchParams.get('courierId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};

    if (senderId) where.senderId = senderId;
    if (courierId) where.courierId = courierId;
    if (status) where.status = status;

    const [deliveries, total] = await Promise.all([
      db.delivery.findMany({
        where,
        include: {
          sender: {
            select: { id: true, name: true, phone: true, avatar: true },
          },
          courier: {
            select: { id: true, name: true, phone: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.delivery.count({ where }),
    ]);

    // Format deliveries without exposing OTP
    const formatted = deliveries.map((d) => ({
      ...d,
      otp: d.status === 'pending' || d.status === 'picked_up' || d.status === 'in_transit'
        ? d.otp
        : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération des livraisons: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/mova/deliveries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      senderId,
      pickupName,
      pickupPhone,
      pickupAddress,
      pickupLat,
      pickupLng,
      pickupZone,
      deliveryName,
      deliveryPhone,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryZone,
      packageType,
      packageSize,
      weight,
      declaredValue,
    } = body;

    // Validate required fields
    const requiredFields = [
      'senderId', 'pickupName', 'pickupPhone', 'pickupAddress',
      'pickupLat', 'pickupLng', 'pickupZone',
      'deliveryName', 'deliveryPhone', 'deliveryAddress',
      'deliveryLat', 'deliveryLng', 'deliveryZone',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Le champ '${field}' est requis` },
          { status: 400 }
        );
      }
    }

    const validPackageTypes = ['standard', 'fragile', 'oversized'];
    const selectedPackageType = packageType || 'standard';
    if (!validPackageTypes.includes(selectedPackageType)) {
      return NextResponse.json(
        { success: false, error: 'Type de colis invalide' },
        { status: 400 }
      );
    }

    // Validate coordinates
    if (pickupLat < -90 || pickupLat > 90 || pickupLng < -180 || pickupLng > 180) {
      return NextResponse.json(
        { success: false, error: 'Coordonnées de ramassage invalides' },
        { status: 400 }
      );
    }

    if (deliveryLat < -90 || deliveryLat > 90 || deliveryLng < -180 || deliveryLng > 180) {
      return NextResponse.json(
        { success: false, error: 'Coordonnées de livraison invalides' },
        { status: 400 }
      );
    }

    // Estimate price
    const estimatedPrice = estimateDeliveryPrice({
      pickupZone,
      deliveryZone,
      packageType: selectedPackageType,
      packageSize,
      weight,
      declaredValue,
    });

    // Generate OTP
    const otp = generateOTP();

    // Create delivery
    const delivery = await db.delivery.create({
      data: {
        senderId,
        pickupName,
        pickupPhone,
        pickupAddress,
        pickupLat,
        pickupLng,
        pickupZone,
        deliveryName,
        deliveryPhone,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        deliveryZone,
        packageType: selectedPackageType,
        packageSize: packageSize || null,
        weight: weight || null,
        declaredValue: declaredValue || null,
        status: 'pending',
        estimatedPrice,
        otp,
      },
      include: {
        sender: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: delivery.id,
        otp: delivery.otp,
        estimatedPrice: delivery.estimatedPrice,
        estimatedPriceFormatted: `${Number(delivery.estimatedPrice).toLocaleString('fr-GN')} GNF`,
        status: delivery.status,
        pickup: {
          name: delivery.pickupName,
          phone: delivery.pickupPhone,
          address: delivery.pickupAddress,
          zone: delivery.pickupZone,
        },
        delivery: {
          name: delivery.deliveryName,
          phone: delivery.deliveryPhone,
          address: delivery.deliveryAddress,
          zone: delivery.deliveryZone,
        },
        package: {
          type: delivery.packageType,
          size: delivery.packageSize,
          weight: delivery.weight,
          declaredValue: delivery.declaredValue,
        },
        createdAt: delivery.createdAt,
      },
      message: 'Livraison créée avec succès. Le code OTP a été généré.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la création de la livraison: ${message}` },
      { status: 500 }
    );
  }
}
