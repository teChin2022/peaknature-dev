-- =====================================================
-- FIX: Host Login After Admin Approval
-- =====================================================
-- Issue: Hosts cannot log in after admin approval due to RLS policy
-- timing issues with session establishment in production.
--
-- Root Cause: get_my_tenant_id() can return NULL during session
-- establishment, causing tenants_select_own policy to fail.
--
-- Solution:
-- 1. Make get_my_tenant_id() more robust with explicit NULL handling
-- 2. Add explicit RLS policy that checks host role directly
-- =====================================================

-- Fix 1: Make get_my_tenant_id() more robust
-- Convert from SQL to plpgsql for better NULL handling
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Try to get tenant_id from profile
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Return NULL if not found (don't throw error)
  -- This allows RLS policies to handle the NULL case gracefully
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fix 2: Add explicit RLS policy for hosts to see their tenant
-- This policy explicitly checks the host role and tenant relationship
-- without relying solely on get_my_tenant_id()
DROP POLICY IF EXISTS "tenants_select_host_own" ON tenants;
CREATE POLICY "tenants_select_host_own"
  ON tenants FOR SELECT
  USING (
    -- Explicitly check if user is a host and owns this tenant
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'host'
      AND profiles.tenant_id = tenants.id
    )
  );

-- Note: The existing "tenants_select_own" policy remains as a fallback
-- The new "tenants_select_host_own" policy is more explicit and reliable
-- for the host login scenario after admin approval.
