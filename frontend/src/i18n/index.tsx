/**
 * FIX #24: Sistema de internacionalizacion (i18n) para CredCore.
 * Soporta ES (default) y EN. Extensible a mas idiomas.
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import esLocale from './locales/es.json'
import enLocale from './locales/en.json'

export type Locale = 'es' | 'en'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Translations = Record<string, any>

const locales: Record<Locale, Translations> = {
  es: esLocale,
  en: enLocale,
}

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, fallback?: string) => string
  availableLocales: { code: Locale; label: string }[]
}

const I18nContext = createContext<I18nContextType | null>(null)

/**
 * Resuelve una clave punteada como "common.save" en el objeto de traducciones.
 */
function resolveKey(obj: Translations, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = sessionStorage.getItem('credcore-locale')
    if (saved === 'en' || saved === 'es') return saved
    // Detectar idioma del navegador
    const browserLang = navigator.language?.substring(0, 2)
    return browserLang === 'en' ? 'en' : 'es'
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    sessionStorage.setItem('credcore-locale', newLocale)
    document.documentElement.lang = newLocale
  }, [])

  const t = useCallback((key: string, fallback?: string): string => {
    const resolved = resolveKey(locales[locale], key)
    if (resolved) return resolved
    // Fallback a espanol si no existe en el idioma actual
    if (locale !== 'es') {
      const esFallback = resolveKey(locales.es, key)
      if (esFallback) return esFallback
    }
    return fallback ?? key
  }, [locale])

  const availableLocales = useMemo(() => [
    { code: 'es' as Locale, label: 'Espanol' },
    { code: 'en' as Locale, label: 'English' },
  ], [])

  const value = useMemo(() => ({
    locale, setLocale, t, availableLocales,
  }), [locale, setLocale, t, availableLocales])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

/**
 * Hook para usar traducciones en componentes.
 * @example
 * const { t, locale, setLocale } = useI18n()
 * <button>{t('common.save')}</button>
 */
export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
