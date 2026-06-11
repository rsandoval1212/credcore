/**
 * Selector de idioma compacto para el header/sidebar.
 */
import { useI18n, type Locale } from '@/i18n'

export default function LanguageSelector() {
  const { locale, setLocale, availableLocales } = useI18n()

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="bg-transparent text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-600 dark:text-gray-300 cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      title="Idioma / Language"
    >
      {availableLocales.map((l) => (
        <option key={l.code} value={l.code}>
          {l.code === 'es' ? '🇩🇴 ES' : '🇺🇸 EN'}
        </option>
      ))}
    </select>
  )
}
