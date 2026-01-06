'use client'

import Link from 'next/link'
import { MapPin, Phone, Mail } from 'lucide-react'
import { Tenant, TenantSettings } from '@/types/database'
import { useTranslations } from 'next-intl'

interface TenantFooterProps {
  tenant: Tenant
  settings: TenantSettings
}

export function TenantFooter({ tenant, settings }: TenantFooterProps) {
  const t = useTranslations('footer')
  const tNav = useTranslations('nav')

  // Build full address
  const addressParts = [
    settings.contact.address,
    settings.contact.city,
    settings.contact.postal_code,
    settings.contact.country
  ].filter(Boolean)
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null

  // Check if any social links exist (only Facebook and LINE are displayed)
  const hasSocialLinks = settings.social.facebook || settings.social.line

  return (
    <footer className="bg-stone-900 text-stone-300">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 md:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:gap-10 md:gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div 
                className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-white font-bold text-base sm:text-lg"
                style={{ backgroundColor: tenant.primary_color }}
              >
                {tenant.name.charAt(0)}
              </div>
              <span className="text-lg sm:text-xl font-semibold text-white">
                {tenant.name}
              </span>
            </div>
            <p className="text-sm sm:text-base text-stone-400 max-w-md leading-relaxed">
              {settings.hero.description || 
                'Experience the warmth of home away from home. We offer comfortable accommodations with authentic local hospitality for travelers seeking memorable stays.'}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider mb-3 sm:mb-4">
              {t('quickLinks')}
            </h3>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <Link 
                  href={`/${tenant.slug}/rooms`} 
                  className="text-sm sm:text-base text-stone-400 hover:text-white transition-colors"
                >
                  {tNav('rooms')}
                </Link>
              </li>
              <li>
                <Link 
                  href={`/${tenant.slug}#amenities`} 
                  className="text-sm sm:text-base text-stone-400 hover:text-white transition-colors"
                >
                  {tNav('amenities')}
                </Link>
              </li>
              <li>
                <Link 
                  href={`/${tenant.slug}#location`} 
                  className="text-sm sm:text-base text-stone-400 hover:text-white transition-colors"
                >
                  {tNav('location')}
                </Link>
              </li>
              <li>
                <Link 
                  href={`/${tenant.slug}/my-bookings`} 
                  className="text-sm sm:text-base text-stone-400 hover:text-white transition-colors"
                >
                  {tNav('myBookings')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div id="contact">
            <h3 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider mb-3 sm:mb-4">
              {t('contact')}
            </h3>
            <ul className="space-y-2 sm:space-y-3">
              {/* Address */}
              {fullAddress ? (
                <li className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base text-stone-400">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5" style={{ color: tenant.primary_color }} />
                  <span>{fullAddress}</span>
                </li>
              ) : (
                <li className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-stone-400">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" style={{ color: tenant.primary_color }} />
                  <span className="italic text-stone-500">-</span>
                </li>
              )}

              {/* Phone */}
              {settings.contact.phone ? (
                <li>
                  <a 
                    href={`tel:${settings.contact.phone}`}
                    className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-stone-400 hover:text-white transition-colors"
                  >
                    <Phone className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" style={{ color: tenant.primary_color }} />
                    <span>{settings.contact.phone}</span>
                  </a>
                </li>
              ) : (
                <li className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-stone-400">
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" style={{ color: tenant.primary_color }} />
                  <span className="italic text-stone-500">-</span>
                </li>
              )}

              {/* Email */}
              {settings.contact.email ? (
                <li>
                  <a 
                    href={`mailto:${settings.contact.email}`}
                    className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-stone-400 hover:text-white transition-colors"
                  >
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" style={{ color: tenant.primary_color }} />
                    <span>{settings.contact.email}</span>
                  </a>
                </li>
              ) : (
                <li className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-stone-400">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" style={{ color: tenant.primary_color }} />
                  <span className="italic text-stone-500">-</span>
                </li>
              )}
            </ul>

            {/* Social Links - Only Facebook and LINE with branded icons */}
            {(settings.social.facebook || settings.social.line) && (
              <div className="flex gap-4 mt-4 sm:mt-6">
                {settings.social.facebook && (
                  <a 
                    href={settings.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    aria-label="Facebook"
                  >
                    {/* Facebook Official Logo */}
                    <svg className="h-8 w-8" viewBox="0 0 36 36" fill="none">
                      <circle cx="18" cy="18" r="18" fill="#1877F2"/>
                      <path d="M25 18.0001C25 14.1341 21.866 11.0001 18 11.0001C14.134 11.0001 11 14.1341 11 18.0001C11 21.4951 13.5505 24.3895 16.9062 24.9041V20.1251H14.9688V18.0001H16.9062V16.3876C16.9062 14.4716 18.0334 13.4376 19.7878 13.4376C20.6291 13.4376 21.5078 13.5876 21.5078 13.5876V15.4688H20.5402C19.5857 15.4688 19.2969 16.0605 19.2969 16.6667V18.0001H21.418L21.0865 20.1251H19.2969V24.9041C22.6495 24.3895 25 21.4951 25 18.0001Z" fill="white"/>
                    </svg>
                  </a>
                )}
                {settings.social.line && (
                  <a 
                    href={`https://line.me/ti/p/${settings.social.line.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    aria-label="LINE"
                  >
                    {/* LINE Official Logo */}
                    <svg className="h-8 w-8" viewBox="0 0 36 36" fill="none">
                      <circle cx="18" cy="18" r="18" fill="#06C755"/>
                      <path d="M27 17.0477C27 13.0154 22.9706 9.72727 18 9.72727C13.0294 9.72727 9 13.0154 9 17.0477C9 20.6695 12.2088 23.7045 16.5441 24.2727C16.8529 24.3409 17.2721 24.4841 17.3824 24.7568C17.4816 25.0045 17.4485 25.3909 17.4154 25.6432L17.2941 26.4341C17.25 26.7205 17.0735 27.5864 18 27.1909C18.9265 26.7955 23.0956 24.1977 24.9044 22.0636C26.1176 20.7068 27 19.0023 27 17.0477ZM14.1176 19.5409H12.4338C12.1875 19.5409 11.9853 19.3386 11.9853 19.0909V15.2864C11.9853 15.0386 12.1875 14.8364 12.4338 14.8364C12.6801 14.8364 12.8824 15.0386 12.8824 15.2864V18.6409H14.1176C14.3639 18.6409 14.5662 18.8432 14.5662 19.0909C14.5662 19.3386 14.3639 19.5409 14.1176 19.5409ZM15.8015 19.0909C15.8015 19.3386 15.5992 19.5409 15.3529 19.5409C15.1066 19.5409 14.9044 19.3386 14.9044 19.0909V15.2864C14.9044 15.0386 15.1066 14.8364 15.3529 14.8364C15.5992 14.8364 15.8015 15.0386 15.8015 15.2864V19.0909ZM20.1066 19.0909C20.1066 19.2886 19.9779 19.4614 19.7941 19.5205C19.7463 19.5341 19.6949 19.5409 19.6471 19.5409C19.4743 19.5409 19.3125 19.4545 19.2169 19.3091L17.4375 16.7045V19.0909C17.4375 19.3386 17.2353 19.5409 16.9889 19.5409C16.7426 19.5409 16.5404 19.3386 16.5404 19.0909V15.2864C16.5404 15.0886 16.6691 14.9159 16.8529 14.8568C16.9007 14.8432 16.9522 14.8364 17 14.8364C17.1728 14.8364 17.3346 14.9227 17.4301 15.0682L19.2096 17.6727V15.2864C19.2096 15.0386 19.4118 14.8364 19.6581 14.8364C19.9044 14.8364 20.1066 15.0386 20.1066 15.2864V19.0909ZM23.5662 16.1818C23.8125 16.1818 24.0147 16.3841 24.0147 16.6318C24.0147 16.8795 23.8125 17.0818 23.5662 17.0818H22.331V17.9864H23.5662C23.8125 17.9864 24.0147 18.1886 24.0147 18.4364C24.0147 18.6841 23.8125 18.8864 23.5662 18.8864H21.8824C21.6361 18.8864 21.4338 18.6841 21.4338 18.4364V15.2864C21.4338 15.0386 21.6361 14.8364 21.8824 14.8364H23.5662C23.8125 14.8364 24.0147 15.0386 24.0147 15.2864C24.0147 15.5341 23.8125 15.7364 23.5662 15.7364H22.331V16.1818H23.5662Z" fill="white"/>
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-8 border-t border-stone-800 flex flex-col items-center gap-3 sm:gap-4 md:flex-row md:justify-between">
          <p className="text-stone-500 text-xs sm:text-sm text-center md:text-left">
            © {new Date().getFullYear()} {tenant.name}. {t('allRightsReserved')}.
          </p>
          <div className="flex gap-4 sm:gap-6">
            <Link 
              href={`/${tenant.slug}/privacy`}
              className="text-xs sm:text-sm text-stone-500 hover:text-white transition-colors"
            >
              {t('privacy')}
            </Link>
            <Link 
              href={`/${tenant.slug}/terms`}
              className="text-xs sm:text-sm text-stone-500 hover:text-white transition-colors"
            >
              {t('terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
