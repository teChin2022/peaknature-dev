'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Tenant } from '@/types/database'
import { OAuthButtons } from './oauth-buttons'
import { useTranslations } from 'next-intl'
import { logSecurityEvent, AuditActions } from '@/lib/audit'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  tenant: Tenant
  redirectTo?: string
}

export function LoginForm({ tenant, redirectTo }: LoginFormProps) {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (signInError) {
        // Log failed login attempt
        logSecurityEvent(AuditActions.LOGIN_FAILED, 'warning', {
          email: data.email,
          error: signInError.message,
          tenantId: tenant.id,
          context: 'guest_login'
        })
        setError(signInError.message)
        return
      }

      if (authData.user) {
        // Check user role and profile completion
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, tenant_id, phone, province')
          .eq('id', authData.user.id)
          .single()

        // Profile not found - account may have been deleted
        if (profileError?.code === 'PGRST116' || !profile) {
          await supabase.auth.signOut()
          setError(tErrors('accountNotFound'))
          return
        }

        if (profile.role === 'super_admin') {
          // Super admins should use admin login
          await supabase.auth.signOut()
          setError(tErrors('superAdminUseAdminPortal'))
          return
        }

        if (profile.role === 'host') {
          // Hosts should use host portal
          await supabase.auth.signOut()
          setError(tErrors('hostUseHostPortal'))
          return
        }

        // Check if profile needs completion (phone and province required)
        const needsProfileCompletion = !profile.phone || !profile.province
        
        if (needsProfileCompletion) {
          // Redirect to complete profile first
          const nextUrl = redirectTo || `/${tenant.slug}`
          window.location.href = `/${tenant.slug}/complete-profile?next=${encodeURIComponent(nextUrl)}`
          return
        }

        // Profile complete, redirect to destination
        // Use window.location for full page reload to ensure server components see auth state
        window.location.href = redirectTo || `/${tenant.slug}`
      }
    } catch {
      setError(tErrors('somethingWrong'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* OAuth Buttons */}
      <OAuthButtons 
        tenantSlug={tenant.slug} 
        redirectTo={redirectTo} 
        mode="login" 
      />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-stone-500">{t('orContinueWith')}</span>
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('password')}</Label>
          <Link
            href={`/${tenant.slug}/forgot-password`}
            className="text-sm font-medium hover:underline"
            style={{ color: tenant.primary_color }}
          >
            {t('forgotPassword')}
          </Link>
        </div>
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

        <Button
          type="submit"
          className="w-full h-11 text-white"
          style={{ backgroundColor: tenant.primary_color }}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('signingIn')}
            </>
          ) : (
            t('signInWithEmail')
          )}
        </Button>
      </form>
    </div>
  )
}
