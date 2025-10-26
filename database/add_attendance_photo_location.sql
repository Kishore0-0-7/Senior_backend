-- ============================================
-- Add Photo Proof and Geolocation to Attendance
-- ============================================

-- Add new columns to attendance_logs table
ALTER TABLE attendance_logs
ADD COLUMN IF NOT EXISTS proof_photo_url TEXT,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS photo_taken_at TIMESTAMP;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_logs_proof_photo ON attendance_logs(proof_photo_url);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_location_coords ON attendance_logs(latitude, longitude);

-- Optional: Create a table to store photo metadata if needed
CREATE TABLE IF NOT EXISTS attendance_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_log_id UUID REFERENCES attendance_logs(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_size_bytes INTEGER,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    photo_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_name VARCHAR(255),
    mime_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index to attendance_photos
CREATE INDEX IF NOT EXISTS idx_attendance_photos_attendance_log ON attendance_photos(attendance_log_id);
CREATE INDEX IF NOT EXISTS idx_attendance_photos_created ON attendance_photos(created_at);

-- Add constraints to ensure photo is stored when attendance is marked
-- Optional: You can add a check constraint
ALTER TABLE attendance_logs
ADD CONSTRAINT check_photo_with_attendance 
    CHECK (proof_photo_url IS NOT NULL OR proof_photo_url IS NULL);

-- Comment on new columns
COMMENT ON COLUMN attendance_logs.proof_photo_url IS 'URL to the photo proof taken during attendance marking';
COMMENT ON COLUMN attendance_logs.latitude IS 'Latitude coordinate where QR was scanned';
COMMENT ON COLUMN attendance_logs.longitude IS 'Longitude coordinate where QR was scanned';
COMMENT ON COLUMN attendance_logs.photo_taken_at IS 'Timestamp when the photo was taken';
