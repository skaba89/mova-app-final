'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from 'recharts'
import {
  TrendingUp,
  BarChart3,
  Users,
  MapPin,
  CreditCard,
  Star,
  Clock,
  Car,
  Activity,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  AlertTriangle,
  Package,
  CheckCircle2,
  ChevronsUpDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { cn } from '@/lib/utils'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const formatGNF = (value: number) =>
  new Intl.NumberFormat('fr-GN').format(value) + ' GNF'

const formatCompactGNF = (value: number) => {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + ' M GNF'
  if (value >= 1_000) return (value / 1_000).toFixed(0) + ' K GNF'
  return formatGNF(value)
}

// ──────────────────────────────────────────────
// Custom tooltip styles
// ──────────────────────────────────────────────

/** Return tooltip style matching the current theme (checked at render-time) */
const getTooltipStyle = () => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return {
    borderRadius: '10px',
    border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
    fontSize: '12px',
    boxShadow: isDark ? '0 4px 12px rgb(0 0 0 / 0.3)' : '0 4px 12px rgb(0 0 0 / 0.08)',
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    color: isDark ? '#e5e7eb' : '#111827',
  }
}

// ──────────────────────────────────────────────
// Motion wrapper
// ──────────────────────────────────────────────

const ChartCard = ({
  children,
  title,
  icon: Icon,
  badge,
  className,
}: {
  children: ReactNode
  title: string
  icon: LucideIcon
  badge?: ReactNode
  className?: string
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
  >
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
            <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        {badge}
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  </motion.div>
)

// ──────────────────────────────────────────────
// 1. RevenueChart
// ──────────────────────────────────────────────

// Legacy types for backward-compatible exports
export interface RevenueChartData { date: string; revenus: number; depenses: number }
export interface StatusData { name: string; value: number; color: string }
export interface ZoneData { zone: string; count: number }
export interface MonthlyRevenueData { month: string; amount: number }
export interface PaymentMethodData { name: string; value: number; color: string }
export interface TopDriverData { name: string; earnings: number; rides: number }
export interface SeverityData { name: string; value: number; color: string }

const revenueData = [
  { date: '01 Jan', revenus: 185000, depenses: 92000 },
  { date: '02 Jan', revenus: 210000, depenses: 98000 },
  { date: '03 Jan', revenus: 195000, depenses: 87000 },
  { date: '04 Jan', revenus: 240000, depenses: 110000 },
  { date: '05 Jan', revenus: 265000, depenses: 125000 },
  { date: '06 Jan', revenus: 310000, depenses: 140000 },
  { date: '07 Jan', revenus: 280000, depenses: 130000 },
  { date: '08 Jan', revenus: 225000, depenses: 105000 },
  { date: '09 Jan', revenus: 350000, depenses: 155000 },
  { date: '10 Jan', revenus: 290000, depenses: 132000 },
  { date: '11 Jan', revenus: 320000, depenses: 148000 },
  { date: '12 Jan', revenus: 275000, depenses: 120000 },
  { date: '13 Jan', revenus: 300000, depenses: 138000 },
  { date: '14 Jan', revenus: 335000, depenses: 150000 },
]

const RevenueChart = ({ data: propData }: { data?: Record<string, unknown>[] }) => {
  const hasCorrectShape = propData && propData.length > 0 && typeof propData[0].revenus === 'number'
  const chartData = hasCorrectShape ? propData as unknown as RevenueChartData[] : revenueData
  const totalRevenus = chartData.reduce((s, d) => s + d.revenus, 0)
  const totalDepenses = chartData.reduce((s, d) => s + d.depenses, 0)

  return (
    <ChartCard
      title="Revenus et Depenses"
      icon={TrendingUp}
      badge={
        <Badge
          variant="secondary"
          className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs font-medium"
        >
          {formatCompactGNF(totalRevenus - totalDepenses)}
        </Badge>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactGNF(v)}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            contentStyle={getTooltipStyle()}
            formatter={(value: number, name: string) => [
              formatGNF(value),
              name === 'revenus' ? 'Revenus' : 'Depenses',
            ]}
            labelFormatter={(label: string) => label}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
            formatter={(value: string) => (value === 'revenus' ? 'Revenus' : 'Depenses')}
          />
          <Area
            type="monotone"
            dataKey="depenses"
            stroke="#f43f5e"
            strokeWidth={2}
            fill="url(#expenseGradient)"
          />
          <Area
            type="monotone"
            dataKey="revenus"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ──────────────────────────────────────────────
// 2. RidesChart
// ──────────────────────────────────────────────

const ridesData = [
  { jour: 'Lun', courses: 42, livraisons: 18 },
  { jour: 'Mar', courses: 55, livraisons: 24 },
  { jour: 'Mer', courses: 48, livraisons: 20 },
  { jour: 'Jeu', courses: 62, livraisons: 28 },
  { jour: 'Ven', courses: 71, livraisons: 32 },
  { jour: 'Sam', courses: 85, livraisons: 38 },
  { jour: 'Dim', courses: 38, livraisons: 14 },
]

const RidesChart = () => {
  const avgCourses = Math.round(ridesData.reduce((s, d) => s + d.courses, 0) / ridesData.length)

  return (
    <ChartCard
      title="Courses et Livraisons"
      icon={BarChart3}
      badge={
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs font-medium"
        >
          Moy. {avgCourses}/j
        </Badge>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={ridesData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="ridesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
            </linearGradient>
            <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
              <stop offset="100%" stopColor="#d97706" stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
          <XAxis
            dataKey="jour"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip
            contentStyle={getTooltipStyle()}
            formatter={(value: number, name: string) => [
              `${value} trajets`,
              name === 'courses' ? 'Courses' : 'Livraisons',
            ]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
            formatter={(value: string) => (value === 'courses' ? 'Courses' : 'Livraisons')}
          />
          <Bar dataKey="courses" fill="url(#ridesGradient)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="livraisons" fill="url(#deliveryGradient)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ──────────────────────────────────────────────
// 3. UserGrowthChart
// ──────────────────────────────────────────────

const userGrowthData = [
  { mois: 'Janv', passagers: 420, chauffeurs: 85, entreprises: 12 },
  { mois: 'Fevr', passagers: 580, chauffeurs: 112, entreprises: 18 },
  { mois: 'Mars', passagers: 750, chauffeurs: 138, entreprises: 24 },
  { mois: 'Avr', passagers: 920, chauffeurs: 165, entreprises: 31 },
  { mois: 'Mai', passagers: 1150, chauffeurs: 198, entreprises: 38 },
  { mois: 'Juin', passagers: 1380, chauffeurs: 240, entreprises: 45 },
]

const CustomDot = (props: { cx?: number; cy?: number; index?: number; payload?: Record<string, unknown> }) => {
  const { cx = 0, cy = 0, index, payload } = props
  const dataPoints = userGrowthData.length - 1
  const isLatest = index === dataPoints

  if (!isLatest) {
    return (
      <circle cx={cx} cy={cy} r={3} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
    )
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#10b981" opacity={0.3}>
        <animate
          attributeName="r"
          values="6;10;6"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.3;0.1;0.3"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={cx} cy={cy} r={4} fill="#10b981" stroke="#fff" strokeWidth={2} />
    </g>
  )
}

const UserGrowthChart = () => {
  return (
    <ChartCard title="Croissance des utilisateurs" icon={Users}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={userGrowthData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
          <XAxis
            dataKey="mois"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip
            contentStyle={getTooltipStyle()}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                passagers: 'Passagers',
                chauffeurs: 'Chauffeurs',
                entreprises: 'Entreprises',
              }
              return [value.toLocaleString('fr-GN'), labels[name] || name]
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                passagers: 'Passagers',
                chauffeurs: 'Chauffeurs',
                entreprises: 'Entreprises',
              }
              return labels[value] || value
            }}
          />
          <Line
            type="monotone"
            dataKey="passagers"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={<CustomDot />}
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="chauffeurs"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 1.5 }}
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="entreprises"
            stroke="#14b8a6"
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 1.5 }}
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ──────────────────────────────────────────────
// 4. ZoneDemandChart
// ──────────────────────────────────────────────

const zoneDemandData = [
  { zone: 'Kaloum', demande: 85 },
  { zone: 'Matam', demande: 62 },
  { zone: 'Dixinn', demande: 48 },
  { zone: 'Ratoma', demande: 72 },
  { zone: 'Gbessia', demande: 55 },
  { zone: 'Matoto', demande: 42 },
  { zone: 'Sonfonia', demande: 38 },
  { zone: 'Lambanyi', demande: 35 },
  { zone: 'Tombolia', demande: 30 },
  { zone: 'Kagbelene', demande: 28 },
  { zone: 'Dubreka', demande: 25 },
  { zone: 'Maneah', demande: 22 },
  { zone: 'Sanoyah', demande: 18 },
]

const getDemandColor = (value: number) => {
  if (value >= 75) return '#ef4444'
  if (value >= 60) return '#f59e0b'
  return '#10b981'
}

const getDemandLabel = (value: number) => {
  if (value >= 75) return 'Elevee'
  if (value >= 60) return 'Moyenne'
  return 'Faible'
}

const ZoneDemandChart = () => {
  return (
    <ChartCard title="Demande par zone" icon={MapPin}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={zoneDemandData}
          layout="vertical"
          margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
        >
          <defs>
            {zoneDemandData.map((item) => (
              <linearGradient
                key={item.zone}
                id={`zone-${item.zone}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor={getDemandColor(item.demande)} stopOpacity={0.85} />
                <stop offset="100%" stopColor={getDemandColor(item.demande)} stopOpacity={0.5} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="zone"
            tick={{ fontSize: 11, fill: '#374151' }}
            axisLine={false}
            tickLine={false}
            width={65}
          />
          <Tooltip
            contentStyle={getTooltipStyle()}
            formatter={(value: number) => [`${value}%`, 'Demande']}
            labelFormatter={(label: string) => label}
          />
          <Bar dataKey="demande" radius={[0, 6, 6, 0]} maxBarSize={28} barSize={28}>
            {zoneDemandData.map((item) => (
              <Cell key={item.zone} fill={`url(#zone-${item.zone})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground">Faible (&lt;60%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span className="text-[10px] text-muted-foreground">Moyenne (60-74%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-[10px] text-muted-foreground">Elevee (&gt;75%)</span>
        </div>
      </div>
    </ChartCard>
  )
}

// ──────────────────────────────────────────────
// 5. PaymentMethodChart
// ──────────────────────────────────────────────

const paymentMethodData = [
  { name: 'Cash', value: 42, color: '#f59e0b' },
  { name: 'Mobile Money', value: 31, color: '#f97316' },
  { name: 'Wallet', value: 18, color: '#10b981' },
  { name: 'Carte', value: 9, color: '#14b8a6' },
]

const RADIAN = Math.PI / 180

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  if (percent < 0.08) return null

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      style={{ fontSize: '11px', fontWeight: 600 }}
    >
      {(percent * 100).toFixed(0)}%
    </text>
  )
}

const PaymentMethodChart = () => {
  const total = paymentMethodData.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard title="Methodes de paiement" icon={CreditCard}>
      <div className="flex items-center justify-center">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={paymentMethodData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
              label={renderCustomizedLabel}
              labelLine={false}
            >
              {paymentMethodData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={getTooltipStyle()}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
            <text
              x="50%"
              y="44%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-lg font-bold"
            >
              {total}%
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px]"
            >
              transactions
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
        {paymentMethodData.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

// ──────────────────────────────────────────────
// 6. RatingDistributionChart
// ──────────────────────────────────────────────

const ratingData = [
  { etoiles: 5, count: 428 },
  { etoiles: 4, count: 182 },
  { etoiles: 3, count: 45 },
  { etoiles: 2, count: 12 },
  { etoiles: 1, count: 5 },
]

const RatingDistributionChart = () => {
  const total = ratingData.reduce((s, d) => s + d.count, 0)

  return (
    <ChartCard
      title="Distribution des notes"
      icon={Star}
      badge={
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs font-medium"
        >
          4.8/5
        </Badge>
      }
    >
      <div className="space-y-3 px-1">
        {ratingData.map((item) => {
          const percentage = Math.round((item.count / total) * 100)
          return (
            <div key={item.etoiles} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 w-16 shrink-0">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span className="text-xs font-medium text-foreground">{item.etoiles}</span>
              </div>
              <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: (5 - item.etoiles) * 0.1 }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{item.count}</span>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

// ──────────────────────────────────────────────
// 7. PeakHoursChart
// ──────────────────────────────────────────────

// Deterministic pseudo-random helper (avoids SSR hydration mismatch)
const seededRange = (i: number, offset: number, spread: number) =>
  ((i * 2654435761 + offset) >>> 0) % (spread + 1)

const peakHoursData = Array.from({ length: 24 }, (_, i) => {
  let rides = 0
  if (i >= 7 && i <= 9) rides = 25 + seededRange(i, 1, 14)
  else if (i >= 17 && i <= 19) rides = 30 + seededRange(i, 2, 17)
  else if (i >= 11 && i <= 14) rides = 15 + seededRange(i, 3, 9)
  else if (i >= 20 && i <= 22) rides = 10 + seededRange(i, 4, 7)
  else if (i >= 1 && i <= 5) rides = 2 + seededRange(i, 5, 2)
  else rides = 8 + seededRange(i, 6, 6)
  return { heure: `${i}h`, courses: rides }
})

const PeakHoursChart = () => {
  return (
    <ChartCard title="Heures de pointe" icon={Clock}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={peakHoursData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="normalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
          <XAxis
            dataKey="heure"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={getTooltipStyle()}
            formatter={(value: number) => [`${value} courses`, 'Courses']}
            labelFormatter={(label: string) => `Heure : ${label}`}
          />
          <ReferenceArea
            x1="7h"
            x2="9h"
            fill="#f59e0b"
            fillOpacity={0.08}
            stroke="#f59e0b"
            strokeOpacity={0.3}
            strokeDasharray="3 3"
          />
          <ReferenceArea
            x1="17h"
            x2="19h"
            fill="#f59e0b"
            fillOpacity={0.08}
            stroke="#f59e0b"
            strokeOpacity={0.3}
            strokeDasharray="3 3"
          />
          <Area
            type="monotone"
            dataKey="courses"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#peakGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400 opacity-40 border border-amber-400" />
          <span className="text-[10px] text-muted-foreground">Heures de pointe (7-9h / 17-19h)</span>
        </div>
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px]"
        >
          Surge 1.5x
        </Badge>
      </div>
    </ChartCard>
  )
}

// ──────────────────────────────────────────────
// 8. VehicleUtilizationChart
// ──────────────────────────────────────────────

const vehicleData = [
  { type: 'Standard', enCourse: 42, disponible: 28, horsLigne: 15 },
  { type: 'Premium', enCourse: 28, disponible: 12, horsLigne: 8 },
  { type: 'Van', enCourse: 18, disponible: 9, horsLigne: 5 },
]

const VehicleUtilizationChart = () => {
  return (
    <ChartCard title="Utilisation vehicules" icon={Car}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={vehicleData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
          <XAxis
            dataKey="type"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={getTooltipStyle()}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                enCourse: 'En course',
                disponible: 'Disponible',
                horsLigne: 'Hors ligne',
              }
              return [value + ' vehicules', labels[name] || name]
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                enCourse: 'En course',
                disponible: 'Disponible',
                horsLigne: 'Hors ligne',
              }
              return labels[value] || value
            }}
          />
          <Bar dataKey="enCourse" stackId="a" fill="#10b981" radius={0} maxBarSize={48} />
          <Bar dataKey="disponible" stackId="a" fill="#f59e0b" radius={0} maxBarSize={48} />
          <Bar dataKey="horsLigne" stackId="a" fill="#d1d5db" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ──────────────────────────────────────────────
// 9. KpiCards
// ──────────────────────────────────────────────

function useAnimatedCounter(target: number, duration: number = 1200) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let start = 0
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(eased * target)
      setValue(current)
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [target, duration])

  return value
}

const KpiCards = () => {
  const animatedRevenue = useAnimatedCounter(2450000)
  const animatedRides = useAnimatedCounter(342)
  const animatedDrivers = useAnimatedCounter(156)

  const cards = [
    {
      icon: TrendingUp,
      value: formatGNF(animatedRevenue),
      label: 'Revenu total',
      trend: 'up' as const,
      trendValue: '+12.5%',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Car,
      value: animatedRides.toString(),
      label: "Courses aujourd'hui",
      trend: 'up' as const,
      trendValue: '+8%',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      icon: Users,
      value: `${animatedDrivers}/500`,
      label: 'Chauffeurs actifs',
      trend: 'up' as const,
      trendValue: '+5.4%',
      iconBg: 'bg-teal-100 dark:bg-teal-900/40',
      iconColor: 'text-teal-600 dark:text-teal-400',
      showProgress: true,
      progressValue: 31,
    },
    {
      icon: Star,
      value: '4.8/5',
      label: 'Note moyenne',
      trend: 'up' as const,
      trendValue: '+0.2',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      showStars: true,
    },
  ] as const

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
        >
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', card.iconBg)}>
                  <card.icon className={cn('h-5 w-5', card.iconColor)} />
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1 text-sm font-medium',
                    card.trend === 'up'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-400'
                  )}
                >
                  {card.trend === 'up' ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  <span>{card.trendValue}</span>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
              </div>
              {'showProgress' in card && card.showProgress && (
                <div className="mt-2">
                  <Progress value={card.progressValue} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">{card.progressValue}% en ligne</p>
                </div>
              )}
              {'showStars' in card && card.showStars && (
                <div className="flex items-center gap-0.5 mt-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        'h-3.5 w-3.5',
                        s <= 4 ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'
                      )}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────
// 10. RealtimeActivityFeed
// ──────────────────────────────────────────────

type ActivityEventType = 'ride' | 'signup' | 'payment' | 'report' | 'delivery'

interface ActivityEvent {
  id: string
  type: ActivityEventType
  description: string
  time: string
  status: string
}

const activityIcons: Record<ActivityEventType, { icon: LucideIcon; color: string; bg: string }> = {
  ride: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  signup: { icon: UserPlus, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/40' },
  payment: { icon: CreditCard, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  report: { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/40' },
  delivery: { icon: Package, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/40' },
}

const statusColors: Record<string, string> = {
  complete: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  recu: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  ouvert: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  encours: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  actif: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
}

const seedEvents: ActivityEvent[] = [
  {
    id: 'a1',
    type: 'ride',
    description: 'Course C-2025-045 terminee - Kipe vers Kaloum',
    time: '14:32',
    status: 'complete',
  },
  {
    id: 'a2',
    type: 'payment',
    description: 'Paiement recu de 25 000 GNF - Orange Money',
    time: '14:28',
    status: 'recu',
  },
  {
    id: 'a3',
    type: 'signup',
    description: "Nouvelle inscription - Aminata Diallo",
    time: '14:25',
    status: 'actif',
  },
  {
    id: 'a4',
    type: 'report',
    description: 'Signalement INC-012 - Retard important Dixinn',
    time: '14:20',
    status: 'ouvert',
  },
  {
    id: 'a5',
    type: 'delivery',
    description: 'Livraison L-2025-088 - Colis Madina vers Boulbinet',
    time: '14:15',
    status: 'encours',
  },
  {
    id: 'a6',
    type: 'ride',
    description: 'Course C-2025-044 terminee - Matoto vers Dixinn',
    time: '14:10',
    status: 'complete',
  },
  {
    id: 'a7',
    type: 'payment',
    description: 'Paiement recu de 38 500 GNF - Wallet MOVA',
    time: '14:05',
    status: 'recu',
  },
  {
    id: 'a8',
    type: 'signup',
    description: 'Nouveau chauffeur inscrit - Fode Camara',
    time: '14:00',
    status: 'actif',
  },
]

// Module-level counter for deterministic event generation
let eventCounter = 0

const generateEvent = (): ActivityEvent => {
  const eventTemplates: Omit<ActivityEvent, 'id' | 'time'>[] = [
    { type: 'ride', description: 'Course terminee - Kaloum vers Ratoma', status: 'complete' },
    { type: 'ride', description: 'Course terminee - Dixinn vers Matam', status: 'complete' },
    { type: 'ride', description: 'Course terminee - Matoto vers Kipe', status: 'complete' },
    { type: 'payment', description: 'Paiement recu de 15 000 GNF - Orange Money', status: 'recu' },
    { type: 'payment', description: 'Paiement recu de 22 500 GNF - Wallet MOVA', status: 'recu' },
    { type: 'payment', description: 'Paiement recu de 30 000 GNF - MTN Money', status: 'recu' },
    { type: 'signup', description: 'Nouvelle inscription - Passager Conakry', status: 'actif' },
    { type: 'signup', description: 'Nouveau chauffeur inscrit - Zone Dixinn', status: 'actif' },
    { type: 'report', description: 'Signalement - Comportement inadapte', status: 'ouvert' },
    { type: 'report', description: 'Signalement - Retard non justifie', status: 'ouvert' },
    { type: 'delivery', description: 'Livraison en cours - Document Almamy', status: 'encours' },
    { type: 'delivery', description: 'Livraison confirmee - Colis Kipe', status: 'complete' },
  ]
  const idx = eventCounter % eventTemplates.length
  eventCounter++
  const template = eventTemplates[idx]
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  return {
    ...template,
    id: `a-${Date.now()}-${idx.toString().padStart(4, '0')}`,
    time,
  }
}

const RealtimeActivityFeed = () => {
  const [events, setEvents] = useState<ActivityEvent[]>(seedEvents)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef(0)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      tickRef.current++
      const newEvent = generateEvent()
      setEvents((prev) => [newEvent, ...prev].slice(0, 8))
    }, 3000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-sm font-semibold">Activite en temps reel</CardTitle>
          </div>
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs font-medium gap-1.5"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Temps reel
          </Badge>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-2.5 max-h-96 overflow-y-auto mova-scrollbar">
            {events.map((event) => {
              const cfg = activityIcons[event.type]
              const Icon = cfg.icon
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg shrink-0', cfg.bg)}>
                    <Icon className={cn('h-4 w-4', cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-tight">{event.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{event.time}</span>
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] px-1.5 py-0', statusColors[event.status] || '')}
                      >
                        {event.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ──────────────────────────────────────────────
// 11. TopDriversTable
// ──────────────────────────────────────────────

interface TopDriver {
  rank: number
  name: string
  zone: string
  rides: number
  rating: number
  revenue: number
}

const topDriversSeed: TopDriver[] = [
  { rank: 1, name: 'Mamadou Diallo', zone: 'Kaloum', rides: 342, rating: 4.9, revenue: 4850000 },
  { rank: 2, name: 'Sekou Bah', zone: 'Matoto', rides: 318, rating: 4.8, revenue: 4520000 },
  { rank: 3, name: 'Ibrahima Soumah', zone: 'Dixinn', rides: 295, rating: 4.8, revenue: 4180000 },
  { rank: 4, name: 'Abdoulaye Conte', zone: 'Ratoma', rides: 276, rating: 4.7, revenue: 3750000 },
  { rank: 5, name: 'Fode Camara', zone: 'Matam', rides: 258, rating: 4.6, revenue: 3420000 },
]

const medalConfig: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-400', label: 'Or' },
  2: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', label: 'Argent' },
  3: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-400', label: 'Bronze' },
}

type SortKey = 'rank' | 'name' | 'zone' | 'rides' | 'rating' | 'revenue'

const SortIndicator = ({
  column,
  activeKey,
  ascending,
}: {
  column: SortKey
  activeKey: SortKey
  ascending: boolean
}) => {
  if (activeKey !== column) {
    return <ChevronsUpDown className="h-3 w-3 text-gray-300 dark:text-gray-600 ml-0.5 inline" />
  }
  return (
    <span className="text-emerald-500 ml-0.5 font-bold inline">
      {ascending ? '\u2191' : '\u2193'}
    </span>
  )
}

const TopDriversTable = () => {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortAsc, setSortAsc] = useState(true)

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc((prev) => !prev)
      } else {
        setSortKey(key)
        setSortAsc(key === 'rank' || key === 'name')
      }
    },
    [sortKey]
  )

  const sortedDrivers = useMemo(() => {
    return [...topDriversSeed].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
  }, [sortKey, sortAsc])

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-sm font-semibold">Meilleurs chauffeurs</CardTitle>
          </div>
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs font-medium"
          >
            Top 5
          </Badge>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none text-xs font-semibold hover:text-foreground"
                  onClick={() => handleSort('rank')}
                >
                  <span className="flex items-center">#<SortIndicator column="rank" activeKey={sortKey} ascending={sortAsc} /></span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-xs font-semibold hover:text-foreground"
                  onClick={() => handleSort('name')}
                >
                  <span className="flex items-center">Nom<SortIndicator column="name" activeKey={sortKey} ascending={sortAsc} /></span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-xs font-semibold hover:text-foreground hidden sm:table-cell"
                  onClick={() => handleSort('zone')}
                >
                  <span className="flex items-center">Zone<SortIndicator column="zone" activeKey={sortKey} ascending={sortAsc} /></span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-xs font-semibold hover:text-foreground text-right"
                  onClick={() => handleSort('rides')}
                >
                  <span className="flex items-center justify-end">Courses<SortIndicator column="rides" activeKey={sortKey} ascending={sortAsc} /></span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-xs font-semibold hover:text-foreground text-center"
                  onClick={() => handleSort('rating')}
                >
                  <span className="flex items-center justify-center">Note<SortIndicator column="rating" activeKey={sortKey} ascending={sortAsc} /></span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-xs font-semibold hover:text-foreground text-right"
                  onClick={() => handleSort('revenue')}
                >
                  <span className="flex items-center justify-end">Revenus<SortIndicator column="revenue" activeKey={sortKey} ascending={sortAsc} /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDrivers.map((driver) => {
                const medal = medalConfig[driver.rank]
                const avatars = ['bg-emerald-600', 'bg-teal-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600']
                return (
                  <TableRow key={driver.rank} className="hover:bg-muted/50">
                    <TableCell className="py-3">
                      {medal ? (
                        <Badge
                          variant="secondary"
                          className={cn('text-xs font-bold px-2', medal.bg, medal.text)}
                        >
                          {driver.rank}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground font-medium pl-2">{driver.rank}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback
                            className={cn(
                              'text-white text-[10px] font-bold',
                              avatars[driver.rank - 1] || 'bg-gray-500'
                            )}
                          >
                            {getInitials(driver.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{driver.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{driver.zone}</span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-medium">{driver.rides}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-medium">{driver.rating}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-medium">{formatCompactGNF(driver.revenue)}</span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ──────────────────────────────────────────────
// Exports (React.memo for performance)
// ──────────────────────────────────────────────

export const RevenueChartMemo = memo(RevenueChart)
export const RidesChartMemo = memo(RidesChart)
export const UserGrowthChartMemo = memo(UserGrowthChart)
export const ZoneDemandChartMemo = memo(ZoneDemandChart)
export const PaymentMethodChartMemo = memo(PaymentMethodChart)
export const RatingDistributionChartMemo = memo(RatingDistributionChart)
export const PeakHoursChartMemo = memo(PeakHoursChart)
export const VehicleUtilizationChartMemo = memo(VehicleUtilizationChart)
export const KpiCardsMemo = memo(KpiCards)
export const RealtimeActivityFeedMemo = memo(RealtimeActivityFeed)
export const TopDriversTableMemo = memo(TopDriversTable)

// Named exports (primary)
export {
  RevenueChart,
  RidesChart,
  UserGrowthChart,
  ZoneDemandChart,
  PaymentMethodChart,
  RatingDistributionChart,
  PeakHoursChart,
  VehicleUtilizationChart,
  KpiCards,
  RealtimeActivityFeed,
  TopDriversTable,
}

// Default export
export default RevenueChart

// ──────────────────────────────────────────────
// Backward-compatible exports for admin-view.tsx
// Uses the exported types defined above

const legacyTooltipStyle = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
}

// Empty state message for charts with no data
const EmptyChartState = ({ message }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
    <p className="text-sm text-muted-foreground">{message || 'Aucune donnee disponible'}</p>
  </div>
)

export function RidesByStatusChart({ data }: { data: StatusData[] }) {
  if (data.length === 0) return <EmptyChartState />
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [`${value} courses`, name]} contentStyle={legacyTooltipStyle} />
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-lg font-bold">{total}</text>
          <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">courses</text>
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RidesByZoneChart({ data }: { data: ZoneData[] }) {
  if (data.length === 0) return <EmptyChartState message="Aucune donnee par zone" />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="zone" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={30} />
        <Tooltip formatter={(value: number) => [`${value} courses`, 'Courses']} contentStyle={legacyTooltipStyle} />
        <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MonthlyRevenueChart({ data }: { data: MonthlyRevenueData[] }) {
  if (data.length === 0) return <EmptyChartState message="Aucun revenu mensuel" />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="legacyBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
        <YAxis tickFormatter={(v: number) => formatCompactGNF(v)} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={70} />
        <Tooltip formatter={(value: number) => [formatGNF(value), 'Revenus']} contentStyle={legacyTooltipStyle} />
        <Bar dataKey="amount" fill="url(#legacyBarGradient)" radius={[6, 6, 0, 0]} maxBarSize={45} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PaymentMethodsChart({ data }: { data: PaymentMethodData[] }) {
  if (data.length === 0) return <EmptyChartState message="Aucune donnee de paiement" />
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none"
            label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => [formatGNF(value), 'Montant']} contentStyle={legacyTooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center mt-1">Total : {formatCompactGNF(total)}</p>
    </div>
  )
}

export function TopDriversChart({ data }: { data: TopDriverData[] }) {
  if (data.length === 0) return <EmptyChartState message="Aucun chauffeur" />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <XAxis type="number" tickFormatter={(v: number) => formatCompactGNF(v)} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={120} />
        <Tooltip formatter={(value: number, name: string) => { if (name === 'earnings') return [formatGNF(value), 'Revenus']; return [value, name] }} contentStyle={legacyTooltipStyle} />
        <Bar dataKey="earnings" fill="#10b981" radius={[0, 6, 6, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function IncidentSeverityChart({ data }: { data: SeverityData[] }) {
  if (data.length === 0) return <EmptyChartState message="Aucun signalement" />
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [`${value} signalements`, name]} contentStyle={legacyTooltipStyle} />
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-lg font-bold">{total}</text>
          <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">signalements</text>
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
