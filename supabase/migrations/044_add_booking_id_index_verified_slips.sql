-- Migration: Add index on booking_id for faster lookups
-- This improves performance when updating easyslip_data after background verification

-- Add index on booking_id for faster updates
CREATE INDEX IF NOT EXISTS idx_verified_slips_booking_id ON verified_slips(booking_id);

-- Comment explaining the index purpose
COMMENT ON INDEX idx_verified_slips_booking_id IS 'Speeds up lookups when updating easyslip_data after background EasySlip verification';

