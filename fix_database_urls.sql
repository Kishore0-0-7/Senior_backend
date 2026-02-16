-- Fix Database URLs Script
-- This script updates all file URLs in the database to use the correct production URL
-- Run this after deploying to production

-- Backup current state (optional - uncomment to see what will change)
-- SELECT 'on_duty_requests', id, document_url FROM on_duty_requests WHERE document_url IS NOT NULL;
-- SELECT 'on_duty_attendance', id, selfie_photo_url FROM on_duty_attendance WHERE selfie_photo_url IS NOT NULL;
-- SELECT 'certificates', id, file_url FROM certificates;
-- SELECT 'attendance_logs', id, proof_photo_url FROM attendance_logs WHERE proof_photo_url IS NOT NULL;
-- SELECT 'students', id, profile_photo_url FROM students WHERE profile_photo_url IS NOT NULL;

BEGIN;

-- Fix on_duty_requests document URLs
UPDATE on_duty_requests
SET document_url = CASE
    -- Remove localhost URLs and replace with production URL
    WHEN document_url LIKE 'http://localhost:%' THEN 
        REPLACE(document_url, SUBSTRING(document_url FROM 'http://localhost:[0-9]+'), 'https://senior-backend-ebwu.onrender.com')
    -- Fix URLs that are missing the base URL (just /uploads/...)
    WHEN document_url LIKE '/uploads/%' THEN 
        'https://senior-backend-ebwu.onrender.com' || document_url
    -- Fix URLs that only have the filename (no path)
    WHEN document_url NOT LIKE 'http%' AND document_url NOT LIKE '/uploads/%' THEN
        'https://senior-backend-ebwu.onrender.com/uploads/onduty-documents/' || document_url
    ELSE document_url
END
WHERE document_url IS NOT NULL;

-- Fix on_duty_attendance selfie URLs
UPDATE on_duty_attendance
SET selfie_photo_url = CASE
    WHEN selfie_photo_url LIKE 'http://localhost:%' THEN 
        REPLACE(selfie_photo_url, SUBSTRING(selfie_photo_url FROM 'http://localhost:[0-9]+'), 'https://senior-backend-ebwu.onrender.com')
    WHEN selfie_photo_url LIKE '/uploads/%' THEN 
        'https://senior-backend-ebwu.onrender.com' || selfie_photo_url
    WHEN selfie_photo_url NOT LIKE 'http%' AND selfie_photo_url NOT LIKE '/uploads/%' THEN
        'https://senior-backend-ebwu.onrender.com/uploads/onduty-selfies/' || selfie_photo_url
    ELSE selfie_photo_url
END
WHERE selfie_photo_url IS NOT NULL;

-- Fix certificates file URLs
UPDATE certificates
SET file_url = CASE
    WHEN file_url LIKE 'http://localhost:%' THEN 
        REPLACE(file_url, SUBSTRING(file_url FROM 'http://localhost:[0-9]+'), 'https://senior-backend-ebwu.onrender.com')
    WHEN file_url LIKE '/uploads/%' THEN 
        'https://senior-backend-ebwu.onrender.com' || file_url
    WHEN file_url NOT LIKE 'http%' AND file_url NOT LIKE '/uploads/%' THEN
        'https://senior-backend-ebwu.onrender.com/uploads/certificates/' || file_url
    ELSE file_url
END;

-- Fix attendance_logs proof photo URLs
UPDATE attendance_logs
SET proof_photo_url = CASE
    WHEN proof_photo_url LIKE 'http://localhost:%' THEN 
        REPLACE(proof_photo_url, SUBSTRING(proof_photo_url FROM 'http://localhost:[0-9]+'), 'https://senior-backend-ebwu.onrender.com')
    WHEN proof_photo_url LIKE '/uploads/%' THEN 
        'https://senior-backend-ebwu.onrender.com' || proof_photo_url
    WHEN proof_photo_url NOT LIKE 'http%' AND proof_photo_url NOT LIKE '/uploads/%' THEN
        'https://senior-backend-ebwu.onrender.com/uploads/attendance-photos/' || proof_photo_url
    ELSE proof_photo_url
END
WHERE proof_photo_url IS NOT NULL;

-- Fix students profile photo URLs
UPDATE students
SET profile_photo_url = CASE
    WHEN profile_photo_url LIKE 'http://localhost:%' THEN 
        REPLACE(profile_photo_url, SUBSTRING(profile_photo_url FROM 'http://localhost:[0-9]+'), 'https://senior-backend-ebwu.onrender.com')
    WHEN profile_photo_url LIKE '/uploads/%' THEN 
        'https://senior-backend-ebwu.onrender.com' || profile_photo_url
    WHEN profile_photo_url NOT LIKE 'http%' AND profile_photo_url NOT LIKE '/uploads/%' THEN
        'https://senior-backend-ebwu.onrender.com/uploads/profile-photos/' || profile_photo_url
    ELSE profile_photo_url
END
WHERE profile_photo_url IS NOT NULL;

-- Show summary of changes
SELECT 'URL Fix Summary' as info;
SELECT 'on_duty_requests' as table_name, COUNT(*) as total_records, 
       COUNT(document_url) as records_with_url 
FROM on_duty_requests;

SELECT 'on_duty_attendance' as table_name, COUNT(*) as total_records, 
       COUNT(selfie_photo_url) as records_with_url 
FROM on_duty_attendance;

SELECT 'certificates' as table_name, COUNT(*) as total_records, 
       COUNT(file_url) as records_with_url 
FROM certificates;

SELECT 'attendance_logs' as table_name, COUNT(*) as total_records, 
       COUNT(proof_photo_url) as records_with_url 
FROM attendance_logs;

SELECT 'students' as table_name, COUNT(*) as total_records, 
       COUNT(profile_photo_url) as records_with_url 
FROM students;

COMMIT;

-- Verify the changes (sample from each table)
SELECT 'Sample URLs after fix:' as info;
SELECT 'on_duty_requests' as table_name, document_url FROM on_duty_requests WHERE document_url IS NOT NULL LIMIT 2;
SELECT 'certificates' as table_name, file_url FROM certificates LIMIT 2;
SELECT 'students' as table_name, profile_photo_url FROM students WHERE profile_photo_url IS NOT NULL LIMIT 2;
