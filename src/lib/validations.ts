/**
 * MOVA Super-App — Comprehensive Zod Validation Schemas
 * =====================================================
 * Validates all API endpoint request bodies for Phase 1 (Security).
 *
 * Uses Zod v4 (`import { z } from 'zod'`).
 * All coordinates are constrained to valid geographic ranges.
 * French error messages are returned by the `validateBody` helper.
 */

import { z } from 'zod';

// ─── Shared Primitives ────────────────────────────────────────────────────

/** UUID or CUID string */
const id = z.string().min(1, "L'identifiant est requis");

/** Valid latitude: -90 to 90 (accepts string or number) */
const lat = z.coerce
  .number({ error: 'Latitude invalide' })
  .min(-90, 'La latitude doit être entre -90 et 90')
  .max(90, 'La latitude doit être entre -90 et 90');

/** Valid longitude: -180 to 180 (accepts string or number) */
const lng = z.coerce
  .number({ error: 'Longitude invalide' })
  .min(-180, 'La longitude doit être entre -180 et 180')
  .max(180, 'La longitude doit être entre -180 et 180');

/** Valid GPS pair factory — creates prefixed lat/lng fields */
function makeCoordinates(prefix: 'pickup' | 'dropoff' | 'home' | 'school') {
  return {
    [`${prefix}Lat`]: lat,
    [`${prefix}Lng`]: lng,
  };
}

/** Phone number supporting +224, +1, +33, etc. African + international formats */
const phone = z
  .string()
  .regex(
    /^\+?[\d\s\-().]{7,15}$/,
    'Numéro de téléphone invalide'
  );

/** Email address */
const email = z.string().email('Adresse email invalide');

/** Password: minimum 8 characters */
const password = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères');

/** Name: non-empty trimmed string */
const name = z
  .string()
  .min(1, 'Le nom est requis')
  .max(100, 'Le nom ne peut pas dépasser 100 caractères');

/** Non-empty string field */
const requiredString = z.string().min(1, 'Ce champ est requis');

/** Optional string field */
const optionalString = z.string().optional();

/** Positive amount (GNF or other currency) */
const positiveAmount = z
  .number({ error: 'Le montant doit être un nombre' })
  .positive('Le montant doit être supérieur à zéro');

/** ISO date string that can be parsed to a valid Date */
const isoDateString = z
  .string()
  .min(1, 'La date est requise')
  .refine(
    (val) => !isNaN(Date.parse(val)),
    'Format de date invalide (ISO 8601 attendu)'
  );

/** Pickup location block (address + coordinates + zone) */
const pickupLocation = {
  pickupAddress: requiredString,
  ...makeCoordinates('pickup'),
  pickupZone: requiredString,
};

/** Dropoff location block (address + coordinates + zone) */
const dropoffLocation = {
  dropoffAddress: requiredString,
  ...makeCoordinates('dropoff'),
  dropoffZone: requiredString,
};

// ─── Enum Definitions ─────────────────────────────────────────────────────

const VehicleTypeEnum = z.enum(['standard', 'premium', 'van'], {
  message: 'Type de véhicule invalide. Options: standard, premium, van',
});

const RideStatusEnum = z.enum(['pending', 'accepted', 'in_progress', 'completed', 'cancelled'], {
  message: 'Statut de course invalide',
});

const DeliveryStatusEnum = z.enum(['pending', 'picked_up', 'in_transit', 'near_delivery', 'delivered', 'cancelled'], {
  message: 'Statut de livraison invalide',
});

const PackageTypeEnum = z.enum(['standard', 'fragile', 'oversized'], {
  message: 'Type de colis invalide. Options: standard, fragile, oversized',
});

const PackageSizeEnum = z.enum(['small', 'medium', 'large'], {
  message: 'Taille de colis invalide. Options: small, medium, large',
});

const PaymentMethodEnum = z.enum(['mobile_money', 'card', 'transfer'], {
  message: 'Méthode de paiement invalide. Options: mobile_money, card, transfer',
});

const WalletProviderEnum = z.enum(['orange_money', 'mtn_momo', 'wave', 'ecobank', 'other'], {
  message: 'Fournisseur de paiement invalide',
});

const NotificationTypeEnum = z.enum(['ride', 'delivery', 'wallet', 'promo', 'system', 'safety'], {
  message: 'Type de notification invalide',
});

const NotificationStatusEnum = z.enum(['read', 'unread', 'archived'], {
  message: 'Le statut doit être "read", "unread" ou "archived"',
});

const IncidentTypeEnum = z.enum(['accident', 'dispute', 'damage', 'lost_item', 'safety', 'other'], {
  message: "Type d'incident invalide. Options: accident, dispute, damage, lost_item, safety, other",
});

const IncidentSeverityEnum = z.enum(['low', 'medium', 'high', 'critical'], {
  message: 'Sévérité invalide. Options: low, medium, high, critical',
});

const IncidentStatusEnum = z.enum(['open', 'investigating', 'resolved', 'closed'], {
  message: "Statut d'incident invalide",
});

const UserRoleEnum = z.enum(['passenger', 'driver', 'admin', 'courier', 'business'], {
  message: "Rôle d'utilisateur invalide. Options: passenger, driver, admin, courier, business",
});

const IntercityVehicleTypeEnum = z.enum(['bus_shared', 'car_shared', 'car_private'], {
  message: 'Type de véhicule invalide. Options: bus_shared, car_shared, car_private',
});

const SchoolScheduleEnum = z.enum(['morning', 'afternoon', 'both'], {
  message: 'Horaire invalide. Options: morning, afternoon, both',
});

const SchoolPackageTypeEnum = z.enum(['monthly', 'quarterly', 'yearly'], {
  message: 'Type de forfait invalide. Options: monthly, quarterly, yearly',
});

const LoyaltyActionEnum = z.enum(['earn', 'spend', 'bonus', 'adjustment'], {
  message: 'Action invalide. Options: earn, spend, bonus, adjustment',
});

// ─── 1. AUTH ──────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name,
  email,
  phone,
  password,
  role: UserRoleEnum,
});

export const loginSchema = z.object({
  identifier: z.union([email, phone], {
    message: 'Veuillez entrer un email ou un numéro de téléphone valide',
  }),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

// ─── 2. FARE ESTIMATION ──────────────────────────────────────────────────

export const fareSchema = z.object({
  pickupZone: requiredString,
  dropoffZone: requiredString,
  vehicleType: VehicleTypeEnum.optional().default('standard'),
});

// ─── 3. RIDES ─────────────────────────────────────────────────────────────

export const createRideSchema = z.object({
  passengerId: id,
  ...pickupLocation,
  ...dropoffLocation,
  vehicleType: VehicleTypeEnum.optional(),
  passengerNote: optionalString,
  distance: z.coerce.number().positive().optional(),
  duration: z.coerce.number().int().positive().optional(),
});

export const updateRideSchema = z.object({
  status: RideStatusEnum,
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  actualFare: z.coerce.number().positive().optional(),
  distance: z.coerce.number().positive().optional(),
  duration: z.coerce.number().int().positive().optional(),
  passengerRating: z.coerce.number().min(1).max(5).optional(),
  driverRating: z.coerce.number().min(1).max(5).optional(),
  passengerNote: optionalString,
  driverNote: optionalString,
});

// ─── 4. BOOKINGS ─────────────────────────────────────────────────────────

export const createBookingSchema = z.object({
  passengerId: id,
  ...pickupLocation,
  ...dropoffLocation,
  vehicleType: VehicleTypeEnum.optional().default('standard'),
  scheduledFor: isoDateString,
  notes: optionalString,
});

// ─── 5. WALLET ───────────────────────────────────────────────────────────

export const topupSchema = z.object({
  userId: id,
  amount: positiveAmount,
  method: PaymentMethodEnum,
  provider: WalletProviderEnum.optional(),
});

export const transferSchema = z.object({
  fromUserId: id,
  toUserId: id,
  amount: positiveAmount,
  note: optionalString,
});

// ─── 6. DELIVERIES ───────────────────────────────────────────────────────

export const createDeliverySchema = z.object({
  senderId: id,
  pickupName: name,
  pickupPhone: phone,
  pickupAddress: requiredString,
  pickupLat: lat,
  pickupLng: lng,
  pickupZone: requiredString,
  deliveryName: name,
  deliveryPhone: phone,
  deliveryAddress: requiredString,
  deliveryLat: lat,
  deliveryLng: lng,
  deliveryZone: requiredString,
  packageType: PackageTypeEnum.optional().default('standard'),
  packageSize: PackageSizeEnum.optional(),
  weight: z.coerce.number().min(0.1, 'Le poids doit être supérieur à 0').optional(),
  declaredValue: z.coerce.number().min(0, 'La valeur déclarée ne peut pas être négative').optional(),
  pickupNotes: optionalString,
  deliveryNotes: optionalString,
});

export const updateDeliverySchema = z.object({
  status: DeliveryStatusEnum,
  otp: z
    .string()
    .length(4, "Le code OTP doit contenir exactement 4 chiffres")
    .regex(/^\d{4}$/, "Le code OTP doit contenir uniquement des chiffres")
    .optional(),
  courierId: z.string().optional(),
  deliveryPhoto: z.string().url('URL de photo invalide').optional(),
});

// ─── 7. PROMOTIONS ───────────────────────────────────────────────────────

export const redeemPromoSchema = z.object({
  userId: id,
  code: z
    .string()
    .min(2, 'Le code promo est trop court')
    .max(50, 'Le code promo est trop long')
    .transform((val) => val.toUpperCase().trim()),
});

// ─── 8. REFERRALS ────────────────────────────────────────────────────────

export const createReferralSchema = z.object({
  referrerId: id,
  referredId: id,
  code: z
    .string()
    .min(2, 'Le code de parrainage est trop court')
    .max(50, 'Le code de parrainage est trop long'),
});

// ─── 9. INCIDENTS ────────────────────────────────────────────────────────

export const createIncidentSchema = z.object({
  reporterId: id,
  reportedId: z.string().optional(),
  rideId: z.string().optional(),
  deliveryId: z.string().optional(),
  type: IncidentTypeEnum,
  severity: IncidentSeverityEnum.optional().default('medium'),
  description: z
    .string()
    .min(10, 'La description doit contenir au moins 10 caractères')
    .max(2000, 'La description ne peut pas dépasser 2000 caractères'),
});

export const updateIncidentSchema = z.object({
  status: IncidentStatusEnum.optional(),
  resolution: z
    .string()
    .min(10, 'La résolution doit contenir au moins 10 caractères')
    .max(2000, 'La résolution ne peut pas dépasser 2000 caractères')
    .optional(),
});

// ─── 10. NOTIFICATIONS ──────────────────────────────────────────────────

export const createNotificationSchema = z.object({
  userId: id,
  title: z
    .string()
    .min(1, 'Le titre est requis')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères'),
  message: z
    .string()
    .min(1, 'Le message est requis')
    .max(1000, 'Le message ne peut pas dépasser 1000 caractères'),
  type: NotificationTypeEnum.optional().default('system'),
  data: z.record(z.string(), z.any()).optional(),
});

export const updateNotificationSchema = z.object({
  status: NotificationStatusEnum,
});

// ─── 10b. PUSH NOTIFICATIONS ─────────────────────────────────────────────

/** Web Push subscription object (VAPID) */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("L'endpoint de l'abonnement est invalide"),
  keys: z.object({
    p256dh: z.string().min(1, "La clé p256dh est requise"),
    auth: z.string().min(1, "La clé auth est requise"),
  }, { message: "Les clés de l'abonnement sont requises (p256dh, auth)" }),
  expirationTime: z.number().nullable().optional(),
});

/** Push notification send payload */
export const sendPushSchema = z.object({
  userId: id,
  title: z
    .string()
    .min(1, 'Le titre est requis')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères'),
  body: z
    .string()
    .min(1, 'Le corps du message est requis')
    .max(1000, 'Le corps ne peut pas dépasser 1000 caractères'),
  data: z.record(z.string(), z.any()).optional(),
  type: NotificationTypeEnum.optional().default('system'),
});

// ─── 11. MOTO (Moto-Taxi) ────────────────────────────────────────────────

/**
 * Moto schema: same as createRideSchema but vehicleType is forced to 'moto'
 * server-side. The client does NOT send vehicleType.
 */
export const createMotoSchema = z.object({
  passengerId: id,
  pickupAddress: requiredString,
  pickupLat: lat,
  pickupLng: lng,
  pickupZone: requiredString,
  dropoffAddress: requiredString,
  dropoffLat: lat,
  dropoffLng: lng,
  dropoffZone: requiredString,
  passengerNote: optionalString,
  distance: z.coerce.number().positive().optional(),
  duration: z.coerce.number().int().positive().optional(),
});

// ─── 12. CARPOOL ─────────────────────────────────────────────────────────

export const createCarpoolSchema = z.object({
  passengerId: id,
  ...pickupLocation,
  ...dropoffLocation,
  availableSeats: z.coerce
    .number({ error: 'Le nombre de places doit être un nombre' })
    .int('Le nombre de places doit être un entier')
    .min(1, 'Le nombre de places doit être au moins 1')
    .max(4, 'Le nombre de places ne peut pas dépasser 4'),
  estimatedFare: z.coerce.number().positive().optional(),
  departureTime: isoDateString.optional(),
  distance: z.coerce.number().positive().optional(),
  duration: z.coerce.number().int().positive().optional(),
});

// ─── 13. INTERCITY ───────────────────────────────────────────────────────

export const createIntercitySchema = z.object({
  passengerId: id,
  departureCity: requiredString,
  arrivalCity: requiredString,
  pickupAddress: requiredString,
  dropoffAddress: requiredString,
  pickupLat: lat,
  pickupLng: lng,
  dropoffLat: lat,
  dropoffLng: lng,
  scheduledDate: isoDateString,
  vehicleType: IntercityVehicleTypeEnum.optional().default('bus_shared'),
  seats: z.coerce
    .number()
    .int()
    .min(1, 'Le nombre de places doit être au moins 1')
    .max(50, 'Le nombre de places ne peut pas dépasser 50')
    .optional(),
  estimatedFare: z.coerce.number().positive().optional(),
});

// ─── 14. SCHOOL TRANSPORT ───────────────────────────────────────────────

export const createSchoolSchema = z.object({
  parentId: id,
  childName: name,
  schoolName: requiredString,
  homeAddress: requiredString,
  pickupLat: lat,
  pickupLng: lng,
  pickupZone: requiredString,
  schoolAddress: requiredString,
  dropoffLat: lat,
  dropoffLng: lng,
  dropoffZone: requiredString,
  schedule: SchoolScheduleEnum.optional().default('both'),
  packageType: SchoolPackageTypeEnum.optional().default('monthly'),
});

// ─── 15. LOYALTY ─────────────────────────────────────────────────────────

export const spendPointsSchema = z.object({
  userId: id,
  points: z
    .number({ error: 'Les points doivent être un nombre' })
    .int('Les points doivent être un entier')
    .positive('Les points doivent être un nombre entier positif'),
  description: requiredString,
});

export const loyaltyActionSchema = z.object({
  userId: id,
  action: LoyaltyActionEnum,
  points: z
    .number({ error: 'Les points doivent être un nombre' })
    .int('Les points doivent être un entier')
    .refine((p) => p !== 0, 'Les points ne peuvent pas être zéro'),
  description: requiredString,
  referenceType: z.enum(['ride', 'delivery', 'promo', 'manual']).optional(),
  referenceId: z.string().optional(),
});

// ─── 16. FEEDBACK ────────────────────────────────────────────────────────

const FeedbackTypeEnum = z.enum(['ride', 'delivery', 'general'], {
  message: 'Type de feedback invalide. Options: ride, delivery, general',
});

const FeedbackCategoryEnum = z.enum([
  'ponctualité', 'conduite', 'propreté', 'prix', 'navigation', 'communication', 'autre',
], {
  message: 'Catégorie de feedback invalide',
});

export const feedbackSchema = z.object({
  type: FeedbackTypeEnum,
  targetId: z.string().optional(),
  rating: z
    .number({ error: 'La note doit être un nombre' })
    .int('La note doit être un entier')
    .min(1, 'La note doit être au moins 1')
    .max(5, 'La note ne peut pas dépasser 5'),
  comment: z
    .string()
    .max(500, 'Le commentaire ne peut pas dépasser 500 caractères')
    .optional(),
  categories: z
    .array(FeedbackCategoryEnum)
    .max(5, 'Vous pouvez sélectionner au maximum 5 catégories')
    .optional(),
});

// ─── 17. SUPPORT ────────────────────────────────────────────────────────

const SupportCategoryEnum = z.enum(['technical', 'payment', 'ride', 'account', 'other'], {
  message: 'Catégorie de support invalide. Options: technical, payment, ride, account, other',
});

const SupportPriorityEnum = z.enum(['low', 'medium', 'high'], {
  message: 'Priorité invalide. Options: low, medium, high',
});

const SupportStatusEnum = z.enum(['open', 'in_progress', 'resolved', 'closed'], {
  message: 'Statut de ticket invalide. Options: open, in_progress, resolved, closed',
});

export const supportTicketSchema = z.object({
  subject: z
    .string()
    .min(1, 'Le sujet est requis')
    .max(200, 'Le sujet ne peut pas dépasser 200 caractères'),
  message: z
    .string()
    .min(1, 'Le message est requis')
    .max(2000, 'Le message ne peut pas dépasser 2000 caractères'),
  category: SupportCategoryEnum,
  priority: SupportPriorityEnum.optional().default('medium'),
});

export const supportUpdateSchema = z.object({
  status: SupportStatusEnum,
  message: z
    .string()
    .min(1, 'Le message est requis')
    .max(2000, 'Le message ne peut pas dépasser 2000 caractères')
    .optional(),
});

// ─── 18. BETA ───────────────────────────────────────────────────────────

export const betaRegisterSchema = z.object({
  email: email,
  name: name,
  phone: phone.optional(),
  referralCode: z
    .string()
    .min(1, 'Le code de parrainage est requis')
    .max(50, 'Le code de parrainage est trop long')
    .optional(),
});

// ─── Query Parameter Schemas (for GET requests) ──────────────────────────

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const userIdSchema = z.object({
  userId: z.string().min(1, "L'identifiant utilisateur est requis"),
});



// ─── VALIDATE BODY HELPER ────────────────────────────────────────────────

/**
 * Validate a request body against a Zod schema.
 * Returns `{ success: true, data: T }` on success,
 * or `{ success: false, error: string }` with a French error message on failure.
 *
 * @example
 * ```ts
 * import { validateBody, createRideSchema } from '@/lib/validations';
 *
 * const body = await request.json();
 * const result = validateBody(createRideSchema, body);
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 * // result.data is fully typed
 * ```
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Build a user-friendly French error message from the first issue
  const firstIssue = result.error.issues[0];
  if (!firstIssue) {
    return { success: false, error: 'Données invalides' };
  }

  const field = firstIssue.path.length > 0
    ? firstIssue.path.join('.')
    : 'champ';
  const message = firstIssue.message || 'Valeur invalide';

  return {
    success: false,
    error: `Erreur de validation sur "${field}": ${message}`,
  };
}
