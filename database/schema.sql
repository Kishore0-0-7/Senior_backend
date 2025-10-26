--
-- PostgreSQL Database Schema
-- Event Management System - Schema Only (No Data)
-- Generated: 2025-10-26
--

-- Database Configuration
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ========================================
-- FUNCTIONS
-- ========================================

-- Function: cleanup_old_attendance_logs
-- Purpose: Delete attendance logs older than specified days
CREATE FUNCTION public.cleanup_old_attendance_logs(days_to_keep integer DEFAULT 365) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM attendance_logs
    WHERE timestamp < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_attendance_logs(days_to_keep integer) IS 'Cleans up attendance logs older than specified days (default: 365)';

-- Function: get_student_attendance_stats
-- Purpose: Get attendance statistics for a specific student
CREATE FUNCTION public.get_student_attendance_stats(student_uuid uuid) 
    RETURNS TABLE(total_events_registered bigint, total_events_attended bigint, attendance_percentage numeric)
    LANGUAGE plpgsql
    AS $$
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
$$;

COMMENT ON FUNCTION public.get_student_attendance_stats(student_uuid uuid) IS 'Returns attendance statistics for a specific student';

-- Function: is_within_grace_period
-- Purpose: Check if current time is within event grace period
CREATE FUNCTION public.is_within_grace_period(event_uuid uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
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
$$;

COMMENT ON FUNCTION public.is_within_grace_period(event_uuid uuid) IS 'Checks if current time is within the grace period for an event';

-- Function: update_updated_at_column
-- Purpose: Trigger function to update updated_at timestamp
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS 'Trigger function to automatically update the updated_at column';

-- ========================================
-- TABLES
-- ========================================

-- Table: users
-- Purpose: Base authentication table for all users (admin and students)
CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp without time zone,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'student'::character varying])::text[])))
);

COMMENT ON TABLE public.users IS 'Base authentication table for all users (admin and students)';

-- Table: admins
-- Purpose: Admin-specific information and profile data
CREATE TABLE public.admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(20),
    department character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.admins IS 'Admin-specific information and profile data';

-- Table: students
-- Purpose: Student information including registration and profile details
CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    college character varying(255) NOT NULL,
    department character varying(100) NOT NULL,
    year character varying(10) NOT NULL,
    registration_number character varying(50) NOT NULL,
    address text,
    date_of_birth date,
    profile_photo_url text,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT students_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);

COMMENT ON TABLE public.students IS 'Student information including registration and profile details';

-- Table: events
-- Purpose: Event information with QR codes and attendance settings
CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    event_date date NOT NULL,
    event_time time without time zone NOT NULL,
    venue character varying(255) NOT NULL,
    category character varying(100),
    status character varying(20) DEFAULT 'Active'::character varying,
    qr_data text NOT NULL,
    max_participants integer,
    grace_period_minutes integer DEFAULT 15,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT events_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[])))
);

COMMENT ON TABLE public.events IS 'Event information with QR codes and attendance settings';

-- Table: event_participants
-- Purpose: Tracks student registration and attendance status for events
CREATE TABLE public.event_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    student_id uuid NOT NULL,
    status character varying(20) DEFAULT 'registered'::character varying,
    check_in_time timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT event_participants_status_check CHECK (((status)::text = ANY ((ARRAY['registered'::character varying, 'attended'::character varying, 'late'::character varying, 'absent'::character varying])::text[])))
);

COMMENT ON TABLE public.event_participants IS 'Tracks student registration and attendance status for events';

-- Table: attendance_logs
-- Purpose: Detailed attendance logs with photo proof and GPS location tracking
CREATE TABLE public.attendance_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    event_id uuid NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_latitude numeric(10,8),
    location_longitude numeric(11,8),
    device_info jsonb,
    qr_data text,
    status character varying(20) DEFAULT 'attended'::character varying,
    notes text,
    proof_photo_url text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    photo_taken_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT attendance_logs_status_check CHECK (((status)::text = ANY ((ARRAY['attended'::character varying, 'late'::character varying, 'verified'::character varying])::text[])))
);

COMMENT ON TABLE public.attendance_logs IS 'Detailed attendance logs with photo proof and GPS location tracking';
COMMENT ON COLUMN public.attendance_logs.proof_photo_url IS 'Path to the uploaded attendance proof photo';
COMMENT ON COLUMN public.attendance_logs.latitude IS 'GPS latitude coordinate where attendance was marked';
COMMENT ON COLUMN public.attendance_logs.longitude IS 'GPS longitude coordinate where attendance was marked';
COMMENT ON COLUMN public.attendance_logs.photo_taken_at IS 'Timestamp when the proof photo was taken';

-- Table: certificates
-- Purpose: Student certificates with approval workflow
CREATE TABLE public.certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    event_id uuid,
    title character varying(255) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_url text NOT NULL,
    certificate_type character varying(50),
    status character varying(20) DEFAULT 'Pending'::character varying,
    remarks text,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_at timestamp without time zone,
    approved_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT certificates_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Approved'::character varying, 'Rejected'::character varying])::text[])))
);

COMMENT ON TABLE public.certificates IS 'Student certificates with approval workflow';

-- Table: on_duty_requests
-- Purpose: Stores on-duty requests submitted by students
CREATE TABLE public.on_duty_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    college_name character varying(255) NOT NULL,
    start_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_date date NOT NULL,
    end_time time without time zone NOT NULL,
    reason text NOT NULL,
    document_url character varying(500),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    approved_by uuid,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT on_duty_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);

COMMENT ON TABLE public.on_duty_requests IS 'Stores on-duty requests submitted by students';
COMMENT ON COLUMN public.on_duty_requests.college_name IS 'Name of the external college/institution';
COMMENT ON COLUMN public.on_duty_requests.document_url IS 'URL path to the uploaded supporting document';
COMMENT ON COLUMN public.on_duty_requests.status IS 'Request status: pending, approved, or rejected';
COMMENT ON COLUMN public.on_duty_requests.approved_by IS 'Admin ID who approved/rejected the request';
COMMENT ON COLUMN public.on_duty_requests.rejection_reason IS 'Reason for rejection (if rejected)';

-- Table: on_duty_attendance
-- Purpose: Stores attendance records for approved on-duty requests
CREATE TABLE public.on_duty_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    on_duty_request_id uuid NOT NULL,
    student_id uuid NOT NULL,
    check_in_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    address text,
    selfie_photo_url character varying(500),
    qr_data text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.on_duty_attendance IS 'Stores attendance records for approved on-duty requests';
COMMENT ON COLUMN public.on_duty_attendance.latitude IS 'GPS latitude where attendance was marked';
COMMENT ON COLUMN public.on_duty_attendance.longitude IS 'GPS longitude where attendance was marked';
COMMENT ON COLUMN public.on_duty_attendance.address IS 'Reverse geocoded address from GPS coordinates';
COMMENT ON COLUMN public.on_duty_attendance.selfie_photo_url IS 'URL path to the selfie photo taken during attendance';
COMMENT ON COLUMN public.on_duty_attendance.qr_data IS 'QR code data scanned during attendance marking';

-- ========================================
-- VIEWS
-- ========================================

-- View: v_student_profiles
-- Purpose: Comprehensive student view with aggregated statistics
CREATE VIEW public.v_student_profiles AS
 SELECT s.id,
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
    count(DISTINCT ep.event_id) AS events_registered,
    count(DISTINCT al.event_id) AS events_attended,
    count(DISTINCT c.id) AS certificates_count
   FROM ((((public.students s
     LEFT JOIN public.users u ON ((s.user_id = u.id)))
     LEFT JOIN public.event_participants ep ON ((s.id = ep.student_id)))
     LEFT JOIN public.attendance_logs al ON ((s.id = al.student_id)))
     LEFT JOIN public.certificates c ON ((s.id = c.student_id)))
  GROUP BY s.id, s.user_id, s.name, s.email, s.phone, s.college, s.department, s.year, s.registration_number, s.address, s.date_of_birth, s.profile_photo_url, s.status, s.created_at, s.updated_at, u.role;

COMMENT ON VIEW public.v_student_profiles IS 'Comprehensive student view with aggregated statistics';

-- View: v_event_statistics
-- Purpose: Event statistics including attendance and photo/location tracking
CREATE VIEW public.v_event_statistics AS
 SELECT e.id,
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
    count(DISTINCT ep.student_id) AS total_participants,
    count(DISTINCT
        CASE
            WHEN ((ep.status)::text = 'attended'::text) THEN ep.student_id
            ELSE NULL::uuid
        END) AS attended_count,
    count(DISTINCT
        CASE
            WHEN ((ep.status)::text = 'late'::text) THEN ep.student_id
            ELSE NULL::uuid
        END) AS late_count,
    count(DISTINCT
        CASE
            WHEN ((ep.status)::text = 'absent'::text) THEN ep.student_id
            ELSE NULL::uuid
        END) AS absent_count,
    count(DISTINCT
        CASE
            WHEN ((ep.status)::text = 'registered'::text) THEN ep.student_id
            ELSE NULL::uuid
        END) AS registered_count,
    count(DISTINCT al.student_id) AS check_ins_count,
    count(DISTINCT
        CASE
            WHEN (al.proof_photo_url IS NOT NULL) THEN al.student_id
            ELSE NULL::uuid
        END) AS photos_uploaded,
    count(DISTINCT
        CASE
            WHEN ((al.latitude IS NOT NULL) AND (al.longitude IS NOT NULL)) THEN al.student_id
            ELSE NULL::uuid
        END) AS gps_locations
   FROM ((public.events e
     LEFT JOIN public.event_participants ep ON ((e.id = ep.event_id)))
     LEFT JOIN public.attendance_logs al ON ((e.id = al.event_id)))
  GROUP BY e.id, e.name, e.description, e.event_date, e.event_time, e.venue, e.category, e.status, e.qr_data, e.max_participants, e.grace_period_minutes, e.created_by, e.created_at, e.updated_at;

COMMENT ON VIEW public.v_event_statistics IS 'Event statistics including attendance and photo/location tracking';

-- ========================================
-- PRIMARY KEYS
-- ========================================

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.on_duty_attendance
    ADD CONSTRAINT on_duty_attendance_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.on_duty_requests
    ADD CONSTRAINT on_duty_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_email_key UNIQUE (email);

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_registration_number_key UNIQUE (registration_number);

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_key UNIQUE (user_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- ========================================
-- INDEXES
-- ========================================

-- Users indexes
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);
CREATE INDEX idx_users_last_login ON public.users USING btree (last_login);
CREATE INDEX idx_users_role ON public.users USING btree (role);

-- Admins indexes
CREATE INDEX idx_admins_user_id ON public.admins USING btree (user_id);

-- Students indexes
CREATE INDEX idx_students_department ON public.students USING btree (department);
CREATE INDEX idx_students_email ON public.students USING btree (email);
CREATE INDEX idx_students_registration_number ON public.students USING btree (registration_number);
CREATE INDEX idx_students_status ON public.students USING btree (status);
CREATE INDEX idx_students_user_id ON public.students USING btree (user_id);

-- Events indexes
CREATE INDEX idx_events_category ON public.events USING btree (category);
CREATE INDEX idx_events_created_by ON public.events USING btree (created_by);
CREATE INDEX idx_events_date ON public.events USING btree (event_date);
CREATE INDEX idx_events_status ON public.events USING btree (status);

-- Event participants indexes
CREATE INDEX idx_event_participants_check_in ON public.event_participants USING btree (check_in_time);
CREATE INDEX idx_event_participants_event_id ON public.event_participants USING btree (event_id);
CREATE INDEX idx_event_participants_event_status ON public.event_participants USING btree (event_id, status);
CREATE INDEX idx_event_participants_status ON public.event_participants USING btree (status);
CREATE INDEX idx_event_participants_student_id ON public.event_participants USING btree (student_id);

-- Attendance logs indexes
CREATE INDEX idx_attendance_event_id ON public.attendance_logs USING btree (event_id);
CREATE INDEX idx_attendance_location ON public.attendance_logs USING btree (latitude, longitude);
CREATE INDEX idx_attendance_photo_location ON public.attendance_logs USING btree (event_id, student_id, proof_photo_url, latitude, longitude);
CREATE INDEX idx_attendance_status ON public.attendance_logs USING btree (status);
CREATE INDEX idx_attendance_student_event ON public.attendance_logs USING btree (student_id, event_id);
CREATE INDEX idx_attendance_student_id ON public.attendance_logs USING btree (student_id);
CREATE INDEX idx_attendance_timestamp ON public.attendance_logs USING btree ("timestamp");

-- Certificates indexes
CREATE INDEX idx_certificates_event_id ON public.certificates USING btree (event_id);
CREATE INDEX idx_certificates_status ON public.certificates USING btree (status);
CREATE INDEX idx_certificates_student_id ON public.certificates USING btree (student_id);
CREATE INDEX idx_certificates_student_status ON public.certificates USING btree (student_id, status);
CREATE INDEX idx_certificates_uploaded_at ON public.certificates USING btree (uploaded_at);

-- On-duty requests indexes
CREATE INDEX idx_on_duty_requests_dates ON public.on_duty_requests USING btree (start_date, end_date);
CREATE INDEX idx_on_duty_requests_status ON public.on_duty_requests USING btree (status);
CREATE INDEX idx_on_duty_requests_student_id ON public.on_duty_requests USING btree (student_id);

-- On-duty attendance indexes
CREATE INDEX idx_on_duty_attendance_check_in_time ON public.on_duty_attendance USING btree (check_in_time);
CREATE INDEX idx_on_duty_attendance_request_id ON public.on_duty_attendance USING btree (on_duty_request_id);
CREATE INDEX idx_on_duty_attendance_student_id ON public.on_duty_attendance USING btree (student_id);

-- ========================================
-- TRIGGERS
-- ========================================

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admins_updated_at 
    BEFORE UPDATE ON public.admins 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at 
    BEFORE UPDATE ON public.students 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at 
    BEFORE UPDATE ON public.events 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_participants_updated_at 
    BEFORE UPDATE ON public.event_participants 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_logs_updated_at 
    BEFORE UPDATE ON public.attendance_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_certificates_updated_at 
    BEFORE UPDATE ON public.certificates 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_on_duty_requests_updated_at 
    BEFORE UPDATE ON public.on_duty_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- FOREIGN KEY CONSTRAINTS
-- ========================================

-- Admins foreign keys
ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Students foreign keys
ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Events foreign keys
ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.admins(id);

-- Event participants foreign keys
ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- Attendance logs foreign keys
ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- Certificates foreign keys
ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES public.admins(id);

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- On-duty requests foreign keys
ALTER TABLE ONLY public.on_duty_requests
    ADD CONSTRAINT on_duty_requests_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES public.admins(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.on_duty_requests
    ADD CONSTRAINT on_duty_requests_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- On-duty attendance foreign keys
ALTER TABLE ONLY public.on_duty_attendance
    ADD CONSTRAINT on_duty_attendance_on_duty_request_id_fkey 
    FOREIGN KEY (on_duty_request_id) REFERENCES public.on_duty_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.on_duty_attendance
    ADD CONSTRAINT on_duty_attendance_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- ========================================
-- END OF SCHEMA
-- ========================================
