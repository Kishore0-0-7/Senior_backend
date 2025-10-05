-- Add new columns to certificates table
-- Run this SQL script in your PostgreSQL database

-- Add category column
ALTER TABLE certificates 
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Add issue_date column
ALTER TABLE certificates 
ADD COLUMN IF NOT EXISTS issue_date DATE;

-- Add description column
ALTER TABLE certificates 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add remarks column (for admin feedback)
ALTER TABLE certificates 
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Verify the changes
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'certificates'
ORDER BY ordinal_position;

-- Show sample data structure
SELECT * FROM certificates LIMIT 1;
