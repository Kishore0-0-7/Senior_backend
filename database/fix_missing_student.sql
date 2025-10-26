-- =====================================================
-- FIX MISSING STUDENT RECORD
-- =====================================================
-- This script checks for users with role 'student' who don't have
-- corresponding entries in the students table and creates them.
-- =====================================================

-- Step 1: Identify users with student role but no student record
SELECT 
    u.id as user_id,
    u.email,
    u.created_at
FROM users u
LEFT JOIN students s ON u.id = s.user_id
WHERE u.role = 'student' 
  AND s.id IS NULL
ORDER BY u.created_at DESC;

-- Step 2: Create missing student records
-- Replace the values below with actual user data
-- You can either run this for each missing student or modify to insert multiple

-- Example for the specific user from the error:
-- student_id: c8203dae-238f-469c-adb1-1e4040eb0b96
-- This is likely the user_id from the users table

-- First, check if this ID exists in users table:
SELECT id, email, role, created_at 
FROM users 
WHERE id = 'c8203dae-238f-469c-adb1-1e4040eb0b96';

-- If the above returns a user with role 'student', create the student record:
-- Adjust the values based on the actual user's information

INSERT INTO students (
    id,
    user_id,
    name,
    email,
    phone,
    college,
    department,
    year,
    registration_number,
    status
)
SELECT 
    gen_random_uuid() as id,  -- Generate new student ID
    u.id as user_id,
    SUBSTRING(COALESCE(NULLIF(u.email, ''), 'Student'), 1, 255) as name,  -- Max 255 chars
    SUBSTRING(u.email, 1, 255) as email,  -- Max 255 chars
    '' as phone,  -- Empty phone
    'Default' as college,  -- Short value
    'CS' as department,  -- Short value
    '1st' as year,  -- Max 10 chars
    LPAD((RANDOM() * 999999)::INTEGER::TEXT, 6, '0') as registration_number,  -- 6-digit: max 50 chars
    'approved' as status  -- Auto-approve to allow immediate use
FROM users u
WHERE u.id = 'c8203dae-238f-469c-adb1-1e4040eb0b96'
  AND u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM students s WHERE s.user_id = u.id);

-- Step 3: Verify the student record was created
SELECT 
    s.id,
    s.user_id,
    s.name,
    s.email,
    s.registration_number,
    s.status,
    s.created_at
FROM students s
WHERE s.user_id = 'c8203dae-238f-469c-adb1-1e4040eb0b96';

-- =====================================================
-- AUTOMATED FIX FOR ALL MISSING STUDENTS
-- =====================================================
-- Run this to automatically create student records for ALL users
-- who have role='student' but no student record:

INSERT INTO students (
    id,
    user_id,
    name,
    email,
    phone,
    college,
    department,
    year,
    registration_number,
    status
)
SELECT 
    gen_random_uuid() as id,
    u.id as user_id,
    SUBSTRING(COALESCE(NULLIF(u.email, ''), 'Student'), 1, 255) as name,
    SUBSTRING(u.email, 1, 255) as email,
    '' as phone,
    'Default' as college,
    'CS' as department,
    '1st' as year,
    LPAD((RANDOM() * 999999)::INTEGER::TEXT, 6, '0') as registration_number,
    'approved' as status
FROM users u
WHERE u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM students s WHERE s.user_id = u.id);

-- Step 4: Verify all students now have records
SELECT 
    COUNT(*) as total_student_users,
    (SELECT COUNT(*) FROM students) as total_student_records,
    COUNT(*) - (SELECT COUNT(*) FROM students) as missing_records
FROM users 
WHERE role = 'student';

-- =====================================================
-- PREVENTION: Add a trigger to auto-create student records
-- =====================================================
-- This prevents the issue from happening again in the future

CREATE OR REPLACE FUNCTION create_student_record()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create student record if role is 'student'
    IF NEW.role = 'student' THEN
        INSERT INTO students (
            id,
            user_id,
            name,
            email,
            phone,
            college,
            department,
            year,
            registration_number,
            status
        ) VALUES (
            gen_random_uuid(),
            NEW.id,
            COALESCE(NULLIF(NEW.email, ''), 'New Student'),
            NEW.email,
            '',
            'Default College',
            'Not Specified',
            'Not Specified',
            LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),  -- Generate 6-digit number (max 10 chars)
            'pending'  -- New students start as pending
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS auto_create_student_record ON users;
CREATE TRIGGER auto_create_student_record
    AFTER INSERT ON users
    FOR EACH ROW
    WHEN (NEW.role = 'student')
    EXECUTE FUNCTION create_student_record();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check for any remaining mismatches
SELECT 
    'Users with student role' as category,
    COUNT(*) as count
FROM users 
WHERE role = 'student'
UNION ALL
SELECT 
    'Student records' as category,
    COUNT(*) as count
FROM students;

-- List all students with their user info
SELECT 
    u.id as user_id,
    u.email,
    u.role,
    s.id as student_id,
    s.name,
    s.registration_number,
    s.status,
    s.created_at as student_created_at
FROM users u
LEFT JOIN students s ON u.id = s.user_id
WHERE u.role = 'student'
ORDER BY u.created_at DESC;

-- =====================================================
-- NOTES
-- =====================================================
-- After running this script:
-- 1. All existing users with role='student' will have student records
-- 2. Future student user creations will automatically create student records
-- 3. Students created this way will have default values and should update their profile
-- 4. The trigger ensures referential integrity going forward
-- =====================================================
