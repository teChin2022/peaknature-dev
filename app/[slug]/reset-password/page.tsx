import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

interface ResetPasswordPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ success?: string; error?: string }>
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

export default async function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  const { slug } = await params
  const { success, error } = await searchParams
  const tenant = await getTenant(slug)
  
  if (!tenant) {
    notFound()
  }

  // Check if user has a valid session (from recovery token)
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // If no session and not showing success, redirect to forgot password
  if (!session && !success) {
    redirect(`/${slug}/forgot-password`)
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
            {success ? 'Password Updated' : 'Set New Password'}
          </h1>
          <p className="text-stone-600 mt-2">
            {success 
              ? "Your password has been successfully updated"
              : "Enter your new password below"
            }
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Error</strong> — {decodeURIComponent(error)}
          </div>
        )}

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
                All done!
              </h2>
              <p className="text-stone-600 text-sm mb-6">
                Your password has been reset successfully. 
                You can now sign in with your new password.
              </p>
              <Link
                href={`/${tenant.slug}/login`}
                className="inline-flex items-center justify-center w-full h-11 rounded-lg text-white font-medium"
                style={{ backgroundColor: tenant.primary_color }}
              >
                Sign in to your account
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
              <ResetPasswordForm tenant={tenant} />
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

