-- Create on_duty_requests table
CREATE TABLE IF NOT EXISTS on_duty_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    college_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_date DATE NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT NOT NULL,
    document_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create on_duty_attendance table
CREATE TABLE IF NOT EXISTS on_duty_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    on_duty_request_id UUID NOT NULL REFERENCES on_duty_requests(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    selfie_photo_url VARCHAR(500),
    qr_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_on_duty_requests_student_id ON on_duty_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_on_duty_requests_status ON on_duty_requests(status);
CREATE INDEX IF NOT EXISTS idx_on_duty_requests_dates ON on_duty_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_on_duty_attendance_request_id ON on_duty_attendance(on_duty_request_id);
CREATE INDEX IF NOT EXISTS idx_on_duty_attendance_student_id ON on_duty_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_on_duty_attendance_check_in_time ON on_duty_attendance(check_in_time);

-- Create triggers for automatic timestamp updates (reusing existing function)
CREATE TRIGGER update_on_duty_requests_updated_at BEFORE UPDATE ON on_duty_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE on_duty_requests IS 'Stores on-duty requests submitted by students';
COMMENT ON COLUMN on_duty_requests.college_name IS 'Name of the external college/institution';
COMMENT ON COLUMN on_duty_requests.status IS 'Request status: pending, approved, or rejected';
COMMENT ON COLUMN on_duty_requests.document_url IS 'URL path to the uploaded supporting document';
COMMENT ON COLUMN on_duty_requests.approved_by IS 'Admin ID who approved/rejected the request';
COMMENT ON COLUMN on_duty_requests.rejection_reason IS 'Reason for rejection (if rejected)';

COMMENT ON TABLE on_duty_attendance IS 'Stores attendance records for approved on-duty requests';
COMMENT ON COLUMN on_duty_attendance.latitude IS 'GPS latitude where attendance was marked';
COMMENT ON COLUMN on_duty_attendance.longitude IS 'GPS longitude where attendance was marked';
COMMENT ON COLUMN on_duty_attendance.address IS 'Reverse geocoded address from GPS coordinates';
COMMENT ON COLUMN on_duty_attendance.selfie_photo_url IS 'URL path to the selfie photo taken during attendance';
COMMENT ON COLUMN on_duty_attendance.qr_data IS 'QR code data scanned during attendance marking';
