-- Migration: Fix create_tenant_for_registration function
-- Add p_primary_color parameter

-- Drop and recreate the function with the correct signature
CREATE OR REPLACE FUNCTION public.create_tenant_for_registration(
  p_name TEXT,
  p_slug TEXT,
  p_primary_color TEXT DEFAULT '#3B82F6',
  p_plan TEXT DEFAULT 'free'
)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  INSERT INTO public.tenants (name, slug, primary_color, plan, is_active)
  VALUES (p_name, p_slug, p_primary_color, p_plan, false)
  RETURNING id INTO v_tenant_id;
  
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure permissions are granted
GRANT EXECUTE ON FUNCTION public.create_tenant_for_registration(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_for_registration(TEXT, TEXT, TEXT, TEXT) TO anon;

