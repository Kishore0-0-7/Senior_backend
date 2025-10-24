# Backend Changes Summary for On-Duty System

## Overview

Added complete backend support for the On-Duty (OD) management system, enabling students to request on-duty permissions and mark attendance with location verification and selfie photos.

## Files Created

### 1. `/backend/src/routes/onduty.routes.ts`

Complete API route handler for On-Duty system with 10 endpoints:

**Student Endpoints:**

- `POST /api/onduty/request` - Create new OD request with document upload
- `GET /api/onduty/my-requests` - Get all requests for current student
- `GET /api/onduty/approved` - Get approved requests valid for today
- `POST /api/onduty/attendance` - Mark attendance with GPS + selfie
- `GET /api/onduty/attendance-history` - Get attendance history
- `DELETE /api/onduty/request/:id` - Delete pending request

**Admin Endpoints:**

- `GET /api/onduty/admin/requests` - Get all requests with filters
- `PUT /api/onduty/admin/requests/:id` - Approve/reject requests
- `GET /api/onduty/admin/attendance` - Get all attendance records

### 2. `/database/add_onduty_tables.sql`

SQL migration file creating:

- `on_duty_requests` table - Stores OD requests with approval workflow
- `on_duty_attendance` table - Stores attendance with GPS coordinates and photos
- Indexes for performance optimization on commonly queried fields
- Table and column comments for documentation

### 3. `/backend/ONDUTY_API_DOCUMENTATION.md`

Comprehensive API documentation including:

- Complete endpoint descriptions with request/response examples
- Authentication requirements
- Query parameters and filtering options
- File upload specifications
- Error handling documentation
- Testing examples with cURL commands
- Integration code samples for React Native

## Files Modified

### 1. `/backend/src/config/upload.ts`

**Changes:**

- Added `onDutyDocumentsDir` and `onDutySelfiesDir` directories
- Created `onDutyDocumentStorage` multer configuration
- Created `onDutySelfieStorage` multer configuration
- Added `documentFileFilter` for PDF, DOC, DOCX, and images (10MB limit)
- Exported `uploadOnDutyDocument` and `uploadOnDutySelfie` multer instances

**New Exports:**

```typescript
export const uploadOnDutyDocument = multer({ ... }); // 10MB, PDF/DOC/images
export const uploadOnDutySelfie = multer({ ... });   // 5MB, images only
```

### 2. `/backend/src/server.ts`

**Changes:**

- Imported `onduty.routes.ts`
- Added upload directories: `onduty-documents/` and `onduty-selfies/`
- Registered route: `app.use('/api/onduty', onDutyRoutes)`
- Ensured directories are created on server startup

**New Routes:**

```typescript
import onDutyRoutes from "./routes/onduty.routes";
app.use(`${API_PREFIX}/onduty`, onDutyRoutes);
```

**New Directories:**

```
uploads/
  ├── onduty-documents/  (PDF, DOC, DOCX, images - max 10MB)
  └── onduty-selfies/    (Images only - max 5MB)
```

## Database Schema

### `on_duty_requests` Table

```sql
- id (SERIAL PRIMARY KEY)
- student_id (INTEGER, FK to students)
- college_name (VARCHAR)
- start_date (DATE)
- start_time (TIME)
- end_date (DATE)
- end_time (TIME)
- reason (TEXT)
- document_url (VARCHAR) - optional
- status (VARCHAR) - 'pending', 'approved', 'rejected'
- approved_by (INTEGER, FK to admins) - nullable
- rejection_reason (TEXT) - nullable
- created_at, updated_at (TIMESTAMP)
```

### `on_duty_attendance` Table

```sql
- id (SERIAL PRIMARY KEY)
- on_duty_request_id (INTEGER, FK to on_duty_requests)
- student_id (INTEGER, FK to students)
- check_in_time (TIMESTAMP)
- latitude (DECIMAL)
- longitude (DECIMAL)
- address (TEXT) - optional
- selfie_photo_url (VARCHAR) - optional
- qr_data (TEXT) - optional
- created_at (TIMESTAMP)
```

### Indexes Created

```sql
- idx_on_duty_requests_student_id
- idx_on_duty_requests_status
- idx_on_duty_requests_dates
- idx_on_duty_attendance_request_id
- idx_on_duty_attendance_student_id
- idx_on_duty_attendance_check_in_time
```

## Key Features

### 1. File Upload Support

- **Documents**: PDF, DOC, DOCX, images (max 10MB) for OD requests
- **Selfies**: Images only (max 5MB) for attendance marking
- Files stored with UUID filenames to prevent conflicts
- Automatic directory creation on server startup

### 2. Authentication & Authorization

- All endpoints require JWT authentication
- Student endpoints: Restricted to student role
- Admin endpoints: Restricted to admin role
- Students can only access their own data

### 3. Business Logic Validations

- End date/time must be after start date/time
- OD requests must be approved before marking attendance
- Attendance can only be marked on valid dates (between start/end dates)
- Cannot mark attendance twice for same OD on same day
- Students can only delete pending requests

### 4. Filtering & Search

- Admin can filter requests by status, date range
- Admin can search by student name, email, registration, college name
- Admin can filter attendance by student and date range

### 5. Data Relationships

- Cascading deletes: Deleting a student removes their OD data
- Set NULL on admin deletion: Preserves historical approval data
- Foreign key constraints ensure data integrity

## Installation Steps

### 1. Install Dependencies

All required packages are already installed (multer, uuid, etc.)

### 2. Run Database Migration

```bash
cd database
psql -U your_username -d your_database -f add_onduty_tables.sql
```

### 3. Restart Backend Server

```bash
cd backend
npm run dev
```

The server will automatically:

- Create `uploads/onduty-documents/` directory
- Create `uploads/onduty-selfies/` directory
- Register `/api/onduty/*` routes

### 4. Verify Installation

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

## API Integration Example

### Student: Create OD Request

```typescript
const formData = new FormData();
formData.append("collegeName", "ABC College");
formData.append("startDate", "2025-10-25");
formData.append("startTime", "09:00");
formData.append("endDate", "2025-10-25");
formData.append("endTime", "17:00");
formData.append("reason", "Tech fest");
formData.append("document", {
  uri: documentUri,
  type: "application/pdf",
  name: "document.pdf",
});

const response = await api.post("/onduty/request", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
```

### Admin: Approve Request

```typescript
const response = await api.put("/onduty/admin/requests/1", {
  status: "approved",
});
```

### Student: Mark Attendance

```typescript
const formData = new FormData();
formData.append("onDutyRequestId", "1");
formData.append("latitude", "13.0827");
formData.append("longitude", "80.2707");
formData.append("address", "123 Main St");
formData.append("selfie", {
  uri: selfieUri,
  type: "image/jpeg",
  name: "selfie.jpg",
});

const response = await api.post("/onduty/attendance", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
```

## Testing Checklist

- [ ] Create OD request as student
- [ ] Upload document with OD request
- [ ] View my OD requests as student
- [ ] View all OD requests as admin
- [ ] Filter requests by status (pending/approved/rejected)
- [ ] Search requests by student name
- [ ] Approve OD request as admin
- [ ] Reject OD request with reason
- [ ] View approved OD requests as student
- [ ] Mark attendance with GPS location
- [ ] Upload selfie with attendance
- [ ] Verify cannot mark attendance twice
- [ ] View attendance history as student
- [ ] View all attendance as admin
- [ ] Delete pending OD request
- [ ] Verify cannot delete approved/rejected request

## Error Handling

All endpoints include proper error handling:

- Input validation (required fields, date validation)
- Authorization checks (student can only access own data)
- Business logic validation (dates, duplicate attendance)
- Database errors with meaningful messages
- File upload errors (size, type validation)

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Role-based access control (student/admin)
3. **Data Isolation**: Students can only access their own data
4. **File Validation**: File type and size limits enforced
5. **SQL Injection**: Using parameterized queries
6. **Path Traversal**: UUID filenames prevent directory traversal

## Performance Optimizations

1. **Database Indexes**: Created on frequently queried columns
2. **Selective Joins**: Only joining necessary tables
3. **Parameterized Queries**: Prepared statements for efficiency
4. **File Size Limits**: Prevents large file uploads

## Next Steps

1. **Frontend Integration**: Update StudentApp API service
2. **Admin UI**: Create OnDutyManagementScreen in admin app
3. **Notifications**: Add push notifications for status changes
4. **Analytics**: Add OD analytics to dashboard
5. **Reports**: Generate OD attendance reports

## Support

For API documentation, see: `backend/ONDUTY_API_DOCUMENTATION.md`
For database schema, see: `database/add_onduty_tables.sql`
For route implementation, see: `backend/src/routes/onduty.routes.ts`
