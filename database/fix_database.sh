#!/bin/bash

# =====================================================
# Quick Database Fix Script
# =====================================================
# This script adds the missing is_active column to users table
# Run this on your Ubuntu server to fix the login error
# =====================================================

echo "🔧 Starting database migration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get database name from user
echo -e "${YELLOW}Enter your PostgreSQL database name:${NC}"
read -r DB_NAME

echo -e "${YELLOW}Enter your PostgreSQL username (default: postgres):${NC}"
read -r DB_USER
DB_USER=${DB_USER:-postgres}

echo ""
echo "📊 Database: $DB_NAME"
echo "👤 User: $DB_USER"
echo ""
echo "Running migration..."
echo ""

# Run the migration
psql -U "$DB_USER" -d "$DB_NAME" << EOF
-- Add is_active column
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Update existing users
UPDATE users SET is_active = true WHERE is_active IS NULL;

-- Verify
SELECT 
    '✅ Migration completed successfully!' as status,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = true) as active_users
FROM users;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Database migration completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Restart your backend server"
    echo "2. Try logging in from your mobile apps"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Migration failed. Please check the error above.${NC}"
    echo ""
    echo "Common issues:"
    echo "- Wrong database name or username"
    echo "- PostgreSQL not running"
    echo "- Permission denied"
    echo ""
    exit 1
fi
