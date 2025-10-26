-- =====================================================
-- MIGRATION: Add Photo Proof and GPS Location Features
-- =====================================================
-- This migration adds photo proof and GPS location tracking
-- to the attendance system
-- =====================================================
-- Created: October 2025
-- Purpose: Enable students to submit photo proof and GPS 
--          coordinates when marking attendance
-- =====================================================

-- Add photo proof and location columns to attendance_logs
-- (Only if they don't already exist)

-- Check if columns exist and add them
DO $$
BEGIN
    -- Add proof_photo_url column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' 
        AND column_name = 'proof_photo_url'
    ) THEN
        ALTER TABLE attendance_logs 
        ADD COLUMN proof_photo_url TEXT;
        
        COMMENT ON COLUMN attendance_logs.proof_photo_url IS 
            'URL/path to the uploaded attendance proof photo';
    END IF;

    -- Add latitude column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' 
        AND column_name = 'latitude'
    ) THEN
        ALTER TABLE attendance_logs 
        ADD COLUMN latitude DECIMAL(10, 8);
        
        COMMENT ON COLUMN attendance_logs.latitude IS 
            'GPS latitude coordinate (WGS84) where attendance was marked';
    END IF;

    -- Add longitude column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' 
        AND column_name = 'longitude'
    ) THEN
        ALTER TABLE attendance_logs 
        ADD COLUMN longitude DECIMAL(11, 8);
        
        COMMENT ON COLUMN attendance_logs.longitude IS 
            'GPS longitude coordinate (WGS84) where attendance was marked';
    END IF;

    -- Add photo_taken_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' 
        AND column_name = 'photo_taken_at'
    ) THEN
        ALTER TABLE attendance_logs 
        ADD COLUMN photo_taken_at TIMESTAMP;
        
        COMMENT ON COLUMN attendance_logs.photo_taken_at IS 
            'Timestamp when the proof photo was captured';
    END IF;
    
    RAISE NOTICE 'Photo proof and GPS location columns added successfully';
END
$$;

-- Create index for photo/location queries
CREATE INDEX IF NOT EXISTS idx_attendance_has_photo 
ON attendance_logs(event_id) 
WHERE proof_photo_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_has_location 
ON attendance_logs(event_id) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_attendance_photo_location 
ON attendance_logs(event_id, student_id, proof_photo_url, latitude, longitude);

-- Add grace period to events table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'grace_period_minutes'
    ) THEN
        ALTER TABLE events 
        ADD COLUMN grace_period_minutes INTEGER DEFAULT 15;
        
        COMMENT ON COLUMN events.grace_period_minutes IS 
            'Grace period in minutes after event start time for late check-ins';
    END IF;
END
$$;

-- Update the event statistics view to include photo/location stats
DROP VIEW IF EXISTS v_event_statistics;

CREATE VIEW v_event_statistics AS
SELECT 
    e.id,
    e.name,
    e.description,
    e.event_date,
    e.event_time,
    e.venue,
    e.category,
    e.status,
    e.qr_data,
    e.max_participants,
    e.grace_period_minutes,
    e.created_by,
    e.created_at,
    e.updated_at,
    COUNT(DISTINCT ep.student_id) as total_participants,
    COUNT(DISTINCT CASE WHEN ep.status = 'attended' THEN ep.student_id END) as attended_count,
    COUNT(DISTINCT CASE WHEN ep.status = 'late' THEN ep.student_id END) as late_count,
    COUNT(DISTINCT CASE WHEN ep.status = 'absent' THEN ep.student_id END) as absent_count,
    COUNT(DISTINCT CASE WHEN ep.status = 'registered' THEN ep.student_id END) as registered_count,
    COUNT(DISTINCT al.student_id) as check_ins_count,
    -- New photo/location statistics
    COUNT(DISTINCT CASE WHEN al.proof_photo_url IS NOT NULL THEN al.student_id END) as photos_uploaded,
    COUNT(DISTINCT CASE WHEN al.latitude IS NOT NULL AND al.longitude IS NOT NULL THEN al.student_id END) as gps_locations,
    COUNT(DISTINCT CASE WHEN al.proof_photo_url IS NOT NULL 
                       AND al.latitude IS NOT NULL 
                       AND al.longitude IS NOT NULL 
                       THEN al.student_id END) as complete_proofs
FROM events e
LEFT JOIN event_participants ep ON e.id = ep.event_id
LEFT JOIN attendance_logs al ON e.id = al.event_id
GROUP BY e.id, e.name, e.description, e.event_date, e.event_time, 
         e.venue, e.category, e.status, e.qr_data, e.max_participants,
         e.grace_period_minutes, e.created_by, e.created_at, e.updated_at;

COMMENT ON VIEW v_event_statistics IS 
    'Event statistics including attendance, photo proof, and GPS location tracking';

-- Create a function to get attendance with photo/location for an event
CREATE OR REPLACE FUNCTION get_event_attendance_with_proof(event_uuid UUID)
RETURNS TABLE (
    student_id UUID,
    student_name VARCHAR,
    student_email VARCHAR,
    department VARCHAR,
    registration_number VARCHAR,
    status VARCHAR,
    check_in_time TIMESTAMP,
    proof_photo_url TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    photo_taken_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.email,
        s.department,
        s.registration_number,
        ep.status,
        ep.check_in_time,
        al.proof_photo_url,
        al.latitude,
        al.longitude,
        al.photo_taken_at
    FROM event_participants ep
    JOIN students s ON ep.student_id = s.id
    LEFT JOIN attendance_logs al ON al.student_id = ep.student_id 
                                 AND al.event_id = ep.event_id
    WHERE ep.event_id = event_uuid
    ORDER BY ep.check_in_time DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_event_attendance_with_proof(UUID) IS 
    'Retrieves complete attendance information including photo proof and GPS location for an event';

-- Create a function to validate photo proof completeness
CREATE OR REPLACE FUNCTION check_attendance_proof_complete(
    p_event_id UUID,
    p_student_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    has_photo BOOLEAN;
    has_location BOOLEAN;
BEGIN
    SELECT 
        (proof_photo_url IS NOT NULL),
        (latitude IS NOT NULL AND longitude IS NOT NULL)
    INTO has_photo, has_location
    FROM attendance_logs
    WHERE event_id = p_event_id 
      AND student_id = p_student_id
    LIMIT 1;
    
    RETURN COALESCE(has_photo AND has_location, FALSE);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_attendance_proof_complete(UUID, UUID) IS 
    'Checks if attendance proof (photo + location) is complete for a student-event pair';

-- Migration verification
DO $$
DECLARE
    photo_col_exists BOOLEAN;
    lat_col_exists BOOLEAN;
    lng_col_exists BOOLEAN;
    photo_time_col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' AND column_name = 'proof_photo_url'
    ) INTO photo_col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' AND column_name = 'latitude'
    ) INTO lat_col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' AND column_name = 'longitude'
    ) INTO lng_col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' AND column_name = 'photo_taken_at'
    ) INTO photo_time_col_exists;
    
    IF photo_col_exists AND lat_col_exists AND lng_col_exists AND photo_time_col_exists THEN
        RAISE NOTICE '✅ Migration completed successfully!';
        RAISE NOTICE '   - proof_photo_url column: %', photo_col_exists;
        RAISE NOTICE '   - latitude column: %', lat_col_exists;
        RAISE NOTICE '   - longitude column: %', lng_col_exists;
        RAISE NOTICE '   - photo_taken_at column: %', photo_time_col_exists;
    ELSE
        RAISE WARNING '⚠️  Migration incomplete - some columns missing';
    END IF;
END
$$;

-- =====================================================
-- ROLLBACK SCRIPT (Use with caution)
-- =====================================================
-- Uncomment the following to rollback this migration:
/*
-- Drop new indexes
DROP INDEX IF EXISTS idx_attendance_has_photo;
DROP INDEX IF EXISTS idx_attendance_has_location;
DROP INDEX IF EXISTS idx_attendance_photo_location;

-- Drop new functions
DROP FUNCTION IF EXISTS get_event_attendance_with_proof(UUID);
DROP FUNCTION IF EXISTS check_attendance_proof_complete(UUID, UUID);

-- Remove columns from attendance_logs
ALTER TABLE attendance_logs DROP COLUMN IF EXISTS proof_photo_url;
ALTER TABLE attendance_logs DROP COLUMN IF EXISTS latitude;
ALTER TABLE attendance_logs DROP COLUMN IF EXISTS longitude;
ALTER TABLE attendance_logs DROP COLUMN IF EXISTS photo_taken_at;

-- Remove grace_period_minutes from events
ALTER TABLE events DROP COLUMN IF EXISTS grace_period_minutes;

-- Recreate old view (without photo/location stats)
DROP VIEW IF EXISTS v_event_statistics;
CREATE VIEW v_event_statistics AS
SELECT 
    e.id,
    e.name,
    e.description,
    e.event_date,
    e.event_time,
    e.venue,
    e.category,
    e.status,
    e.qr_data,
    e.max_participants,
    e.created_by,
    e.created_at,
    e.updated_at,
    COUNT(DISTINCT ep.student_id) as total_participants,
    COUNT(DISTINCT CASE WHEN ep.status = 'attended' THEN ep.student_id END) as attended_count,
    COUNT(DISTINCT CASE WHEN ep.status = 'late' THEN ep.student_id END) as late_count,
    COUNT(DISTINCT CASE WHEN ep.status = 'absent' THEN ep.student_id END) as absent_count,
    COUNT(DISTINCT CASE WHEN ep.status = 'registered' THEN ep.student_id END) as registered_count
FROM events e
LEFT JOIN event_participants ep ON e.id = ep.event_id
GROUP BY e.id;
*/
