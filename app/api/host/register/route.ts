import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for registration
const registerSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(2),
  propertyName: z.string().min(2),
  propertySlug: z.string().regex(/^[a-z0-9-]+$/),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
})

/**
 * POST /api/host/register
 * 
 * Creates a tenant and sets up the host profile.
 * Uses admin client (service role) to bypass RLS restrictions.
 * 
 * This endpoint should only be called after a successful signUp,
 * with the user ID from the auth response.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const parseResult = registerSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid registration data', details: parseResult.error.errors },
        { status: 400 }
      )
    }
    
    const { userId, fullName, propertyName, propertySlug, primaryColor } = parseResult.data
    
    // Use admin client to verify the user exists in auth.users
    const adminClient = createAdminClient()
    
    // Verify the user actually exists and was recently created
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId)
    
    if (userError || !userData?.user) {
      console.error('User verification failed:', userError)
      return NextResponse.json(
        { success: false, error: 'User not found. Please try registering again.' },
        { status: 404 }
      )
    }
    
    // Additional security: only allow registration for users created within the last 5 minutes
    const createdAt = new Date(userData.user.created_at)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    
    if (createdAt < fiveMinutesAgo) {
      return NextResponse.json(
        { success: false, error: 'Registration window expired. Please try registering again.' },
        { status: 403 }
      )
    }
    
    // Check if slug is already taken
    const { data: existingTenant } = await adminClient
      .from('tenants')
      .select('id')
      .eq('slug', propertySlug)
      .single()
    
    if (existingTenant) {
      return NextResponse.json(
        { success: false, error: 'This property URL is already taken. Please choose another.' },
        { status: 409 }
      )
    }
    
    // Check if user already has a host profile
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', userId)
      .single()
    
    if (existingProfile?.role === 'host' && existingProfile?.tenant_id) {
      return NextResponse.json(
        { success: false, error: 'You already have a registered property.' },
        { status: 409 }
      )
    }
    
    // Create the tenant (with is_active = false, pending approval)
    const { data: tenantData, error: tenantError } = await adminClient
      .from('tenants')
      .insert({
        name: propertyName,
        slug: propertySlug,
        primary_color: primaryColor,
        plan: 'free',
        is_active: false,
      })
      .select('id')
      .single()
    
    if (tenantError || !tenantData) {
      console.error('Tenant creation error:', tenantError)
      return NextResponse.json(
        { success: false, error: 'Failed to create property. Please try again.' },
        { status: 500 }
      )
    }
    
    // Update or insert the profile as host
    // First check if profile exists (might be created by trigger)
    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({
          role: 'host',
          tenant_id: tenantData.id,
          full_name: fullName,
        })
        .eq('id', userId)
      
      if (updateError) {
        console.error('Profile update error:', updateError)
        // Rollback: delete the tenant
        await adminClient.from('tenants').delete().eq('id', tenantData.id)
        return NextResponse.json(
          { success: false, error: 'Failed to set up host profile. Please try again.' },
          { status: 500 }
        )
      }
    } else {
      // Insert new profile (trigger might not have run yet)
      const { error: insertError } = await adminClient
        .from('profiles')
        .insert({
          id: userId,
          email: userData.user.email || '',
          full_name: fullName,
          role: 'host',
          tenant_id: tenantData.id,
        })
      
      if (insertError) {
        console.error('Profile insert error:', insertError)
        // Rollback: delete the tenant
        await adminClient.from('tenants').delete().eq('id', tenantData.id)
        return NextResponse.json(
          { success: false, error: 'Failed to create host profile. Please try again.' },
          { status: 500 }
        )
      }
    }
    
    // Send LINE notification to admin (fire and forget)
    try {
      await fetch(new URL('/api/admin/notify', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_tenant',
          data: {
            tenantName: propertyName,
            tenantEmail: userData.user.email,
            tenantSlug: propertySlug,
          }
        })
      })
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError)
      // Don't fail the registration for notification errors
    }
    
    return NextResponse.json({
      success: true,
      tenantId: tenantData.id,
      message: 'Property registered successfully!'
    })
    
  } catch (error) {
    console.error('Host registration error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

