import { format as dateFnsFormat } from 'date-fns'
import { th, enUS } from 'date-fns/locale'
import { Locale } from './i18n-config'

// Map locale strings to date-fns locale objects
const dateLocales = {
  th: th,
  en: enUS,
}

/**
 * Format a date with locale support
 * @param date - The date to format
 * @param formatStr - The date-fns format string
 * @param locale - The locale code ('th' or 'en')
 * @returns Formatted date string
 */
export function formatDate(date: Date, formatStr: string, locale: Locale = 'th'): string {
  return dateFnsFormat(date, formatStr, {
    locale: dateLocales[locale] || dateLocales.th,
  })
}

/**
 * Format a date range for display
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param locale - The locale code
 * @returns Formatted date range string
 */
export function formatDateRange(checkIn: Date, checkOut: Date, locale: Locale = 'th'): string {
  const dateLocale = dateLocales[locale] || dateLocales.th
  
  // If same month, show: "Jan 9 – 10, 2026"
  // If different months, show: "Jan 9 – Feb 10, 2026"
  const sameMonth = checkIn.getMonth() === checkOut.getMonth() && checkIn.getFullYear() === checkOut.getFullYear()
  
  if (sameMonth) {
    return `${dateFnsFormat(checkIn, 'MMM d', { locale: dateLocale })} – ${dateFnsFormat(checkOut, 'd, yyyy', { locale: dateLocale })}`
  }
  
  return `${dateFnsFormat(checkIn, 'MMM d', { locale: dateLocale })} – ${dateFnsFormat(checkOut, 'MMM d, yyyy', { locale: dateLocale })}`
}

