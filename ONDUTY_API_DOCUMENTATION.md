# On-Duty Management API Documentation

## Overview

The On-Duty (OD) Management API allows students to request on-duty permissions for external college events and mark attendance with location verification and selfie photos. Admins can review, approve, or reject these requests.

## Database Setup

Run the SQL migration to create the necessary tables:

```bash
psql -U your_username -d your_database -f database/add_onduty_tables.sql
```

This creates:

- `on_duty_requests` - Stores OD requests with approval status
- `on_duty_attendance` - Stores attendance records with location and photos

## API Endpoints

### Student Endpoints

#### 1. Create On-Duty Request

**POST** `/api/onduty/request`

Submit a new on-duty request with details and optional supporting document.

**Authentication:** Required (Student)

**Request:**

- Content-Type: `multipart/form-data`

**Form Fields:**

```
collegeName: string (required) - Name of the external college
startDate: string (required) - Start date (YYYY-MM-DD)
startTime: string (required) - Start time (HH:MM)
endDate: string (required) - End date (YYYY-MM-DD)
endTime: string (required) - End time (HH:MM)
reason: string (required) - Reason for OD request
document: file (optional) - Supporting document (PDF, images, DOC/DOCX, max 10MB)
```

**Response:**

```json
{
  "success": true,
  "message": "On-duty request submitted successfully",
  "data": {
    "id": 1,
    "student_id": 5,
    "college_name": "ABC College",
    "start_date": "2025-10-25",
    "start_time": "09:00:00",
    "end_date": "2025-10-25",
    "end_time": "17:00:00",
    "reason": "Tech fest participation",
    "document_url": "/uploads/onduty-documents/abc123.pdf",
    "status": "pending",
    "created_at": "2025-10-24T10:30:00.000Z"
  }
}
```

---

#### 2. Get My On-Duty Requests

**GET** `/api/onduty/my-requests`

Retrieve all on-duty requests submitted by the current student.

**Authentication:** Required (Student)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "student_id": 5,
      "college_name": "ABC College",
      "start_date": "2025-10-25",
      "start_time": "09:00:00",
      "end_date": "2025-10-25",
      "end_time": "17:00:00",
      "reason": "Tech fest participation",
      "document_url": "/uploads/onduty-documents/abc123.pdf",
      "status": "approved",
      "approved_by": 1,
      "approved_by_name": "Admin Name",
      "rejection_reason": null,
      "created_at": "2025-10-24T10:30:00.000Z",
      "updated_at": "2025-10-24T11:00:00.000Z"
    }
  ]
}
```

---

#### 3. Get Approved On-Duty Requests

**GET** `/api/onduty/approved`

Get only approved OD requests that are valid for today.

**Authentication:** Required (Student)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "college_name": "ABC College",
      "start_date": "2025-10-24",
      "end_date": "2025-10-26",
      "approved_by_name": "Admin Name"
    }
  ]
}
```

---

#### 4. Mark On-Duty Attendance

**POST** `/api/onduty/attendance`

Mark attendance for an approved on-duty request with GPS location and selfie.

**Authentication:** Required (Student)

**Request:**

- Content-Type: `multipart/form-data`

**Form Fields:**

```
onDutyRequestId: number (required) - ID of the approved OD request
latitude: number (required) - GPS latitude
longitude: number (required) - GPS longitude
address: string (optional) - Reverse geocoded address
qrData: string (optional) - QR code data
selfie: file (optional) - Selfie photo (images only, max 5MB)
```

**Response:**

```json
{
  "success": true,
  "message": "On-duty attendance marked successfully",
  "data": {
    "id": 1,
    "on_duty_request_id": 1,
    "student_id": 5,
    "check_in_time": "2025-10-25T09:30:00.000Z",
    "latitude": 13.0827,
    "longitude": 80.2707,
    "address": "123 Main St, Chennai",
    "selfie_photo_url": "/uploads/onduty-selfies/xyz789.jpg",
    "qr_data": "{\"type\":\"ON_DUTY_ATTENDANCE\",\"studentId\":5}",
    "created_at": "2025-10-25T09:30:00.000Z"
  }
}
```

**Validations:**

- OD request must be approved
- OD request must be valid for today (between start_date and end_date)
- Cannot mark attendance twice for the same OD request on the same day

---

#### 5. Get On-Duty Attendance History

**GET** `/api/onduty/attendance-history`

Retrieve attendance history for all on-duty requests.

**Authentication:** Required (Student)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "on_duty_request_id": 1,
      "student_id": 5,
      "check_in_time": "2025-10-25T09:30:00.000Z",
      "latitude": 13.0827,
      "longitude": 80.2707,
      "address": "123 Main St, Chennai",
      "selfie_photo_url": "/uploads/onduty-selfies/xyz789.jpg",
      "college_name": "ABC College",
      "start_date": "2025-10-25",
      "end_date": "2025-10-25"
    }
  ]
}
```

---

#### 6. Delete On-Duty Request

**DELETE** `/api/onduty/request/:id`

Delete a pending on-duty request. Only pending requests can be deleted.

**Authentication:** Required (Student)

**Parameters:**

- `id` - Request ID

**Response:**

```json
{
  "success": true,
  "message": "On-duty request deleted successfully"
}
```

---

### Admin Endpoints

#### 1. Get All On-Duty Requests

**GET** `/api/onduty/admin/requests`

Retrieve all on-duty requests with filtering options.

**Authentication:** Required (Admin)

**Query Parameters:**

- `status` (optional) - Filter by status: "pending", "approved", "rejected"
- `search` (optional) - Search by student name, email, registration number, or college name
- `startDate` (optional) - Filter by start date (YYYY-MM-DD)
- `endDate` (optional) - Filter by end date (YYYY-MM-DD)

**Example:** `/api/onduty/admin/requests?status=pending&search=John`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "student_id": 5,
      "student_name": "John Doe",
      "student_email": "john@example.com",
      "registration_number": "2021001",
      "department": "Computer Science",
      "college": "Main Campus",
      "college_name": "ABC College",
      "start_date": "2025-10-25",
      "start_time": "09:00:00",
      "end_date": "2025-10-25",
      "end_time": "17:00:00",
      "reason": "Tech fest participation",
      "document_url": "/uploads/onduty-documents/abc123.pdf",
      "status": "pending",
      "approved_by": null,
      "approved_by_name": null,
      "rejection_reason": null,
      "created_at": "2025-10-24T10:30:00.000Z",
      "updated_at": "2025-10-24T10:30:00.000Z"
    }
  ]
}
```

---

#### 2. Approve/Reject On-Duty Request

**PUT** `/api/onduty/admin/requests/:id`

Approve or reject an on-duty request.

**Authentication:** Required (Admin)

**Parameters:**

- `id` - Request ID

**Request Body:**

```json
{
  "status": "approved",
  "rejectionReason": null
}
```

Or for rejection:

```json
{
  "status": "rejected",
  "rejectionReason": "Invalid supporting documents"
}
```

**Response:**

```json
{
  "success": true,
  "message": "On-duty request approved successfully",
  "data": {
    "id": 1,
    "status": "approved",
    "approved_by": 1,
    "updated_at": "2025-10-24T11:00:00.000Z"
  }
}
```

---

#### 3. Get All On-Duty Attendance Records

**GET** `/api/onduty/admin/attendance`

Retrieve all on-duty attendance records with filtering.

**Authentication:** Required (Admin)

**Query Parameters:**

- `studentId` (optional) - Filter by student ID
- `startDate` (optional) - Filter by check-in date (YYYY-MM-DD)
- `endDate` (optional) - Filter by check-in date (YYYY-MM-DD)

**Example:** `/api/onduty/admin/attendance?studentId=5&startDate=2025-10-01`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "on_duty_request_id": 1,
      "student_id": 5,
      "student_name": "John Doe",
      "student_email": "john@example.com",
      "registration_number": "2021001",
      "check_in_time": "2025-10-25T09:30:00.000Z",
      "latitude": 13.0827,
      "longitude": 80.2707,
      "address": "123 Main St, Chennai",
      "selfie_photo_url": "/uploads/onduty-selfies/xyz789.jpg",
      "college_name": "ABC College",
      "od_start_date": "2025-10-25",
      "od_end_date": "2025-10-25",
      "created_at": "2025-10-25T09:30:00.000Z"
    }
  ]
}
```

---

## File Upload Limits

- **Documents** (PDF, DOC, DOCX, Images): 10MB
- **Selfie Photos** (Images only): 5MB

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error message here",
  "statusCode": 400
}
```

Common error codes:

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (no token or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## Testing the API

### 1. Create an OD Request (Student)

```bash
curl -X POST http://localhost:3000/api/onduty/request \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
  -F "collegeName=ABC College" \
  -F "startDate=2025-10-25" \
  -F "startTime=09:00" \
  -F "endDate=2025-10-25" \
  -F "endTime=17:00" \
  -F "reason=Tech fest participation" \
  -F "document=@/path/to/document.pdf"
```

### 2. Get All Pending Requests (Admin)

```bash
curl -X GET "http://localhost:3000/api/onduty/admin/requests?status=pending" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 3. Approve a Request (Admin)

```bash
curl -X PUT http://localhost:3000/api/onduty/admin/requests/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

### 4. Mark Attendance (Student)

```bash
curl -X POST http://localhost:3000/api/onduty/attendance \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
  -F "onDutyRequestId=1" \
  -F "latitude=13.0827" \
  -F "longitude=80.2707" \
  -F "address=123 Main St, Chennai" \
  -F "selfie=@/path/to/selfie.jpg"
```

---

## Integration with StudentApp

Update the `StudentApp/src/services/api.ts` file to add these API calls:

```typescript
// On-Duty Request APIs
export const onDutyAPI = {
  createRequest: async (requestData: FormData) => {
    const response = await api.post("/onduty/request", requestData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  getMyRequests: async () => {
    const response = await api.get("/onduty/my-requests");
    return response.data;
  },

  getApprovedRequests: async () => {
    const response = await api.get("/onduty/approved");
    return response.data;
  },

  markAttendance: async (attendanceData: FormData) => {
    const response = await api.post("/onduty/attendance", attendanceData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  getAttendanceHistory: async () => {
    const response = await api.get("/onduty/attendance-history");
    return response.data;
  },

  deleteRequest: async (requestId: number) => {
    const response = await api.delete(`/onduty/request/${requestId}`);
    return response.data;
  },
};

// Admin On-Duty APIs
export const adminOnDutyAPI = {
  getAllRequests: async (filters?: {
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const params = new URLSearchParams(filters as any);
    const response = await api.get(`/onduty/admin/requests?${params}`);
    return response.data;
  },

  updateRequestStatus: async (
    requestId: number,
    status: "approved" | "rejected",
    rejectionReason?: string
  ) => {
    const response = await api.put(`/onduty/admin/requests/${requestId}`, {
      status,
      rejectionReason,
    });
    return response.data;
  },

  getAllAttendance: async (filters?: {
    studentId?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const params = new URLSearchParams(filters as any);
    const response = await api.get(`/onduty/admin/attendance?${params}`);
    return response.data;
  },
};
```

---

## Notes

1. **Permissions**: All Android permissions (CAMERA, ACCESS_FINE_LOCATION) are already configured in the StudentApp's AndroidManifest.xml
2. **Upload Directories**: Directories are automatically created on server startup
3. **Authentication**: All endpoints require valid JWT tokens (except public endpoints)
4. **File Storage**: Uploaded files are stored in the `uploads/` directory with subdirectories for each type
5. **Database Indexes**: Indexes are created for optimal query performance on frequently accessed columns

---

## Complete Workflow

1. **Student** submits OD request with college details, dates, times, and supporting document
2. **Admin** views all pending requests in the admin panel
3. **Admin** reviews the request and supporting document
4. **Admin** approves or rejects the request with optional reason
5. **Student** receives notification/sees updated status
6. On the OD date, **Student** opens the app and:
   - Scans/shows their student QR code
   - Selects the approved OD event
   - App captures GPS location automatically
   - Student takes a selfie photo
   - Marks attendance
7. **Admin** can view all attendance records with location and photo verification
