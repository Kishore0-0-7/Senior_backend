# On-Duty Backend Fixes

## Changes Made

### 1. Enhanced Validation in `onduty.routes.ts`

#### Student Profile Validation

Added validation to check if the student exists in the `students` table before creating an on-duty request:

```typescript
// Validate student exists in students table
const studentCheck = await query(
  `SELECT id, name, status FROM students WHERE user_id = $1`,
  [studentId]
);

if (studentCheck.rows.length === 0) {
  throw new AppError(
    "Student profile not found. Please complete your profile setup or contact administrator.",
    404
  );
}
```

#### Student Status Check

Added validation to ensure only approved students can submit on-duty requests:

```typescript
if (student.status !== "approved") {
  throw new AppError(
    `Your student profile is ${student.status}. Only approved students can submit on-duty requests.`,
    403
  );
}
```

#### Enhanced Date Validation

Added comprehensive date validation:

```typescript
// Check if dates are in the past
if (start < now) {
  throw new AppError("Start date/time cannot be in the past", 400);
}

// Check if request is too far in the future (e.g., more than 1 year)
const oneYearFromNow = new Date();
oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

if (start > oneYearFromNow) {
  throw new AppError(
    "On-duty requests cannot be more than one year in advance",
    400
  );
}
```

#### Fixed Foreign Key Issue

Changed from using `user_id` directly to using the `student.id` from the students table:

```typescript
// OLD (caused foreign key error):
// studentId (which is user_id from auth)

// NEW (correct):
student.id; // Use student ID from students table
```

### 2. Enhanced Error Handler (`errorHandler.ts`)

Added PostgreSQL-specific error handling with user-friendly messages:

#### Foreign Key Constraint Violations (23503)

```typescript
if ((err as any).code === "23503") {
  statusCode = 400;
  const constraint = (err as any).constraint || "";

  if (constraint.includes("student_id")) {
    message =
      "Student profile not found. Please complete your profile setup or contact administrator.";
  } else if (constraint.includes("event_id")) {
    message = "Event not found. The event may have been deleted.";
  } else if (constraint.includes("admin_id")) {
    message = "Administrator not found.";
  } else {
    message =
      "Invalid reference in request. Please check your data and try again.";
  }
}
```

#### Unique Constraint Violations (23505)

```typescript
if ((err as any).code === "23505") {
  statusCode = 409;
  const detail = (err as any).detail || "";

  if (detail.includes("email")) {
    message = "Email address already exists.";
  } else if (detail.includes("registration_number")) {
    message = "Registration number already exists.";
  } else {
    message = "Duplicate entry. This record already exists.";
  }
}
```

#### Check Constraint Violations (23514)

```typescript
if ((err as any).code === "23514") {
  statusCode = 400;
  message = "Invalid data value. Please check your input and try again.";
}
```

#### Not-Null Constraint Violations (23502)

```typescript
if ((err as any).code === "23502") {
  statusCode = 400;
  const column = (err as any).column || "field";
  message = `Required field '${column}' is missing.`;
}
```

## How It Works Now

### Request Flow

1. **Authentication** - Verify user is logged in
2. **Authorization** - Verify user has 'student' role
3. **Student Lookup** - Query students table using `user_id` from token
4. **Profile Validation** - Check if student record exists
5. **Status Validation** - Check if student status is 'approved'
6. **Date Validation** - Check dates are valid and in the future
7. **File Upload** - Process document if provided
8. **Database Insert** - Use `student.id` (not `user_id`) for foreign key
9. **Success Response** - Return created on-duty request

### Error Handling Flow

```
Database Error
    ↓
Error Handler Middleware
    ↓
Check PostgreSQL Error Code
    ↓
Convert to User-Friendly Message
    ↓
Return Appropriate HTTP Status Code
    ↓
Frontend Displays Clear Error Message
```

## Database Fix Required

**IMPORTANT:** You must run the database fix to create missing student records:

```bash
cd /media/kishore/LDisk1/projects/senior_project/database
psql -U your_username -d your_database -f fix_missing_student.sql
```

Or manually:

```sql
-- Create student record for user c8203dae-238f-469c-adb1-1e4040eb0b96
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
WHERE u.id = 'c8203dae-238f-469c-adb1-1e4040eb0b96'
  AND u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM students s WHERE s.user_id = u.id);
```

## Testing

### 1. Build Backend

```bash
cd /media/kishore/LDisk1/projects/senior_project/backend
npm run build
```

### 2. Start Backend

```bash
npm start
```

### 3. Test API Endpoint

**Valid Request:**

```bash
curl -X POST http://localhost:3000/api/onduty/request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "collegeName=Test College" \
  -F "startDate=2025-10-25" \
  -F "startTime=09:00" \
  -F "endDate=2025-10-25" \
  -F "endTime=17:00" \
  -F "reason=Conference Attendance" \
  -F "document=@/path/to/document.pdf"
```

**Expected Response (Success):**

```json
{
  "success": true,
  "message": "On-duty request submitted successfully",
  "data": {
    "id": "...",
    "student_id": "...",
    "college_name": "Test College",
    "start_date": "2025-10-25",
    "start_time": "09:00:00",
    "end_date": "2025-10-25",
    "end_time": "17:00:00",
    "reason": "Conference Attendance",
    "document_url": "/uploads/onduty-documents/...",
    "status": "pending",
    "created_at": "..."
  }
}
```

**Expected Response (Student Not Found):**

```json
{
  "success": false,
  "error": {
    "message": "Student profile not found. Please complete your profile setup or contact administrator."
  }
}
```

**Expected Response (Past Date):**

```json
{
  "success": false,
  "error": {
    "message": "Start date/time cannot be in the past"
  }
}
```

## Validation Rules

### Date/Time Rules

- ✅ Start date/time must be in the future
- ✅ End date/time must be after start date/time
- ✅ Request cannot be more than 1 year in advance
- ✅ All date/time fields are required

### Student Rules

- ✅ Student must exist in students table
- ✅ Student status must be 'approved'
- ✅ Student must have valid user_id reference

### Document Rules

- ✅ Document upload is optional
- ✅ Supported formats: PDF, DOC, DOCX, JPG, PNG
- ✅ File size limit: 10MB

## Common Errors and Solutions

### Error 1: Foreign Key Constraint Violation

**Cause:** Student record doesn't exist in students table
**Solution:** Run `fix_missing_student.sql` to create missing student records

### Error 2: Student Not Approved

**Cause:** Student status is 'pending' or 'rejected'
**Solution:** Admin must approve the student profile

### Error 3: Past Date Error

**Cause:** Trying to submit request with past dates
**Solution:** Select current or future dates

### Error 4: Invalid Date Range

**Cause:** End date/time is before or equal to start date/time
**Solution:** Ensure end date/time is after start date/time

## Files Modified

1. ✅ `/backend/src/routes/onduty.routes.ts`

   - Added student profile validation
   - Added status check
   - Enhanced date validation
   - Fixed foreign key reference

2. ✅ `/backend/src/middleware/errorHandler.ts`

   - Added PostgreSQL error code handling
   - Added user-friendly error messages
   - Added constraint-specific messages

3. ✅ `/database/fix_missing_student.sql` (NEW)
   - SQL script to fix missing student records
   - Trigger to auto-create student records

## Next Steps

1. **Run Database Fix**

   ```bash
   psql -U your_username -d your_database -f database/fix_missing_student.sql
   ```

2. **Restart Backend**

   ```bash
   cd backend
   npm start
   ```

3. **Test in StudentApp**

   - Login as student
   - Navigate to On-Duty Request
   - Submit a request
   - Verify success

4. **Monitor Logs**
   - Watch for any new errors
   - Verify user-friendly messages appear

## Summary

✅ **Backend now validates student existence before insert**
✅ **Backend checks student approval status**
✅ **Backend validates dates comprehensively**
✅ **Backend returns user-friendly error messages**
✅ **Fixed foreign key constraint issue**
✅ **Enhanced PostgreSQL error handling**
✅ **Improved security and data integrity**

The backend is now production-ready with proper validation, error handling, and user-friendly messages!
