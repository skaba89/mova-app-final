'use client'

import { useTranslation, LOCALES } from "@/lib/mova/i18n"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LanguageSelector() {
  const { locale, setLocale, t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <Globe className="size-4 text-muted-foreground" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as 'fr' | 'pul' | 'sus')}
        className="text-xs bg-transparent border-0 text-foreground font-medium focus:outline-none cursor-pointer"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
        ))}
      </select>
    </div>
  )
}
