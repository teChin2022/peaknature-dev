import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'
import { uploadLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 20 token creations per minute per IP
    const clientIP = getClientIP(request.headers)
    const { success: rateLimitOk, reset } = await uploadLimiter.check(20, `create-token:${clientIP}`)
    if (!rateLimitOk) {
      return rateLimitResponse(reset)
    }

    const body = await request.json()
    const { tenantId, roomId, checkIn, checkOut, guests, totalPrice, notes } = body

    if (!tenantId || !roomId || !checkIn || !checkOut || !guests || !totalPrice) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Please log in first' },
        { status: 401 }
      )
    }

    // Generate unique token
    const token = nanoid(32)

    // Token expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Delete any existing tokens for this user/room/dates
    await supabase
      .from('upload_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .eq('check_in', checkIn)
      .eq('check_out', checkOut)

    // Create new token
    const { data: tokenData, error: tokenError } = await supabase
      .from('upload_tokens')
      .insert({
        token,
        user_id: user.id,
        tenant_id: tenantId,
        room_id: roomId,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        total_price: totalPrice,
        notes: notes || null,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (tokenError) {
      console.error('Error creating upload token:', tokenError)
      return NextResponse.json(
        { success: false, error: 'Failed to create upload token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      tokenId: tokenData.id,
    })

  } catch (error) {
    console.error('Create token error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    )
  }
}

