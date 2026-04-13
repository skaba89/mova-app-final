# Worklog - TypeScript Fixes for MOVA API

## Task ID: ts-fixes

### Date: 2025-01-XX

### Summary
Fixed all TypeScript type errors in the MOVA Next.js API caused by mismatches between the Prisma schema (35 models, 23 enums) and the API code. All 15+ targeted files were fixed. After fixes: **0 API TS errors remaining** (26 errors remain only in `prisma/seed.ts` which is out of scope).

### Files Changed (17 files)

#### 1. `lib/mova/auth-middleware.ts`
- Updated `UserRole` type to match Prisma enum: `client, chauffeur, coursier, restaurant, commercant, gestionnaire_flotte, admin, support_agent, operateur_validation, compte_entreprise`
- Converted `requireRole` to curried function signature: `requireRole(roles) → (request) → Promise<AuthUser | NextResponse>` to match usage in drivers/[id]

#### 2. `app/api/mova/auth/route.ts`
- Login query: `isActive: true` → `status: true` (UserStatus enum, not Boolean)
- Login check: `!user.isActive` → `user.status !== 'active'`
- "me" query: `isActive: true` → `status: true`
- Added null check for `user.password` before bcrypt.compare (password is optional)

#### 3. `app/api/mova/assistant/route.ts`
- Fixed ZAI SDK import: `const ZAI = (await import('z-ai-web-dev-sdk')).default` → `const { default: ZAI } = await import('z-ai-web-dev-sdk')`
- Fixed API call: `ZAI.chat.completions.create()` → `const zai = await ZAI.create(); zai.chat.completions.create()`

#### 4. `app/api/mova/notifications/route.ts`
- NotificationType enum: removed `'alert'`, added valid values (`food_update`, `delivery_update`, `safety`, `sos`)
- `z.record(z.unknown())` → `z.record(z.string(), z.unknown())` (Zod v4 requires two args)
- Added `if (auth instanceof NextResponse) return auth` narrowing in both GET and POST
- `data: data ? JSON.stringify(data) : null` → `...(data ? { data: JSON.stringify(data) } : {})` (avoid JsonNull)

#### 5. `app/api/mova/notifications/[id]/route.ts`
- Added `if (auth instanceof NextResponse) return auth` narrowing before using `auth.id`/`auth.role`

#### 6. `app/api/mova/notifications/read-all/route.ts`
- Added `if (auth instanceof NextResponse) return auth` narrowing before using `auth.id`

#### 7. `app/api/mova/rides/route.ts`
- PaymentMethod enum: `mobile_money` → `orange_money`, added `card`, `mtn_momo`, `wave`
- VehicleType: `auto` → `standard` (matches Prisma enum)
- `driver` include → `driverProfile` include (with nested `user` select)
- Removed `vehicle` include from driver (doesn't exist on User/DriverProfile directly)
- Removed `vehicleType` from ride create data (not a field on Ride model)
- Decimal fields: `finalFare` → `actualFare`, `driverRating` → `rating`

#### 8. `app/api/mova/rides/[id]/route.ts`
- `driver` include → `driverProfile` include with nested `user` select
- `payment` include → `payments` include (relation name)
- `ride.driverId` → `ride.driverProfileId`
- `updateData.driverId` → `updateData.driverProfileId`
- `Payment.findUnique({ where: { rideId } })` → `Payment.findFirst({ where: { rideId } })` (rideId not unique)
- `finalFare` → `actualFare` throughout
- Transaction types: `debit` → `ride_payment`, `credit` → `refund`
- Fixed WalletTransaction.create to include required fields: `balanceBefore`, `balanceAfter`, `reference`
- Removed non-existent fields: `method`, `status` from WalletTransaction.create

#### 9. `app/api/mova/drivers/route.ts`
- Rewrote to query `db.driverProfile` instead of `db.user` (driver fields live on DriverProfile)
- `role: 'driver'` → removed (querying DriverProfile directly)
- Removed `vehicle` include (vehicles relation is on DriverProfile, not User)
- `isActive: true` filter → kept (valid on DriverProfile)
- `zone` filter → kept (valid on DriverProfile)
- `vehicle` filter → `vehicleType` filter (valid on DriverProfile)
- `isOnline` filter → kept (valid on DriverProfile)

#### 10. `app/api/mova/drivers/[id]/route.ts`
- Rewrote GET to query `db.driverProfile` instead of `db.user`
- `role: 'driver'` → removed
- `driverId` → `driverProfileId` in ride queries
- `driverRating` → removed (using `rating` from Rating model)
- Rewrote PATCH to update `db.driverProfile` instead of `db.user`
- Fixed `requireRole` usage: already using curried form, now matches signature
- Removed `vehicle` includes, added `vehicles` (plural) and `user` includes

#### 11. `app/api/mova/wallet/route.ts`
- Added `if (auth instanceof NextResponse) return auth` in GET and POST
- PaymentMethod enum: `mobile_money` → `orange_money`, added `mtn_momo`, `wave`
- Transaction type: `credit` → `top_up`
- Fixed WalletTransaction.create: added `balanceBefore`, `balanceAfter`, `reference`
- Removed non-existent fields: `method`, `status`

#### 12. `app/api/mova/wallet/transfer/route.ts`
- Added `if (auth instanceof NextResponse) return auth` narrowing
- `isActive` → `status` on user select and check (`status !== 'active'`)
- Transaction types: `debit` → `transfer_out`, `credit` → `transfer_in`
- Fixed WalletTransaction.create: added required fields, removed non-existent ones

#### 13. `app/api/mova/loyalty/route.ts`
- Imported `LoyaltyTier` from `@prisma/client`
- `determineTier` return type: `string` → `LoyaltyTier`
- `currentTier` type: `string` → `LoyaltyTier`
- `tier as LoyaltyTier` cast to satisfy enum constraint

#### 14. `lib/mova/job-queue.ts`
- `getStats()`: added `cancelled` counter and `total: this.queue.size` to match `QueueStats` interface

#### 15. `lib/mova/audit-logger.ts`
- `details: params.details ? JSON.stringify(params.details) : null` → `...(params.details ? { details: JSON.stringify(params.details) } : {})`
- `JSON.parse(log.details as string)` → `log.details ?? null` (Prisma returns already-parsed JSON)
- Added `Prisma` import (available for future use)

#### 16. `components/mova/admin-monitoring-view.tsx`
- Added optional chaining (`m?.`) and nullish coalescing (`?? 0`) on all `m` property accesses
- Used `m.rateLimiter!.topViolators` with non-null assertion inside truthy-guarded blocks

### Remaining Errors
- **26 errors** remain in `prisma/seed.ts` (out of scope - seed file uses old schema fields)
- **0 errors** in API routes, middleware, components, and library files
