'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, Lock, Eye, EyeOff, User, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Tenant } from '@/types/database'
import { OAuthButtons } from './oauth-buttons'
import { useTranslations } from 'next-intl'
import { getAppBaseUrl } from '@/lib/utils'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Phone number is required (min 10 digits)'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

interface RegisterFormProps {
  tenant: Tenant
  redirectTo?: string
}

export function RegisterForm({ tenant, redirectTo }: RegisterFormProps) {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      // Use NEXT_PUBLIC_APP_URL if available, otherwise fallback to window.location.origin
      const baseUrl = getAppBaseUrl()
      const redirectUrl = `${baseUrl}/${tenant.slug}/auth/callback?next=${encodeURIComponent(redirectTo || `/${tenant.slug}`)}`
      console.log('Registration redirect URL:', redirectUrl)
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone: data.phone || null,
            tenant_id: tenant.id,
          },
          emailRedirectTo: redirectUrl,
        },
      })

      console.log('SignUp response:', { 
        user: signUpData?.user?.id,
        email: signUpData?.user?.email,
        emailConfirmedAt: signUpData?.user?.email_confirmed_at,
        session: signUpData?.session ? 'SESSION EXISTS' : 'NO SESSION',
        identities: signUpData?.user?.identities,
        identitiesCount: signUpData?.user?.identities?.length ?? 'undefined',
        confirmationSentAt: signUpData?.user?.confirmation_sent_at,
        error: signUpError 
      })
      
      // Log full user object for debugging
      console.log('Full user data:', JSON.stringify(signUpData?.user, null, 2))

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // Check if user already exists (identities will be empty array)
      if (signUpData?.user?.identities?.length === 0) {
        setError('An account with this email already exists. Please login instead.')
        return
      }

      // Check if email confirmation is required
      if (signUpData?.user && !signUpData?.session) {
        // Email confirmation required - this is expected
        console.log('Email confirmation required')
        setSuccess(true)
      } else if (signUpData?.session) {
        // Auto-confirmed (email confirmation disabled in Supabase)
        console.log('User auto-confirmed, redirecting...')
        window.location.href = redirectTo || `/${tenant.slug}`
      } else {
        setSuccess(true)
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError(tErrors('somethingWrong'))
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div 
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${tenant.primary_color}15` }}
        >
          <Mail className="h-8 w-8" style={{ color: tenant.primary_color }} />
        </div>
        <h3 className="text-lg font-semibold text-stone-900 mb-2">
          {t('checkEmail')}
        </h3>
        <p className="text-stone-600">
          {t('confirmationSent')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* OAuth Buttons */}
      <OAuthButtons 
        tenantSlug={tenant.slug} 
        redirectTo={redirectTo} 
        mode="register" 
      />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-stone-500">{t('orRegisterWith')}</span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="fullName">{t('fullName')}</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            id="fullName"
            type="text"
            placeholder="John Doe"
            className="pl-10"
            {...register('fullName')}
          />
        </div>
        {errors.fullName && (
          <p className="text-sm text-red-600">{errors.fullName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="pl-10"
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">
          {t('phone')} <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            id="phone"
            type="tel"
            placeholder="+66 812 345 678"
            className="pl-10"
            {...register('phone')}
          />
        </div>
        {errors.phone && (
          <p className="text-sm text-red-500">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="pl-10 pr-10"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="pl-10"
            {...register('confirmPassword')}
          />
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
        )}
      </div>

        <Button
          type="submit"
          className="w-full h-11 text-white"
          style={{ backgroundColor: tenant.primary_color }}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('signingUp')}
            </>
          ) : (
            t('signUpWithEmail')
          )}
        </Button>
      </form>

      <p className="text-xs text-stone-500 text-center">
        {t('termsAgreement')}
      </p>
    </div>
  )
}
