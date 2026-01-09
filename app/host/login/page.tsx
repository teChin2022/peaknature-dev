'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, Lock, Eye, EyeOff, Building2, CheckCircle2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { logSecurityEvent, AuditActions } from '@/lib/audit'
import { getAppBaseUrl } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

function HostLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showResendForm, setShowResendForm] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  // Handle URL parameters (error/message from callbacks)
  useEffect(() => {
    const errorParam = searchParams.get('error')
    const messageParam = searchParams.get('message')
    const showResend = searchParams.get('showResend')
    
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
    if (messageParam) {
      setSuccessMessage(decodeURIComponent(messageParam))
    }
    if (showResend === 'true') {
      setShowResendForm(true)
    }
  }, [searchParams])

  // Resend verification email
  const handleResendVerification = async () => {
    if (!resendEmail) {
      setError('Please enter your email address')
      return
    }

    setIsResending(true)
    setError(null)

    try {
      const baseUrl = getAppBaseUrl()
      const redirectUrl = `${baseUrl}/host/auth/callback`

      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      })

      if (resendError) {
        setError(resendError.message)
      } else {
        setResendSuccess(true)
        setShowResendForm(false)
      }
    } catch {
      setError('Failed to resend verification email. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, tenant_id')
          .eq('id', user.id)
          .single()
        
        if (profile?.role === 'host' && profile?.tenant_id) {
          // Get tenant slug and redirect to dashboard
          const { data: tenant } = await supabase
            .from('tenants')
            .select('slug, is_active')
            .eq('id', profile.tenant_id)
            .single()
          
          if (tenant?.is_active) {
            router.push(`/${tenant.slug}/dashboard`)
          }
        } else if (profile?.role === 'super_admin') {
          // Redirect super admin to admin login
          router.push('/admin/login')
        }
      }
    }
    checkAuth()
  }, [supabase, router])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Helper function to add timeout to promises (prevents infinite hanging)
  const withTimeout = <T,>(promise: Promise<T>, ms: number, operation: string): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    )
    return Promise.race([promise, timeout])
  }

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('[Host Login] Starting sign in...')
      
      const { data: authData, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        }),
        15000,
        'Sign in'
      )

      if (signInError) {
        logSecurityEvent(AuditActions.LOGIN_FAILED, 'warning', {
          email: data.email,
          error: signInError.message,
          context: 'host_login'
        })
        setError(signInError.message)
        return
      }

      if (authData.user) {
        console.log('[Host Login] Sign in successful, verifying session...')
        
        // CRITICAL FIX: Verify session is fully established before RLS-protected queries
        // This prevents race conditions where auth.uid() returns NULL in RLS policies
        const { data: sessionData, error: sessionError } = await withTimeout(
          supabase.auth.getUser(),
          10000,
          'Session verification'
        )

        if (sessionError || !sessionData.user) {
          console.error('[Host Login] Session verification failed:', sessionError)
          await supabase.auth.signOut()
          setError('Login succeeded but session could not be verified. Please try again.')
          return
        }

        console.log('[Host Login] Session verified, fetching profile...')

        // Check user role with timeout protection
        const { data: profile, error: profileError } = await withTimeout(
          supabase
            .from('profiles')
            .select('role, tenant_id')
            .eq('id', authData.user.id)
            .single(),
          10000,
          'Profile fetch'
        )

        console.log('[Host Login] Profile result:', { profile, error: profileError?.message })

        // Handle profile not found
        if (profileError || !profile) {
          console.error('[Host Login] Profile not found:', profileError)
          await supabase.auth.signOut()
          setError('Profile not found. Your registration may not have completed properly. Please try registering again.')
          return
        }

        if (profile.role === 'super_admin') {
          await supabase.auth.signOut()
          setError('Super admins should use the admin portal.')
          return
        }

        if (profile.role !== 'host') {
          logSecurityEvent(AuditActions.UNAUTHORIZED_ACCESS, 'warning', {
            email: data.email,
            attemptedRole: 'host',
            actualRole: profile.role,
            context: 'host_login'
          })
          
          await supabase.auth.signOut()
          
          if (profile.role === 'guest') {
            setError('Your host profile was not set up correctly during registration. Please contact support or try registering again with a different email.')
          } else {
            setError('This login is for property hosts only. Guests should login at the property page.')
          }
          return
        }

        // Check email verification
        if (!authData.user.email_confirmed_at) {
          await supabase.auth.signOut()
          setError('Please verify your email address first. Check your inbox for the verification link.')
          return
        }

        // Check if tenant_id is set
        if (!profile.tenant_id) {
          await supabase.auth.signOut()
          setError('Your property is not linked to your account. Please contact support.')
          return
        }

        console.log('[Host Login] Fetching tenant...')

        // Get tenant and check status with timeout protection
        const { data: tenant, error: tenantError } = await withTimeout(
          supabase
            .from('tenants')
            .select('slug, is_active')
            .eq('id', profile.tenant_id)
            .single(),
          10000,
          'Tenant fetch'
        )

        console.log('[Host Login] Tenant result:', { tenant, error: tenantError?.message })

        if (tenantError || !tenant) {
          console.error('[Host Login] Tenant not found:', tenantError)
          await supabase.auth.signOut()
          setError('Property not found. Please contact support.')
          return
        }

        if (!tenant.is_active) {
          await supabase.auth.signOut()
          setError('Your property is pending approval. You will receive an email once approved.')
          return
        }

        console.log('[Host Login] Success! Redirecting to dashboard...')

        // Navigate to dashboard
        setIsLoading(false)
        router.push(`/${tenant.slug}/dashboard`)
        router.refresh()
        return
      }
    } catch (err) {
      console.error('[Host Login] Unexpected error:', err)
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      
      // Handle timeout errors specifically
      if (errorMessage.includes('timed out')) {
        setError('The server is taking too long to respond. Please check your connection and try again.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4">
            <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            Host Portal
          </h1>
          <p className="text-sm sm:text-base text-stone-600 mt-2">
            Sign in to manage your property
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xl p-6 sm:p-8">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              {successMessage}
            </div>
          )}

          {/* Resend Success Message */}
          {resendSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Verification email sent! Please check your inbox and spam folder.
            </div>
          )}

          {/* Resend Verification Form */}
          {showResendForm && !resendSuccess && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Resend Verification Email
              </h3>
              <p className="text-amber-700 text-sm mb-3">
                Enter your email to receive a new verification link.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
                {!showResendForm && error.includes('verify') && (
                  <button
                    type="button"
                    onClick={() => setShowResendForm(true)}
                    className="block mt-2 text-emerald-600 hover:text-emerald-700 font-medium underline"
                  >
                    Resend verification email
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-stone-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10 border-stone-300 text-sm sm:text-base"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-stone-700">Password</Label>
                <Link 
                  href="/host/forgot-password" 
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10 border-stone-300 text-sm sm:text-base"
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
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm sm:text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-600">
              Don&apos;t have an account?{' '}
              <Link href="/host/register" className="text-emerald-600 hover:text-emerald-700 font-medium">
                Register your property
              </Link>
            </p>
          </div>
        </div>

        {/* Back Link */}
        <p className="text-center mt-6 text-sm text-stone-500">
          <Link href="/" className="hover:text-stone-700 transition-colors">
            ← Back to homepage
          </Link>
        </p>
      </div>
    </div>
  )
}

// Loading fallback for Suspense
function LoginLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4">
            <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            Host Portal
          </h1>
          <p className="text-sm sm:text-base text-stone-600 mt-2">
            Loading...
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xl p-6 sm:p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </div>
    </div>
  )
}

export default function HostLoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <HostLoginContent />
    </Suspense>
  )
}
