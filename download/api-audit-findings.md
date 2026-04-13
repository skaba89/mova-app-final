# MOVA API Route Audit Report

**Date:** 2025-07-13  
**Scope:** 22 API routes under `src/app/api/mova/`  
**Prisma Schema:** Reviewed — all 25 models present, all referenced models exist.  
**DB Client:** `src/lib/db.ts` — exports singleton `db` from `@prisma/client`.  
**Auth Middleware:** `src/lib/mova/auth-middleware.ts` — provides `validateRequest()` (JWT Bearer verification).  

---

## CRITICAL FINDINGS

### C1. Decimal Fields Not Converted to Number (13 routes affected)

Prisma `Decimal` fields serialize as objects like `{ "type": "BigNumber", "hex": "..." }` instead of JSON numbers when returned directly in `NextResponse.json()`. Routes must call `Number(field)` or use a serialization helper before sending.

| Route | Unconverted Decimal Fields |
|---|---|
| `rides/route.ts` (GET) | `estimatedFare`, `actualFare` on rides; `amount` on payments |
| `rides/[id]/route.ts` (GET/PATCH) | `estimatedFare`, `actualFare`; `amount` on payments |
| `wallet/route.ts` (GET) | `wallet.balance`; `amount` and `balance` on every WalletTransaction |
| `wallet/transfer/route.ts` (POST) | `senderWallet.balance` in response (line 141) |
| `deliveries/route.ts` (GET/POST) | `estimatedPrice`, `weight`, `declaredValue`, `actualPrice` |
| `bookings/route.ts` (GET) | `estimatedFare` |
| `promotions/route.ts` (GET) | `discountValue`, `minAmount`, `maxDiscount` |
| `referrals/route.ts` (GET) | `bonusAmount` on each referral |
| `carpool/route.ts` (GET) | `estimatedFare` on rides |
| `moto/route.ts` (GET) | `estimatedFare` on rides |
| `marketplace/route.ts` (GET) | `price` on listings |
| `business/route.ts` (GET) | `monthlyLimit` on employees (line 67) |

**Impact:** Frontend clients will receive objects instead of numbers for all monetary/decimal values, causing display and calculation failures.

**Recommended Fix:** Create a Prisma middleware or utility function that converts all Decimal fields to `Number` before JSON serialization.

---

### C2. Missing Authentication on Most Routes (19 routes)

Only `wallet/transfer/route.ts` uses `validateRequest()` from `@/lib/mova/auth-middleware`. All other routes accept `userId` from query params or request body without verifying JWT tokens.

**Routes without auth:**
- `rides/route.ts` — anyone can create/list rides for any user
- `rides/[id]/route.ts` — anyone can update any ride
- `wallet/route.ts` — anyone can view/top-up any wallet
- `deliveries/route.ts` — anyone can create/list deliveries
- `bookings/route.ts` — anyone can create/list bookings
- `analytics/route.ts` — anyone can view all platform analytics
- `promotions/route.ts` — anyone can redeem codes for any user
- `referrals/route.ts` — anyone can view/create referrals
- `drivers/route.ts` — anyone can list all drivers
- `drivers/[id]/route.ts` — anyone can update any driver
- `carpool/route.ts` — uses spoofable `x-user-id` header (see C3)
- `moto/route.ts` — uses spoofable `x-user-id` header (see C3)
- `intercity/route.ts` — no auth at all
- `school/route.ts` — no auth at all
- `marketplace/route.ts` — no auth at all
- `assistant/route.ts` — no auth at all
- `support/route.ts` — no auth at all
- `notifications/route.ts` — no auth at all
- `loyalty/route.ts` — no auth at all
- `business/route.ts` — no auth at all

**Impact:** Any unauthenticated client can perform all operations including reading other users' wallets, creating rides, modifying drivers, viewing platform analytics, etc.

---

### C3. Spoofable Authentication via `x-user-id` Header

**Routes:** `carpool/route.ts`, `moto/route.ts`

These routes read `userId` from the `x-user-id` request header:
```ts
const userId = request.headers.get('x-user-id');
```

This header can be trivially set by any HTTP client. They should use `validateRequest()` with JWT Bearer tokens instead.

---

### C4. Wallet Transfer Uses Body `fromUserId` Instead of Auth User

**Route:** `wallet/transfer/route.ts`

The route calls `validateRequest(request)` to authenticate, but then uses `fromUserId` from the request body (line 14) rather than the authenticated user's ID from the token payload. This means an authenticated user could transfer funds from **any other user's** wallet.

```ts
const auth = await validateRequest(request);
if (!auth.success) return auth.response;
// auth.user.id is IGNORED
const { fromUserId, toUserId, amount } = body; // uses body instead!
```

**Impact:** Authenticated attacker can drain any user's wallet.

---

### C5. Loyalty Points Earned Without Transaction Safety (Race Condition)

**Route:** `loyalty/route.ts` (POST)

Points are earned and the profile is updated in separate, non-transactional queries:

1. Creates `LoyaltyTransaction` record (line 210)
2. Optionally creates streak bonus `LoyaltyTransaction` (line 228)
3. Updates `LoyaltyProfile` with new points total (line 250)

If two concurrent requests arrive for the same user (e.g., rapid double-tap), both could read the same `profile.points`, calculate the same new total, and the profile update would only reflect one of them — but both transactions would exist, giving double points.

**Impact:** Point inflation through race conditions.

---

## HIGH FINDINGS

### H1. Intercity Bookings Not Persisted to Database

**Route:** `intercity/route.ts` (POST)

The POST handler generates an in-memory booking object with `Date.now()` IDs and returns it. It never writes to any Prisma model. Bookings are lost on server restart and are not queryable.

```ts
const booking = {
  id: `ic-${Date.now()}-${Math.random()...}`,
  // ... purely in-memory, no db call
};
return NextResponse.json({ success: true, data: booking }, { status: 201 });
```

**Impact:** All intercity bookings are ephemeral. No data persistence.

---

### H2. School Subscriptions Not Persisted to Database

**Route:** `school/route.ts` (POST)

Same pattern as H1. The POST handler returns an in-memory object. No database write occurs. Demo subscriptions are hardcoded in the route file.

**Impact:** All school subscription data is ephemeral.

---

### H3. AI Assistant Conversations Stored In-Memory Only

**Route:** `assistant/route.ts`

Conversations are stored in a JavaScript `Map<string, ConversationMessage[]>`. This means:
- All conversation history is lost on server restart
- In multi-server deployments, conversations exist on only one server
- The 1000-entry cleanup uses insertion order, not LRU, so active conversations can be evicted

**Impact:** Conversation history is unreliable in production.

---

### H4. Notification `unreadCount` Only Counts Current Page

**Route:** `notifications/route.ts` (GET, line 48)

```ts
unreadCount: notifications.filter((n) => !n.read).length,
```

This counts unread notifications **within the current page** (limited by `take`), not the total unread count. If a user has 100 unread notifications but only fetches 20, `unreadCount` would be at most 20.

**Impact:** UI badges showing unread count will be inaccurate.

---

### H5. Promotion Savings Calculation Uses Wrong Base

**Route:** `promotions/route.ts` (POST redeem, line 120-121)

```ts
let savings: number = promotion.discountType === 'percentage'
  ? (Number(promotion.discountValue) / 100) * Number(promotion.minAmount || 0)
  : Number(promotion.discountValue);
```

For percentage discounts, savings are calculated using `minAmount` (minimum order amount) instead of the **actual ride amount**. If `minAmount` is null, savings are 0. There is no `rideId` or `amount` parameter accepted by this endpoint.

**Impact:** Percentage promo codes always compute savings from the wrong base, potentially giving wrong discounts.

---

### H6. Referral Code Lookup Is Unreliable

**Route:** `referrals/route.ts` (POST, lines 115-121)

The referral code is `MOVA-{first6charsOfUserId}`. The lookup does:
```ts
const referrer = await db.user.findFirst({
  where: {
    id: { startsWith: codeUserId.toLowerCase() },
    role: { in: ['passenger', 'driver'] },
  },
});
```

This `startsWith` query on the user ID could match the wrong user if two user IDs share the same 6-character prefix (CUID IDs have ~7+ random chars). The GET endpoint generates the code from the full user ID, but the POST lookup only uses 6 chars.

**Impact:** Referral could be attributed to the wrong referrer.

---

## MEDIUM FINDINGS

### M1. Analytics `groupBy` on DateTime Returns Per-Record Results

**Route:** `analytics/route.ts` (GET, line 57)

```ts
db.payment.groupBy({
  by: ['createdAt'],
  where: { status: 'completed', createdAt: { gte: sevenDaysAgo } },
  _sum: { amount: true },
})
```

`groupBy` on a `DateTime` field groups by the full timestamp (including time), not by date. Each payment creates its own group. The manual aggregation on line 78 (`item.createdAt.toISOString().split('T')[0]`) compensates partially, but is less efficient than a SQL-level `DATE()` truncation.

**Impact:** Performance concern — many records processed client-side instead of DB-side.

---

### M2. Wallet Transfer Response Uses Stale Balance

**Route:** `wallet/transfer/route.ts` (POST, line 141)

```ts
sender: {
  userId: fromUserId,
  name: senderUser?.name,
  newBalance: Number(senderWallet.balance) - amount,  // uses pre-transaction snapshot
},
```

The `senderWallet` object was fetched before the `$transaction` block. The correct new balance should come from `freshSender.balance` inside the transaction.

**Impact:** Frontend may display incorrect wallet balance after transfer.

---

### M3. OTP Exposed in Delivery Listing API

**Route:** `deliveries/route.ts` (GET, lines 102-107)

The GET endpoint includes the OTP for deliveries in `pending`, `picked_up`, and `in_transit` status. Any authenticated user listing their deliveries can see the OTP in the API response.

```ts
const formatted = deliveries.map((d) => ({
  ...d,
  otp: d.status === 'pending' || d.status === 'picked_up' || d.status === 'in_transit'
    ? d.otp
    : undefined,
}));
```

**Impact:** OTP intended for delivery verification is exposed in the listing API response.

---

### M4. Carpool/Moto Auto-Assign Random Vehicle

**Routes:** `carpool/route.ts` (POST, line 167), `moto/route.ts` (POST, line 205)

```ts
const activeVehicle = await db.vehicle.findFirst({ where: { isActive: true } });
```

These routes grab the first active vehicle from the database without checking if it's already assigned to another ride, or if the driver is available. The same vehicle could be assigned to multiple concurrent rides.

**Impact:** Multiple rides could be assigned to the same driver/vehicle simultaneously.

---

### M5. Carpool Metadata Stored in `passengerNote` Field

**Route:** `carpool/route.ts`

Carpool-specific metadata (seats, departure time) is stored in the `passengerNote` text field using a custom format: `CARPOOL:seats=3,departure=2025-...`. This is fragile — if the note is overwritten, carpool data is lost. The `passengerNote` field is also used for actual passenger notes, creating a naming collision.

**Impact:** Data integrity risk; loss of carpool metadata.

---

### M6. No Pagination on Multiple GET Endpoints

**Routes affected:**
- `drivers/route.ts` — returns ALL drivers with vehicles, no limit
- `marketplace/route.ts` — hard-coded `take: 50` with no offset param
- `promotions/route.ts` — returns all promotions with no limit

**Impact:** Potential performance issues and large response payloads as data grows.

---

### M7. Unused `message` Variable in Catch Blocks

**Routes:** `rides/route.ts` (lines 72, 126), `rides/[id]/route.ts` (lines 41, 113)

The variable `message` is assigned but never used in the JSON error response:
```ts
const message = error instanceof Error ? error.message : 'Erreur serveur';
console.error('...', error instanceof Error ? error.message : error);
return NextResponse.json({ success: false, error: '...' }); // message not used here
```

**Impact:** Internal error messages are logged but not returned to the client (this could be intentional for security, but the unused variable suggests it was meant to be included).

---

### M8. Business Route Checks Email with `findFirst` Instead of `findUnique`

**Route:** `business/route.ts` (POST, line 122)

```ts
const existing = await db.businessAccount.findFirst({ where: { email } });
```

The schema has `email @unique`, so `findUnique({ where: { email } })` would be more efficient and semantically correct.

**Impact:** Minor performance inefficiency.

---

### M9. Marketplace DELETE Endpoint Uses POST Body Instead of URL Param

**Route:** `marketplace/route.ts` (DELETE)

The DELETE handler reads the `id` from the request body:
```ts
const body = await request.json();
const { id } = body;
```

DELETE requests typically shouldn't have a body per HTTP semantics. The `id` should come from the URL path (e.g., `/api/mova/marketplace?id=xxx`).

**Impact:** Non-standard API design; may not work with all HTTP clients or CDNs.

---

## LOW FINDINGS

### L1. Inconsistent Error Response Format Across Routes

Some routes return `{ success: false, error: "..." }` while others return `{ error: "..." }` without the `success` field:

- `carpool/route.ts` GET catch: `{ error: "..." }` (missing `success: false`)
- `moto/route.ts` GET/POST catch: `{ error: "..." }` (missing `success: false`)
- `carpool/route.ts` POST validation: `{ error: "..." }` (missing `success: false`)
- `moto/route.ts` POST validation: `{ error: "..." }` (missing `success: false`)

---

### L2. AI Assistant Fallback Returns `success: true` on Error

**Route:** `assistant/route.ts` (POST, lines 206-216)

When the LLM call fails, the handler returns HTTP 200 with `success: true` and a fallback message. The client cannot distinguish between a real AI response and a fallback.

---

### L3. `Math.random()` Used for Reference Generation

**Routes:** `wallet/route.ts`, `wallet/transfer/route.ts`, `intercity/route.ts`, `school/route.ts`

`Math.random()` is not cryptographically secure. For financial reference codes, `crypto.randomBytes()` should be used to prevent predictability.

---

### L4. Zone Distance Matrices Are Incomplete/Inconsistent

- `pricing/route.ts` — 13 zones in distance matrix
- `deliveries/route.ts` — only 5 zones in distance matrix
- `carpool/route.ts` — only 5 zones
- `moto/route.ts` — only 5 zones

Zones like Gbessia, Tombolia, Lambanyi, Sonfonia, Kagbelene, Dubreka, Maneah, Sanoyah are missing from most matrices and will fall back to the default distance of 8 km.

---

### L5. Rides GET Route Validates Insufficient Required Fields

**Route:** `rides/route.ts` (POST, line 97)

Only checks `passengerId`, `pickupAddress`, and `dropoffAddress` as required. Fields like `pickupZone`, `dropoffZone`, `pickupLat`, `pickupLng` default to 0 or 'Unknown' without validation, which could cause incorrect pricing and zone assignment.

---

### L6. Booking Fare Estimation Is Overly Simplistic

**Route:** `bookings/route.ts` (POST)

Fare is a flat hardcoded value per vehicle type (standard: 5000, premium: 12000, van: 20000) regardless of distance or zones. This doesn't match the dynamic pricing in `pricing/route.ts`.

---

### L7. Driver Update Only Updates First Vehicle

**Route:** `drivers/[id]/route.ts` (PATCH, line 46)

```ts
await db.vehicle.update({
  where: { id: existingDriver.vehicles[0].id },
  data: vehicleUpdate,
});
```

If a driver has multiple active vehicles, only the first one is updated.

---

## PRISMA SCHEMA NOTES

- All 25 models are defined and properly related
- All Decimal fields are annotated with `@db.Decimal(10, 2)`
- Indexes are defined for frequently queried fields
- The `ChatMessage` model has no relation to `Ride` model via a proper foreign key (uses `rideId` as a plain String field without `@relation`)
- No soft-delete pattern is used; deletes are permanent

---

## SUMMARY TABLE

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 5 | C1, C2, C3, C4, C5 |
| **High** | 6 | H1, H2, H3, H4, H5, H6 |
| **Medium** | 9 | M1-M9 |
| **Low** | 7 | L1-L7 |
| **Total** | 27 | |

## TOP PRIORITY RECOMMENDATIONS

1. **Add `validateRequest()` to all routes** — This is the single highest-impact fix. Apply JWT auth middleware consistently.
2. **Fix Decimal serialization** — Create a global Prisma middleware or response helper to convert all Decimal fields to Number.
3. **Fix `wallet/transfer` auth check** — Use `auth.user.id` instead of `body.fromUserId`.
4. **Wrap loyalty points in a Prisma `$transaction`** — Prevent race condition point inflation.
5. **Persist intercity and school bookings to database** — Either create dedicated models or reuse the `Booking` model.
