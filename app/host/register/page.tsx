'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, Lock, Eye, EyeOff, User, Building2, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { getAppBaseUrl } from '@/lib/utils'

import { passwordSchema, emailSchema, fullNameSchema, slugSchema, colorSchema } from '@/lib/validations'

const registerSchema = z.object({
  // User info
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  // Property info
  propertyName: z.string().min(2, 'Property name must be at least 2 characters'),
  propertySlug: slugSchema,
  primaryColor: colorSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function HostRegisterPage() {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      primaryColor: '#10B981', // Emerald-500
    },
  })

  const primaryColor = watch('primaryColor')

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      // Check if email already exists before attempting registration
      try {
        const emailCheckResponse = await fetch('/api/user/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email }),
        })
        
        if (emailCheckResponse.ok) {
          const emailCheckData = await emailCheckResponse.json()
          if (emailCheckData.exists) {
            setError('An account with this email already exists. Please login instead.')
            setIsLoading(false)
            return
          }
        }
      } catch (emailCheckError) {
        console.error('Email check failed:', emailCheckError)
        // Continue with registration - the signUp will handle duplicate detection as fallback
      }

      // Create user account with proper email redirect
      const baseUrl = getAppBaseUrl()
      const emailRedirectUrl = `${baseUrl}/host/auth/callback`
      
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
          emailRedirectTo: emailRedirectUrl,
        },
      })

      console.log('Host SignUp response:', { 
        user: authData?.user?.id,
        email: authData?.user?.email,
        emailConfirmedAt: authData?.user?.email_confirmed_at,
        session: authData?.session ? 'SESSION EXISTS' : 'NO SESSION',
        identities: authData?.user?.identities,
        identitiesCount: authData?.user?.identities?.length ?? 'undefined',
        confirmationSentAt: authData?.user?.confirmation_sent_at,
        emailRedirectUrl,
        error: signUpError 
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // Check if user already exists (identities will be empty array)
      if (authData?.user?.identities?.length === 0) {
        setError('An account with this email already exists. Please login instead.')
        return
      }

      if (authData.user) {
        // Use API route to create tenant and set up host profile
        // This uses service role to bypass RLS restrictions
        const registerResponse = await fetch('/api/host/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authData.user.id,
            fullName: data.fullName,
            propertyName: data.propertyName,
            propertySlug: data.propertySlug,
            primaryColor: data.primaryColor,
          }),
        })

        const registerResult = await registerResponse.json()

        if (!registerResponse.ok || !registerResult.success) {
          // Registration failed - show error to user
          setError(registerResult.error || 'Failed to register property. Please try again.')
          return
        }

        setSuccess(true)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-6">
            <Building2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-4">
            Registration Successful! 🎉
          </h1>
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl p-6 text-left space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-semibold text-amber-800 mb-2">Next Steps:</h3>
              <ol className="list-decimal list-inside text-amber-700 text-sm space-y-2">
                <li><strong>Verify your email</strong> - Check your inbox and click the verification link</li>
                <li><strong>Wait for approval</strong> - Our team will review your property</li>
                <li><strong>Start managing</strong> - Once approved, you can access your dashboard</li>
              </ol>
            </div>
            <p className="text-stone-600 text-sm">
              You&apos;ll receive an email notification once your property is approved.
            </p>
          </div>
          <Link href="/host/login">
            <Button className="mt-6 bg-emerald-600 hover:bg-emerald-700">
              Go to Login
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4">
            <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            Register Your Property
          </h1>
          <p className="text-sm sm:text-base text-stone-600 mt-2">
            Join our platform and start accepting bookings
          </p>
        </div>

        {/* Register Form */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal Information
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  {...register('fullName')}
                />
                {errors.fullName && (
                  <p className="text-sm text-red-500">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
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
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-stone-200" />

            {/* Property Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Property Information
              </h3>

              <div className="space-y-2">
                <Label htmlFor="propertyName">Property Name</Label>
                <Input
                  id="propertyName"
                  placeholder="My Cozy Homestay"
                  {...register('propertyName')}
                />
                {errors.propertyName && (
                  <p className="text-sm text-red-500">{errors.propertyName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertySlug">Property URL</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-500 whitespace-nowrap">yoursite.com/</span>
                  <Input
                    id="propertySlug"
                    placeholder="my-homestay"
                    {...register('propertySlug')}
                  />
                </div>
                {errors.propertySlug && (
                  <p className="text-sm text-red-500">{errors.propertySlug.message}</p>
                )}
                <p className="text-xs text-stone-500">
                  Only lowercase letters, numbers, and hyphens allowed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryColor" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Brand Color
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="primaryColor"
                    {...register('primaryColor')}
                    className="h-10 w-14 rounded border border-stone-300 cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => register('primaryColor').onChange(e)}
                    className="font-mono w-28"
                    maxLength={7}
                  />
                  <div 
                    className="h-10 px-4 rounded flex items-center text-white text-sm font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Preview
                  </div>
                </div>
                {errors.primaryColor && (
                  <p className="text-sm text-red-500">{errors.primaryColor.message}</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating your property...
                </>
              ) : (
                'Register Property'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-600">
              Already have an account?{' '}
              <Link href="/host/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
                Sign in
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

