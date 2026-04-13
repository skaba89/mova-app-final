// ---------------------------------------------------------------------------
// MOVA — Guinea Administrative Divisions (Law L/2024/003/CNT)
// Master reference data for all 8 regions, 33 prefectures, and Conakry's
// communes as defined by the Conseil National de la Transition.
// ---------------------------------------------------------------------------

export interface Region {
  id: string
  name: string
  type: "gouvernorat" | "region"
  lat: number
  lng: number
  prefectures: Prefecture[]
}

export interface Prefecture {
  id: string
  name: string
  lat: number
  lng: number
  communes: Commune[]
}

export interface Commune {
  id: string
  name: string
  lat: number
  lng: number
  isConakry: boolean
  chefLieu?: string
}

// ---------------------------------------------------------------------------
// Conakry — 13 communes (5 original + 8 from scission)
// ---------------------------------------------------------------------------

export const CONAKRY_COMMUNES: Commune[] = [
  // ── 5 original communes ──
  { id: "ck-kaloum",   name: "Kaloum",     lat: 9.5092, lng: -13.7122, isConakry: true, chefLieu: "Conakry" },
  { id: "ck-dixinn",   name: "Dixinn",     lat: 9.5380, lng: -13.6950, isConakry: true, chefLieu: "Conakry" },
  { id: "ck-matam",    name: "Matam",      lat: 9.5560, lng: -13.6700, isConakry: true },
  { id: "ck-ratoma",   name: "Ratoma",     lat: 9.6350, lng: -13.5950, isConakry: true, chefLieu: "Taouyah" },
  { id: "ck-matoto",   name: "Matoto",     lat: 9.5860, lng: -13.6230, isConakry: true, chefLieu: "Simbaya 2" },

  // ── NEW communes (Law L/2024/003/CNT) ──
  // From Matoto (scission)
  { id: "ck-gbessia",    name: "Gbessia",    lat: 9.5920, lng: -13.6100, isConakry: true, chefLieu: "Cite de l'Air" },
  { id: "ck-tombolia",   name: "Tombolia",   lat: 9.6400, lng: -13.5800, isConakry: true, chefLieu: "Tombolia" },
  // From Ratoma (scission)
  { id: "ck-lambanyi",   name: "Lambanyi",   lat: 9.6100, lng: -13.6150, isConakry: true, chefLieu: "Lambanyi" },
  { id: "ck-sonfonia",   name: "Sonfonia",   lat: 9.6200, lng: -13.5850, isConakry: true, chefLieu: "Sonfonia Centre 1" },
  // From Dubreka (moved into Ville de Conakry)
  { id: "ck-kagbelen",   name: "Kagbelene",  lat: 9.6000, lng: -13.5450, isConakry: true, chefLieu: "Kagbelene Plateau" },
  { id: "ck-dubreka",    name: "Dubreka",    lat: 9.7833, lng: -13.5167, isConakry: true, chefLieu: "Dubreka Centre" },
  // From Maneah (moved into Ville de Conakry)
  { id: "ck-maneah",     name: "Maneah",     lat: 9.5800, lng: -13.4950, isConakry: true, chefLieu: "Tanene 1" },
  { id: "ck-sanoyah",    name: "Sanoyah",    lat: 9.5650, lng: -13.4800, isConakry: true, chefLieu: "Sanoyah Km 36" },
]

/** Quick lookup set for Conakry commune names (for validation) */
export const CONAKRY_COMMUNE_NAMES = new Set(CONAKRY_COMMUNES.map((c) => c.name))

// ---------------------------------------------------------------------------
// All 8 regions of Guinea
// ---------------------------------------------------------------------------

export const GUINEA_REGIONS: Region[] = [
  // ─── 1. Conakry — Gouvernorat (special zone) ───
  {
    id: "rg-conakry",
    name: "Conakry",
    type: "gouvernorat",
    lat: 9.5092,
    lng: -13.7122,
    prefectures: [
      {
        id: "pf-conakry",
        name: "Conakry",
        lat: 9.5092,
        lng: -13.7122,
        communes: CONAKRY_COMMUNES,
      },
    ],
  },

  // ─── 2. Boke ───
  {
    id: "rg-boke",
    name: "Boke",
    type: "region",
    lat: 10.9333,
    lng: -14.2833,
    prefectures: [
      { id: "pf-boffa",    name: "Boffa",    lat: 10.1833, lng: -14.3833, communes: [] },
      { id: "pf-boke",     name: "Boke",     lat: 10.9333, lng: -14.2833, communes: [] },
      { id: "pf-fria",     name: "Fria",     lat: 10.3667, lng: -13.5833, communes: [] },
      { id: "pf-gaoual",   name: "Gaoual",   lat: 11.2500, lng: -13.2167, communes: [] },
      { id: "pf-koundara", name: "Koundara", lat: 11.8833, lng: -13.2167, communes: [] },
    ],
  },

  // ─── 3. Kindia ───
  {
    id: "rg-kindia",
    name: "Kindia",
    type: "region",
    lat: 10.0556,
    lng: -12.8667,
    prefectures: [
      { id: "pf-coyah",     name: "Coyah",     lat: 9.7000, lng: -13.3833, communes: [] },
      { id: "pf-dubreka",   name: "Dubreka",   lat: 9.7833, lng: -13.5167, communes: [] },
      { id: "pf-forecariah", name: "Forecariah", lat: 9.9333, lng: -13.1833, communes: [] },
      { id: "pf-kindia",    name: "Kindia",    lat: 10.0556, lng: -12.8667, communes: [] },
      { id: "pf-telimeli",  name: "Telimeli",  lat: 10.6833, lng: -12.8833, communes: [] },
    ],
  },

  // ─── 4. Labe ───
  {
    id: "rg-labe",
    name: "Labe",
    type: "region",
    lat: 11.3167,
    lng: -12.2833,
    prefectures: [
      { id: "pf-dalaba",  name: "Dalaba",  lat: 10.6833, lng: -12.2500, communes: [] },
      { id: "pf-koubia",  name: "Koubia",  lat: 11.1000, lng: -12.1667, communes: [] },
      { id: "pf-labe",    name: "Labe",    lat: 11.3167, lng: -12.2833, communes: [] },
      { id: "pf-lelouma", name: "Lelouma", lat: 11.2167, lng: -12.6333, communes: [] },
      { id: "pf-togue",   name: "Togue",   lat: 11.4500, lng: -12.6500, communes: [] },
    ],
  },

  // ─── 5. Mamou ───
  {
    id: "rg-mamou",
    name: "Mamou",
    type: "region",
    lat: 10.3667,
    lng: -11.8833,
    prefectures: [
      { id: "pf-mamou", name: "Mamou", lat: 10.3667, lng: -11.8833, communes: [] },
      { id: "pf-pita",  name: "Pita",  lat: 10.0500, lng: -12.4000, communes: [] },
    ],
  },

  // ─── 6. Kankan ───
  {
    id: "rg-kankan",
    name: "Kankan",
    type: "region",
    lat: 10.3833,
    lng: -9.3000,
    prefectures: [
      { id: "pf-kankan",    name: "Kankan",    lat: 10.3833, lng: -9.3000, communes: [] },
      { id: "pf-kerouane",  name: "Kerouane",  lat: 10.3500, lng: -9.1833, communes: [] },
      { id: "pf-kouroussa", name: "Kouroussa", lat: 10.6500, lng: -10.0500, communes: [] },
      { id: "pf-mandiana",  name: "Mandiana",  lat: 10.6167, lng: -8.6833, communes: [] },
      { id: "pf-siguiri",   name: "Siguiri",   lat: 11.4167, lng: -9.1667, communes: [] },
    ],
  },

  // ─── 7. Faranah ───
  {
    id: "rg-faranah",
    name: "Faranah",
    type: "region",
    lat: 10.0500,
    lng: -10.7500,
    prefectures: [
      { id: "pf-dabola",      name: "Dabola",      lat: 10.4500, lng: -11.1167, communes: [] },
      { id: "pf-dinguiraye",  name: "Dinguiraye",  lat: 11.3000, lng: -10.7000, communes: [] },
      { id: "pf-faranah",     name: "Faranah",     lat: 10.0500, lng: -10.7500, communes: [] },
      { id: "pf-kissidougou", name: "Kissidougou", lat: 9.1833, lng: -10.1000, communes: [] },
    ],
  },

  // ─── 8. Nzerekore ───
  {
    id: "rg-nzerekore",
    name: "Nzerekore",
    type: "region",
    lat: 7.7500,
    lng: -8.8333,
    prefectures: [
      { id: "pf-beyla",      name: "Beyla",      lat: 8.6833, lng: -8.6333, communes: [] },
      { id: "pf-gueckedou",  name: "Gueckedou",  lat: 8.5667, lng: -10.1333, communes: [] },
      { id: "pf-lola",       name: "Lola",       lat: 7.9667, lng: -8.5333, communes: [] },
      { id: "pf-macenta",    name: "Macenta",    lat: 8.5333, lng: -9.4667, communes: [] },
      { id: "pf-nzerekore",  name: "Nzerekore",  lat: 7.7500, lng: -8.8333, communes: [] },
      { id: "pf-yomou",      name: "Yomou",      lat: 7.5667, lng: -9.2500, communes: [] },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helper: Get all prefecture names across Guinea (for validation)
// ---------------------------------------------------------------------------

export const ALL_PREFECTURE_NAMES: string[] = GUINEA_REGIONS.flatMap((r) =>
  r.prefectures.map((p) => p.name)
)

// ---------------------------------------------------------------------------
// Helper: Build a flat location list from Conakry communes for dropdowns
// Each commune gets 2-3 named locations
// ---------------------------------------------------------------------------

export interface Location {
  name: string
  zone: string
  lat: number
  lng: number
  region?: string
}

/** Conakry-specific locations for passenger/delivery/carpool dropdowns */
export const CONAKRY_LOCATIONS: Location[] = [
  // ── Kaloum (Centre administratif) ──
  { name: "Centre-ville Kaloum", zone: "Kaloum", lat: 9.5090, lng: -13.7120, region: "Conakry" },
  { name: "Hotel Riviera", zone: "Kaloum", lat: 9.5060, lng: -13.7180, region: "Conakry" },
  { name: "Port de Conakry", zone: "Kaloum", lat: 9.5045, lng: -13.7220, region: "Conakry" },

  // ── Dixinn (Quartier diplomatique) ──
  { name: "Palais du Peuple", zone: "Dixinn", lat: 9.5380, lng: -13.6950, region: "Conakry" },
  { name: "Corniche Nord", zone: "Dixinn", lat: 9.5450, lng: -13.7050, region: "Conakry" },
  { name: "Belle Vue", zone: "Dixinn", lat: 9.5350, lng: -13.6820, region: "Conakry" },

  // ── Matam (Commerce, Marche Madina) ──
  { name: "Marche Madina", zone: "Matam", lat: 9.5560, lng: -13.6700, region: "Conakry" },
  { name: "Coronthie", zone: "Matam", lat: 9.5580, lng: -13.6650, region: "Conakry" },
  { name: "Marche Niger", zone: "Matam", lat: 9.5540, lng: -13.6720, region: "Conakry" },

  // ── Ratoma (Zone residentielle, chef-lieu: Taouyah) ──
  { name: "Cite des Enseignants", zone: "Ratoma", lat: 9.6300, lng: -13.5950, region: "Conakry" },
  { name: "Taouyah", zone: "Ratoma", lat: 9.6250, lng: -13.6100, region: "Conakry" },

  // ── Matoto (chef-lieu: Simbaya 2) ──
  { name: "Simbaya 2", zone: "Matoto", lat: 9.5900, lng: -13.6180, region: "Conakry" },
  { name: "Koloma", zone: "Matoto", lat: 9.5920, lng: -13.6280, region: "Conakry" },

  // ── Gbessia (from Matoto, chef-lieu: Cite de l'Air) ──
  { name: "Aeroport Gbessia", zone: "Gbessia", lat: 9.5920, lng: -13.6100, region: "Conakry" },
  { name: "Cite de l'Air", zone: "Gbessia", lat: 9.5860, lng: -13.6050, region: "Conakry" },

  // ── Tombolia (from Matoto) ──
  { name: "Tombolia Centre", zone: "Tombolia", lat: 9.6400, lng: -13.5800, region: "Conakry" },
  { name: "Cite des Ministres", zone: "Tombolia", lat: 9.6450, lng: -13.5750, region: "Conakry" },

  // ── Lambanyi (from Ratoma) ──
  { name: "Lambanyi Centre", zone: "Lambanyi", lat: 9.6100, lng: -13.6150, region: "Conakry" },

  // ── Sonfonia (from Ratoma, chef-lieu: Sonfonia Centre 1) ──
  { name: "Sonfonia Centre", zone: "Sonfonia", lat: 9.6200, lng: -13.5850, region: "Conakry" },
  { name: "Sonfonia Cite", zone: "Sonfonia", lat: 9.6250, lng: -13.5800, region: "Conakry" },

  // ── Kagbelene (from Dubreka) ──
  { name: "Kagbelene Plateau", zone: "Kagbelene", lat: 9.6000, lng: -13.5450, region: "Conakry" },

  // ── Dubreka (from Dubreka prefecture) ──
  { name: "Dubreka Centre", zone: "Dubreka", lat: 9.7833, lng: -13.5167, region: "Conakry" },
  { name: "Marche Dubreka", zone: "Dubreka", lat: 9.7850, lng: -13.5200, region: "Conakry" },

  // ── Maneah (from Maneah, chef-lieu: Tanene 1) ──
  { name: "Tanene 1", zone: "Maneah", lat: 9.5800, lng: -13.4950, region: "Conakry" },

  // ── Sanoyah (from Maneah, chef-lieu: Sanoyah Km 36) ──
  { name: "Sanoyah Km 36", zone: "Sanoyah", lat: 9.5650, lng: -13.4800, region: "Conakry" },
]

// ---------------------------------------------------------------------------
// National locations (prefecture capitals for inter-city routes)
// ---------------------------------------------------------------------------

export const NATIONAL_LOCATIONS: Location[] = [
  // Boke region
  { name: "Boke Centre", zone: "Boke", lat: 10.9333, lng: -14.2833, region: "Boke" },
  { name: "Fria", zone: "Fria", lat: 10.3667, lng: -13.5833, region: "Boke" },
  { name: "Koundara", zone: "Koundara", lat: 11.8833, lng: -13.2167, region: "Boke" },
  // Kindia region
  { name: "Kindia Centre", zone: "Kindia", lat: 10.0556, lng: -12.8667, region: "Kindia" },
  { name: "Coyah", zone: "Coyah", lat: 9.7000, lng: -13.3833, region: "Kindia" },
  { name: "Forecariah", zone: "Forecariah", lat: 9.9333, lng: -13.1833, region: "Kindia" },
  // Labe region
  { name: "Labe Centre", zone: "Labe", lat: 11.3167, lng: -12.2833, region: "Labe" },
  { name: "Dalaba", zone: "Dalaba", lat: 10.6833, lng: -12.2500, region: "Labe" },
  { name: "Togue", zone: "Togue", lat: 11.4500, lng: -12.6500, region: "Labe" },
  // Mamou region
  { name: "Mamou Centre", zone: "Mamou", lat: 10.3667, lng: -11.8833, region: "Mamou" },
  { name: "Pita", zone: "Pita", lat: 10.0500, lng: -12.4000, region: "Mamou" },
  // Kankan region
  { name: "Kankan Centre", zone: "Kankan", lat: 10.3833, lng: -9.3000, region: "Kankan" },
  { name: "Siguiri", zone: "Siguiri", lat: 11.4167, lng: -9.1667, region: "Kankan" },
  { name: "Kouroussa", zone: "Kouroussa", lat: 10.6500, lng: -10.0500, region: "Kankan" },
  // Faranah region
  { name: "Faranah Centre", zone: "Faranah", lat: 10.0500, lng: -10.7500, region: "Faranah" },
  { name: "Kissidougou", zone: "Kissidougou", lat: 9.1833, lng: -10.1000, region: "Faranah" },
  // Nzerekore region
  { name: "Nzerekore Centre", zone: "Nzerekore", lat: 7.7500, lng: -8.8333, region: "Nzerekore" },
  { name: "Gueckedou", zone: "Gueckedou", lat: 8.5667, lng: -10.1333, region: "Nzerekore" },
  { name: "Macenta", zone: "Macenta", lat: 8.5333, lng: -9.4667, region: "Nzerekore" },
]

/** All locations combined (Conakry + national) */
export const ALL_LOCATIONS: Location[] = [...CONAKRY_LOCATIONS, ...NATIONAL_LOCATIONS]
