'use client'

import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { Route, Clock, Search, Navigation, X, LocateFixed, Layers } from 'lucide-react'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useDriverSimulation } from '@/hooks/use-driver-simulation'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'

// ─── Fix Leaflet default marker icon paths for Next.js ─────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MovaMapProps {
  pickup?: { lat: number; lng: number; name?: string } | null
  dropoff?: { lat: number; lng: number; name?: string } | null
  drivers?: Array<{ lat: number; lng: number; id: string; name?: string }>
  showZones?: boolean
  className?: string
  onLocationSelect?: (lat: number, lng: number, address: string) => void
  onRouteInfo?: (info: { distance: number; duration: number }) => void
  interactive?: boolean
  showRoute?: boolean
  showSearch?: boolean
  showLocate?: boolean
  showLayerToggle?: boolean
  showScale?: boolean
  /** Assigned driver position during active ride (real-time) */
  assignedDriverLocation?: { lat: number; lng: number; heading?: number; timestamp?: number } | null
  /** Ride ETA and distance remaining */
  rideEta?: { etaSeconds: number; distanceRemaining: number } | null
  /** Whether to show the live ride progress */
  showRideProgress?: boolean
}

interface ZoneData {
  name: string
  color: string
  center: [number, number]
  polygon: [number, number][]
}

interface SearchResult {
  display_name: string
  lat: string
  lon: string
  type: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CONAKRY_CENTER: [number, number] = [9.6050, -13.6230]
const CONAKRY_ZOOM = 12
const CONAKRY_BOUNDS: L.LatLngBounds = L.latLngBounds(
  [9.46, -13.80], // SW
  [9.72, -13.40], // NE
)

// Polygon boundaries for Conakry communes (5 historiques + 8 nouveaux L/2024/003/CNT)
const ZONES: ZoneData[] = [
  {
    name: 'Kaloum',
    color: '#10b981',
    center: [9.5092, -13.7122],
    polygon: [
      [9.4920, -13.7420], [9.4880, -13.7200], [9.4900, -13.7000],
      [9.4980, -13.6880], [9.5080, -13.6850], [9.5180, -13.6900],
      [9.5250, -13.7000], [9.5280, -13.7150], [9.5250, -13.7300],
      [9.5180, -13.7400], [9.5050, -13.7450], [9.4920, -13.7420],
    ],
  },
  {
    name: 'Dixinn',
    color: '#f59e0b',
    center: [9.5380, -13.6950],
    polygon: [
      [9.5180, -13.6900], [9.5250, -13.7000], [9.5280, -13.7150],
      [9.5400, -13.7200], [9.5480, -13.7120], [9.5520, -13.6980],
      [9.5480, -13.6820], [9.5380, -13.6750], [9.5280, -13.6780],
      [9.5180, -13.6880], [9.5180, -13.6900],
    ],
  },
  {
    name: 'Matam',
    color: '#ef4444',
    center: [9.5560, -13.6700],
    polygon: [
      [9.5480, -13.6820], [9.5520, -13.6980], [9.5580, -13.6900],
      [9.5650, -13.6780], [9.5700, -13.6650], [9.5680, -13.6480],
      [9.5600, -13.6450], [9.5500, -13.6520], [9.5450, -13.6650],
      [9.5480, -13.6780], [9.5480, -13.6820],
    ],
  },
  {
    name: 'Ratoma',
    color: '#ec4899',
    center: [9.6350, -13.5950],
    polygon: [
      [9.5650, -13.6480], [9.5700, -13.6650], [9.5800, -13.6550],
      [9.5950, -13.6350], [9.6150, -13.6180], [9.6350, -13.6000],
      [9.6500, -13.5800], [9.6450, -13.5600], [9.6300, -13.5500],
      [9.6100, -13.5550], [9.5900, -13.5650], [9.5750, -13.5800],
      [9.5650, -13.6000], [9.5580, -13.6200], [9.5600, -13.6400],
      [9.5650, -13.6480],
    ],
  },
  {
    name: 'Matoto',
    color: '#8b5cf6',
    center: [9.5860, -13.6230],
    polygon: [
      [9.5700, -13.6650], [9.5800, -13.6550], [9.5950, -13.6350],
      [9.6100, -13.6200], [9.6150, -13.6050], [9.6100, -13.5850],
      [9.6000, -13.5700], [9.5900, -13.5600], [9.5800, -13.5650],
      [9.5700, -13.5800], [9.5650, -13.6000], [9.5580, -13.6200],
      [9.5600, -13.6400], [9.5650, -13.6480], [9.5700, -13.6650],
    ],
  },
  {
    name: 'Gbessia',
    color: '#0ea5e9',
    center: [9.608, -13.608],
    polygon: [
      [9.598, -13.620], [9.602, -13.616], [9.608, -13.613],
      [9.615, -13.615], [9.618, -13.610], [9.616, -13.603],
      [9.612, -13.598], [9.605, -13.596], [9.598, -13.600],
      [9.595, -13.607], [9.597, -13.615], [9.598, -13.620],
    ],
  },
  {
    name: 'Tombolia',
    color: '#a855f7',
    center: [9.615, -13.615],
    polygon: [
      [9.608, -13.625], [9.612, -13.621], [9.618, -13.618],
      [9.622, -13.613], [9.620, -13.607], [9.616, -13.604],
      [9.610, -13.607], [9.607, -13.613], [9.608, -13.620],
      [9.608, -13.625],
    ],
  },
  {
    name: 'Lambanyi',
    color: '#14b8a6',
    center: [9.625, -13.610],
    polygon: [
      [9.616, -13.622], [9.620, -13.618], [9.628, -13.615],
      [9.633, -13.610], [9.632, -13.603], [9.627, -13.597],
      [9.621, -13.598], [9.617, -13.603], [9.615, -13.610],
      [9.616, -13.618], [9.616, -13.622],
    ],
  },
  {
    name: 'Sonfonia',
    color: '#f97316',
    center: [9.640, -13.585],
    polygon: [
      [9.630, -13.600], [9.635, -13.595], [9.642, -13.590],
      [9.648, -13.582], [9.647, -13.575], [9.642, -13.570],
      [9.635, -13.572], [9.630, -13.578], [9.628, -13.588],
      [9.630, -13.596], [9.630, -13.600],
    ],
  },
  {
    name: 'Kagbelen',
    color: '#6366f1',
    center: [9.610, -13.630],
    polygon: [
      [9.601, -13.640], [9.605, -13.636], [9.612, -13.632],
      [9.618, -13.628], [9.617, -13.622], [9.612, -13.618],
      [9.605, -13.620], [9.600, -13.626], [9.598, -13.634],
      [9.601, -13.640],
    ],
  },
  {
    name: 'Dubreka',
    color: '#84cc16',
    center: [9.690, -13.550],
    polygon: [
      [9.678, -13.568], [9.683, -13.562], [9.690, -13.556],
      [9.697, -13.548], [9.695, -13.540], [9.688, -13.534],
      [9.680, -13.537], [9.675, -13.544], [9.672, -13.556],
      [9.675, -13.564], [9.678, -13.568],
    ],
  },
  {
    name: 'Maneah',
    color: '#ec4899',
    center: [9.660, -13.560],
    polygon: [
      [9.650, -13.575], [9.655, -13.570], [9.662, -13.565],
      [9.668, -13.558], [9.666, -13.550], [9.660, -13.545],
      [9.653, -13.548], [9.648, -13.555], [9.646, -13.565],
      [9.648, -13.573], [9.650, -13.575],
    ],
  },
  {
    name: 'Sanoyah',
    color: '#eab308',
    center: [9.680, -13.570],
    polygon: [
      [9.670, -13.582], [9.675, -13.577], [9.682, -13.572],
      [9.688, -13.565], [9.687, -13.557], [9.682, -13.552],
      [9.675, -13.555], [9.669, -13.561], [9.667, -13.571],
      [9.669, -13.579], [9.670, -13.582],
    ],
  },
]

// ─── Tile Layers ──────────────────────────────────────────────────────────────

const TILE_LAYERS = [
  {
    name: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
  },
  {
    name: 'Topographique',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
  {
    name: 'Sombre',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB',
  },
]

// ─── Custom Icons ──────────────────────────────────────────────────────────────

function createPickupIcon(): L.DivIcon {
  return L.divIcon({
    className: 'mova-marker-pickup',
    html: `
      <div style="position:relative;width:44px;height:44px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(16,185,129,0.2);animation:mova-marker-pulse 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:rgba(16,185,129,0.12);animation:mova-marker-pulse 2s ease-out infinite 0.4s;"></div>
        <div style="position:absolute;inset:8px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 2px 12px rgba(16,185,129,0.5);display:flex;align-items:center;justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg>
        </div>
        <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:#10b981;color:white;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.2);">DEPART</div>
      </div>
    `,
    iconSize: [44, 56],
    iconAnchor: [22, 22],
  })
}

function createDropoffIcon(): L.DivIcon {
  return L.divIcon({
    className: 'mova-marker-dropoff',
    html: `
      <div style="position:relative;width:40px;height:40px;">
        <div style="position:absolute;inset:2px;border-radius:50%;background:rgba(245,158,11,0.15);"></div>
        <div style="position:absolute;inset:5px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 2px 12px rgba(245,158,11,0.5);display:flex;align-items:center;justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:#f59e0b;color:white;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.2);">ARRIVEE</div>
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 20],
  })
}

function createDriverIcon(): L.DivIcon {
  return L.divIcon({
    className: 'mova-marker-driver',
    html: `
      <div style="position:relative;width:36px;height:36px;">
        <div style="position:absolute;inset:2px;border-radius:50%;background:rgba(5,150,105,0.12);animation:mova-marker-pulse 3s ease-out infinite;"></div>
        <div style="position:absolute;inset:6px;border-radius:50%;background:#059669;border:2.5px solid white;box-shadow:0 2px 8px rgba(5,150,105,0.4);display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A1 1 0 0 0 14.5 6h-5a1 1 0 0 0-.8.4L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

function createSelectedIcon(): L.DivIcon {
  return L.divIcon({
    className: 'mova-marker-selected',
    html: `
      <div style="position:relative;width:28px;height:28px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(239,68,68,0.2);animation:mova-marker-pulse 1.5s ease-out infinite;"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 10px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// Memoize icons
const pickupIcon = createPickupIcon()
const dropoffIcon = createDropoffIcon()
const driverIcon = createDriverIcon()
const selectedIcon = createSelectedIcon()

// ─── Polyline Decoder (OSRM) ─────────────────────────────────────────────────

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let shift = 0, result = 0, byte = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlat = ((result & 1) ? ~(result >>> 1) : result >>> 1)
    lat += dlat
    shift = 0; result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlng = ((result & 1) ? ~(result >>> 1) : result >>> 1)
    lng += dlng
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

// ─── Sub-Components ────────────────────────────────────────────────────────────

/** Auto-fits map bounds when pickup/dropoff change */
function FitBoundsHandler({
  pickup,
  dropoff,
}: {
  pickup?: { lat: number; lng: number } | null
  dropoff?: { lat: number; lng: number } | null
}) {
  const map = useMap()
  const hasFitted = useRef(false)

  useEffect(() => {
    if (!pickup && !dropoff) return

    const points: L.LatLngExpression[] = []
    if (pickup) points.push([pickup.lat, pickup.lng])
    if (dropoff) points.push([dropoff.lat, dropoff.lng])

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 })
      hasFitted.current = true
    } else if (points.length === 1) {
      map.setView(points[0], 15, { animate: true })
      hasFitted.current = true
    }
  }, [pickup, dropoff, map])

  return null
}

/** Handles map click events for location selection with reverse geocoding */
function ClickHandler({
  onLocationSelect,
  interactive = true,
}: {
  onLocationSelect?: (lat: number, lng: number, address: string) => void
  interactive?: boolean
}) {
  const map = useMap()

  useMapEvents({
    click(e) {
      if (interactive && onLocationSelect) {
        // Reverse geocode the clicked point
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&zoom=18&addressdetails=1&accept-language=fr`,
          { headers: { 'User-Agent': 'MOVA-App/1.0' } },
        )
          .then((r) => r.json())
          .then((data) => {
            const name = data.display_name || `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`
            onLocationSelect(e.latlng.lat, e.latlng.lng, name)
          })
          .catch(() => {
            // Fallback to coordinates
            onLocationSelect(e.latlng.lat, e.latlng.lng, `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`)
          })
      }
    },
  })

  return null
}

/** Locate user button handler */
function LocateHandler({ enabled }: { enabled: boolean }) {
  const map = useMap()
  const watchRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        map.setView([latitude, longitude], 16, { animate: true })
        // Place a temporary marker
        const marker = L.marker([latitude, longitude], { icon: selectedIcon }).addTo(map)
        marker.bindTooltip('Votre position', { permanent: true, direction: 'top', className: 'mova-marker-tooltip' })
        // Remove after 10 seconds
        setTimeout(() => marker.remove(), 10000)
      },
      () => {
        // Geolocation denied or unavailable - center on Conakry
        map.setView(CONAKRY_CENTER, CONAKRY_ZOOM)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )

    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [enabled, map])

  return null
}

/** Zone polygon with hover effect */
function ZonePolygon({ zone }: { zone: ZoneData }) {
  const positions = useMemo(() => zone.polygon, [zone.polygon])
  const pathOptions = useMemo(
    () => ({
      color: zone.color,
      weight: 2,
      opacity: 0.7,
      fillColor: zone.color,
      fillOpacity: 0.08,
      dashArray: undefined,
    }),
    [zone.color],
  )

  const hoverPathOptions = useMemo(
    () => ({
      color: zone.color,
      weight: 3,
      opacity: 1,
      fillColor: zone.color,
      fillOpacity: 0.18,
    }),
    [zone.color],
  )

  const [hovered, setHovered] = useState(false)

  return (
    <Polygon
      positions={positions}
      pathOptions={hovered ? hoverPathOptions : pathOptions}
      eventHandlers={{
        mouseover: () => setHovered(true),
        mouseout: () => setHovered(false),
      }}
    >
      <Tooltip
        permanent={false}
        direction="center"
        sticky={true}
        className="mova-zone-tooltip"
      >
        <span style={{ fontWeight: 600, fontSize: 12, color: zone.color }}>
          {zone.name}
        </span>
      </Tooltip>
    </Polygon>
  )
}

/** OSRM route with animated dash */
function RouteLine({
  pickup,
  dropoff,
  routePoints,
}: {
  pickup?: { lat: number; lng: number } | null
  dropoff?: { lat: number; lng: number } | null
  routePoints?: [number, number][] | null
}) {
  const positions = useMemo(() => {
    if (routePoints && routePoints.length > 0) return routePoints as L.LatLngExpression[]
    if (!pickup || !dropoff) return []
    return [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] as L.LatLngExpression[]
  }, [pickup, dropoff, routePoints])

  if (positions.length === 0) return null

  return (
    <>
      {/* Shadow / outline */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#065f46',
          weight: 8,
          opacity: 0.3,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Main line */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#059669',
          weight: 4,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '12 8',
        }}
      />
    </>
  )
}

/** Animated marker with entrance */
function AnimatedMarker({
  position,
  icon,
  label,
}: {
  position: [number, number]
  icon: L.DivIcon
  label?: string
}) {
  return (
    <Marker position={position} icon={icon}>
      {label && (
        <Tooltip
          permanent={false}
          direction="top"
          offset={[0, -24]}
          className="mova-marker-tooltip"
        >
          {label}
        </Tooltip>
      )}
    </Marker>
  )
}

/** Scale control */
function ScaleControl() {
  const map = useMap()
  useEffect(() => {
    const scale = L.control.scale({ imperial: false, position: 'bottomleft' })
    scale.addTo(map)
    return () => { map.removeControl(scale) }
  }, [map])
  return null
}

// ─── Smooth Driver Marker ─────────────────────────────────────────────────────

/** Animated driver marker with heading direction indicator */
function SmoothDriverMarker({
  position,
  heading = 0,
  isAssigned = false,
  name,
}: {
  position: [number, number]
  heading?: number
  isAssigned?: boolean
  name?: string
}) {
  const icon = useMemo(() => {
    if (isAssigned) {
      // Larger, more prominent marker for the assigned driver
      return L.divIcon({
        className: 'mova-marker-assigned-driver',
        html: `
          <div style="position:relative;width:48px;height:48px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(5,150,105,0.2);animation:mova-marker-pulse 2s ease-out infinite;"></div>
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(5,150,105,0.1);animation:mova-marker-pulse 2s ease-out infinite 0.5s;"></div>
            <div style="position:absolute;inset:4px;border-radius:50%;background:#059669;border:3px solid white;box-shadow:0 2px 16px rgba(5,150,105,0.6);display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A1 1 0 0 0 14.5 6h-5a1 1 0 0 0-.8.4L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/>
                <circle cx="7" cy="17" r="2"/>
                <path d="M9 17h6"/>
                <circle cx="17" cy="17" r="2"/>
              </svg>
            </div>
            <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);background:#059669;color:white;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2);">VOTRE CHAUFFEUR</div>
          </div>
        `,
        iconSize: [48, 62],
        iconAnchor: [24, 24],
      })
    }
    return L.divIcon({
      className: 'mova-marker-driver-smooth',
      html: `
        <div style="position:relative;width:32px;height:32px;">
          <div style="position:absolute;inset:2px;border-radius:50%;background:rgba(5,150,105,0.12);"></div>
          <div style="position:absolute;inset:5px;border-radius:50%;background:#059669;border:2px solid white;box-shadow:0 2px 8px rgba(5,150,105,0.4);display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A1 1 0 0 0 14.5 6h-5a1 1 0 0 0-.8.4L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <path d="M9 17h6"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    })
  }, [heading, isAssigned])

  return (
    <Marker position={position} icon={icon}>
      {name && (
        <Tooltip
          permanent={false}
          direction="top"
          offset={[0, -20]}
          className="mova-marker-tooltip"
        >
          {name}
        </Tooltip>
      )}
    </Marker>
  )
}

// ─── Main Map Component ────────────────────────────────────────────────────────

export function MovaMap({
  pickup,
  dropoff,
  drivers,
  showZones = true,
  className = '',
  onLocationSelect,
  onRouteInfo,
  interactive = true,
  showRoute = true,
  showSearch = true,
  showLocate = true,
  showLayerToggle = true,
  showScale = true,
  assignedDriverLocation,
  rideEta,
  showRideProgress = false,
}: MovaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [routePoints, setRoutePoints] = useState<[number, number][] | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [locateRequested, setLocateRequested] = useState(false)
  const [activeLayer, setActiveLayer] = useState(0)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Inject map CSS
  useEffect(() => {
    const styleId = 'mova-map-styles-v2'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes mova-marker-pulse {
        0% { transform: scale(0.8); opacity: 0.8; }
        100% { transform: scale(1.8); opacity: 0; }
      }

      .mova-marker-pickup, .mova-marker-dropoff,
      .mova-marker-driver, .mova-marker-selected,
      .mova-marker-assigned-driver, .mova-marker-driver-smooth {
        background: transparent !important;
        border: none !important;
      }

      .mova-zone-tooltip {
        background: rgba(255, 255, 255, 0.96) !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 10px !important;
        padding: 6px 14px !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 13px !important;
      }
      .mova-zone-tooltip::before {
        border-top-color: rgba(255, 255, 255, 0.96) !important;
      }
      .dark .mova-zone-tooltip {
        background: rgba(15, 23, 42, 0.95) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
      }
      .dark .mova-zone-tooltip::before {
        border-top-color: rgba(15, 23, 42, 0.95) !important;
      }

      .mova-marker-tooltip {
        background: rgba(15, 23, 42, 0.92) !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 5px 12px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        letter-spacing: -0.01em;
      }
      .mova-marker-tooltip::before {
        border-top-color: rgba(15, 23, 42, 0.92) !important;
      }
      .dark .mova-marker-tooltip {
        background: rgba(255, 255, 255, 0.95) !important;
        color: #0f172a !important;
      }
      .dark .mova-marker-tooltip::before {
        border-top-color: rgba(255, 255, 255, 0.95) !important;
      }

      /* Leaflet controls styling */
      .leaflet-control-zoom a {
        width: 36px !important;
        height: 36px !important;
        line-height: 36px !important;
        font-size: 18px !important;
        border-radius: 10px !important;
        border: none !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
        color: #0f172a !important;
        background: rgba(255, 255, 255, 0.95) !important;
      }
      .leaflet-control-zoom a:hover {
        background: rgba(255, 255, 255, 1) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      }
      .dark .leaflet-control-zoom a {
        background: rgba(30, 41, 59, 0.95) !important;
        color: #e2e8f0 !important;
      }

      .leaflet-control-scale-line {
        background: rgba(255, 255, 255, 0.85) !important;
        border-color: #94a3b8 !important;
        color: #475569 !important;
        font-size: 11px !important;
        border-radius: 4px !important;
        padding: 2px 6px !important;
      }
      .dark .leaflet-control-scale-line {
        background: rgba(30, 41, 59, 0.85) !important;
        border-color: #475569 !important;
        color: #cbd5e1 !important;
      }

      /* Smooth marker entrance */
      .leaflet-marker-icon {
        animation: mova-marker-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes mova-marker-enter {
        0% { opacity: 0; transform: scale(0.3) translateY(12px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }

      /* Popup styling */
      .leaflet-popup-content-wrapper {
        border-radius: 12px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12) !important;
      }

      @media (max-width: 640px) {
        .leaflet-control-attribution {
          font-size: 7px !important;
          padding: 1px 3px !important;
          background: rgba(255,255,255,0.5) !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => { const el = document.getElementById(styleId); if (el) el.remove() }
  }, [])

  // Fetch OSRM route
  useEffect(() => {
    if (!pickup || !dropoff || !showRoute) return

    const controller = new AbortController()
    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=polylines&steps=true`
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        if (data.routes && data.routes[0]) {
          const route = data.routes[0]
          const decoded = decodePolyline(route.geometry)
          setRoutePoints(decoded)
          const info = { distance: route.distance, duration: route.duration }
          setRouteInfo(info)
          if (onRouteInfo) onRouteInfo(info)
        }
      } catch {
        setRoutePoints(null)
      }
    }
    fetchRoute()
    return () => controller.abort()
  }, [pickup, dropoff, showRoute])

  // Search handler with Nominatim
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (query.length < 3) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const bounds = `${CONAKRY_BOUNDS.getSouth()},${CONAKRY_BOUNDS.getWest()},${CONAKRY_BOUNDS.getNorth()},${CONAKRY_BOUNDS.getEast()}`
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Conakry Guinee')}&bounded=1&viewbox=${bounds}&limit=6&addressdetails=1&accept-language=fr`,
          { headers: { 'User-Agent': 'MOVA-App/1.0' } },
        )
        const data = await res.json()
        setSearchResults(data)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 350)
  }, [])

  // Select a search result
  const handleSelectResult = useCallback((result: SearchResult) => {
    if (onLocationSelect) {
      onLocationSelect(parseFloat(result.lat), parseFloat(result.lon), result.display_name)
    }
    setShowSearchPanel(false)
    setSearchQuery('')
    setSearchResults([])
  }, [onLocationSelect])

  // Locate me handler
  const handleLocate = useCallback(() => {
    setLocateRequested(true)
    setTimeout(() => setLocateRequested(false), 100)
  }, [])

  // Real-time driver simulation
  const { drivers: simDrivers, isSimulating } = useDriverSimulation(true)

  // Use external drivers prop if provided, otherwise use simulated drivers
  const activeDrivers = drivers ?? simDrivers
  const onlineCount = activeDrivers.filter((d) => 'isOnline' in d ? (d as { isOnline?: boolean }).isOnline !== false : true).length
  const tileLayer = TILE_LAYERS[activeLayer]

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden rounded-xl ${className}`}>
      <MapContainer
        center={CONAKRY_CENTER}
        zoom={CONAKRY_ZOOM}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={true}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        maxBounds={CONAKRY_BOUNDS.pad(0.3)}
        maxBoundsViscosity={0.8}
        minZoom={10}
        maxZoom={18}
        ref={(map) => { if (map) mapRef.current = map }}
      >
        {/* Tile layer */}
        <TileLayer
          key={activeLayer}
          url={tileLayer.url}
          attribution={tileLayer.attribution}
          crossOrigin="anonymous"
          maxZoom={19}
        />

        {/* Click handler */}
        <ClickHandler onLocationSelect={onLocationSelect} interactive={interactive} />

        {/* Locate handler */}
        <LocateHandler enabled={locateRequested} />

        {/* Auto-fit bounds */}
        <FitBoundsHandler pickup={pickup} dropoff={dropoff} />

        {/* Zone polygons */}
        {showZones && ZONES.map((zone) => (
          <ZonePolygon key={zone.name} zone={zone} />
        ))}

        {/* Pickup marker */}
        {pickup && (
          <AnimatedMarker
            position={[pickup.lat, pickup.lng]}
            icon={pickupIcon}
            label={pickup.name || 'Depart'}
          />
        )}

        {/* Dropoff marker */}
        {dropoff && (
          <AnimatedMarker
            position={[dropoff.lat, dropoff.lng]}
            icon={dropoffIcon}
            label={dropoff.name || 'Arrivee'}
          />
        )}

        {/* Route line */}
        {showRoute && <RouteLine pickup={pickup} dropoff={dropoff} routePoints={routePoints} />}

        {/* Driver markers (only online drivers from simulation) */}
        {activeDrivers
          .filter((d) => 'isOnline' in d ? (d as { isOnline?: boolean }).isOnline !== false : true)
          .map((driver) => (
          <AnimatedMarker
            key={driver.id}
            position={[driver.lat, driver.lng]}
            icon={driverIcon}
            label={driver.name}
          />
        ))}

        {/* Assigned driver marker (real-time during active ride) */}
        {assignedDriverLocation && (
          <SmoothDriverMarker
            position={[assignedDriverLocation.lat, assignedDriverLocation.lng]}
            heading={assignedDriverLocation.heading ?? 0}
            isAssigned={true}
          />
        )}

        {/* Zoom control */}
        <ZoomControl position="topright" />

        {/* Scale */}
        {showScale && <ScaleControl />}
      </MapContainer>

      {/* ── Search Bar ── */}
      {showSearch && interactive && (
        <div className="absolute top-3 left-14 z-[1000] w-64 sm:w-72">
          <div className="mova-glass rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Rechercher une adresse..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setShowSearchPanel(true)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchPanel(false) }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {showSearchPanel && (
              <div className="border-t border-border/50 max-h-60 overflow-y-auto mova-scrollbar">
                {searchLoading && (
                  <div className="px-4 py-6 text-center">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Recherche en cours...</p>
                  </div>
                )}
                {!searchLoading && searchResults.length === 0 && searchQuery.length >= 3 && (
                  <div className="px-4 py-6 text-center">
                    <Navigation className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Aucun resultat pour "{searchQuery}"</p>
                  </div>
                )}
                {searchResults.map((result, i) => (
                  <button
                    key={`${result.lat}-${result.lon}-${i}`}
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                  >
                    <p className="text-xs font-medium text-foreground line-clamp-1">{result.display_name.split(',')[0]}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{result.display_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Map Controls ── */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        {/* Locate me */}
        {showLocate && interactive && (
          <button
            onClick={handleLocate}
            className="mova-glass rounded-xl shadow-md w-9 h-9 flex items-center justify-center hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors"
            title="Ma position"
          >
            <LocateFixed className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>
        )}

        {/* Layer toggle */}
        {showLayerToggle && (
          <button
            onClick={() => setActiveLayer((prev) => (prev + 1) % TILE_LAYERS.length)}
            className="mova-glass rounded-xl shadow-md w-9 h-9 flex items-center justify-center hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors"
            title={TILE_LAYERS[activeLayer].name}
          >
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>
        )}
      </div>

      {/* ── Layer Name Badge ── */}
      {showLayerToggle && (
        <div className="absolute bottom-14 right-3 z-[1000]">
          <div className="mova-glass rounded-lg shadow-sm px-2.5 py-1">
            <span className="text-[10px] font-semibold text-muted-foreground">{TILE_LAYERS[activeLayer].name}</span>
          </div>
        </div>
      )}

      {/* ── Route Info Overlay ── */}
      {routeInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 mova-glass rounded-xl px-5 py-2.5 shadow-lg z-[1000]">
          <div className="flex items-center gap-5 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <Route className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="font-bold text-foreground">{(routeInfo.distance / 1000).toFixed(1)} km</p>
              </div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duree</p>
                <p className="font-bold text-foreground">{Math.ceil(routeInfo.duration / 60)} min</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Ride ETA Overlay ── */}
      {showRideProgress && rideEta && rideEta.etaSeconds > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] mt-8">
          <div className="mova-glass rounded-xl px-4 py-2 shadow-lg flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Arrivée dans</p>
              <p className="font-bold text-sm text-foreground">
                {rideEta.etaSeconds < 60 
                  ? `${rideEta.etaSeconds}s` 
                  : `${Math.ceil(rideEta.etaSeconds / 60)} min`}
              </p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div>
              <p className="text-xs text-muted-foreground">Restant</p>
              <p className="font-bold text-sm text-foreground">
                {(rideEta.distanceRemaining / 1000).toFixed(1)} km
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── MOVA Watermark ── */}
      <div className="absolute top-3 left-3 z-[1000]">
        <div className="mova-glass rounded-lg px-3 py-1.5 shadow-sm pointer-events-none">
          <p className="text-xs font-black mova-gradient-text tracking-widest">MOVA</p>
        </div>
      </div>

      {/* ── Driver Count Badge ── */}
      {onlineCount > 0 && (
        <div className="absolute top-3 left-3 z-[999] mt-8 pointer-events-none">
          <div className="mova-glass rounded-lg px-2.5 py-1 shadow-sm">
            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              {onlineCount} chauffeur{onlineCount > 1 ? 's' : ''} en ligne
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Zoom Control Component ────────────────────────────────────────────────────

function ZoomControl({ position }: { position: L.ControlPosition }) {
  const map = useMap()
  useEffect(() => {
    const zoom = L.control.zoom({ position })
    zoom.addTo(map)
    return () => { map.removeControl(zoom) }
  }, [map, position])
  return null
}

// ─── Dynamic Import Wrapper ────────────────────────────────────────────────────

export { MovaMap as default }

export const DynamicMovaMap = dynamic(
  () => import('@/components/mova/mova-map').then((mod) => ({ default: mod.MovaMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gradient-to-br from-emerald-50 via-emerald-100/50 to-amber-50 dark:from-emerald-950/50 dark:via-emerald-900/30 dark:to-amber-950/30 animate-pulse flex items-center justify-center rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl mova-gradient mx-auto mb-3 animate-pulse flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    ),
  },
)

export type { MovaMapProps }
