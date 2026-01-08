import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const fixProfileSchema = z.object({
  userEmail: z.string().email(),
  tenantId: z.string().uuid(),
})

/**
 * POST /api/admin/fix-host-profile
 * 
 * Admin-only endpoint to fix a host's profile that wasn't properly
 * set up during registration.
 * 
 * This links an existing user to a tenant as a host.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the caller is a super_admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Check if user is super_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profile?.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Super admin access required' },
        { status: 403 }
      )
    }
    
    // Parse and validate request body
    const body = await request.json()
    const parseResult = fixProfileSchema.safeParse(body)
    
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: parseResult.error.errors },
        { status: 400 }
      )
    }
    
    const { userEmail, tenantId } = parseResult.data
    
    // Use admin client to update the profile
    const adminClient = createAdminClient()
    
    // Verify the tenant exists
    const { data: tenant, error: tenantError } = await adminClient
      .from('tenants')
      .select('id, name, slug')
      .eq('id', tenantId)
      .single()
    
    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      )
    }
    
    // Find the user by email
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      return NextResponse.json(
        { success: false, error: 'Failed to find user' },
        { status: 500 }
      )
    }
    
    const targetUser = users.find(u => u.email?.toLowerCase() === userEmail.toLowerCase())
    
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found with that email' },
        { status: 404 }
      )
    }
    
    // Check if user already has a different tenant
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', targetUser.id)
      .single()
    
    if (existingProfile?.role === 'host' && existingProfile?.tenant_id && existingProfile.tenant_id !== tenantId) {
      return NextResponse.json(
        { success: false, error: 'User is already a host for a different tenant' },
        { status: 409 }
      )
    }
    
    // Update the profile to be a host for this tenant
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        role: 'host',
        tenant_id: tenantId,
      })
      .eq('id', targetUser.id)
    
    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully linked ${userEmail} as host for ${tenant.name} (${tenant.slug})`,
      data: {
        userId: targetUser.id,
        userEmail: targetUser.email,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
      }
    })
    
  } catch (error) {
    console.error('Fix host profile error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

