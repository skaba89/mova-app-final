'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  Droplets,
  Wallet,
  Lock,
  ChevronDown,
  Navigation,
  Zap,
  Receipt,
  Info,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  distance: number;
  duration: number;
  timeMultiplier: number;
  surgeMultiplier: number;
  weatherMultiplier: number;
  serviceFee: number;
  discount: number;
  finalFare: number;
}

interface PricingMeta {
  isSurge: boolean;
  surgePercent: number;
  savingsWithWallet: number;
  priceLockAvailable: boolean;
}

export interface PricingDisplayProps {
  fare: number;
  breakdown: FareBreakdown;
  meta: PricingMeta;
  currency?: string;
  compact?: boolean;
  /** Called when the price lock toggle changes */
  onPriceLockChange?: (locked: boolean) => void;
  /** Called when the user clicks "Pay with wallet" */
  onWalletPayClick?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGNF(amount: number): string {
  return amount.toLocaleString('fr-FR');
}

function getMultiplierLabel(value: number): string {
  if (value > 1.25) return 'tres eleve';
  if (value > 1.15) return 'eleve';
  if (value > 1.05) return 'legerement eleve';
  if (value === 1.0) return 'normal';
  return 'reduit';
}

function getMultiplierColor(value: number): string {
  if (value > 1.25) return 'bg-red-100 text-red-700 border-red-200';
  if (value > 1.15) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (value > 1.05) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PricingDisplay({
  fare,
  breakdown,
  meta,
  currency = 'GNF',
  compact = false,
  onPriceLockChange,
  onWalletPayClick,
}: PricingDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const [priceLocked, setPriceLocked] = useState(false);
  const [lockedFare, setLockedFare] = useState<number | null>(null);

  const effectiveFare = priceLocked && lockedFare !== null ? lockedFare : fare;
  const hasWeatherSurge = breakdown.weatherMultiplier > 1.0;
  const hasTimeSurge = breakdown.timeMultiplier > 1.0;
  const hasAnySurge = meta.isSurge || hasWeatherSurge || hasTimeSurge;

  const combinedMultiplier = useMemo(
    () =>
      Math.round(
        (breakdown.timeMultiplier * breakdown.surgeMultiplier * breakdown.weatherMultiplier) * 100,
      ) / 100,
    [breakdown.timeMultiplier, breakdown.surgeMultiplier, breakdown.weatherMultiplier],
  );

  // -----------------------------------------------------------------------
  // Compact variant
  // -----------------------------------------------------------------------
  if (compact) {
    return (
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="p-4 space-y-2">
          {/* Main fare + surge badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-emerald-700">
                {formatGNF(effectiveFare)} <span className="text-sm font-normal text-muted-foreground">{currency}</span>
              </span>
            </div>
            {meta.isSurge && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Badge className="bg-amber-500 text-white border-amber-500 gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +{meta.surgePercent}%
                </Badge>
              </motion.div>
            )}
          </div>

          {/* Quick info row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Navigation className="h-3 w-3" />
              {breakdown.distance} km
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {breakdown.duration} min
            </span>
          </div>

          {/* Wallet savings callout */}
          {meta.savingsWithWallet > 0 && (
            <button
              type="button"
              onClick={onWalletPayClick}
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 transition-colors w-full"
            >
              <Wallet className="h-3 w-3" />
              Payer avec le wallet et economiser {formatGNF(meta.savingsWithWallet)} {currency}
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  // -----------------------------------------------------------------------
  // Full variant
  // -----------------------------------------------------------------------
  return (
    <Card className="border-emerald-200 overflow-hidden">
      {/* Surge banner */}
      <AnimatePresence>
        {hasAnySurge && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div
              className={`px-4 py-2.5 flex items-center gap-2 text-sm font-medium ${
                meta.isSurge && meta.surgePercent > 20
                  ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white'
                  : 'bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900'
              }`}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                <TrendingUp className="h-4 w-4" />
              </motion.div>
              {meta.isSurge
                ? `Demande elevee — tarif majore de +${meta.surgePercent}%`
                : 'Conditions particulieres appliquees'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardContent className="p-6 space-y-4">
        {/* ---- Main fare ---- */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Tarif estime</p>
            <div className="flex items-baseline gap-1.5">
              <motion.span
                key={effectiveFare}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="text-4xl font-extrabold tracking-tight text-emerald-700"
              >
                {formatGNF(effectiveFare)}
              </motion.span>
              <span className="text-lg text-muted-foreground font-medium">{currency}</span>
            </div>
          </div>

          {/* Price lock toggle */}
          {meta.priceLockAvailable && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs font-medium leading-tight">Verrouiller</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Bloquer le tarif</span>
              </div>
              <Switch
                checked={priceLocked}
                onCheckedChange={(checked) => {
                  setPriceLocked(checked);
                  setLockedFare(checked ? fare : null);
                  onPriceLockChange?.(checked);
                }}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          )}
        </div>

        {/* ---- Distance & duration ---- */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Navigation className="h-4 w-4 text-emerald-500" />
            <span>
              <span className="font-semibold text-foreground">{breakdown.distance} km</span> de distance
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span>
              <span className="font-semibold text-foreground">{breakdown.duration} min</span> de trajet
            </span>
          </div>
        </div>

        <Separator />

        {/* ---- Multiplier badges ---- */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={`text-xs gap-1 ${getMultiplierColor(breakdown.timeMultiplier)}`}
          >
            <Clock className="h-3 w-3" />
            x{breakdown.timeMultiplier.toFixed(2)} {getMultiplierLabel(breakdown.timeMultiplier)}
          </Badge>

          <Badge
            variant="outline"
            className={`text-xs gap-1 ${getMultiplierColor(breakdown.surgeMultiplier)}`}
          >
            <TrendingUp className="h-3 w-3" />
            x{breakdown.surgeMultiplier.toFixed(2)} demande
          </Badge>

          {hasWeatherSurge && (
            <Badge
              variant="outline"
              className="text-xs gap-1 bg-blue-100 text-blue-700 border-blue-200"
            >
              <Droplets className="h-3 w-3" />
              x{breakdown.weatherMultiplier.toFixed(2)} pluie
            </Badge>
          )}

          <Badge variant="outline" className="text-xs gap-1 bg-muted text-muted-foreground">
            x{combinedMultiplier.toFixed(2)} total
          </Badge>
        </div>

        {/* ---- Wallet savings callout ---- */}
        {meta.savingsWithWallet > 0 && (
          <motion.div
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button
              type="button"
              onClick={onWalletPayClick}
              className="w-full flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm transition-colors hover:bg-emerald-100"
            >
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-800 font-medium">
                  Payer avec le wallet ou Mobile Money
                </span>
              </div>
              <div className="flex items-center gap-1 text-emerald-700 font-bold">
                <span>-{formatGNF(meta.savingsWithWallet)} {currency}</span>
                <Zap className="h-3.5 w-3.5" />
              </div>
            </button>
          </motion.div>
        )}

        {/* ---- Expandable breakdown ---- */}
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Receipt className="h-4 w-4" />
            <span className="font-medium">Detail du tarif</span>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
                  <BreakdownRow
                    label="Tarif de base"
                    value={breakdown.baseFare}
                    currency={currency}
                  />
                  <BreakdownRow
                    label={`${breakdown.distance} km x ${formatGNF(Math.round(breakdown.distance > 0 ? breakdown.distanceFare / breakdown.distance : 0))} GNF/km`}
                    value={breakdown.distanceFare}
                    currency={currency}
                  />
                  <Separator className="my-2" />
                  <BreakdownRow
                    label="Sous-total"
                    value={breakdown.baseFare + breakdown.distanceFare}
                    currency={currency}
                    bold
                  />
                  <BreakdownRow
                    label={`Multiplicateur horaire (x${breakdown.timeMultiplier.toFixed(2)})`}
                    value={null}
                    info="Heures de pointe, nuit ou week-end"
                    currency={currency}
                  />
                  <BreakdownRow
                    label={`Multiplicateur demande (x${breakdown.surgeMultiplier.toFixed(2)})`}
                    value={null}
                    info="Base sur la popularite des zones"
                    currency={currency}
                  />
                  {hasWeatherSurge && (
                    <BreakdownRow
                      label={`Multiplicateur meteo (x${breakdown.weatherMultiplier.toFixed(2)})`}
                      value={null}
                      info="Conditions de pluie"
                      currency={currency}
                    />
                  )}
                  <Separator className="my-2" />
                  <BreakdownRow
                    label="Frais de service (5%)"
                    value={breakdown.serviceFee}
                    currency={currency}
                  />
                  {breakdown.discount > 0 && (
                    <BreakdownRow
                      label="Remise wallet (3%)"
                      value={-breakdown.discount}
                      currency={currency}
                      className="text-emerald-600"
                    />
                  )}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-base text-foreground">Tarif final</span>
                    <span className="font-bold text-lg text-emerald-700">
                      {formatGNF(breakdown.finalFare)} {currency}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---- Info footer ---- */}
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Le tarif peut varier selon les conditions de trafic en temps reel. Le prix est garanti si verrouille.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// BreakdownRow sub-component
// ---------------------------------------------------------------------------

function BreakdownRow({
  label,
  value,
  currency,
  bold = false,
  info,
  className,
}: {
  label: string;
  value: number | null;
  currency?: string;
  bold?: boolean;
  info?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between ${bold ? 'font-semibold' : ''} ${className ?? ''}`}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        {info && (
          <span className="relative group">
            <Info className="h-3 w-3 text-muted-foreground" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded-md border px-2 py-1 whitespace-nowrap shadow-lg z-10">
              {info}
            </span>
          </span>
        )}
      </div>
      {value !== null && (
        <span className={className ?? ''}>
          {value < 0 ? '-' : ''}{formatGNF(Math.abs(value))} {currency}
        </span>
      )}
    </div>
  );
}

export default PricingDisplay;
