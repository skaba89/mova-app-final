import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { isOnline, isActive, currentLat, currentLng, zone, vehicle } = body;

    const existingDriver = await db.user.findUnique({
      where: { id, role: 'driver' },
      include: { vehicles: { where: { isActive: true } } },
    });

    if (!existingDriver) {
      return NextResponse.json(
        { success: false, error: 'Chauffeur non trouvé' },
        { status: 404 }
      );
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (isOnline !== undefined) updateData.isOnline = isOnline;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (currentLat !== undefined) updateData.currentLat = parseFloat(currentLat);
    if (currentLng !== undefined) updateData.currentLng = parseFloat(currentLng);
    if (zone !== undefined) updateData.zone = zone;

    // Update vehicle data if provided
    if (vehicle && existingDriver.vehicles.length > 0) {
      const vehicleUpdate: Prisma.VehicleUpdateInput = {};
      if (vehicle.brand !== undefined) vehicleUpdate.brand = vehicle.brand;
      if (vehicle.model !== undefined) vehicleUpdate.model = vehicle.model;
      if (vehicle.plate !== undefined) vehicleUpdate.plate = vehicle.plate;
      if (vehicle.color !== undefined) vehicleUpdate.color = vehicle.color;
      if (vehicle.year !== undefined) vehicleUpdate.year = typeof vehicle.year === 'string' ? parseInt(vehicle.year) : vehicle.year;
      if (vehicle.type !== undefined) vehicleUpdate.type = vehicle.type;
      await db.vehicle.update({
        where: { id: existingDriver.vehicles[0].id },
        data: vehicleUpdate,
      });
    }

    const driver = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        vehicles: { where: { isActive: true } },
      },
    });

    const { password: _password, ...safeDriver } = driver;

    return NextResponse.json({ success: true, data: safeDriver });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Update driver error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour du chauffeur' },
      { status: 500 }
    );
  }
}
