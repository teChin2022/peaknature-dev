-- Migration: Add payment_slip_url to get_tenant_bookings function

-- Drop the existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_tenant_bookings(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_tenant_bookings(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  room_id UUID,
  user_id UUID,
  check_in DATE,
  check_out DATE,
  guests INT,
  total_price DECIMAL,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  room_name TEXT,
  guest_full_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  payment_slip_url TEXT
) AS $$
BEGIN
  -- Verify the caller is a host for this tenant or a super_admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'host' 
      AND profiles.tenant_id = p_tenant_id
    )
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  ) THEN
    RETURN; -- Return empty result if not authorized
  END IF;

  RETURN QUERY
  SELECT 
    b.id,
    b.tenant_id,
    b.room_id,
    b.user_id,
    b.check_in,
    b.check_out,
    b.guests,
    b.total_price,
    b.status,
    b.notes,
    b.created_at,
    r.name as room_name,
    p.full_name as guest_full_name,
    p.email as guest_email,
    p.phone as guest_phone,
    b.payment_slip_url
  FROM public.bookings b
  LEFT JOIN public.rooms r ON r.id = b.room_id
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE b.tenant_id = p_tenant_id
  AND (p_status IS NULL OR b.status = p_status)
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure permissions
GRANT EXECUTE ON FUNCTION public.get_tenant_bookings TO authenticated;

