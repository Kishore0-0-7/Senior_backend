-- =====================================================
-- COMPLETE DATABASE SCHEMA FOR STUDENT EVENT MANAGEMENT
-- =====================================================
-- This schema includes all tables, views, triggers, and functions
-- for the complete student event management system with QR attendance,
-- photo proof, GPS location tracking, and certificate management
-- =====================================================

-- Drop existing objects (use with caution in production)
DROP VIEW IF EXISTS v_event_statistics CASCADE;
DROP VIEW IF EXISTS v_student_profiles CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS attendance_logs CASCADE;
DROP TABLE IF EXISTS event_participants CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- USERS TABLE (Base authentication)
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'student')),
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster email lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_last_login ON users(last_login);

-- =====================================================
-- ADMINS TABLE
-- =====================================================
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admins_user_id ON admins(user_id);

-- =====================================================
-- STUDENTS TABLE
-- =====================================================
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    college VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    year VARCHAR(10) NOT NULL,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    date_of_birth DATE,
    profile_photo_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster queries
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_registration_number ON students(registration_number);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_department ON students(department);

-- =====================================================
-- EVENTS TABLE
-- =====================================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    venue VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
    qr_data TEXT NOT NULL,
    max_participants INTEGER,
    grace_period_minutes INTEGER DEFAULT 15,
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for event queries
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_category ON events(category);

-- =====================================================
-- EVENT PARTICIPANTS TABLE
-- =====================================================
CREATE TABLE event_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'late', 'absent')),
    check_in_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, student_id)
);

-- Indexes for participant queries
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_student_id ON event_participants(student_id);
CREATE INDEX idx_event_participants_status ON event_participants(status);
CREATE INDEX idx_event_participants_check_in ON event_participants(check_in_time);

-- =====================================================
-- ATTENDANCE LOGS TABLE (with Photo Proof & GPS Location)
-- =====================================================
CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    device_info JSONB,
    qr_data TEXT,
    status VARCHAR(20) DEFAULT 'attended' CHECK (status IN ('attended', 'late', 'verified')),
    notes TEXT,
    -- Photo proof fields
    proof_photo_url TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    photo_taken_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for attendance queries
CREATE INDEX idx_attendance_student_id ON attendance_logs(student_id);
CREATE INDEX idx_attendance_event_id ON attendance_logs(event_id);
CREATE INDEX idx_attendance_timestamp ON attendance_logs(timestamp);
CREATE INDEX idx_attendance_status ON attendance_logs(status);
CREATE INDEX idx_attendance_location ON attendance_logs(latitude, longitude);

-- Composite index for common join query
CREATE INDEX idx_attendance_student_event ON attendance_logs(student_id, event_id);

-- =====================================================
-- CERTIFICATES TABLE
-- =====================================================
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    certificate_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    remarks TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by UUID REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for certificate queries
CREATE INDEX idx_certificates_student_id ON certificates(student_id);
CREATE INDEX idx_certificates_event_id ON certificates(event_id);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_uploaded_at ON certificates(uploaded_at);

-- =====================================================
-- VIEWS FOR COMPLEX QUERIES
-- =====================================================

-- View: Student Profiles with User Info
CREATE OR REPLACE VIEW v_student_profiles AS
SELECT 
    s.id,
    s.user_id,
    s.name,
    s.email,
    s.phone,
    s.college,
    s.department,
    s.year,
    s.registration_number,
    s.address,
    s.date_of_birth,
    s.profile_photo_url,
    s.status,
    s.created_at,
    s.updated_at,
    u.role,
    COUNT(DISTINCT ep.event_id) as events_registered,
    COUNT(DISTINCT al.event_id) as events_attended,
    COUNT(DISTINCT c.id) as certificates_count
FROM students s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN event_participants ep ON s.id = ep.student_id
LEFT JOIN attendance_logs al ON s.id = al.student_id
LEFT JOIN certificates c ON s.id = c.student_id
GROUP BY s.id, s.user_id, s.name, s.email, s.phone, s.college, 
         s.department, s.year, s.registration_number, s.address, 
         s.date_of_birth, s.profile_photo_url, s.status, 
         s.created_at, s.updated_at, u.role;

-- View: Event Statistics
CREATE OR REPLACE VIEW v_event_statistics AS
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
    COUNT(DISTINCT CASE WHEN al.proof_photo_url IS NOT NULL THEN al.student_id END) as photos_uploaded,
    COUNT(DISTINCT CASE WHEN al.latitude IS NOT NULL AND al.longitude IS NOT NULL THEN al.student_id END) as gps_locations
FROM events e
LEFT JOIN event_participants ep ON e.id = ep.event_id
LEFT JOIN attendance_logs al ON e.id = al.event_id
GROUP BY e.id, e.name, e.description, e.event_date, e.event_time, 
         e.venue, e.category, e.status, e.qr_data, e.max_participants,
         e.grace_period_minutes, e.created_by, e.created_at, e.updated_at;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_participants_updated_at BEFORE UPDATE ON event_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_logs_updated_at BEFORE UPDATE ON attendance_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA (OPTIONAL - for testing)
-- =====================================================

-- Create admin user (password: admin123)
INSERT INTO users (id, email, password_hash, role) VALUES 
('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'admin@example.com', '$2b$10$XYZ...', 'admin');

INSERT INTO admins (id, user_id, name, phone, department) VALUES 
('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Admin User', '1234567890', 'IT');

-- Create sample student (password: student123)
INSERT INTO users (id, email, password_hash, role) VALUES 
('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'student@example.com', '$2b$10$ABC...', 'student');

INSERT INTO students (id, user_id, name, email, phone, college, department, year, registration_number, status) VALUES 
('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 
 'Sample Student', 'student@example.com', '9876543210', 
 'Sample College', 'Computer Science', '3rd', 'CS001', 'approved');

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to get attendance statistics for a student
CREATE OR REPLACE FUNCTION get_student_attendance_stats(student_uuid UUID)
RETURNS TABLE (
    total_events_registered BIGINT,
    total_events_attended BIGINT,
    attendance_percentage DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT ep.event_id)::BIGINT as total_events_registered,
        COUNT(DISTINCT al.event_id)::BIGINT as total_events_attended,
        CASE 
            WHEN COUNT(DISTINCT ep.event_id) > 0 
            THEN (COUNT(DISTINCT al.event_id)::DECIMAL / COUNT(DISTINCT ep.event_id)::DECIMAL * 100)
            ELSE 0 
        END as attendance_percentage
    FROM event_participants ep
    LEFT JOIN attendance_logs al ON ep.event_id = al.event_id AND ep.student_id = al.student_id
    WHERE ep.student_id = student_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to check if event is within grace period
CREATE OR REPLACE FUNCTION is_within_grace_period(event_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    event_datetime TIMESTAMP;
    grace_minutes INTEGER;
    current_time TIMESTAMP := CURRENT_TIMESTAMP;
BEGIN
    SELECT 
        (e.event_date::TEXT || ' ' || e.event_time::TEXT)::TIMESTAMP,
        COALESCE(e.grace_period_minutes, 15)
    INTO event_datetime, grace_minutes
    FROM events e
    WHERE e.id = event_uuid;
    
    IF event_datetime IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN current_time <= (event_datetime + (grace_minutes || ' minutes')::INTERVAL);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to delete old attendance logs (older than X days)
CREATE OR REPLACE FUNCTION cleanup_old_attendance_logs(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM attendance_logs
    WHERE timestamp < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERMISSIONS (Optional - adjust based on your needs)
-- =====================================================

-- Grant permissions to application role (create role first)
-- CREATE ROLE app_user WITH LOGIN PASSWORD 'your_password';
-- GRANT CONNECT ON DATABASE your_database TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'Base authentication table for all users (admin and students)';
COMMENT ON TABLE admins IS 'Admin-specific information and profile data';
COMMENT ON TABLE students IS 'Student information including registration and profile details';
COMMENT ON TABLE events IS 'Event information with QR codes and attendance settings';
COMMENT ON TABLE event_participants IS 'Tracks student registration and attendance status for events';
COMMENT ON TABLE attendance_logs IS 'Detailed attendance logs with photo proof and GPS location tracking';
COMMENT ON TABLE certificates IS 'Student certificates with approval workflow';

COMMENT ON COLUMN attendance_logs.proof_photo_url IS 'Path to the uploaded attendance proof photo';
COMMENT ON COLUMN attendance_logs.latitude IS 'GPS latitude coordinate where attendance was marked';
COMMENT ON COLUMN attendance_logs.longitude IS 'GPS longitude coordinate where attendance was marked';
COMMENT ON COLUMN attendance_logs.photo_taken_at IS 'Timestamp when the proof photo was taken';

COMMENT ON VIEW v_student_profiles IS 'Comprehensive student view with aggregated statistics';
COMMENT ON VIEW v_event_statistics IS 'Event statistics including attendance and photo/location tracking';

-- =====================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_attendance_photo_location ON attendance_logs(event_id, student_id, proof_photo_url, latitude, longitude);
CREATE INDEX idx_certificates_student_status ON certificates(student_id, status);
CREATE INDEX idx_event_participants_event_status ON event_participants(event_id, status);

-- =====================================================
-- COMPLETED SCHEMA
-- =====================================================
-- This schema includes:
-- ✅ User authentication (admin & student)
-- ✅ Student registration and profiles
-- ✅ Event management with QR codes
-- ✅ Event participant tracking
-- ✅ Attendance logging with photo proof
-- ✅ GPS location tracking
-- ✅ Certificate management
-- ✅ Views for statistics and reporting
-- ✅ Triggers for automatic updates
-- ✅ Utility functions for common operations
-- ✅ Indexes for performance optimization
-- =====================================================

-- Verify schema creation
SELECT 'Schema created successfully!' as status,
       COUNT(*) FILTER (WHERE table_type = 'BASE TABLE') as tables_created,
       COUNT(*) FILTER (WHERE table_type = 'VIEW') as views_created
FROM information_schema.tables 
WHERE table_schema = 'public';
