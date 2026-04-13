// Comprehensive input validation for MOVA API routes
// Sanitize and validate all user inputs to prevent XSS, SQL injection, etc.

export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 1000) // Max length
}

export function sanitizePhone(phone: unknown): string {
  if (typeof phone !== 'string') return ''
  return phone.replace(/[^0-9+]/g, '').slice(0, 15)
}

export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

export function validateGNFAmount(amount: unknown): number | null {
  if (typeof amount !== 'number' && typeof amount !== 'string') return null
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num) || num < 0 || num > 10_000_000) return null // Max 10M GNF
  return Math.round(num)
}

export function validateCoordinates(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const latNum = typeof lat === 'number' ? lat : typeof lat === 'string' ? parseFloat(lat) : NaN
  const lngNum = typeof lng === 'number' ? lng : typeof lng === 'string' ? parseFloat(lng) : NaN
  if (isNaN(latNum) || isNaN(lngNum)) return null
  // Global bounds check
  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return null
  return { lat: latNum, lng: lngNum }
}

export function validateOTP(otp: unknown): string | null {
  if (typeof otp !== 'string') return null
  const cleaned = otp.replace(/\s/g, '')
  if (!/^\d{4,6}$/.test(cleaned)) return null
  return cleaned
}

export function validateVehicleType(type: unknown): 'standard' | 'premium' | 'van' | null {
  if (typeof type !== 'string') return null
  const valid = ['standard', 'premium', 'van']
  return valid.includes(type.toLowerCase()) ? type.toLowerCase() as 'standard' | 'premium' | 'van' : null
}

export function validateRideStatus(status: unknown): string | null {
  if (typeof status !== 'string') return null
  const valid = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled']
  return valid.includes(status.toLowerCase()) ? status.toLowerCase() : null
}

export function validatePaymentMethod(method: unknown): string | null {
  if (typeof method !== 'string') return null
  const valid = ['cash', 'mobile_money', 'card', 'wallet']
  return valid.includes(method.toLowerCase()) ? method.toLowerCase() : null
}

export function validateZone(zone: unknown): string | null {
  if (typeof zone !== 'string') return null
  const valid = ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto', 'Gbessia', 'Tombolia', 'Lambanyi', 'Sonfonia', 'Kagbelene', 'Dubreka', 'Maneah', 'Sanoyah']
  return valid.some(v => v.toLowerCase() === zone.toLowerCase()) ? zone : null
}

export function sanitizeSearchQuery(query: unknown): string {
  if (typeof query !== 'string') return ''
  return query.trim().slice(0, 200)
}

// Validate request body has required fields
export function validateRequiredFields(body: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Le champ ${field} est requis`
    }
  }
  return null
}
