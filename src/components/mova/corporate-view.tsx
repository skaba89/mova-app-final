'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/lib/mova/store'
import { useNotifications } from '@/lib/mova/use-notifications'
import { useBusiness, useBusinessAnalytics, useBookings } from '@/lib/mova/api-hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Building2,
  Users,
  DollarSign,
  Briefcase,
  Settings,
  Plus,
  Search,
  Filter,
  Download,
  Edit,
  FileText,
  CreditCard,
  Bell,
  AlertTriangle,
  Check,
  X,
  ArrowUp,
  Eye,
  Phone,
  Mail,
  MapPin,
  ArrowLeft,
  LayoutDashboard,
  Moon,
  Sun,
  Clock,
  Smartphone,
} from 'lucide-react'

// ── GNF Formatter ──
const fmt = (n: number) => new Intl.NumberFormat('fr-GN').format(n) + ' GNF'
const fmtShort = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
  return n.toString()
}

// ── Company ──
const COMPANY = {
  name: 'SOCOPAO Guinee',
  fullName: 'Societe Commerciale et de Participation de l\'Ouest Africain',
  plan: 'Pro' as const,
  planBadge: 'Pro',
  totalMembers: 25,
  siret: 'GN-2024-B-01482',
  address: 'Cite Diamant, Dixinn, Conakry, Guinee',
  contact: '+224 628 11 22 33',
  email: 'entreprise@socopao.gn',
}

// ── Demo Business ID (fallback) ──
const DEMO_BUSINESS_ID = 'biz_demo_001'

// ── Status label mapping ──
const BOOKING_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Planifiee',
  confirmed: 'Confirmee',
  in_progress: 'En cours',
  completed: 'Terminee',
  cancelled: 'Annulee',
}

// ── Types ──
interface Employee {
  id: string
  name: string
  email: string
  phone: string
  department: string
  status: 'actif' | 'inactif'
  monthlyRides: number
  totalSpent: number
  monthlyLimit: number
  costCenter: string
}

interface Booking {
  id: string
  date: string
  time: string
  employee: string
  department: string
  pickup: string
  dropoff: string
  fare: number
  status: 'Planifiee' | 'Confirmee' | 'En cours' | 'Terminee' | 'Annulee'
}

interface Invoice {
  id: string
  number: string
  period: string
  amount: number
  status: 'Payee' | 'En attente' | 'En retard'
  dueDate: string
  rides?: Booking[]
  ridesCount?: number
}

interface CostCenter {
  id: string
  name: string
  budget: number
  spent: number
  manager: string
  employeeCount: number
}

// ── Mock Data ──
const DEPARTMENTS = ['General', 'Commercial', 'Direction', 'Logistique']

// Demo employees/cost centers removed — data comes from /api/mova/business API

// Demo bookings removed — data comes from /api/mova/bookings API

// ── French month names ──
const FRENCH_MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
]

// ── Generate invoices dynamically from bookings ──
function generateInvoicesFromBookings(
  bookings: Booking[],
  companyName: string
): (Invoice & { rides: Booking[]; ridesCount: number })[] {
  const completed = bookings.filter((b) => b.status === 'Terminee' && b.fare > 0)
  if (completed.length === 0) return []

  // Group by year-month
  const grouped: Record<string, Booking[]> = {}
  for (const b of completed) {
    const key = b.date.slice(0, 7) // "2024-12"
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(b)
  }

  // Sort months descending
  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a)).slice(0, 6)

  const prefix = companyName.split(' ')[0].toUpperCase().slice(0, 6)
  return sortedKeys.map((key, idx) => {
    const rides = grouped[key]
    const totalFare = rides.reduce((s, r) => s + r.fare, 0)
    const [year, month] = key.split('-').map(Number)
    const periodLabel = `${FRENCH_MONTHS[month - 1]} ${year}`
    const yyyymm = key.replace('-', '')
    const invoiceNum = `INV-${prefix}-${yyyymm}-${String(idx + 1).padStart(3, '0')}`

    // Determine status: latest month is pending, older ones are paid
    const now = new Date()
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
    const isPastDue = new Date(year, month + 1, 15) < now
    let status: Invoice['status'] = 'Payee'
    if (isCurrentMonth || idx === 0) status = 'En attente'
    else if (isPastDue && idx <= 1) status = 'En retard'

    const dueDate = `${year}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-15`

    return {
      id: invoiceNum,
      number: invoiceNum,
      period: periodLabel,
      amount: totalFare,
      status,
      dueDate,
      rides,
      ridesCount: rides.length,
    }
  })
}

// ── Download invoice as .txt file ──
function downloadInvoiceAsText(
  invoice: Invoice & { rides: Booking[]; ridesCount: number },
  company: { name: string; fullName: string; address: string; email: string; contact: string; siret: string }
) {
  const sep = '='.repeat(60)
  const thin = '-'.repeat(60)
  const lines: string[] = [
    sep,
    `  FACTURE`,
    sep,
    '',
    `Entreprise : ${company.fullName}`,
    `Adresse    : ${company.address}`,
    `Email      : ${company.email}`,
    `Telephone  : ${company.contact}`,
    `SIRET      : ${company.siret}`,
    '',
    thin,
    `Numero de facture : ${invoice.number}`,
    `Periode            : ${invoice.period}`,
    `Date d'emission    : ${new Date().toLocaleDateString('fr-FR')}`,
    `Echeance           : ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}`,
    `Statut             : ${invoice.status}`,
    thin,
    '',
    `Nombre de courses  : ${invoice.ridesCount}`,
    '',
    'DETAIL DES COURSES',
    thin,
    '',
    'Date       | Employe              | Trajet                       | Montant (GNF)',
    thin,
    ...invoice.rides.map((r) => {
      const emp = r.employee.padEnd(20).slice(0, 20)
      const route = `${r.pickup} > ${r.dropoff}`.padEnd(28).slice(0, 28)
      const fare = fmt(r.fare).padStart(15)
      return `${r.date}  | ${emp} | ${route} | ${fare}`
    }),
    thin,
    '',
    `TOTAL : ${fmt(invoice.amount)}`,
    '',
    sep,
    `  genere par MOVA Entreprise`,
    sep,
  ]

  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `facture_${invoice.number}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── CSV generation helpers ──
function escapeCsvField(field: string) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [headers.map(escapeCsvField).join(';'), ...rows.map((r) => r.map(escapeCsvField).join(';'))].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Demo chart data removed — charts come from API data or show empty state

// ── Chart Configs ──
const spendChartConfig = {
  montant: { label: 'Depenses', color: '#10b981' },
}

const centerChartConfig = {
  General: { label: 'General', color: '#10b981' },
  Commercial: { label: 'Commercial', color: '#f59e0b' },
  Direction: { label: 'Direction', color: '#3b82f6' },
  Logistique: { label: 'Logistique', color: '#9ca3af' },
}

// ── Helper: Status Badge ──
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    'Planifiee': 'bg-blue-100 text-blue-800 border-blue-200',
    'Confirmee': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'En cours': 'bg-amber-100 text-amber-800 border-amber-200',
    'Terminee': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Annulee': 'bg-red-100 text-red-800 border-red-200',
    'Payee': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'En attente': 'bg-amber-100 text-amber-800 border-amber-200',
    'En retard': 'bg-red-100 text-red-800 border-red-200',
    actif: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    inactif: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return (
    <Badge variant="outline" className={variants[status] || 'bg-muted'}>
      {status}
    </Badge>
  )
}

// ── Helper: Progress Color ──
function getProgressColor(pct: number) {
  if (pct >= 90) return '[&>div]:bg-red-500'
  if (pct >= 75) return '[&>div]:bg-amber-500'
  return '[&>div]:bg-emerald-500'
}

// ── Helper: Plan badge color ──
function getPlanBadgeClass(plan: string) {
  if (plan === 'Enterprise') return 'bg-purple-100 text-purple-800 border-purple-200'
  if (plan === 'Pro') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

// ══════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════
export default function CorporateView() {
  const { goBack } = useAppStore()
  const { unreadCount } = useNotifications()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  // Employee state
  const [empSearch, setEmpSearch] = useState('')
  const [empDeptFilter, setEmpDeptFilter] = useState('all')
  const [empStatusFilter, setEmpStatusFilter] = useState('all')
  const [addEmpDialog, setAddEmpDialog] = useState(false)

  // Booking state
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all')
  const [bookingDeptFilter, setBookingDeptFilter] = useState('all')

  // Cost center state
  const [addCenterDialog, setAddCenterDialog] = useState(false)

  // Settings state
  const [editCompany, setEditCompany] = useState(false)
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifBudget, setNotifBudget] = useState(true)
  const [notifEmployee, setNotifEmployee] = useState(false)
  const [showPlanDialog, setShowPlanDialog] = useState(false)
  const [disableDialog, setDisableDialog] = useState(false)

  // Edit employee dialog
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  // Local overrides for employees edited in-session (no dedicated API endpoint)
  const [localEmployeeOverrides, setLocalEmployeeOverrides] = useState<Map<string, Employee>>(new Map())

  // Employee status toggle dialog
  const [confirmDeactivateEmp, setConfirmDeactivateEmp] = useState<Employee | null>(null)
  // Employee bookings dialog
  const [selectedEmployeeForBookings, setSelectedEmployeeForBookings] = useState<Employee | null>(null)
  // Edit cost center dialog
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null)
  // Local overrides for cost centers edited in-session
  const [localCostCenterOverrides, setLocalCostCenterOverrides] = useState<Map<string, Partial<CostCenter>>>(new Map())

  const { data: businessData, isLoading: businessLoading, error: businessError } = useBusiness(DEMO_BUSINESS_ID)
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useBusinessAnalytics(DEMO_BUSINESS_ID)
  const { data: bookingsResponse, isLoading: bookingsLoading, error: bookingsError } = useBookings({ limit: 50 })

  const isLoading = businessLoading || analyticsLoading || bookingsLoading
  const apiErrors = [businessError, analyticsError, bookingsError].filter(Boolean) as Error[]

  // ── Derive company info from API ──
  const companyName = businessData?.name || COMPANY.name
  const companyPlan = businessData?.plan || COMPANY.plan
  const planBadge = companyPlan === 'enterprise' ? 'Enterprise' : companyPlan === 'pro' ? 'Pro' : 'Starter'
  const totalMembers = businessData?.employeeCount || COMPANY.totalMembers

  // ── Derive employees from API (businessData.employees preferred, fallback to analytics) ──
  const apiEmployees: Employee[] = useMemo(() => {
    // Prefer businessData.employees: richer data (email, phone, costCenter, monthlyBudget)
    if (businessData?.employees && businessData.employees.length > 0) {
      return businessData.employees.map((be) => ({
        id: be.id,
        name: be.user.name,
        email: be.user.email || '',
        phone: be.user.phone || '',
        department: be.department,
        status: 'actif' as const,
        monthlyRides: 0,
        totalSpent: be.costCenter?.spent || 0,
        monthlyLimit: be.monthlyBudget || 300000,
        costCenter: be.costCenter?.name || be.department,
      }))
    }
    // Fallback: derive from analyticsData.topEmployees (less detail)
    if (!analyticsData?.overview) return []
    const depts = analyticsData.spendByDepartment || {}
    const topEmps = analyticsData.topEmployees || []
    return topEmps.map((te) => ({
      id: te.userId,
      name: te.name,
      email: '',
      phone: '',
      department: te.department,
      status: 'actif' as const,
      monthlyRides: te.rides || 0,
      totalSpent: (depts[te.department] || 0) / Math.max(1, topEmps.filter(e => e.department === te.department).length),
      monthlyLimit: 300000,
      costCenter: te.department,
    }))
  }, [businessData, analyticsData])

  const activeEmployees = businessData?.employeeCount || analyticsData?.overview?.activeEmployees || 0
  const newEmployees = 3

  // ── Derive cost centers from API ──
  const apiCostCenters: CostCenter[] = useMemo(() => {
    const centers = businessData?.costCenters || analyticsData?.costCenters || []
    return centers.map((cc) => ({
      id: cc.id,
      name: cc.name,
      budget: cc.budget,
      spent: cc.spent,
      manager: '',
      employeeCount: cc.employeeCount,
    }))
  }, [businessData, analyticsData])

  // ── Derive bookings from API ──
  const apiBookings: Booking[] = useMemo(() => {
    if (!bookingsResponse?.data) return []
    return bookingsResponse.data.map((b) => {
      const schedDate = new Date(b.scheduledFor)
      const statusLabel = BOOKING_STATUS_LABELS[b.status] || b.status
      return {
        id: b.id,
        date: schedDate.toISOString().slice(0, 10),
        time: schedDate.toTimeString().slice(0, 5),
        employee: b.passenger?.name || 'Inconnu',
        department: b.pickupZone || '',
        pickup: b.pickupAddress,
        dropoff: b.dropoffAddress,
        fare: b.actualFare || b.estimatedFare,
        status: statusLabel as Booking['status'],
      }
    })
  }, [bookingsResponse])

  // ── Merge local edits into resolved employees ──
  const baseEmployees = apiEmployees
  const resolvedEmployees = useMemo(() => {
    if (localEmployeeOverrides.size === 0) return baseEmployees
    return baseEmployees.map((e) => {
      const override = localEmployeeOverrides.get(e.id)
      return override ? { ...e, ...override } : e
    })
  }, [baseEmployees, localEmployeeOverrides])
  const resolvedCostCenters = apiCostCenters.length > 0 && localCostCenterOverrides.size > 0
    ? apiCostCenters.map((cc) => {
        const override = localCostCenterOverrides.get(cc.id)
        return override ? { ...cc, ...override } : cc
      })
    : apiCostCenters
  const resolvedBookings = apiBookings

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return resolvedEmployees.filter((e) => {
      const matchSearch = !empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase())
      const matchDept = empDeptFilter === 'all' || e.department === empDeptFilter
      const matchStatus = empStatusFilter === 'all' || e.status === empStatusFilter
      return matchSearch && matchDept && matchStatus
    })
  }, [empSearch, empDeptFilter, empStatusFilter, resolvedEmployees])

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return resolvedBookings.filter((b) => {
      const matchStatus = bookingStatusFilter === 'all' || b.status === bookingStatusFilter
      const matchDept = bookingDeptFilter === 'all' || b.department === bookingDeptFilter
      return matchStatus && matchDept
    })
  }, [bookingStatusFilter, bookingDeptFilter, resolvedBookings])

  const totalBudget = resolvedCostCenters.reduce((s, c) => s + c.budget, 0)
  const totalSpent = resolvedCostCenters.reduce((s, c) => s + c.spent, 0)
  const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  const handleBack = useCallback(() => {
    goBack()
  }, [goBack])

  const handleExport = useCallback((type: string) => {
    if (type === 'employees') {
      const headers = ['Employe', 'Departement', 'Courses', 'Depenses (GNF)']
      const rows = resolvedEmployees.map((e) => [
        e.name, e.department, String(e.monthlyRides), String(e.totalSpent),
      ])
      downloadCsv('employes_mova.csv', headers, rows)
      toast.success('Export des employes genere avec succes')
    } else if (type === 'bookings') {
      const headers = ['Date', 'Employe', 'Departement', 'Trajet', 'Montant (GNF)', 'Statut']
      const rows = resolvedBookings.map((b) => [
        b.date, b.employee, b.department, `${b.pickup} > ${b.dropoff}`, String(b.fare), b.status,
      ])
      downloadCsv('reservations_mova.csv', headers, rows)
      toast.success('Export des reservations genere avec succes')
    }
  }, [resolvedEmployees, resolvedBookings])

  // Budget by center for dashboard (from API or demo)
  const budgetByCenter = useMemo(() => {
    if (resolvedCostCenters.length === 0) return []
    return resolvedCostCenters.map((cc) => ({
      name: cc.name,
      spent: cc.spent,
      budget: cc.budget,
      pct: cc.budget > 0 ? Math.round((cc.spent / cc.budget) * 100) : 0,
      color: cc.name === 'General' ? '#10b981' : cc.name === 'Commercial' ? '#f59e0b' : cc.name === 'Direction' ? '#3b82f6' : '#9ca3af',
    }))
  }, [resolvedCostCenters, businessData])

  // Recent bookings for dashboard (from API or demo)
  const recentBookings = useMemo(() => resolvedBookings.slice(0, 5), [resolvedBookings])

  const handleSaveEmployee = useCallback(async (emp: Employee) => {
    // Update employee locally in state
    setLocalEmployeeOverrides((prev) => {
      const next = new Map(prev)
      next.set(emp.id, emp)
      return next
    })

    // Attempt to persist to server (requires dedicated API endpoint)
    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch(`/api/mova/business/${DEMO_BUSINESS_ID}/employees`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          department: emp.department,
          monthlyLimit: emp.monthlyLimit,
          costCenter: emp.costCenter,
        }),
      })
      if (res.ok) {
        toast.success(`Profil de ${emp.name} mis a jour avec succes`)
      } else {
        // API returned an error — data saved locally
        toast.warning(`Profil de ${emp.name} sauvegarde localement`, {
          description: 'La synchronisation serveur echouee. Veuillez reessayer plus tard.',
        })
      }
    } catch {
      // No API available or network error — inform user
      toast.warning(`Profil de ${emp.name} sauvegarde localement`, {
        description: 'Cette fonctionnalite necessite une integration serveur. Les donnees seront perdues au rechargement.',
      })
    }

    setEditingEmployee(null)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-40 bg-card border-b border-border/50 mova-glass">
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg mova-gradient flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-bold mova-gradient-text">MOVA Entreprise</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Changer de theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
              </button>
            )}
            <Button variant="ghost" size="icon" className="relative" onClick={() => toast.info(unreadCount > 0 ? `${unreadCount} nouvelle(s) notification(s)` : 'Aucune notification')}>
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('settings')}>
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Company Card */}
        <div className="px-4 pb-3 max-w-5xl mx-auto">
          <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">{companyName}</p>
                <p className="text-xs text-muted-foreground">{totalMembers} membres</p>
              </div>
            </div>
            <Badge className={getPlanBadgeClass(planBadge)} variant="outline">
              {planBadge}
            </Badge>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 overflow-y-auto mova-scrollbar pb-24">
        <div className="max-w-5xl mx-auto p-4">
          {/* ── API Error Banner ── */}
          {apiErrors.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">Erreur de chargement</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                    {apiErrors.map((e) => e.message).join(' · ')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Les donnees demo sont affichees.</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => {
                    // Force refetch by reloading
                    window.location.reload()
                  }}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Loading Skeleton ── */}
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-muted" />
                ))}
              </div>
              <div className="h-64 rounded-xl bg-muted" />
              <div className="h-48 rounded-xl bg-muted" />
            </div>
          ) : (
            <>
          {activeTab === 'dashboard' && (
            <DashboardTab
              activeEmployees={activeEmployees}
              totalMembers={totalMembers}
              newEmployees={newEmployees}
              budgetPct={budgetPct}
              totalSpent={totalSpent}
              totalBudget={totalBudget}
              budgetByCenter={budgetByCenter}
              recentBookings={recentBookings}
              topEmployees={analyticsData?.topEmployees}
            />
          )}
          {activeTab === 'employees' && (
            <EmployeesTab
              search={empSearch}
              setSearch={setEmpSearch}
              deptFilter={empDeptFilter}
              setDeptFilter={setEmpDeptFilter}
              statusFilter={empStatusFilter}
              setStatusFilter={setEmpStatusFilter}
              employees={filteredEmployees}
              onAdd={() => setAddEmpDialog(true)}
              onEditEmployee={setEditingEmployee}
              onToggleStatus={setConfirmDeactivateEmp}
              onViewBookings={setSelectedEmployeeForBookings}
              totalMembers={totalMembers}
              activeEmployees={activeEmployees}
              newEmployees={newEmployees}
            />
          )}
          {activeTab === 'costcenters' && (
            <CostCentersTab
              costCenters={resolvedCostCenters}
              totalBudget={totalBudget}
              totalSpent={totalSpent}
              onAdd={() => setAddCenterDialog(true)}
              onEditCenter={setEditingCostCenter}
            />
          )}
          {activeTab === 'bookings' && (
            <BookingsTab
              bookings={filteredBookings}
              statusFilter={bookingStatusFilter}
              setStatusFilter={setBookingStatusFilter}
              deptFilter={bookingDeptFilter}
              setDeptFilter={setBookingDeptFilter}
              onExport={handleExport}
            />
          )}
          {activeTab === 'invoices' && (
            <InvoicesTab
              bookings={resolvedBookings}
              companyName={companyName}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              editCompany={editCompany}
              setEditCompany={setEditCompany}
              notifEmail={notifEmail}
              setNotifEmail={setNotifEmail}
              notifBudget={notifBudget}
              setNotifBudget={setNotifBudget}
              notifEmployee={notifEmployee}
              setNotifEmployee={setNotifEmployee}
              onShowPlan={() => setShowPlanDialog(true)}
              onDisable={() => setDisableDialog(true)}
            />
          )}
            </>
          )}
        </div>
      </main>

      {/* ── Bottom Tab Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border/50 mova-glass">
        <div className="max-w-5xl mx-auto flex">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.key
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all ${
                  isActive
                    ? 'text-emerald-600'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <div className="w-5 h-0.5 rounded-full bg-emerald-500 mt-0.5" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── Dialogs ── */}
      <AddEmployeeDialog open={addEmpDialog} onOpenChange={setAddEmpDialog} />
      <EditEmployeeDialog employee={editingEmployee} onOpenChange={setEditingEmployee} onSave={handleSaveEmployee} />
      <AddCostCenterDialog open={addCenterDialog} onOpenChange={setAddCenterDialog} />
      <PlanDialog open={showPlanDialog} onOpenChange={setShowPlanDialog} />
      <DisableAccountDialog open={disableDialog} onOpenChange={setDisableDialog} />

      {/* Confirm Deactivate Employee Dialog */}
      <Dialog open={!!confirmDeactivateEmp} onOpenChange={(open) => { if (!open) setConfirmDeactivateEmp(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {confirmDeactivateEmp?.status === 'actif' ? "Desactiver l'employe" : "Reactiver l'employe"}
            </DialogTitle>
            <DialogDescription>
              {confirmDeactivateEmp?.status === 'actif'
                ? `Voulez-vous vraiment desactiver ${confirmDeactivateEmp?.name} ? L'employe n'aura plus acces aux services de transport.`
                : `Voulez-vous reactiver ${confirmDeactivateEmp?.name} ? L'employe retrouvera l'acces aux services de transport.`}
            </DialogDescription>
          </DialogHeader>
          {confirmDeactivateEmp && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
                    {confirmDeactivateEmp.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{confirmDeactivateEmp.name}</p>
                  <p className="text-xs text-muted-foreground">{confirmDeactivateEmp.department} - {confirmDeactivateEmp.phone}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeactivateEmp(null)}>Annuler</Button>
            <Button
              variant={confirmDeactivateEmp?.status === 'actif' ? 'destructive' : 'default'}
              className={confirmDeactivateEmp?.status !== 'actif' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
              onClick={() => {
                if (confirmDeactivateEmp) {
                  const newStatus = confirmDeactivateEmp.status === 'actif' ? 'inactif' as const : 'actif' as const
                  setLocalEmployeeOverrides((prev) => {
                    const next = new Map(prev)
                    next.set(confirmDeactivateEmp.id, { ...confirmDeactivateEmp, status: newStatus })
                    return next
                  })
                  toast.success(
                    newStatus === 'actif'
                      ? `${confirmDeactivateEmp.name} a ete reactive avec succes`
                      : `${confirmDeactivateEmp.name} a ete desactive avec succes`
                  )
                  setConfirmDeactivateEmp(null)
                }
              }}
            >
              {confirmDeactivateEmp?.status === 'actif' ? <><X className="w-4 h-4" /> Desactiver</> : <><Check className="w-4 h-4" /> Reactiver</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Bookings Dialog */}
      <Dialog open={!!selectedEmployeeForBookings} onOpenChange={(open) => { if (!open) setSelectedEmployeeForBookings(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-600" />
              Courses de {selectedEmployeeForBookings?.name}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const empBookings = selectedEmployeeForBookings ? resolvedBookings.filter((b) => b.employee === selectedEmployeeForBookings.name) : []
                return `${empBookings.length} reservation(s) trouvee(s)`
              })()}
            </DialogDescription>
          </DialogHeader>
          {selectedEmployeeForBookings && (
            <div className="max-h-[60vh] overflow-y-auto mova-scrollbar rounded-lg border border-border/50">
              {(() => {
                const empBookings = resolvedBookings.filter((b) => b.employee === selectedEmployeeForBookings.name)
                if (empBookings.length === 0) {
                  return (
                    <div className="py-8 text-center">
                      <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Aucune reservation trouvee pour cet employe</p>
                    </div>
                  )
                }
                return (
                  <div className="divide-y divide-border">
                    {empBookings.map((booking) => (
                      <div key={booking.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          booking.status === 'Terminee' ? 'bg-emerald-100' :
                          booking.status === 'Annulee' ? 'bg-red-100' :
                          booking.status === 'En cours' ? 'bg-amber-100' :
                          'bg-muted'
                        }`}>
                          {booking.status === 'Terminee' ? <Check className="w-4 h-4 text-emerald-600" /> :
                           booking.status === 'Annulee' ? <X className="w-4 h-4 text-red-600" /> :
                           booking.status === 'En cours' ? <ArrowUp className="w-4 h-4 text-amber-600" /> :
                           <Clock className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium truncate">{booking.pickup}</span>
                            <ArrowUp className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium truncate">{booking.dropoff}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{booking.date} {booking.time}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{booking.fare > 0 ? fmt(booking.fare) : '---'}</p>
                          <StatusBadge status={booking.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEmployeeForBookings(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Cost Center Dialog */}
      <Dialog open={!!editingCostCenter} onOpenChange={(open) => { if (!open) setEditingCostCenter(null) }}>
        <EditCostCenterDialogContent
          costCenter={editingCostCenter}
          onSave={(id, name, budget) => {
            setLocalCostCenterOverrides((prev) => {
              const next = new Map(prev)
              next.set(id, { name, budget })
              return next
            })
            toast.success('Centre de couts mis a jour avec succes')
            setEditingCostCenter(null)
          }}
          onCancel={() => setEditingCostCenter(null)}
        />
      </Dialog>
    </div>
  )
}

// ── Tab Items ──
const TAB_ITEMS = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'employees', label: 'Employes', icon: Users },
  { key: 'costcenters', label: 'Centres de couts', icon: DollarSign },
  { key: 'bookings', label: 'Reservations', icon: Briefcase },
  { key: 'invoices', label: 'Factures', icon: FileText },
  { key: 'settings', label: 'Parametres', icon: Settings },
]

// ══════════════════════════════════════════════════════
// TAB 1: TABLEAU DE BORD
// ══════════════════════════════════════════════════════
function DashboardTab({
  activeEmployees,
  totalMembers,
  newEmployees,
  budgetPct,
  totalSpent,
  totalBudget,
  budgetByCenter,
  recentBookings,
  topEmployees,
}: {
  activeEmployees: number
  totalMembers: number
  newEmployees: number
  budgetPct: number
  totalSpent: number
  totalBudget: number
  budgetByCenter: { name: string; spent: number; budget: number; pct: number; color: string }[]
  recentBookings: Booking[]
  topEmployees: Array<{ name: string; department: string; rides?: number; spent?: number }> | undefined
}) {
  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs text-emerald-600 font-medium">{Math.round((activeEmployees / totalMembers) * 100)}%</span>
            </div>
            <p className="text-xl font-bold">{activeEmployees}<span className="text-muted-foreground text-sm font-normal">/{totalMembers}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Employes actifs</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{budgetPct}%</span>
            </div>
            <p className="text-sm font-bold">{fmtShort(totalSpent)}<span className="text-muted-foreground text-xs font-normal"> / {fmtShort(totalBudget)}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Budget mensuel (GNF)</p>
            <Progress value={budgetPct} className={`h-1.5 mt-1.5 ${getProgressColor(budgetPct)}`} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-emerald-600" />
              </div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[10px] px-1.5">
                <ArrowUp className="w-2.5 h-2.5 mr-0.5" />+18%
              </Badge>
            </div>
            <p className="text-xl font-bold">147</p>
            <p className="text-xs text-muted-foreground mt-0.5">Courses ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-amber-600" />
              </div>
              <Badge variant="outline" className="text-red-500 border-red-200 text-[10px] px-1.5">
                <ArrowUp className="w-2.5 h-2.5 mr-0.5" />+12%
              </Badge>
            </div>
            <p className="text-sm font-bold">{fmtShort(totalSpent)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Depenses ce mois (GNF)</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget by Cost Center */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Budget par centre de couts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {budgetByCenter.map((center) => (
            <div key={center.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{center.name}</span>
                <span className="text-muted-foreground text-xs">
                  {fmtShort(center.spent)} / {fmtShort(center.budget)} ({center.pct}%)
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${center.pct}%`, backgroundColor: center.color }}
                />
              </div>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Total</span>
            <span>{fmtShort(totalSpent)} / {fmtShort(totalBudget)} GNF</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Employees by Spending */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Top employes par depenses</CardTitle>
            <Badge variant="outline" className="text-xs">Ce mois</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(topEmployees || []).slice(0, 5).map((emp, idx) => (
              <div key={emp.name} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-amber-100 text-amber-700' :
                  idx === 1 ? 'bg-gray-100 text-gray-600' :
                  idx === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{emp.name}</p>
                  <p className="text-xs text-muted-foreground">{emp.department}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{fmtShort((emp as { name: string; department: string; rides: number; spent?: number }).spent || 0)} GNF</p>
                  <p className="text-xs text-muted-foreground">{(emp as { rides?: number }).rides || 0} courses</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Reservations recentes</CardTitle>
            <Badge variant="outline" className="text-xs">5 dernieres</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {recentBookings.map((booking) => (
              <div key={booking.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  booking.status === 'Terminee' ? 'bg-emerald-100' :
                  booking.status === 'Annulee' ? 'bg-red-100' :
                  booking.status === 'En cours' ? 'bg-amber-100' :
                  'bg-blue-100'
                }`}>
                  {booking.status === 'Terminee' ? <Check className="w-4 h-4 text-emerald-600" /> :
                   booking.status === 'Annulee' ? <X className="w-4 h-4 text-red-600" /> :
                   booking.status === 'En cours' ? <ArrowUp className="w-4 h-4 text-amber-600" /> :
                   <Clock className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{booking.employee}</p>
                  <p className="text-xs text-muted-foreground truncate">{booking.pickup} <ArrowUp className="w-2.5 h-2.5 inline" /> {booking.dropoff}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{booking.fare > 0 ? fmt(booking.fare) : '---'}</p>
                  <p className="text-[10px] text-muted-foreground">{booking.date.slice(5)}</p>
                </div>
                <StatusBadge status={booking.status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// TAB 2: EMPLOYES
// ══════════════════════════════════════════════════════
function EmployeesTab({
  search, setSearch, deptFilter, setDeptFilter, statusFilter, setStatusFilter,
  employees, onAdd, onEditEmployee, onToggleStatus, onViewBookings, totalMembers, activeEmployees, newEmployees,
}: {
  search: string; setSearch: (v: string) => void
  deptFilter: string; setDeptFilter: (v: string) => void
  statusFilter: string; setStatusFilter: (v: string) => void
  employees: Employee[]; onAdd: () => void; onEditEmployee: (emp: Employee) => void; onToggleStatus: (emp: Employee) => void; onViewBookings: (emp: Employee) => void
  totalMembers: number; activeEmployees: number; newEmployees: number
}) {
  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{totalMembers}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">{activeEmployees}</p>
            <p className="text-xs text-muted-foreground">Actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{newEmployees}</p>
            <p className="text-xs text-muted-foreground">Nouveaux ce mois</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <Filter className="w-4 h-4 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Departement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="actif">Actif</SelectItem>
            <SelectItem value="inactif">Inactif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Department Filter Chips */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...DEPARTMENTS].map((dept) => (
          <button
            key={dept}
            onClick={() => setDeptFilter(dept)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              deptFilter === dept
                ? 'bg-emerald-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {dept === 'all' ? 'Tous' : dept}
          </button>
        ))}
      </div>

      {/* Add Employee Button */}
      <div className="flex justify-end">
        <Button onClick={onAdd} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Ajouter un employe
        </Button>
      </div>

      {/* Employee List */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto mova-scrollbar pr-1">
        {employees.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun employe trouve</p>
            </CardContent>
          </Card>
        ) : (
          employees.map((emp) => {
            const usagePct = emp.monthlyLimit > 0 ? Math.round((emp.totalSpent / emp.monthlyLimit) * 100) : 0
            return (
              <Card key={emp.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Name Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{emp.name}</p>
                          <StatusBadge status={emp.status} />
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onEditEmployee(emp)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          {emp.status === 'actif' && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-600" onClick={() => onToggleStatus(emp)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {emp.status === 'inactif' && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-emerald-600" onClick={() => onToggleStatus(emp)}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onViewBookings(emp)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Department + Phone */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{emp.department}</Badge>
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {emp.phone}</span>
                      </div>

                      {/* Budget Progress */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Budget mensuel</span>
                          <span className="font-medium">{fmtShort(emp.totalSpent)} / {fmtShort(emp.monthlyLimit)} GNF</span>
                        </div>
                        <Progress value={usagePct} className={`h-1.5 ${getProgressColor(usagePct)}`} />
                      </div>

                      {/* Bottom Stats */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          <Briefcase className="w-3 h-3 inline mr-1" />
                          {emp.monthlyRides} courses ce mois
                        </span>
                        <span className="text-muted-foreground">
                          <DollarSign className="w-3 h-3 inline mr-1" />
                          Centre : {emp.costCenter}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// TAB 3: CENTRES DE COUTS
// ══════════════════════════════════════════════════════
function CostCentersTab({
  costCenters,
  totalBudget,
  totalSpent,
  onAdd,
  onEditCenter,
}: {
  costCenters: CostCenter[]
  totalBudget: number
  totalSpent: number
  onAdd: () => void
  onEditCenter: (center: CostCenter) => void
}) {
  const remaining = totalBudget - totalSpent
  return (
    <div className="space-y-5">
      {/* Summary Card */}
      <Card className="overflow-hidden">
        <div className="mova-gradient p-5 text-white">
          <CardTitle className="text-white text-sm mb-3">Synthese budgetaire</CardTitle>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-lg font-bold">{fmtShort(totalBudget)}</p>
              <p className="text-xs text-white/70">Budget total (GNF)</p>
            </div>
            <div>
              <p className="text-lg font-bold">{fmtShort(totalSpent)}</p>
              <p className="text-xs text-white/70">Depense (GNF)</p>
            </div>
            <div>
              <p className="text-lg font-bold">{fmtShort(remaining)}</p>
              <p className="text-xs text-white/70">Restant (GNF)</p>
            </div>
          </div>
          <Progress value={Math.round((totalSpent / totalBudget) * 100)} className="h-2 mt-3 bg-white/20 [&>div]:bg-white" />
        </div>
      </Card>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={onAdd} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Ajouter un centre
        </Button>
      </div>

      {/* Cost Center Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {costCenters.map((center) => {
          const pct = center.budget > 0 ? Math.round((center.spent / center.budget) * 100) : 0
          const remaining = center.budget - center.spent
          return (
            <Card key={center.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{center.name}</p>
                    <p className="text-xs text-muted-foreground">Budget : {fmtShort(center.budget)} GNF</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => onEditCenter(center)}>
                    <Edit className="w-3 h-3" /> Modifier
                  </Button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Depense</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <Progress value={pct} className={`h-2 ${getProgressColor(pct)}`} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{fmtShort(center.spent)} depense</span>
                    <span>{fmtShort(remaining)} restant</span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-3 h-3" /> {center.employeeCount} employes
                  </span>
                  <span className="text-muted-foreground">
                    <Briefcase className="w-3 h-3 inline mr-1" /> {center.manager}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Spending Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tendance des depenses par centre</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={centerChartConfig} className="h-[250px] w-full">
            <BarChart data={[]} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={11} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => fmtShort(v)} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
              <Bar dataKey="General" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Commercial" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Direction" stackId="a" fill="#3b82f6" />
              <Bar dataKey="Logistique" stackId="a" fill="#9ca3af" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// TAB 4: RESERVATIONS
// ══════════════════════════════════════════════════════
function BookingsTab({
  bookings,
  statusFilter,
  setStatusFilter,
  deptFilter,
  setDeptFilter,
  onExport,
}: {
  bookings: Booking[]
  statusFilter: string
  setStatusFilter: (v: string) => void
  deptFilter: string
  setDeptFilter: (v: string) => void
  onExport: (type: string) => void
}) {
  const [exportType, setExportType] = useState('bookings')

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="w-4 h-4 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="Planifiee">Planifiee</SelectItem>
                <SelectItem value="Confirmee">Confirmee</SelectItem>
                <SelectItem value="En cours">En cours</SelectItem>
                <SelectItem value="Terminee">Terminee</SelectItem>
                <SelectItem value="Annulee">Annulee</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Departement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={exportType} onValueChange={setExportType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Type d'export" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bookings">Reservations</SelectItem>
                <SelectItem value="employees">Employes</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-1.5" onClick={() => onExport(exportType)}>
              <Download className="w-4 h-4" /> Exporter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Spending Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Depenses mensuelles</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={spendChartConfig} className="h-[200px] w-full">
            <BarChart data={[]} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={11} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => fmtShort(v)} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
              <Bar dataKey="montant" radius={[4, 4, 0, 0]} fill="#10b981" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Booking List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Reservations</CardTitle>
            <Badge variant="outline" className="text-xs">{bookings.length} resultats</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Employe</TableHead>
                  <TableHead className="text-xs">Trajet</TableHead>
                  <TableHead className="text-xs">Date / Heure</TableHead>
                  <TableHead className="text-xs text-right">Tarif</TableHead>
                  <TableHead className="text-xs">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{b.employee}</p>
                        <p className="text-xs text-muted-foreground">{b.department}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{b.pickup} <ArrowUp className="w-3 h-3 inline mx-1 text-muted-foreground" /> {b.dropoff}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{b.date.slice(5)}</p>
                      <p className="text-xs text-muted-foreground">{b.time}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="text-sm font-semibold">{b.fare > 0 ? fmt(b.fare) : '---'}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2.5">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.employee}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.pickup} <ArrowUp className="w-2.5 h-2.5 inline" /> {b.dropoff}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">{b.date} {b.time}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{b.fare > 0 ? fmt(b.fare) : '---'}</p>
                  <StatusBadge status={b.status} />
                </div>
              </div>
            ))}
          </div>

          {bookings.length === 0 && (
            <div className="py-8 text-center">
              <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune reservation trouvee</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// TAB 5: FACTURES
// ══════════════════════════════════════════════════════
function InvoicesTab({
  bookings,
  companyName,
}: {
  bookings: Booking[]
  companyName: string
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<(Invoice & { rides: Booking[]; ridesCount: number }) | null>(null)
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Virement bancaire')

  const PAYMENT_METHODS = [
    { value: 'Virement bancaire', description: 'Ecobank Guinee | Compte professionnel', icon: <CreditCard className="w-5 h-5 text-emerald-600" /> },
    { value: 'Orange Money', description: 'Paiement instantane via Orange Money', icon: <Phone className="w-5 h-5 text-orange-600" /> },
    { value: 'MTN Mobile Money', description: 'Paiement instantane via MTN Mobile Money', icon: <Phone className="w-5 h-5 text-amber-600" /> },
    { value: 'Wave', description: 'Paiement via Wave', icon: <Smartphone className="w-5 h-5 text-emerald-600" /> },
  ]

  const invoices = useMemo(
    () => generateInvoicesFromBookings(bookings, companyName),
    [bookings, companyName]
  )

  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0)
  const pendingAmount = invoices.filter(i => i.status === 'En attente').reduce((s, i) => s + i.amount, 0)
  const paidAmount = invoices.filter(i => i.status === 'Payee').reduce((s, i) => s + i.amount, 0)
  const overdueAmount = invoices.filter(i => i.status === 'En retard').reduce((s, i) => s + i.amount, 0)

  const handleDownload = useCallback((inv: Invoice & { rides: Booking[]; ridesCount: number }) => {
    downloadInvoiceAsText(inv, {
      name: companyName,
      fullName: COMPANY.fullName,
      address: COMPANY.address,
      email: COMPANY.email,
      contact: COMPANY.contact,
      siret: COMPANY.siret,
    })
    toast.success(`Facture ${inv.number} telechargee`)
  }, [companyName])

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm font-bold">{fmtShort(totalInvoiced)}</p>
            <p className="text-[10px] text-muted-foreground">Total facture (GNF)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-1.5">
              <CreditCard className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-sm font-bold">{fmtShort(pendingAmount + overdueAmount)}</p>
            <p className="text-[10px] text-muted-foreground">Paiement en attente (GNF)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto mb-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm font-bold">{fmtShort(paidAmount)}</p>
            <p className="text-[10px] text-muted-foreground">Paye (GNF)</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Historique des factures</CardTitle>
            <Badge variant="outline" className="text-xs">{invoices.length} factures</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune facture disponible</p>
              <p className="text-xs text-muted-foreground mt-1">Les factures sont generees a partir des courses terminees</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedInvoice(inv)}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{inv.number}</p>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {inv.period} | {inv.ridesCount} courses | Echeance : {inv.dueDate}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{fmt(inv.amount)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(inv)
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Mode de paiement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Virement bancaire</p>
              <p className="text-xs text-muted-foreground">Ecobank Guinee | Compte professionnel</p>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => { setSelectedPaymentMethod('Virement bancaire'); setShowPaymentMethodDialog(true) }}>
              <Edit className="w-3 h-3 mr-1" /> Modifier
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Changer le mode de paiement
            </DialogTitle>
            <DialogDescription>Selectionnez votre methode de paiement preferee</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.value}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                  selectedPaymentMethod === method.value
                    ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-border hover:border-emerald-200 hover:bg-muted/50'
                }`}
                onClick={() => setSelectedPaymentMethod(method.value)}
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {method.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{method.value}</p>
                  <p className="text-xs text-muted-foreground">{method.description}</p>
                </div>
                {selectedPaymentMethod === method.value && (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPaymentMethodDialog(false)}>Annuler</Button>
            <Button onClick={() => {
              toast.success(`Mode de paiement change en ${selectedPaymentMethod}`)
              setShowPaymentMethodDialog(false)
            }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <Check className="w-4 h-4" /> Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => { if (!open) setSelectedInvoice(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Detail de la facture</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.number} - {selectedInvoice?.period}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              {/* Invoice Meta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Statut</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedInvoice.status} />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Echeance</p>
                  <p className="text-sm font-medium mt-1">{selectedInvoice.dueDate}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nombre de courses</p>
                  <p className="text-sm font-medium mt-1">{selectedInvoice.ridesCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wider">Montant total</p>
                  <p className="text-sm font-bold text-emerald-700 mt-1">{fmt(selectedInvoice.amount)}</p>
                </div>
              </div>

              <Separator />

              {/* Rides Table */}
              <div>
                <p className="text-xs font-semibold mb-2">Courses incluses</p>
                <div className="max-h-60 overflow-y-auto mova-scrollbar rounded-lg border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Date</TableHead>
                        <TableHead className="text-[10px]">Employe</TableHead>
                        <TableHead className="text-[10px]">Trajet</TableHead>
                        <TableHead className="text-[10px] text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.rides.map((ride) => (
                        <TableRow key={ride.id}>
                          <TableCell className="text-xs py-2">{ride.date.slice(5)}</TableCell>
                          <TableCell className="text-xs py-2 font-medium">{ride.employee}</TableCell>
                          <TableCell className="text-xs py-2">
                            {ride.pickup} <ArrowUp className="w-2.5 h-2.5 inline mx-0.5 text-muted-foreground" /> {ride.dropoff}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-right font-medium">{fmt(ride.fare)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Total</p>
                <p className="text-lg font-bold text-emerald-600">{fmt(selectedInvoice.amount)}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Fermer
            </Button>
            {selectedInvoice && (
              <Button className="gap-1.5" onClick={() => handleDownload(selectedInvoice)}>
                <Download className="w-4 h-4" /> Telecharger la facture
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// TAB 6: PARAMETRES
// ══════════════════════════════════════════════════════
function SettingsTab({
  editCompany, setEditCompany,
  notifEmail, setNotifEmail,
  notifBudget, setNotifBudget,
  notifEmployee, setNotifEmployee,
  onShowPlan, onDisable,
}: {
  editCompany: boolean
  setEditCompany: (v: boolean) => void
  notifEmail: boolean; setNotifEmail: (v: boolean) => void
  notifBudget: boolean; setNotifBudget: (v: boolean) => void
  notifEmployee: boolean; setNotifEmployee: (v: boolean) => void
  onShowPlan: () => void
  onDisable: () => void
}) {
  const [companyForm, setCompanyForm] = useState({
    name: COMPANY.name,
    siret: COMPANY.siret,
    address: COMPANY.address,
    email: COMPANY.email,
    phone: COMPANY.contact,
  })

  return (
    <div className="space-y-5">
      {/* Company Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Informations de la societe</CardTitle>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => {
              if (editCompany) {
                toast.success('Informations mises a jour avec succes')
              }
              setEditCompany(!editCompany)
            }}>
              {editCompany ? (
                <><Check className="w-3 h-3" /> Enregistrer</>
              ) : (
                <><Edit className="w-3 h-3" /> Modifier</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nom de la societe</Label>
              {editCompany ? (
                <Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} className="h-9" />
              ) : (
                <p className="text-sm font-medium p-2 bg-muted/50 rounded-md">{companyForm.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">SIRET</Label>
              {editCompany ? (
                <Input value={companyForm.siret} onChange={(e) => setCompanyForm({ ...companyForm, siret: e.target.value })} className="h-9" />
              ) : (
                <p className="text-sm font-medium p-2 bg-muted/50 rounded-md">{companyForm.siret}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Adresse</Label>
              {editCompany ? (
                <Input value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} className="h-9" />
              ) : (
                <p className="text-sm font-medium p-2 bg-muted/50 rounded-md flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {companyForm.address}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              {editCompany ? (
                <Input value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} className="h-9" />
              ) : (
                <p className="text-sm font-medium p-2 bg-muted/50 rounded-md flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {companyForm.email}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Telephone</Label>
              {editCompany ? (
                <Input value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} className="h-9" />
              ) : (
                <p className="text-sm font-medium p-2 bg-muted/50 rounded-md flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {companyForm.phone}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Forfait actuel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">Forfait Pro</p>
                  <p className="text-xs text-muted-foreground">Actuellement actif</p>
                </div>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">Actif</Badge>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Jusqu&apos;a 50 employes</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Budget mensuel : 2 000 000 GNF</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Rapports avances</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Support prioritaire</span>
              </div>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-3 text-xs gap-1.5" onClick={onShowPlan}>
            <Settings className="w-3.5 h-3.5" /> Changer de forfait
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Rapports par email</p>
              <p className="text-xs text-muted-foreground">Recevoir un resume hebdomadaire par email</p>
            </div>
            <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Alerte budget bas</p>
              <p className="text-xs text-muted-foreground">Notifier quand le budget atteint 80%</p>
            </div>
            <Switch checked={notifBudget} onCheckedChange={setNotifBudget} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Nouvel employe</p>
              <p className="text-xs text-muted-foreground">Notifier lors de l&apos;ajout d&apos;un employe</p>
            </div>
            <Switch checked={notifEmployee} onCheckedChange={setNotifEmployee} />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Zone de danger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Cette action est irreversible. Tous les donnees de votre compte entreprise seront supprimees.
          </p>
          <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 text-xs gap-1.5" onClick={onDisable}>
            <X className="w-3.5 h-3.5" /> Desactiver le compte entreprise
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// DIALOGS
// ══════════════════════════════════════════════════════

// Add Employee Dialog
function AddEmployeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', department: 'General', costCenter: 'General', limit: '200000' })

  const handleSubmit = () => {
    if (!form.name || !form.email) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    toast.success(`Employe ${form.name} ajoute avec succes`)
    onOpenChange(false)
    setForm({ name: '', email: '', phone: '', department: 'General', costCenter: 'General', limit: '200000' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Ajouter un employe
          </DialogTitle>
          <DialogDescription>Remplissez les informations du nouvel employe</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom complet *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Mamadou Diallo" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="m.diallo@socopao.gn" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telephone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+224 6xx xx xx xx" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Departement</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Centre de couts</Label>
              <Select value={form.costCenter} onValueChange={(v) => setForm({ ...form, costCenter: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Limite mensuelle (GNF)</Label>
            <Input type="number" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} className="h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} className="gap-1.5">
            <Plus className="w-4 h-4" /> Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Add Cost Center Dialog
function AddCostCenterDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState({ name: '', budget: '500000', manager: '' })

  const handleSubmit = () => {
    if (!form.name || !form.manager) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    toast.success(`Centre de couts "${form.name}" cree avec succes`)
    onOpenChange(false)
    setForm({ name: '', budget: '500000', manager: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Ajouter un centre de couts
          </DialogTitle>
          <DialogDescription>Definissez un nouveau centre de couts</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom du centre *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Marketing" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Budget mensuel (GNF)</Label>
            <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Responsable *</Label>
            <Input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} placeholder="Ex: Mamadou Bah" className="h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} className="gap-1.5">
            <Plus className="w-4 h-4" /> Creer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Plan Dialog
function PlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const plans = [
    {
      name: 'Starter',
      price: 'Gratuit',
      features: ['10 employes maximum', 'Budget : 500K GNF/mois', 'Rapports de base'],
      badge: 'Gratuit',
      badgeClass: 'bg-gray-100 text-gray-700',
      current: false,
    },
    {
      name: 'Pro',
      price: '199 000 GNF/mois',
      features: ['50 employes maximum', 'Budget : 2M GNF/mois', 'Rapports avances', 'Support prioritaire'],
      badge: 'Actuel',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      current: true,
    },
    {
      name: 'Enterprise',
      price: 'Sur mesure',
      features: ['Employes illimites', 'Budget : 10M GNF/mois', 'Acces API', 'Gestionnaire dedie'],
      badge: 'Premium',
      badgeClass: 'bg-purple-100 text-purple-800',
      current: false,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto mova-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-600" />
            Changer de forfait
          </DialogTitle>
          <DialogDescription>Choisissez le forfait adapte a votre entreprise</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`border rounded-xl p-4 transition-all ${
              plan.current ? 'border-emerald-300 bg-emerald-50/50' : 'border-border hover:border-emerald-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{plan.name}</p>
                  <Badge className={`${plan.badgeClass} text-[10px]`} variant="outline">{plan.badge}</Badge>
                </div>
                <p className="text-xs font-medium text-muted-foreground">{plan.price}</p>
              </div>
              <div className="space-y-1.5">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              {!plan.current && (
                <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => {
                  toast.success(`Demande de changement vers le forfait ${plan.name} envoyee`)
                  onOpenChange(false)
                }}>
                  Choisir {plan.name}
                </Button>
              )}
              {plan.current && (
                <div className="mt-3 text-center">
                  <Badge className="bg-emerald-500 text-white text-xs">Forfait actuel</Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Disable Account Dialog
function DisableAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Desactiver le compte entreprise
          </DialogTitle>
          <DialogDescription>
            Cette action est irreversible. Toutes les donnees de votre compte seront definitivement supprimees.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700 font-medium">Attention :</p>
            <ul className="text-xs text-red-600 space-y-1 mt-1">
              <li>- Tous les employes seront desactives</li>
              <li>- L&apos;historique des courses sera supprime</li>
              <li>- Les factures en attente seront annulees</li>
              <li>- Le budget restant sera perdu</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirmez avec le nom de la societe</Label>
            <Input placeholder="SOCOPAO Guinee" className="h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="destructive" className="gap-1.5" onClick={() => {
            toast.success('Compte desactive avec succes')
            onOpenChange(false)
          }}>
            <X className="w-4 h-4" /> Desactiver definitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Clock icon is imported from lucide-react (line 84) ──

// Edit Employee Dialog
function EditEmployeeDialog({ employee, onOpenChange, onSave }: { employee: Employee | null; onOpenChange: (emp: Employee | null) => void; onSave: (emp: Employee) => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', department: 'General', costCenter: 'General', limit: '200000' })

  useEffect(() => {
    if (employee) {
      queueMicrotask(() => setForm({
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        costCenter: employee.costCenter,
        limit: String(employee.monthlyLimit),
      }))
    }
  }, [employee])

  if (!employee) return null

  const handleSubmit = () => {
    onSave({ ...employee, name: form.name, email: form.email, phone: form.phone, department: form.department, costCenter: form.costCenter, monthlyLimit: parseInt(form.limit) || 0 })
  }

  return (
    <Dialog open={!!employee} onOpenChange={(v) => { if (!v) onOpenChange(null) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-emerald-600" />
            Modifier {employee.name}
          </DialogTitle>
          <DialogDescription>Mettez a jour les informations de l&apos;employe</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom complet *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telephone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Departement</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Limite mensuelle (GNF)</Label>
              <Input type="number" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} className="h-9" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(null)}>Annuler</Button>
          <Button onClick={handleSubmit} className="gap-1.5">
            <Check className="w-4 h-4" /> Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Edit Cost Center Dialog Content (rendered inside a Dialog from parent)
function EditCostCenterDialogContent({ costCenter, onSave, onCancel }: { costCenter: CostCenter | null; onSave: (id: string, name: string, budget: number) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', budget: '' })

  useEffect(() => {
    if (costCenter) {
      queueMicrotask(() => setForm({ name: costCenter.name, budget: String(costCenter.budget) }))
    }
  }, [costCenter])

  if (!costCenter) return null

  const handleSubmit = () => {
    if (!form.name) {
      toast.error('Veuillez entrer un nom de centre')
      return
    }
    const budget = parseInt(form.budget)
    if (!budget || budget <= 0) {
      toast.error('Veuillez entrer un budget valide')
      return
    }
    onSave(costCenter.id, form.name, budget)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          Modifier le centre de couts
        </DialogTitle>
        <DialogDescription>Mettez a jour les informations du centre de couts</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Nom du centre *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Budget mensuel (GNF)</Label>
          <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="h-9" />
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
        <Button onClick={handleSubmit} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Check className="w-4 h-4" /> Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}
