import Link from 'next/link'
import { ArrowRight, Home, Calendar, Shield, CreditCard, Globe, Sparkles, Check, Star, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { getCurrencySymbol } from '@/lib/currency'
import { CurrencyCode } from '@/types/database'
import { getLocaleFromCookies, getTranslations } from '@/lib/i18n-server'
import { LanguageSwitcher } from '@/components/landing/language-switcher'
import { FooterCookieSettings } from '@/components/landing/footer-cookie-settings'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'

interface LandingStats {
  propertiesCount: number
  bookingsCount: number
  usersCount: number
}

interface PlatformConfig {
  platformName: string
  currency: CurrencyCode
  proPlanPrice: number
}

async function getLandingData(): Promise<{ stats: LandingStats; config: PlatformConfig }> {
  const supabase = await createClient()

  try {
    // Fetch platform settings
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('platform_name, default_currency')
      .limit(1)

    // Fetch real stats
    const [tenantsResult, bookingsResult, usersResult] = await Promise.all([
      supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'guest'),
    ])

    return {
      stats: {
        propertiesCount: tenantsResult.count || 0,
        bookingsCount: bookingsResult.count || 0,
        usersCount: usersResult.count || 0,
      },
      config: {
        platformName: settings?.[0]?.platform_name || 'Homestay',
        currency: (settings?.[0]?.default_currency as CurrencyCode) || 'THB',
        proPlanPrice: 699, // THB price
      },
    }
  } catch {
    return {
      stats: {
        propertiesCount: 0,
        bookingsCount: 0,
        usersCount: 0,
      },
      config: {
        platformName: 'Homestay',
        currency: 'THB',
        proPlanPrice: 699,
      },
    }
  }
}

function formatStatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}K+`
  }
  return num > 0 ? `${num}+` : '0'
}

interface HomePageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { error } = await searchParams
  const { stats, config } = await getLandingData()
  const currencySymbol = getCurrencySymbol(config.currency)
  const locale = await getLocaleFromCookies()
  const messages = await getTranslations(locale)
  const t = messages.landingPage

  // Features data with translations
  const features = [
    {
      icon: Globe,
      title: t.features.customBrandedWebsite,
      description: t.features.customBrandedWebsiteDesc,
    },
    {
      icon: Calendar,
      title: t.features.smartBookingSystem,
      description: t.features.smartBookingSystemDesc,
    },
    {
      icon: CreditCard,
      title: t.features.securePayments,
      description: t.features.securePaymentsDesc,
    },
    {
      icon: Users,
      title: t.features.guestManagement,
      description: t.features.guestManagementDesc,
    },
    {
      icon: Home,
      title: t.features.multiRoomSupport,
      description: t.features.multiRoomSupportDesc,
    },
    {
      icon: Sparkles,
      title: t.features.beautifulMobile,
      description: t.features.beautifulMobileDesc,
    },
  ]

  // Pricing features with translations
  const pricingFeatures = [
    t.pricing.unlimitedRooms,
    t.pricing.onlinePayments,
    t.pricing.customBranding,
    t.pricing.advancedAnalytics,
    t.pricing.prioritySupport,
    t.pricing.apiAccess,
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight">
              <span className="text-blue-600">Peak</span>
              <span className="text-emerald-500">nature</span>
              <span className="text-slate-400 font-normal">.com</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher currentLocale={locale} />
            <Link href="/host/login">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 text-sm font-medium hidden sm:inline-flex">
                {t.nav.hostLogin}
              </Button>
            </Link>
            <Link href="/host/register">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30">
                <span className="hidden sm:inline">{t.nav.getStartedFree}</span>
                <span className="sm:hidden">{t.hero.startFreeTrial}</span>
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Error Banner */}
      {error === 'tenant_inactive' && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-red-50 border-b border-red-200 py-3 px-4">
          <div className="mx-auto max-w-7xl flex items-center justify-center gap-2 text-red-700 text-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              <strong>{messages.errors.propertyUnavailable}:</strong>{' '}
              {messages.errors.propertyUnavailableDesc}
            </span>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4 sm:pt-32 sm:pb-20 md:pt-40 md:pb-28 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-br from-blue-50 via-indigo-50 to-white rounded-full blur-3xl opacity-70" />
          <div className="absolute top-20 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-100/30 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium mb-8">
              <Sparkles className="h-4 w-4" />
              {stats.propertiesCount > 0 
                ? t.hero.badge.replace('{count}', formatStatNumber(stats.propertiesCount))
                : t.hero.badgeDefault
              }
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]">
              {t.hero.headline1}
              <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {t.hero.headline2}
              </span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t.hero.subheadline}
            </p>
            
            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/host/register">
                <Button 
                  size="lg" 
                  className="h-14 px-8 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30"
                >
                  {t.hero.startFreeTrial}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#features">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-14 px-8 text-base font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  {t.hero.seeHowItWorks}
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{t.hero.noCreditCard}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{t.hero.twoMonthsFree}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{t.hero.cancelAnytime}</span>
              </div>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-16 sm:mt-20 relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 blur-3xl rounded-3xl" />
            <div className="relative bg-white rounded-2xl shadow-2xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
              {/* Browser Chrome */}
              <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 border-b border-slate-100">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-slate-200" />
                  <div className="h-3 w-3 rounded-full bg-slate-200" />
                  <div className="h-3 w-3 rounded-full bg-slate-200" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-white rounded-lg px-4 py-1.5 text-sm text-slate-400 border border-slate-200 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                    peaknature.com/your-property
                  </div>
                </div>
              </div>
              {/* Preview Content */}
              <div className="aspect-[16/9] bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="h-20 w-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
                    <Home className="h-10 w-10 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">{t.hero.dashboardTitle}</h3>
                  <p className="text-slate-500">{t.hero.dashboardSubtitle}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 border-y border-slate-100 bg-slate-50/50">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">
                {formatStatNumber(stats.propertiesCount)}
              </div>
              <div className="text-sm text-slate-600">{t.stats.propertiesListed}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">
                {formatStatNumber(stats.bookingsCount)}
              </div>
              <div className="text-sm text-slate-600">{t.stats.bookingsProcessed}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">
                {formatStatNumber(stats.usersCount)}
              </div>
              <div className="text-sm text-slate-600">{t.stats.happyGuests}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">24/7</div>
              <div className="text-sm text-slate-600">{t.stats.supportAvailable}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-4">
              <Zap className="h-4 w-4" />
              {t.features.badge}
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t.features.title}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {t.features.subtitle}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="group border-slate-200 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
                <CardContent className="p-6 md:p-8">
                  <div className="h-12 w-12 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center mb-5 transition-colors">
                    <feature.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:py-24 md:py-32 bg-slate-50">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-4">
              <Star className="h-4 w-4" />
              {t.pricing.badge}
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t.pricing.title}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {t.pricing.subtitle}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Trial Plan */}
            <Card className="border-emerald-200 bg-white relative overflow-hidden shadow-xl shadow-emerald-500/10">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="absolute -top-0 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold px-4 py-1.5 rounded-b-lg">
                  {t.pricing.freeTrialBadge}
                </div>
              </div>
              <CardContent className="p-8 pt-10">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{t.pricing.freeTrialTitle}</h3>
                  <p className="text-slate-600 text-sm">{t.pricing.freeTrialSubtitle}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">{currencySymbol}0</span>
                  <span className="text-slate-500 ml-1">{t.pricing.perTwoMonths}</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {pricingFeatures.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-slate-600">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-emerald-600" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/host/register">
                  <Button className="w-full h-12 text-base font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25">
                    {t.pricing.startFreeTrial}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-blue-200 bg-white relative overflow-hidden shadow-xl shadow-blue-500/10">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
              <div className="absolute -top-0 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold px-4 py-1.5 rounded-b-lg">
                  {t.pricing.afterTrialBadge}
                </div>
              </div>
              <CardContent className="p-8 pt-10">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{t.pricing.proTitle}</h3>
                  <p className="text-slate-600 text-sm">{t.pricing.proSubtitle}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">{currencySymbol}{config.proPlanPrice}</span>
                  <span className="text-slate-500 ml-1">{t.pricing.perMonth}</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {pricingFeatures.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-slate-600">
                      <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-blue-600" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/host/register">
                  <Button variant="outline" className="w-full h-12 text-base font-medium border-blue-200 text-blue-600 hover:bg-blue-50">
                    {t.pricing.subscribeAfterTrial}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:py-24 md:py-32 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="mx-auto max-w-4xl text-center relative">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
            {t.cta.title}
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            {stats.propertiesCount > 0 
              ? t.cta.subtitle.replace('{count}', formatStatNumber(stats.propertiesCount))
              : t.cta.subtitleDefault
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/host/register">
              <Button size="lg" className="h-14 px-10 text-base font-semibold bg-white text-blue-600 hover:bg-blue-50 shadow-xl">
                {t.cta.button}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <p className="text-blue-200 text-sm mt-6">
            {t.cta.footer}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 md:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold tracking-tight">
                <span className="text-blue-400">Peak</span>
                <span className="text-emerald-400">nature</span>
                <span className="text-slate-500 font-normal">.com</span>
              </span>
            </Link>
            <div className="flex flex-wrap justify-center gap-6 sm:gap-8 text-sm">
              <Link href="#features" className="hover:text-white transition-colors">{t.footer.features}</Link>
              <Link href="#pricing" className="hover:text-white transition-colors">{t.footer.pricing}</Link>
              <Link href="/host/login" className="hover:text-white transition-colors">{t.footer.hostLogin}</Link>
              <Link href="/host/register" className="hover:text-white transition-colors">{t.footer.getStarted}</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">{t.footer.privacy}</Link>
              <Link href="/terms" className="hover:text-white transition-colors">{t.footer.terms}</Link>
              <FooterCookieSettings />
            </div>
            <p className="text-sm text-center">© {new Date().getFullYear()} Peaknature. {t.footer.allRightsReserved}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
