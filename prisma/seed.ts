import { db } from '@/lib/db'

async function seed() {
  // ============ SEED CONAKRY ZONES ============
  const zones = [
    { name: 'Kaloum', nameFr: 'Kaloum', lat: 9.5092, lng: -13.7122, sortOrder: 0 },
    { name: 'Dixinn', nameFr: 'Dixinn', lat: 9.5347, lng: -13.6889, sortOrder: 1 },
    { name: 'Matam', nameFr: 'Matam', lat: 9.5633, lng: -13.6633, sortOrder: 2 },
    { name: 'Ratoma', nameFr: 'Ratoma', lat: 9.5580, lng: -13.5850, sortOrder: 3 },
    { name: 'Matoto', nameFr: 'Matoto', lat: 9.5850, lng: -13.5500, sortOrder: 4 },
  ]

  for (const zone of zones) {
    await db.zone.upsert({
      where: { name: zone.name },
      update: zone,
      create: zone,
    })
  }
  console.log('✅ Zones seeded')

  // ============ SEED DEMO DRIVERS ============
  const drivers = [
    { name: 'Mamadou Diallo', email: 'mamadou@mova.gn', phone: '+224621000001', role: 'driver', zone: 'Kaloum', rating: 4.8, totalRides: 312, isOnline: true, password: 'demo123' },
    { name: 'Fatoumata Bah', email: 'fatoumata@mova.gn', phone: '+224621000002', role: 'driver', zone: 'Dixinn', rating: 4.9, totalRides: 245, isOnline: true, password: 'demo123' },
    { name: 'Ibrahima Soumah', email: 'ibrahima@mova.gn', phone: '+224621000003', role: 'driver', zone: 'Ratoma', rating: 4.7, totalRides: 178, isOnline: false, password: 'demo123' },
    { name: 'Aissatou Conde', email: 'aissatou@mova.gn', phone: '+224621000004', role: 'driver', zone: 'Matam', rating: 4.95, totalRides: 420, isOnline: true, password: 'demo123' },
    { name: 'Sekou Toure', email: 'sekou@mova.gn', phone: '+224621000005', role: 'driver', zone: 'Matoto', rating: 4.6, totalRides: 89, isOnline: true, password: 'demo123' },
  ]

  for (const driver of drivers) {
    const user = await db.user.upsert({
      where: { email: driver.email },
      update: driver,
      create: driver,
    })

    // Seed vehicles for each driver
    const vehicleData = [
      { brand: 'Toyota', model: 'Corolla', plate: `GN-${user.id.slice(-4).toUpperCase()}-A`, color: 'Blanc', type: 'standard' },
    ]
    if (driver.rating >= 4.8) {
      vehicleData.push({ brand: 'Mercedes', model: 'C-Class', plate: `GN-${user.id.slice(-4).toUpperCase()}-B`, color: 'Noir', type: 'premium' })
    }

    for (const v of vehicleData) {
      await db.vehicle.upsert({
        where: { plate: v.plate },
        update: {},
        create: { ...v, driverId: user.id },
      })
    }
  }
  console.log('✅ Drivers & vehicles seeded')

  // ============ SEED DEMO PASSENGERS ============
  const passengers = [
    { name: 'Abdoulaye Camara', email: 'abdoulaye@mova.gn', phone: '+224661000010', role: 'passenger', zone: 'Kaloum', rating: 4.5, totalRides: 23, password: 'demo123' },
    { name: 'Mariama Sylla', email: 'mariama@mova.gn', phone: '+224661000011', role: 'passenger', zone: 'Dixinn', rating: 4.7, totalRides: 45, password: 'demo123' },
  ]

  for (const p of passengers) {
    await db.user.upsert({
      where: { email: p.email },
      update: p,
      create: p,
    })
  }
  console.log('✅ Passengers seeded')

  // ============ SEED DEMO ADMIN ============
  await db.user.upsert({
    where: { email: 'admin@mova.gn' },
    update: {},
    create: {
      name: 'Admin MOVA',
      email: 'admin@mova.gn',
      phone: '+224660000000',
      role: 'admin',
      password: 'admin123',
    },
  })
  console.log('✅ Admin seeded')

  // ============ SEED DEMO RIDES ============
  const allDrivers = await db.user.findMany({ where: { role: 'driver' } })
  const allPassengers = await db.user.findMany({ where: { role: 'passenger' } })
  const rideStatuses = ['completed', 'completed', 'completed', 'in_progress', 'pending', 'accepted']

  const rideTemplates = [
    { pickup: 'Aéroport Gbessia', pickupZone: 'Matoto', pickupLat: 9.5808, pickupLng: -13.6105, dropoff: 'Hôtel Riviera', dropoffZone: 'Kaloum', dropoffLat: 9.5045, dropoffLng: -13.7220, fare: 15000, distance: 14.2, duration: 35 },
    { pickup: 'Marché Madina', pickupZone: 'Matam', pickupLat: 9.5560, pickupLng: -13.6700, dropoff: 'Palais du Peuple', dropoffZone: 'Dixinn', dropoffLat: 9.5380, dropoffLng: -13.6950, fare: 8000, distance: 5.8, duration: 18 },
    { pickup: 'Kipé', pickupZone: 'Ratoma', pickupLat: 9.5700, pickupLng: -13.6200, dropoff: 'Centre-ville', dropoffZone: 'Kaloum', dropoffLat: 9.5090, dropoffLng: -13.7120, fare: 10000, distance: 9.5, duration: 25 },
    { pickup: 'Cosa', pickupZone: 'Matoto', pickupLat: 9.5920, pickupLng: -13.5700, dropoff: 'Corniche Nord', dropoffZone: 'Dixinn', dropoffLat: 9.5450, dropoffLng: -13.7050, fare: 18000, distance: 16.8, duration: 40 },
    { pickup: 'Belle Vue', pickupZone: 'Matam', pickupLat: 9.5500, pickupLng: -13.6500, dropoff: 'Université Gammal', dropoffZone: 'Ratoma', dropoffLat: 9.5600, dropoffLng: -13.5900, fare: 6000, distance: 4.2, duration: 12 },
  ]

  for (let i = 0; i < rideTemplates.length; i++) {
    const template = rideTemplates[i]
    const driver = allDrivers[i % allDrivers.length]
    const passenger = allPassengers[i % allPassengers.length]
    const status = rideStatuses[i % rideStatuses.length]

    const vehicle = await db.vehicle.findFirst({ where: { driverId: driver.id } })
    const now = new Date()
    const hoursAgo = (i + 1) * 2

    const ride = await db.ride.create({
      data: {
        status,
        passengerId: passenger.id,
        driverId: driver.id,
        vehicleId: vehicle?.id,
        pickupAddress: template.pickup,
        pickupLat: template.pickupLat,
        pickupLng: template.pickupLng,
        pickupZone: template.pickupZone,
        dropoffAddress: template.dropoff,
        dropoffLat: template.dropoffLat,
        dropoffLng: template.dropoffLng,
        dropoffZone: template.dropoffZone,
        estimatedFare: template.fare,
        actualFare: status === 'completed' ? template.fare * (0.9 + Math.random() * 0.2) : null,
        distance: template.distance,
        duration: template.duration,
        passengerRating: status === 'completed' ? 4 + Math.random() : null,
        driverRating: status === 'completed' ? 4 + Math.random() : null,
        createdAt: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000),
        ...(status === 'in_progress' ? { startedAt: new Date(now.getTime() - 15 * 60 * 1000) } : {}),
        ...(status === 'completed' ? { startedAt: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000), completedAt: new Date(now.getTime() - (hoursAgo - 1) * 60 * 60 * 1000) } : {}),
      },
    })

    if (status === 'completed') {
      await db.payment.create({
        data: {
          rideId: ride.id,
          userId: passenger.id,
          amount: ride.actualFare!,
          method: ['cash', 'mobile_money', 'card'][i % 3],
          status: 'completed',
          provider: ['Orange Money', 'MTN Mobile Money', null][i % 3] as string | null,
        },
      })
    }
  }
  console.log('✅ Demo rides & payments seeded')

  // ============ WALLET SYSTEM ============
  const demoPassenger = allPassengers[0] // Abdoulaye Camara

  const wallet = await db.wallet.upsert({
    where: { userId: demoPassenger.id },
    update: {},
    create: {
      userId: demoPassenger.id,
      balance: 125000,
      currency: 'GNF',
    },
  })

  // 5 wallet transactions for demo passenger
  const walletTransactions = [
    { type: 'topup', amount: 200000, balance: 200000, method: 'mobile_money', provider: 'Orange Money', reference: 'OM-TOP-2024001', description: 'Recharge Orange Money', status: 'completed' },
    { type: 'debit', amount: 15000, balance: 185000, method: 'system', provider: null, reference: null, description: 'Paiement course - Aéroport Gbessia vers Hôtel Riviera', status: 'completed' },
    { type: 'cashback', amount: 1500, balance: 186500, method: 'system', provider: null, reference: null, description: 'Cashback 10% - Course premium', status: 'completed' },
    { type: 'debit', amount: 8000, balance: 178500, method: 'system', provider: null, reference: null, description: 'Paiement course - Marché Madina vers Palais du Peuple', status: 'completed' },
    { type: 'referral_bonus', amount: 5000, balance: 125000, method: 'system', provider: null, reference: null, description: 'Bonus parrainage - Invitation de Mariama Sylla', status: 'completed' },
  ]

  for (const tx of walletTransactions) {
    await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        ...tx,
      },
    })
  }
  console.log('✅ Wallet & transactions seeded')

  // ============ PROMOTIONS ============
  const now = new Date()
  const promotions = [
    {
      code: 'BIENVENUE50',
      title: 'Bienvenue sur MOVA',
      description: '50% de réduction sur votre première course',
      type: 'percentage',
      value: 50,
      minOrder: 3000,
      maxDiscount: 10000,
      usageLimit: 1000,
      perUserLimit: 1,
      startsAt: new Date('2024-01-01'),
      expiresAt: new Date('2025-12-31'),
      isActive: true,
    },
    {
      code: 'RIDEFREE',
      title: 'Course gratuite',
      description: 'Votre 10ème course est offerte ! Merci pour votre fidélité.',
      type: 'free_ride',
      value: 0,
      minOrder: 5000,
      maxDiscount: 20000,
      usageLimit: 500,
      perUserLimit: 1,
      startsAt: new Date('2024-01-01'),
      expiresAt: new Date('2025-06-30'),
      isActive: true,
    },
    {
      code: 'MOVA10',
      title: 'Réduction MOVA10',
      description: '10% de réduction sur toutes vos courses cette semaine',
      type: 'percentage',
      value: 10,
      minOrder: 0,
      maxDiscount: 5000,
      usageLimit: 5000,
      perUserLimit: 5,
      startsAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  ]

  for (const promo of promotions) {
    await db.promotion.upsert({
      where: { code: promo.code },
      update: {},
      create: promo,
    })
  }
  console.log('✅ Promotions seeded')

  // ============ REFERRALS ============
  const referredUsers = [
    { name: 'Ousmane Keita', email: 'ousmane@mova.gn', phone: '+224661000020', role: 'passenger' as const, zone: 'Ratoma', rating: 4.3, totalRides: 8, password: 'demo123' },
    { name: 'Aminata Diallo', email: 'aminata@mova.gn', phone: '+224661000021', role: 'passenger' as const, zone: 'Matoto', rating: 4.8, totalRides: 31, password: 'demo123' },
    { name: 'Moussa Bangoura', email: 'moussa@mova.gn', phone: '+224661000022', role: 'passenger' as const, zone: 'Matam', rating: 4.6, totalRides: 15, password: 'demo123' },
  ]

  const referralCodes = ['ABDO2024', 'MARI2024', 'ABDO2024B']

  for (let i = 0; i < referredUsers.length; i++) {
    const referred = await db.user.upsert({
      where: { email: referredUsers[i].email },
      update: referredUsers[i],
      create: referredUsers[i],
    })

    const referrer = i < 2 ? allPassengers[0] : allPassengers[1]

    await db.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: referred.id,
        code: referralCodes[i],
        reward: 5000,
        status: i === 2 ? 'pending' : 'completed',
        completedAt: i < 2 ? new Date(now.getTime() - (i + 3) * 24 * 60 * 60 * 1000) : null,
      },
    })
  }
  console.log('✅ Referrals seeded')

  // ============ SUBSCRIPTIONS ============
  await db.subscription.create({
    data: {
      userId: demoPassenger.id,
      plan: 'premium',
      status: 'active',
      price: 50000,
      ridesLeft: 12,
      cashbackRate: 10,
      startsAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    },
  })
  console.log('✅ Subscriptions seeded')

  // ============ BOOKINGS (Scheduled Rides) ============
  const bookings = [
    {
      vehicleType: 'premium',
      pickupAddress: 'Aéroport Gbessia',
      pickupLat: 9.5808,
      pickupLng: -13.6105,
      pickupZone: 'Matoto',
      dropoffAddress: 'Hôtel Riviera',
      dropoffLat: 9.5045,
      dropoffLng: -13.7220,
      dropoffZone: 'Kaloum',
      scheduledFor: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // in 2 days
      estimatedFare: 15000,
      notes: 'Vol arrivant à 14h, besoin de help avec les bagages',
      status: 'scheduled',
    },
    {
      vehicleType: 'standard',
      pickupAddress: 'Résidence Kipé',
      pickupLat: 9.5680,
      pickupLng: -13.6150,
      pickupZone: 'Ratoma',
      dropoffAddress: 'Ambassade de France',
      dropoffLat: 9.5100,
      dropoffLng: -13.7050,
      dropoffZone: 'Kaloum',
      scheduledFor: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // in 5 days
      estimatedFare: 8000,
      notes: 'Rendez-vous visa à 10h du matin',
      status: 'scheduled',
    },
  ]

  for (const booking of bookings) {
    await db.booking.create({
      data: {
        passengerId: demoPassenger.id,
        ...booking,
      },
    })
  }
  console.log('✅ Bookings seeded')

  // ============ DELIVERIES ============
  const deliverySender = allPassengers[1] // Mariama Sylla
  const deliveryCourier1 = allDrivers[1] // Fatoumata Bah
  const deliveryCourier2 = allDrivers[3] // Aissatou Conde

  const deliveries = [
    {
      status: 'delivered',
      senderId: deliverySender.id,
      courierId: deliveryCourier1.id,
      pickupName: 'Boutique Mariama Mode',
      pickupPhone: '+224661000011',
      pickupAddress: 'Marché Madina, Matam',
      pickupLat: 9.5560,
      pickupLng: -13.6700,
      pickupZone: 'Matam',
      pickupNotes: '2ème étage, boutique bleue',
      deliveryName: 'Fatoumata Camara',
      deliveryPhone: '+224661000030',
      deliveryAddress: 'Cité des Enseignants, Ratoma',
      deliveryLat: 9.5550,
      deliveryLng: -13.5900,
      deliveryZone: 'Ratoma',
      deliveryNotes: 'Portail vert',
      deliveryOtp: '4827',
      packageType: 'package',
      packageSize: 'medium',
      weight: 2.5,
      declaredValue: 50000,
      estimatedPrice: 8000,
      actualPrice: 7500,
      distance: 6.3,
      duration: 18,
      pickedUpAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      deliveredAt: new Date(now.getTime() - 2.5 * 60 * 60 * 1000),
    },
    {
      status: 'in_transit',
      senderId: deliverySender.id,
      courierId: deliveryCourier2.id,
      pickupName: 'Guichet Unique',
      pickupPhone: '+224661000011',
      pickupAddress: 'Ministère du Commerce, Kaloum',
      pickupLat: 9.5120,
      pickupLng: -13.7080,
      pickupZone: 'Kaloum',
      pickupNotes: null,
      deliveryName: 'Ibrahima Baldé',
      deliveryPhone: '+224661000031',
      deliveryAddress: 'Cosa, Matoto',
      deliveryLat: 9.5920,
      deliveryLng: -13.5700,
      deliveryZone: 'Matoto',
      deliveryNotes: 'Demander au gardien',
      deliveryOtp: '1539',
      packageType: 'document',
      packageSize: 'small',
      weight: 0.5,
      declaredValue: null,
      estimatedPrice: 12000,
      actualPrice: null,
      distance: 14.1,
      duration: 38,
      pickedUpAt: new Date(now.getTime() - 20 * 60 * 1000),
    },
    {
      status: 'pending',
      senderId: deliverySender.id,
      courierId: null,
      pickupName: 'Pharmacie Centrale',
      pickupPhone: '+224661000011',
      pickupAddress: 'Boulevard du Commerce, Kaloum',
      pickupLat: 9.5080,
      pickupLng: -13.7150,
      pickupZone: 'Kaloum',
      pickupNotes: 'Médicaments fragiles',
      deliveryName: 'Hawa Condé',
      deliveryPhone: '+224661000032',
      deliveryAddress: 'Matam, près du lycée',
      deliveryLat: 9.5650,
      deliveryLng: -13.6680,
      deliveryZone: 'Matam',
      deliveryNotes: null,
      deliveryOtp: null,
      packageType: 'package',
      packageSize: 'small',
      weight: 1.0,
      declaredValue: 25000,
      estimatedPrice: 5000,
      actualPrice: null,
      distance: 4.8,
      duration: 14,
    },
    {
      status: 'picked_up',
      senderId: demoPassenger.id,
      courierId: deliveryCourier1.id,
      pickupName: 'Abdoulaye Camara',
      pickupPhone: '+224661000010',
      pickupAddress: 'Belle Vue, Matam',
      pickupLat: 9.5500,
      pickupLng: -13.6500,
      pickupZone: 'Matam',
      pickupNotes: 'Appeler avant de venir',
      deliveryName: 'Kadiatou Bah',
      deliveryPhone: '+224661000033',
      deliveryAddress: 'Kipé, Ratoma',
      deliveryLat: 9.5720,
      deliveryLng: -13.6180,
      deliveryZone: 'Ratoma',
      deliveryNotes: null,
      deliveryOtp: '7712',
      packageType: 'merchandise',
      packageSize: 'large',
      weight: 8.0,
      declaredValue: 150000,
      estimatedPrice: 15000,
      actualPrice: null,
      distance: 5.5,
      duration: 16,
      pickedUpAt: new Date(now.getTime() - 10 * 60 * 1000),
    },
    {
      status: 'cancelled',
      senderId: demoPassenger.id,
      courierId: null,
      pickupName: 'Abdoulaye Camara',
      pickupPhone: '+224661000010',
      pickupAddress: 'Centre-ville, Kaloum',
      pickupLat: 9.5090,
      pickupLng: -13.7120,
      pickupZone: 'Kaloum',
      pickupNotes: null,
      deliveryName: 'Seydouba Guilavogui',
      deliveryPhone: '+224661000034',
      deliveryAddress: 'Hamdallaye, Ratoma',
      deliveryLat: 9.5450,
      deliveryLng: -13.6000,
      deliveryZone: 'Ratoma',
      deliveryNotes: null,
      deliveryOtp: null,
      packageType: 'document',
      packageSize: 'small',
      weight: 0.3,
      declaredValue: null,
      estimatedPrice: 7000,
      actualPrice: null,
      distance: 8.2,
      duration: 22,
      cancelledAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
    },
  ]

  for (const delivery of deliveries) {
    const created = await db.delivery.create({
      data: {
        ...delivery,
      },
    })

    // Create delivery payment for delivered and completed ones
    if (created.status === 'delivered' && created.actualPrice) {
      await db.deliveryPayment.create({
        data: {
          deliveryId: created.id,
          userId: deliverySender.id,
          amount: created.actualPrice,
          method: 'mobile_money',
          status: 'completed',
        },
      })
    }
  }
  console.log('✅ Deliveries seeded')

  // ============ B2B / CORPORATE ============
  const businessAccount = await db.businessAccount.create({
    data: {
      name: 'Guinée Telecom SA',
      siret: 'GN-2024-001234',
      address: 'Boulevard du Commerce, Kaloum, Conakry',
      email: 'contact@guineetelecom.gn',
      phone: '+224622000001',
      plan: 'pro',
      monthlyBudget: 5000000,
      status: 'active',
    },
  })

  // Business employees
  const bizEmployees = [
    { name: 'Mouctar Diallo', email: 'mouctar@guineetelecom.gn', phone: '+224662000010', department: 'Comptabilité', position: 'Chef de service', monthlyLimit: 500000 },
    { name: 'Djenaba Soumah', email: 'djenaba@guineetelecom.gn', phone: '+224662000011', department: 'Marketing', position: 'Directrice', monthlyLimit: 800000 },
    { name: 'Lamine Camara', email: 'lamine@guineetelecom.gn', phone: '+224662000012', department: 'Technique', position: 'Ingénieur', monthlyLimit: 300000 },
  ]

  for (const emp of bizEmployees) {
    const empUser = await db.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        role: 'passenger',
        zone: 'Kaloum',
        rating: 4.5,
        totalRides: 12,
        password: 'demo123',
      },
    })

    await db.businessEmployee.create({
      data: {
        businessId: businessAccount.id,
        userId: empUser.id,
        department: emp.department,
        position: emp.position,
        monthlyLimit: emp.monthlyLimit,
        isActive: true,
      },
    })
  }

  // Business cost centers
  const costCenters = [
    { name: 'Déplacements Executifs', budget: 2000000, used: 750000, manager: 'Mouctar Diallo' },
    { name: 'Logistique Terrain', budget: 1500000, used: 320000, manager: 'Djenaba Soumah' },
  ]

  for (const cc of costCenters) {
    await db.businessCostCenter.create({
      data: {
        businessId: businessAccount.id,
        ...cc,
      },
    })
  }
  console.log('✅ Business account seeded')

  // ============ INCIDENTS ============
  const incidents = [
    {
      rideId: null,
      deliveryId: null,
      reporterId: allPassengers[0].id,
      reportedId: allDrivers[0].id,
      type: 'dispute',
      severity: 'medium',
      description: 'Le chauffeur a demandé un tarif supérieur à celui affiché dans l\'application. Le tarif estimé était de 15 000 GNF mais le chauffeur a demandé 20 000 GNF à l\'arrivée.',
      status: 'investigating',
      resolution: null,
    },
    {
      rideId: null,
      deliveryId: null,
      reporterId: allDrivers[1].id,
      reportedId: allPassengers[1].id,
      type: 'safety',
      severity: 'low',
      description: 'Le passager a eu un comportement agressif pendant la course suite à un retard causé par la circulation.',
      status: 'resolved',
      resolution: 'Passager averti. Note du passager ajustée. Chauffeur dédommagé avec 5 000 GNF de crédit.',
    },
  ]

  for (const incident of incidents) {
    await db.incident.create({
      data: incident,
    })
  }
  console.log('✅ Incidents seeded')

  console.log('\n🎉 MOVA database seeded successfully!')
  console.log('   Admin: admin@mova.gn / admin123')
  console.log('   Driver: mamadou@mova.gn / demo123')
  console.log('   Passenger: abdoulaye@mova.gn / demo123')
  console.log('   Business: Guinée Telecom SA (pro plan, 3 employees, 2 cost centers)')
  console.log('   Promotions: BIENVENUE50, RIDEFREE, MOVA10')
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())
