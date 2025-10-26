-- =====================================================
-- ADD MISSING COLUMNS TO USERS TABLE
-- =====================================================
-- This migration adds the missing columns that the backend expects:
-- - is_active: Boolean flag to enable/disable user accounts
-- - last_login: Timestamp of the user's last successful login
-- =====================================================

-- Add is_active column (default to true for existing users)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Add last_login column (nullable, will be set on first login)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Create index for faster queries on active users
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Create index for last_login queries
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Update existing users to be active (if any exist)
UPDATE users SET is_active = true WHERE is_active IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.is_active IS 'Flag to enable/disable user account access';
COMMENT ON COLUMN users.last_login IS 'Timestamp of the user last successful login';

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('is_active', 'last_login')
ORDER BY column_name;

-- Show success message
SELECT 'Migration completed successfully! Added is_active and last_login columns to users table.' AS status;
