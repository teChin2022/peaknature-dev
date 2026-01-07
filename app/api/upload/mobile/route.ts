import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Generate SHA-256 hash of file content for duplicate detection
function generateContentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token = formData.get('token') as string
    const file = formData.get('file') as File

    if (!token || !file) {
      return NextResponse.json(
        { success: false, error: 'Token and file are required' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for storage uploads
    const supabase = createAdminClient()

    // Get token data (this works for anon due to RLS policy)
    // Use maybeSingle() instead of single() to avoid error when no rows found
    const { data: tokenData, error: tokenError } = await supabase
      .from('upload_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_uploaded', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (tokenError) {
      console.error('Token error:', tokenError)
      return NextResponse.json({
        success: false,
        error: 'Failed to validate token. Please try again.',
      })
    }

    if (!tokenData) {
      // Token not found, expired, or already used
      return NextResponse.json({
        success: false,
        error: 'This upload link has expired or already been used. Please generate a new QR code.',
      })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: 'Please upload an image file',
      })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'Image must be less than 10MB',
      })
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Generate content hash FIRST for duplicate detection
    const contentHash = generateContentHash(buffer)
    console.log('[mobile-upload] Content hash generated:', contentHash.substring(0, 16) + '...')
    
    // Generate unique filename
    const fileName = `payment-slips/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('bookings')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({
        success: false,
        error: `Failed to upload image: ${uploadError.message}`,
      })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('bookings')
      .getPublicUrl(uploadData.path)

    // Update token with slip URL and content hash
    // Try with content hash first, fall back without if column doesn't exist
    let updateError = null
    const { error: updateErr1 } = await supabase
      .from('upload_tokens')
      .update({
        slip_url: publicUrl,
        slip_content_hash: contentHash, // Store content hash for duplicate detection
        is_uploaded: true,
      })
      .eq('token', token)
    
    if (updateErr1) {
      // If error might be due to missing column, try without slip_content_hash
      if (updateErr1.message?.includes('slip_content_hash') || updateErr1.code === '42703') {
        console.log('[mobile-upload] slip_content_hash column not found, updating without it')
        const { error: updateErr2 } = await supabase
          .from('upload_tokens')
          .update({
            slip_url: publicUrl,
            is_uploaded: true,
          })
          .eq('token', token)
        updateError = updateErr2
      } else {
        updateError = updateErr1
      }
    }

    if (updateError) {
      console.error('Update token error:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update upload status',
      })
    }

    return NextResponse.json({
      success: true,
      slipUrl: publicUrl,
      message: 'Upload successful! You can now close this page.',
    })

  } catch (error) {
    console.error('Mobile upload error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    )
  }
}

