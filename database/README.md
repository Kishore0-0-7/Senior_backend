# Database Schema Documentation

This directory contains SQL scripts for the Student Event Management System with QR Attendance, Photo Proof, and GPS Location Tracking.

## 📁 Files

### 1. `complete_schema.sql`

Complete database schema for creating the system from scratch.

**Use this when:**

- Setting up a new database
- Starting a fresh installation
- Creating a development/testing environment

**Features included:**

- ✅ User authentication (Admin & Student roles)
- ✅ Student registration and profiles
- ✅ Event management with QR codes
- ✅ Event participant tracking
- ✅ Attendance logging with photo proof
- ✅ GPS location tracking (latitude/longitude)
- ✅ Certificate management with approval workflow
- ✅ Statistical views for reporting
- ✅ Triggers for automatic timestamp updates
- ✅ Utility functions for common operations
- ✅ Performance-optimized indexes

### 2. `migrations/001_add_photo_location_proof.sql`

Migration script for adding photo proof and GPS location features to an existing database.

**Use this when:**

- Upgrading an existing database
- Adding photo/location features to a running system
- Maintaining existing data while adding new features

**Changes applied:**

- Adds `proof_photo_url` column to `attendance_logs`
- Adds `latitude` and `longitude` columns (DECIMAL precision)
- Adds `photo_taken_at` timestamp column
- Adds `grace_period_minutes` to `events` table
- Updates `v_event_statistics` view with photo/location stats
- Creates helper functions for photo proof validation
- Includes rollback script for safe migration

### 3. `schema.sql` (Original)

Basic schema without photo/location features.

## 🚀 Quick Start

### For New Installation

```bash
# 1. Create database
createdb student_event_management

# 2. Run complete schema
psql -d student_event_management -f complete_schema.sql
```

### For Existing Database (Migration)

```bash
# 1. Backup your database first!
pg_dump student_event_management > backup_$(date +%Y%m%d).sql

# 2. Run migration
psql -d student_event_management -f migrations/001_add_photo_location_proof.sql

# 3. Verify migration
psql -d student_event_management -c "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'attendance_logs'
  AND column_name IN ('proof_photo_url', 'latitude', 'longitude', 'photo_taken_at');
"
```

## 📊 Database Schema Overview

### Core Tables

#### `users`

Base authentication table for all system users.

- Stores email, password hash, and role (admin/student)
- References: parent of `admins` and `students`

#### `students`

Student profile information.

- Personal details (name, email, phone, college, department, year)
- Registration number (unique identifier)
- Profile photo URL
- Status: pending, approved, rejected

#### `events`

Event definitions with QR codes.

- Event details (name, date, time, venue, description)
- QR data for attendance
- Max participants limit
- Grace period for late check-ins (default: 15 minutes)
- Status: Active, Completed, Cancelled

#### `event_participants`

Tracks student registration and attendance status.

- Links students to events
- Status: registered, attended, late, absent
- Check-in timestamp
- Admin notes

#### `attendance_logs` ⭐ (Enhanced with Photo/Location)

Detailed attendance records with proof.

- Student ID + Event ID
- **Photo proof URL** (`proof_photo_url`)
- **GPS coordinates** (`latitude`, `longitude` in DECIMAL format)
- **Photo timestamp** (`photo_taken_at`)
- Device info (JSONB)
- QR data verification

#### `certificates`

Student certificates with approval workflow.

- Certificate files and metadata
- Status: Pending, Approved, Rejected
- Links to students and optionally to events

### Views

#### `v_student_profiles`

Comprehensive student information with statistics.

- Student details + user info
- Events registered/attended count
- Certificates count

#### `v_event_statistics` ⭐ (Enhanced)

Event analytics including photo/location tracking.

- Participant counts by status
- **Photos uploaded count**
- **GPS locations recorded count**
- **Complete proofs count** (photo + location)

## 🔧 Utility Functions

### `get_student_attendance_stats(student_uuid)`

Returns attendance statistics for a student.

```sql
SELECT * FROM get_student_attendance_stats('student-uuid-here');
```

### `is_within_grace_period(event_uuid)`

Checks if current time is within event's grace period.

```sql
SELECT is_within_grace_period('event-uuid-here');
```

### `get_event_attendance_with_proof(event_uuid)` ⭐

Retrieves complete attendance with photo/location data.

```sql
SELECT * FROM get_event_attendance_with_proof('event-uuid-here');
```

### `check_attendance_proof_complete(event_uuid, student_uuid)` ⭐

Validates if photo proof is complete (photo + location).

```sql
SELECT check_attendance_proof_complete('event-uuid', 'student-uuid');
```

## 📈 Common Queries

### Get all events with photo proof statistics

```sql
SELECT
    name,
    event_date,
    total_participants,
    attended_count,
    photos_uploaded,
    gps_locations,
    complete_proofs
FROM v_event_statistics
ORDER BY event_date DESC;
```

### Get attendance records with photo proof for an event

```sql
SELECT
    ep.student_id,
    s.name,
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
WHERE ep.event_id = 'your-event-uuid'
ORDER BY ep.check_in_time DESC;
```

### Find students who haven't uploaded photo proof

```sql
SELECT
    s.name,
    s.email,
    s.registration_number,
    e.name as event_name
FROM event_participants ep
JOIN students s ON ep.student_id = s.id
JOIN events e ON ep.event_id = e.id
LEFT JOIN attendance_logs al ON al.student_id = ep.student_id
                             AND al.event_id = ep.event_id
WHERE ep.status = 'attended'
  AND al.proof_photo_url IS NULL
ORDER BY e.event_date DESC;
```

### Get GPS location map data

```sql
SELECT
    s.name,
    e.name as event_name,
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
```

## 🔒 Data Types & Precision

### GPS Coordinates

- **Latitude**: `DECIMAL(10, 8)` - Range: -90.00000000 to 90.00000000
- **Longitude**: `DECIMAL(11, 8)` - Range: -180.00000000 to 180.00000000
- **Precision**: ~1.1 mm accuracy (WGS84 standard)

### Photo URLs

- **Type**: `TEXT`
- **Format**: Relative path (e.g., `/uploads/attendance-photos/filename.jpg`)
- **Storage**: File system, URL stored in database

### Timestamps

- **Type**: `TIMESTAMP`
- **Format**: `YYYY-MM-DD HH:MM:SS`
- **Timezone**: UTC (recommended)

## 🛡️ Security Considerations

1. **Password Storage**: Use bcrypt with appropriate salt rounds (default: 10)
2. **Photo Files**: Store outside web root, serve through backend API
3. **GPS Data**: Consider privacy regulations (GDPR, etc.)
4. **File Upload**: Validate file types, implement size limits
5. **SQL Injection**: Always use parameterized queries
6. **Indexes**: Monitor query performance, add indexes as needed

## 🔄 Backup & Maintenance

### Daily Backup

```bash
pg_dump -Fc student_event_management > backup_$(date +%Y%m%d).dump
```

### Cleanup Old Logs (1 year)

```sql
SELECT cleanup_old_attendance_logs(365);
```

### Vacuum & Analyze

```sql
VACUUM ANALYZE;
```

## 📝 Version History

| Version | Date     | Description                                 |
| ------- | -------- | ------------------------------------------- |
| 1.0     | Oct 2025 | Initial schema with basic attendance        |
| 2.0     | Oct 2025 | Added photo proof and GPS location tracking |

## 🆘 Troubleshooting

### Migration fails with "column already exists"

The migration script checks for existing columns. This is safe to ignore if columns were added manually.

### Latitude/Longitude showing as strings in JavaScript

PostgreSQL returns DECIMAL as strings. Use `parseFloat()` in your application:

```javascript
latitude: item.latitude ? parseFloat(item.latitude) : null;
```

### Photo URLs not loading

- Check file permissions in uploads directory
- Verify backend is serving static files from `/uploads`
- Confirm photo URL format matches file storage path

## 📞 Support

For issues or questions:

1. Check this README
2. Review migration logs
3. Verify data types and constraints
4. Check backend API logs for query errors

---

**Last Updated**: October 18, 2025  
**Database Version**: 2.0  
**Schema Status**: Production Ready ✅
