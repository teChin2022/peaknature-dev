'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { IntlProvider } from 'next-intl'
import { Locale, defaultLocale, locales } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'

// Import messages statically
import thMessages from '@/messages/th.json'
import enMessages from '@/messages/en.json'

const messages: Record<Locale, typeof thMessages> = {
  th: thMessages,
  en: enMessages
}

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const LOCALE_STORAGE_KEY = 'homestay-locale'
const LOCALE_COOKIE_KEY = 'locale'

// Helper to set cookie with proper attributes for production
function setLocaleCookie(locale: Locale) {
  // Only add Secure flag on HTTPS (production), not on localhost HTTP
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const secureFlag = isSecure ? ';Secure' : ''
  document.cookie = `${LOCALE_COOKIE_KEY}=${locale};path=/;max-age=31536000;SameSite=Lax${secureFlag}`
}

// Helper to get locale from cookie
function getLocaleFromCookie(): Locale | null {
  const match = document.cookie.match(new RegExp(`(^| )${LOCALE_COOKIE_KEY}=([^;]+)`))
  if (match && locales.includes(match[2] as Locale)) {
    return match[2] as Locale
  }
  return null
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  const supabase = createClient()

  // Load locale from database (for logged-in users) or localStorage/cookie (for guests)
  useEffect(() => {
    let isMounted = true
    
    async function loadLocale() {
      try {
        // First, try cookie (synced with landing page), then localStorage
        const cookieLocale = getLocaleFromCookie()
        const savedLocale = cookieLocale || (localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null)
        if (savedLocale && locales.includes(savedLocale)) {
          if (isMounted) {
            setLocaleState(savedLocale)
            document.documentElement.lang = savedLocale
            // Sync cookie if it was from localStorage
            if (!cookieLocale) {
              setLocaleCookie(savedLocale)
            }
          }
        }
        
        // Then check if user is logged in and load from database
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) {
          console.warn('Auth error loading user:', authError.message)
          // Continue with localStorage preference
          if (isMounted) setIsLoaded(true)
          return
        }
        
        if (user && isMounted) {
          setUserId(user.id)
          
          // Load locale from database
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('locale')
            .eq('id', user.id)
            .single()
          
          if (profileError) {
            console.warn('Error loading profile locale:', profileError.message)
            // Continue with localStorage preference
            if (isMounted) setIsLoaded(true)
            return
          }
          
          if (profile?.locale && locales.includes(profile.locale as Locale) && isMounted) {
            setLocaleState(profile.locale as Locale)
            localStorage.setItem(LOCALE_STORAGE_KEY, profile.locale)
            setLocaleCookie(profile.locale as Locale)
            document.documentElement.lang = profile.locale
          }
        }
      } catch (error) {
        console.error('Error loading locale:', error)
      } finally {
        if (isMounted) setIsLoaded(true)
      }
    }

    loadLocale()
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id)
        
        try {
          // Load locale from database when user signs in
          const { data: profile } = await supabase
            .from('profiles')
            .select('locale')
            .eq('id', session.user.id)
            .single()
          
          if (profile?.locale && locales.includes(profile.locale as Locale) && isMounted) {
            setLocaleState(profile.locale as Locale)
            localStorage.setItem(LOCALE_STORAGE_KEY, profile.locale)
            setLocaleCookie(profile.locale as Locale)
            document.documentElement.lang = profile.locale
          }
        } catch (error) {
          console.warn('Error loading locale on sign in:', error)
        }
      } else if (event === 'SIGNED_OUT') {
        setUserId(null)
        // Keep the current locale in localStorage for guests
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const setLocale = useCallback(async (newLocale: Locale) => {
    setIsLoading(true)
    setLocaleState(newLocale)
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
    setLocaleCookie(newLocale) // Sync with cookie for landing page
    document.documentElement.lang = newLocale

    // If user is logged in, save to database
    if (userId) {
      try {
        await supabase
          .from('profiles')
          .update({ locale: newLocale })
          .eq('id', userId)
      } catch (error) {
        console.error('Error saving locale to database:', error)
      }
    }
    
    setIsLoading(false)
  }, [userId, supabase])

  // Show loading state briefly while loading locale
  // Using default locale if loading takes too long to prevent white screen
  if (!isLoaded) {
    // Return children with default locale to prevent white screen
    return (
      <LanguageContext.Provider value={{ locale: defaultLocale, setLocale: () => {}, isLoading: true }}>
        <IntlProvider 
          locale={defaultLocale} 
          messages={messages[defaultLocale]}
          timeZone="Asia/Bangkok"
        >
          {children}
        </IntlProvider>
      </LanguageContext.Provider>
    )
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, isLoading }}>
      <IntlProvider 
        locale={locale} 
        messages={messages[locale]}
        timeZone="Asia/Bangkok"
      >
        {children}
      </IntlProvider>
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    // Return safe defaults when used outside of LanguageProvider
    // This can happen during SSR or in edge cases
    return {
      locale: defaultLocale,
      setLocale: () => {},
      isLoading: false,
    }
  }
  return context
}
