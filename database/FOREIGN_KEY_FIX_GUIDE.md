# Foreign Key Constraint Fix Guide

## Problem

**Error:** `foreign key constraint "on_duty_requests_student_id_fkey" violation`

```
Detail: Key (student_id)=(c8203dae-238f-469c-adb1-1e4040eb0b96) is not present in table "students".
```

## Root Cause

The user is authenticated in the `users` table but **doesn't have a corresponding record in the `students` table**. This happens when:

1. User was created with role='student' in `users` table
2. No corresponding entry was created in `students` table
3. App tries to create on-duty request using `student_id` from frontend
4. Database foreign key constraint fails because `student_id` doesn't exist

## Quick Fix (Immediate)

### Option 1: Fix the Specific User (Fast)

Run this SQL command on your database:

```bash
cd /media/kishore/LDisk1/projects/senior_project/database
psql -U your_username -d your_database -f fix_missing_student.sql
```

Or manually via psql:

```sql
-- Create student record for the missing user
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
    u.email as name,
    u.email,
    '' as phone,
    'Default College' as college,
    'Not Specified' as department,
    'Not Specified' as year,
    CONCAT('REG', EXTRACT(YEAR FROM NOW()), LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')) as registration_number,
    'approved' as status
FROM users u
WHERE u.id = 'c8203dae-238f-469c-adb1-1e4040eb0b96'
  AND u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM students s WHERE s.user_id = u.id);
```

### Option 2: Fix ALL Missing Students (Comprehensive)

```sql
-- Auto-create student records for ALL users with role='student' but no student record
INSERT INTO students (
    id, user_id, name, email, phone, college, department, year, registration_number, status
)
SELECT
    gen_random_uuid(),
    u.id,
    u.email,
    u.email,
    '',
    'Default College',
    'Not Specified',
    'Not Specified',
    CONCAT('REG', EXTRACT(YEAR FROM NOW()), LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')),
    'approved'
FROM users u
WHERE u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM students s WHERE s.user_id = u.id);
```

## Permanent Solution (Prevention)

Add a trigger to automatically create student records when users are created:

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION create_student_record()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'student' THEN
        INSERT INTO students (
            id, user_id, name, email, phone, college,
            department, year, registration_number, status
        ) VALUES (
            gen_random_uuid(),
            NEW.id,
            COALESCE(NULLIF(NEW.email, ''), 'New Student'),
            NEW.email,
            '',
            'Default College',
            'Not Specified',
            'Not Specified',
            CONCAT('REG', EXTRACT(YEAR FROM NOW()), LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')),
            'pending'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER auto_create_student_record
    AFTER INSERT ON users
    FOR EACH ROW
    WHEN (NEW.role = 'student')
    EXECUTE FUNCTION create_student_record();
```

## Verification

### Check for Missing Records

```sql
-- Count mismatches
SELECT
    'Student Users' as type,
    COUNT(*) as count
FROM users WHERE role = 'student'
UNION ALL
SELECT
    'Student Records' as type,
    COUNT(*) as count
FROM students;
```

### List Missing Students

```sql
SELECT
    u.id as user_id,
    u.email,
    u.created_at
FROM users u
LEFT JOIN students s ON u.id = s.user_id
WHERE u.role = 'student' AND s.id IS NULL;
```

### Verify Specific User

```sql
SELECT
    u.id as user_id,
    u.email,
    u.role,
    s.id as student_id,
    s.name,
    s.status
FROM users u
LEFT JOIN students s ON u.id = s.user_id
WHERE u.id = 'c8203dae-238f-469c-adb1-1e4040eb0b96';
```

## Testing After Fix

1. **Run the SQL fix** (Option 1 or 2 above)

2. **Verify the record exists:**

   ```sql
   SELECT * FROM students WHERE user_id = 'c8203dae-238f-469c-adb1-1e4040eb0b96';
   ```

3. **Restart your backend:**

   ```bash
   cd /media/kishore/LDisk1/projects/senior_project/backend
   npm run build
   npm start
   ```

4. **Test in the app:**

   - Open StudentApp
   - Go to "On-Duty Request"
   - Fill out the form
   - Select a document
   - Submit

5. **Expected Result:**
   - ✅ Request submits successfully
   - ✅ No foreign key error
   - ✅ Request appears in "My OD Requests" tab

## Frontend Validation (Already Implemented)

The frontend already has protection against this:

```typescript
// In OnDutyRequestScreen.tsx
if (!currentStudent.id) {
  Alert.alert(
    "Error",
    "Your student profile is incomplete. Please logout and login again, or contact administrator."
  );
  return;
}
```

And user-friendly error messages:

```typescript
if (serverError.includes("student_id") || serverError.includes("foreign key")) {
  errorMessage =
    "Your student profile is not properly set up. Please logout and login again...";
}
```

## Long-term Best Practices

1. **Use Database Triggers:** Auto-create student records when users are created
2. **Data Validation:** Ensure user registration creates both `users` and `students` records
3. **Migration Scripts:** Run fix_missing_student.sql on existing databases
4. **Health Checks:** Add API endpoint to check data integrity
5. **Monitoring:** Log and alert on foreign key violations

## Common Issues

### Issue 1: User can't login after fix

**Solution:** Clear app cache and login again

### Issue 2: Still getting foreign key error

**Solution:**

- Verify SQL ran successfully
- Check the student record exists
- Restart backend server

### Issue 3: Multiple student records for one user

**Solution:**

```sql
-- Find duplicates
SELECT user_id, COUNT(*)
FROM students
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Delete duplicates (keep the oldest)
DELETE FROM students s1
USING students s2
WHERE s1.user_id = s2.user_id
  AND s1.created_at > s2.created_at;
```

## Summary

- ✅ **Immediate Fix:** Run `fix_missing_student.sql`
- ✅ **Prevention:** Add trigger to auto-create student records
- ✅ **Verification:** Check all student users have student records
- ✅ **Testing:** Verify on-duty request submission works
- ✅ **Frontend:** Already has user-friendly error handling

This is a **database migration issue**, not a code bug. The frontend code is correct and already handles this gracefully with user-friendly error messages.
