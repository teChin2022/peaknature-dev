-- =====================================================
-- SECURITY HARDENING MIGRATION
-- =====================================================
-- This migration addresses several security concerns:
-- 1. Revoke anonymous access to tenant creation RPC
-- 2. Restrict verified_slips SELECT policy
-- 3. Add additional security constraints
-- =====================================================

-- ============================================================================
-- 1. REVOKE ANONYMOUS ACCESS TO TENANT CREATION FUNCTION
-- ============================================================================
-- The create_tenant_for_registration function should only be callable by 
-- authenticated users, not anonymous users. This prevents unauthenticated 
-- tenant creation bypassing frontend validation.

REVOKE EXECUTE ON FUNCTION public.create_tenant_for_registration(TEXT, TEXT, TEXT, TEXT) FROM anon;

-- Also revoke from set_user_as_host if it exists and has anon access
DO $$ 
BEGIN
  -- Check if function exists before revoking
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'set_user_as_host'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_user_as_host FROM anon';
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    -- Function doesn't exist, skip
    NULL;
END $$;

-- ============================================================================
-- 2. RESTRICT VERIFIED_SLIPS SELECT POLICY
-- ============================================================================
-- Currently anyone can SELECT from verified_slips. This should be restricted
-- to authenticated users only to prevent exposing payment information.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can check duplicates" ON verified_slips;

-- Create a more restrictive policy for authenticated users only
CREATE POLICY "Authenticated users can check duplicates" ON verified_slips
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Update grants to match
REVOKE SELECT ON verified_slips FROM anon;

-- ============================================================================
-- 3. ADD UNIQUE CONSTRAINT FOR CONTENT HASH (if not exists)
-- ============================================================================
-- Ensure duplicate slips cannot be inserted even with race conditions

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_slip_url_hash' 
    AND conrelid = 'verified_slips'::regclass
  ) THEN
    ALTER TABLE verified_slips 
    ADD CONSTRAINT unique_slip_url_hash UNIQUE (slip_url_hash);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists
    NULL;
END $$;

-- ============================================================================
-- 4. ENSURE AUDIT_LOGS TABLE HAS PROPER RLS
-- ============================================================================
-- Audit logs should only be readable by super_admin and writable by service role

-- Enable RLS if not already enabled
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON audit_logs;

-- Super admins can read all audit logs
DROP POLICY IF EXISTS "Super admins can read audit logs" ON audit_logs;
CREATE POLICY "Super admins can read audit logs" ON audit_logs
  FOR SELECT
  USING (public.is_super_admin());

-- No direct INSERT from authenticated users - use admin client with service role
-- This is intentional: audit logs should only be written via API routes
-- that use the admin client (service role) after proper authentication

-- ============================================================================
-- 5. ADD SECURITY FUNCTION FOR CHECKING TENANT OWNERSHIP
-- ============================================================================
-- Helper function to verify if a user owns/manages a tenant

CREATE OR REPLACE FUNCTION public.user_owns_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'host'
    AND tenant_id = p_tenant_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 6. ADDITIONAL INDEXES FOR SECURITY QUERIES
-- ============================================================================
-- These indexes improve performance for security-related queries

-- Index for faster role lookups (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Index for faster tenant-user association checks
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON profiles(tenant_id, role);

-- Index for faster blocked user checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_blocked ON profiles(is_blocked) WHERE is_blocked = true;

-- ============================================================================
-- 7. ENSURE UPLOAD_TOKENS HAS PROPER EXPIRATION CHECK
-- ============================================================================
-- Add index to speed up expired token cleanup

CREATE INDEX IF NOT EXISTS idx_upload_tokens_expires_at ON upload_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_user_room ON upload_tokens(user_id, room_id);

-- ============================================================================
-- 8. REVOKE UNNECESSARY PERMISSIONS FROM ANON ROLE
-- ============================================================================
-- Ensure anon can only do what's absolutely necessary

-- Revoke from check_slip_duplicate_by_hash if it has anon access
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_slip_duplicate_by_hash'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_slip_duplicate_by_hash(TEXT) FROM anon';
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END $$;

-- ============================================================================
-- VERIFICATION COMMENT
-- ============================================================================
-- After running this migration, verify:
-- 1. Anonymous users cannot call create_tenant_for_registration
-- 2. Anonymous users cannot SELECT from verified_slips
-- 3. Audit logs are only readable by super_admin
-- 4. All security indexes are created

