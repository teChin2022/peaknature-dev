import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()
  
  // Sign out from Supabase
  await supabase.auth.signOut()
  
  // Redirect to tenant's landing page after sign out
  const response = NextResponse.redirect(new URL(`/${slug}`, request.url))
  
  // Clear all Supabase auth cookies explicitly
  response.cookies.delete('sb-access-token')
  response.cookies.delete('sb-refresh-token')
  
  // Clear any cookies that start with 'sb-'
  const cookieNames = ['sb-access-token', 'sb-refresh-token']
  cookieNames.forEach(name => {
    response.cookies.set(name, '', {
      expires: new Date(0),
      path: '/',
    })
  })
  
  return response
}

// Support GET method as well (for direct navigation)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  return POST(request, context)
}

