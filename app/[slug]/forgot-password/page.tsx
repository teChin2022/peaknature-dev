import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

interface ForgotPasswordPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ success?: string }>
}

async function getTenant(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  
  return data
}

export default async function ForgotPasswordPage({ params, searchParams }: ForgotPasswordPageProps) {
  const { slug } = await params
  const { success } = await searchParams
  const tenant = await getTenant(slug)
  
  if (!tenant) {
    notFound()
  }

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex h-14 w-14 items-center justify-center rounded-xl text-white font-bold text-2xl mb-4"
            style={{ backgroundColor: tenant.primary_color }}
          >
            {tenant.name.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold text-stone-900">
            Reset your password
          </h1>
          <p className="text-stone-600 mt-2">
            {success 
              ? "Check your email for a reset link"
              : "Enter your email and we'll send you a link to reset your password"
            }
          </p>
        </div>

        {/* Success State */}
        {success ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
            <div className="text-center">
              <div 
                className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4"
                style={{ backgroundColor: `${tenant.primary_color}15` }}
              >
                <CheckCircle2 
                  className="h-8 w-8" 
                  style={{ color: tenant.primary_color }}
                />
              </div>
              <h2 className="text-lg font-semibold text-stone-900 mb-2">
                Check your inbox
              </h2>
              <p className="text-stone-600 text-sm mb-6">
                We've sent a password reset link to your email address. 
                Click the link in the email to reset your password.
              </p>
              <p className="text-stone-500 text-xs mb-6">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <Link
                href={`/${tenant.slug}/login`}
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                style={{ color: tenant.primary_color }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
              <ForgotPasswordForm tenant={tenant} />
            </div>

            {/* Back to Login Link */}
            <p className="text-center mt-6 text-stone-600">
              <Link 
                href={`/${tenant.slug}/login`}
                className="inline-flex items-center gap-2 font-medium hover:underline"
                style={{ color: tenant.primary_color }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

