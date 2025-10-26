-- =====================================================
-- QUICK REFERENCE: Common SQL Queries
-- =====================================================
-- Frequently used queries for Student Event Management System
-- =====================================================

-- =====================================================
-- STUDENT QUERIES
-- =====================================================

-- Get all approved students
SELECT id, name, email, registration_number, department, year
FROM students
WHERE status = 'approved'
ORDER BY name;

-- Search students by name or registration number
SELECT id, name, email, registration_number, department
FROM students
WHERE status = 'approved'
  AND (LOWER(name) LIKE LOWER('%search_term%') 
       OR LOWER(registration_number) LIKE LOWER('%search_term%'))
ORDER BY name;

-- Get student profile with statistics
SELECT *
FROM v_student_profiles
WHERE id = 'student-uuid-here';

-- Get pending student approvals
SELECT id, name, email, registration_number, created_at
FROM students
WHERE status = 'pending'
ORDER BY created_at DESC;

-- =====================================================
-- EVENT QUERIES
-- =====================================================

-- Get all active events
SELECT id, name, event_date, event_time, venue, category
FROM events
WHERE status = 'Active'
ORDER BY event_date ASC;

-- Get events with statistics
SELECT 
    id,
    name,
    event_date,
    event_time,
    venue,
    total_participants,
    attended_count,
    photos_uploaded,
    gps_locations
FROM v_event_statistics
WHERE status = 'Active'
ORDER BY event_date ASC;

-- Get upcoming events (next 30 days)
SELECT id, name, event_date, event_time, venue
FROM events
WHERE status = 'Active'
  AND event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY event_date ASC;

-- Get events by category
SELECT id, name, event_date, venue
FROM events
WHERE category = 'Workshop' -- or 'Seminar', 'Competition', etc.
  AND status = 'Active'
ORDER BY event_date ASC;

-- =====================================================
-- ATTENDANCE QUERIES
-- =====================================================

-- Get attendance for specific event (with photo proof)
SELECT 
    s.name as student_name,
    s.registration_number,
    s.department,
    ep.status,
    ep.check_in_time,
    al.proof_photo_url,
    al.latitude,
    al.longitude,
    al.photo_taken_at,
    CASE 
        WHEN al.proof_photo_url IS NOT NULL 
         AND al.latitude IS NOT NULL 
         AND al.longitude IS NOT NULL 
        THEN 'Complete'
        WHEN al.proof_photo_url IS NOT NULL THEN 'Photo Only'
        WHEN al.latitude IS NOT NULL THEN 'Location Only'
        ELSE 'No Proof'
    END as proof_status
FROM event_participants ep
JOIN students s ON ep.student_id = s.id
LEFT JOIN attendance_logs al ON al.student_id = ep.student_id 
                             AND al.event_id = ep.event_id
WHERE ep.event_id = 'event-uuid-here'
ORDER BY ep.check_in_time DESC;

-- Get student's attendance history
SELECT 
    e.name as event_name,
    e.event_date,
    ep.status,
    ep.check_in_time,
    CASE WHEN al.proof_photo_url IS NOT NULL THEN 'Yes' ELSE 'No' END as has_photo,
    CASE WHEN al.latitude IS NOT NULL THEN 'Yes' ELSE 'No' END as has_location
FROM event_participants ep
JOIN events e ON ep.event_id = e.id
LEFT JOIN attendance_logs al ON al.student_id = ep.student_id 
                             AND al.event_id = ep.event_id
WHERE ep.student_id = 'student-uuid-here'
ORDER BY e.event_date DESC;

-- Get students who attended but no photo proof
SELECT 
    s.name,
    s.registration_number,
    s.email,
    e.name as event_name,
    ep.check_in_time
FROM event_participants ep
JOIN students s ON ep.student_id = s.id
JOIN events e ON ep.event_id = e.id
LEFT JOIN attendance_logs al ON al.student_id = ep.student_id 
                             AND al.event_id = ep.event_id
WHERE ep.status IN ('attended', 'late')
  AND al.proof_photo_url IS NULL
ORDER BY e.event_date DESC, s.name;

-- =====================================================
-- CERTIFICATE QUERIES
-- =====================================================

-- Get pending certificates for approval
SELECT 
    c.id,
    c.title,
    s.name as student_name,
    s.registration_number,
    e.name as event_name,
    c.uploaded_at,
    c.file_url
FROM certificates c
JOIN students s ON c.student_id = s.id
LEFT JOIN events e ON c.event_id = e.id
WHERE c.status = 'Pending'
ORDER BY c.uploaded_at DESC;

-- Get approved certificates for a student
SELECT 
    c.title,
    c.certificate_type,
    e.name as event_name,
    c.approved_at,
    c.file_url
FROM certificates c
JOIN students s ON c.student_id = s.id
LEFT JOIN events e ON c.event_id = e.id
WHERE c.student_id = 'student-uuid-here'
  AND c.status = 'Approved'
ORDER BY c.approved_at DESC;

-- =====================================================
-- ANALYTICS & REPORTS
-- =====================================================

-- Event attendance summary
SELECT 
    e.name,
    e.event_date,
    COUNT(DISTINCT ep.student_id) as total_registered,
    COUNT(DISTINCT CASE WHEN ep.status = 'attended' THEN ep.student_id END) as attended,
    COUNT(DISTINCT CASE WHEN ep.status = 'late' THEN ep.student_id END) as late,
    COUNT(DISTINCT CASE WHEN ep.status = 'absent' THEN ep.student_id END) as absent,
    ROUND(
        COUNT(DISTINCT CASE WHEN ep.status IN ('attended', 'late') THEN ep.student_id END)::DECIMAL 
        / NULLIF(COUNT(DISTINCT ep.student_id), 0) * 100, 
        2
    ) as attendance_percentage
FROM events e
LEFT JOIN event_participants ep ON e.id = ep.event_id
WHERE e.event_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY e.id, e.name, e.event_date
ORDER BY e.event_date DESC;

-- Photo proof compliance report
SELECT 
    e.name as event_name,
    e.event_date,
    COUNT(DISTINCT ep.student_id) as total_attended,
    COUNT(DISTINCT CASE WHEN al.proof_photo_url IS NOT NULL THEN ep.student_id END) as with_photo,
    COUNT(DISTINCT CASE WHEN al.latitude IS NOT NULL THEN ep.student_id END) as with_location,
    ROUND(
        COUNT(DISTINCT CASE WHEN al.proof_photo_url IS NOT NULL THEN ep.student_id END)::DECIMAL 
        / NULLIF(COUNT(DISTINCT ep.student_id), 0) * 100,
        2
    ) as photo_compliance_percent
FROM events e
JOIN event_participants ep ON e.id = ep.event_id
LEFT JOIN attendance_logs al ON al.student_id = ep.student_id 
                             AND al.event_id = ep.event_id
WHERE ep.status IN ('attended', 'late')
  AND e.event_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY e.id, e.name, e.event_date
ORDER BY e.event_date DESC;

-- Student participation leaderboard (top 10)
SELECT 
    s.name,
    s.registration_number,
    s.department,
    COUNT(DISTINCT ep.event_id) as events_attended,
    COUNT(DISTINCT c.id) as certificates_earned
FROM students s
LEFT JOIN event_participants ep ON s.id = ep.student_id 
                                 AND ep.status IN ('attended', 'late')
LEFT JOIN certificates c ON s.id = c.student_id 
                          AND c.status = 'Approved'
WHERE s.status = 'approved'
GROUP BY s.id, s.name, s.registration_number, s.department
ORDER BY events_attended DESC, certificates_earned DESC
LIMIT 10;

-- Department-wise event participation
SELECT 
    s.department,
    COUNT(DISTINCT s.id) as total_students,
    COUNT(DISTINCT ep.student_id) as participating_students,
    COUNT(DISTINCT ep.event_id) as events_participated,
    ROUND(
        COUNT(DISTINCT ep.student_id)::DECIMAL 
        / NULLIF(COUNT(DISTINCT s.id), 0) * 100,
        2
    ) as participation_rate
FROM students s
LEFT JOIN event_participants ep ON s.id = ep.student_id 
                                 AND ep.status IN ('attended', 'late')
WHERE s.status = 'approved'
GROUP BY s.department
ORDER BY participation_rate DESC;

-- =====================================================
-- GPS LOCATION QUERIES
-- =====================================================

-- Get all attendance with GPS coordinates (for mapping)
SELECT 
    s.name as student_name,
    e.name as event_name,
    e.venue,
    al.latitude,
    al.longitude,
    al.photo_taken_at,
    al.proof_photo_url
FROM attendance_logs al
JOIN students s ON al.student_id = s.id
JOIN events e ON al.event_id = e.id
WHERE al.latitude IS NOT NULL 
  AND al.longitude IS NOT NULL
ORDER BY al.photo_taken_at DESC;

-- Find attendance locations within a radius (example: 1km from event venue)
-- Note: This is a simple approximation, use PostGIS for accurate geospatial queries
SELECT 
    s.name,
    e.name as event_name,
    al.latitude,
    al.longitude,
    SQRT(
        POWER(69.0 * (al.latitude - 11.3536392), 2) + 
        POWER(69.0 * (77.7305707 - al.longitude) * COS(al.latitude / 57.3), 2)
    ) * 1.609344 as distance_km
FROM attendance_logs al
JOIN students s ON al.student_id = s.id
JOIN events e ON al.event_id = e.id
WHERE al.latitude IS NOT NULL 
  AND al.longitude IS NOT NULL
  AND e.id = 'event-uuid-here'
HAVING distance_km <= 1.0
ORDER BY distance_km;

-- =====================================================
-- ADMIN OPERATIONS
-- =====================================================

-- Approve student
UPDATE students
SET status = 'approved',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'student-uuid-here';

-- Mark participant as attended
UPDATE event_participants
SET status = 'attended',
    check_in_time = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE event_id = 'event-uuid-here'
  AND student_id = 'student-uuid-here';

-- Approve certificate
UPDATE certificates
SET status = 'Approved',
    approved_at = CURRENT_TIMESTAMP,
    approved_by = 'admin-uuid-here',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'certificate-uuid-here';

-- Mark pending participants as absent (after event)
UPDATE event_participants
SET status = 'absent',
    updated_at = CURRENT_TIMESTAMP
WHERE event_id = 'event-uuid-here'
  AND status = 'registered';

-- Complete an event
UPDATE events
SET status = 'Completed',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'event-uuid-here';

-- =====================================================
-- DATA CLEANUP
-- =====================================================

-- Delete attendance logs older than 2 years
DELETE FROM attendance_logs
WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '2 years';

-- Find and remove duplicate attendance logs
DELETE FROM attendance_logs a
USING attendance_logs b
WHERE a.id > b.id
  AND a.student_id = b.student_id
  AND a.event_id = b.event_id
  AND a.timestamp = b.timestamp;

-- =====================================================
-- PERFORMANCE MONITORING
-- =====================================================

-- Find slow queries (if pg_stat_statements is enabled)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
WHERE query LIKE '%attendance%' OR query LIKE '%events%'
ORDER BY mean_time DESC
LIMIT 10;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- =====================================================
-- END OF QUICK REFERENCE
-- =====================================================
