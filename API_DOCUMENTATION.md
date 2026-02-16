# API Documentation

Complete API reference for the Student Event Management System backend.

**Base URL**: `https://your-backend.onrender.com/api` (Production)  
**Base URL**: `http://localhost:3000/api` (Development)

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Database Connection Test](#database-connection-test)
3. [Admin Creation (POST)](#admin-creation-post)
4. [Auth Endpoints](#auth-endpoints)
5. [Admin Endpoints](#admin-endpoints)
6. [Student Endpoints](#student-endpoints)
7. [Event Endpoints](#event-endpoints)
8. [Attendance Endpoints](#attendance-endpoints)
9. [Certificate Endpoints](#certificate-endpoints)
10. [On-Duty Endpoints](#on-duty-endpoints)
11. [Analytics Endpoints](#analytics-endpoints)
12. [Error Responses](#error-responses)

---

## Authentication & Authorization

### Authorization Header

Most endpoints require authentication. Include the JWT token in the request header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles

- **Admin**: Full access to all endpoints
- **Student**: Access to student-specific endpoints

---

## Database Connection Test

### Test Database Connection

**Endpoint**: `GET /api/test-db`

**Description**: Test database connectivity and retrieve database information. Useful for debugging connection issues and verifying deployment.

**Authentication**: None (Public endpoint)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Database connection successful",
  "data": {
    "connected": true,
    "timestamp": "2026-02-16T10:30:00.000Z",
    "database": {
      "name": "student_event_management",
      "host": "dpg-d66qnu06fj8s739bk8jg-a.singapore-postgres.render.com",
      "port": "5432",
      "version": "PostgreSQL 15.3 on x86_64-pc-linux-gnu..."
    },
    "tables": {
      "total": 15
    },
    "records": {
      "users": 25,
      "students": 20,
      "events": 10
    }
  }
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "success": false,
  "message": "Database connection failed",
  "error": {
    "message": "connection to server at \"localhost\" (127.0.0.1), port 5432 failed",
    "code": "ECONNREFUSED",
    "detail": "Error stack trace (only in development)"
  }
}
```

**Use Cases**:
1. **Initial Setup**: Verify database credentials are correct
2. **Deployment**: Check if deployed app can reach database
3. **Debugging**: Diagnose connection issues
4. **Monitoring**: Quick health check for database

**cURL Example**:
```bash
# Test local database
curl http://localhost:3000/api/test-db

# Test production database
curl https://your-backend.onrender.com/api/test-db
```

**React Native Example**:
```javascript
const testDatabaseConnection = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/test-db`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Database connected');
      console.log('Database version:', data.data.database.version);
      console.log('Total tables:', data.data.tables.total);
      console.log('User count:', data.data.records.users);
      return true;
    } else {
      console.error('❌ Database connection failed:', data.error.message);
      Alert.alert('Database Error', data.error.message);
      return false;
    }
  } catch (error) {
    console.error('Network error:', error);
    return false;
  }
};

// Usage
await testDatabaseConnection();
```

**Information Returned**:
- **connected**: Boolean indicating successful connection
- **timestamp**: Current database server time
- **database.name**: Database name
- **database.host**: Database host address
- **database.port**: Database port
- **database.version**: PostgreSQL version and details
- **tables.total**: Number of tables in the public schema
- **records.users**: Total user count
- **records.students**: Total student count
- **records.events**: Total event count

**Security Note**: This endpoint is public but doesn't expose sensitive data like passwords. In production, you may want to restrict access or disable it.

---

## Admin Creation (POST)

### Create Admin Account

**Endpoint**: `POST /api/admin/add-login`

**Description**: Creates a new admin account. This is the primary method to create admin users.

**Authentication**: None (Public endpoint - can be restricted via `ALLOW_ADMIN_CREATION` env variable)

**Request Body**:
```json
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "password": "securepassword123"
}
```

**Validation Rules**:
- `name`: Required, string
- `email`: Required, valid email format
- `password`: Required, minimum 6 characters

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "Admin account created successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@example.com",
      "role": "admin"
    },
    "admin": {
      "id": 1,
      "name": "Admin Name"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**:

- **400 Bad Request**:
```json
{
  "success": false,
  "message": "Name, email, and password are required"
}
```

- **400 Bad Request** (Invalid email):
```json
{
  "success": false,
  "message": "Invalid email format"
}
```

- **400 Bad Request** (Weak password):
```json
{
  "success": false,
  "message": "Password must be at least 6 characters long"
}
```

- **409 Conflict** (Email exists):
```json
{
  "success": false,
  "message": "Email already registered. Please use a different email."
}
```

**cURL Example**:
```bash
curl -X POST https://your-backend.onrender.com/api/admin/add-login \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Admin",
    "email": "john@admin.com",
    "password": "admin123"
  }'
```

**React Native Example**:
```javascript
const createAdmin = async () => {
  const response = await fetch(`${API_URL}/admin/add-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'John Admin',
      email: 'john@admin.com',
      password: 'admin123',
    }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Store token
    await AsyncStorage.setItem('authToken', data.data.token);
    console.log('Admin created:', data.data.admin);
  }
};
```

**Important Notes**:
1. This endpoint can be disabled in production by setting `ALLOW_ADMIN_CREATION=false` in environment variables
2. The response includes a JWT token that can be used immediately for authentication
3. Admin accounts have full access to all system features
4. Email must be unique across all users (both admins and students)

---

## Auth Endpoints

### 1. Register Student

**Endpoint**: `POST /api/auth/register`

**Description**: Register a new student account

**Authentication**: None

**Request Body**:
```json
{
  "full_name": "John Doe",
  "email": "john@student.com",
  "password": "password123",
  "phone_number": "1234567890",
  "college": "Engineering College",
  "year": 2,
  "department": "Computer Science",
  "roll_number": "CS2023001",
  "address": "123 Main St",
  "date_of_birth": "2003-05-15"
}
```

**Alternative Field Names** (for flexibility):
- `name` instead of `full_name`
- `phone` instead of `phone_number`
- `registration_number` instead of `roll_number`

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": 5,
      "email": "john@student.com",
      "role": "student"
    },
    "student": {
      "id": 5,
      "name": "John Doe",
      "email": "john@student.com",
      "status": "pending"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Login

**Endpoint**: `POST /api/auth/login`

**Description**: Login for both admin and student users

**Authentication**: None

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "role": "student"
    },
    "student": {
      "id": 1,
      "name": "John Doe",
      "status": "approved",
      "profile_photo_url": "https://backend.com/uploads/profile-photos/abc.jpg"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Get Current User Profile

**Endpoint**: `GET /api/auth/me`

**Description**: Get currently authenticated user's profile

**Authentication**: Required (Bearer Token)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "role": "student"
    },
    "profile": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "1234567890",
      "college": "Engineering College",
      "year": 2,
      "department": "Computer Science",
      "registration_number": "CS2023001",
      "status": "approved",
      "profile_photo_url": "https://backend.com/uploads/profile-photos/abc.jpg"
    }
  }
}
```

### 4. Logout

**Endpoint**: `POST /api/auth/logout`

**Description**: Logout current user (client should delete token)

**Authentication**: Required

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 5. Verify Email

**Endpoint**: `POST /api/auth/verify-email`

**Description**: Verify student email with code

**Authentication**: None

**Request Body**:
```json
{
  "email": "student@example.com",
  "verificationCode": "123456"
}
```

---

## Admin Endpoints

### 1. Admin Login

**Endpoint**: `POST /api/admin/login`

**Description**: Admin-specific login endpoint

**Authentication**: None

**Request Body**:
```json
{
  "email": "admin@example.com",
  "password": "adminpassword"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@example.com",
      "role": "admin"
    },
    "admin": {
      "id": 1,
      "name": "Admin Name"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Get All Students

**Endpoint**: `GET /api/admin/students`

**Description**: Get list of all students (admin only)

**Authentication**: Required (Admin)

**Query Parameters**:
- `status` (optional): Filter by approval status (pending, approved, rejected)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@student.com",
      "college": "Engineering College",
      "department": "Computer Science",
      "year": 2,
      "status": "approved"
    }
  ]
}
```

### 3. Get All Events

**Endpoint**: `GET /api/admin/events`

**Description**: Get all events (admin only)

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Tech Fest 2026",
      "description": "Annual technology festival",
      "event_date": "2026-03-15",
      "location": "Main Auditorium",
      "max_participants": 100,
      "status": "upcoming"
    }
  ]
}
```

### 4. Get All Attendance Records

**Endpoint**: `GET /api/admin/attendance`

**Description**: Get all attendance records (admin only)

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "event_id": 1,
      "student_id": 5,
      "student_name": "John Doe",
      "event_title": "Tech Fest 2026",
      "marked_at": "2026-03-15T10:30:00Z",
      "status": "present"
    }
  ]
}
```

### 5. Get All Certificates

**Endpoint**: `GET /api/admin/certificates`

**Description**: Get all uploaded certificates (admin only)

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "student_id": 5,
      "student_name": "John Doe",
      "title": "Best Project Award",
      "certificate_type": "Achievement",
      "file_url": "https://backend.com/uploads/certificates/student/cert.pdf",
      "status": "Pending",
      "uploaded_at": "2026-02-15T14:20:00Z"
    }
  ]
}
```

---

## Student Endpoints

### 1. Get All Students

**Endpoint**: `GET /api/students`

**Description**: Get list of students with filters

**Authentication**: Required (Admin)

**Query Parameters**:
- `status` (optional): pending, approved, rejected
- `college` (optional): Filter by college name
- `department` (optional): Filter by department
- `search` (optional): Search by name or email

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [...]
}
```

### 2. Get Student by ID

**Endpoint**: `GET /api/students/:id`

**Description**: Get specific student details

**Authentication**: Required (Student can view own, Admin can view all)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@student.com",
    "phone": "1234567890",
    "college": "Engineering College",
    "year": 2,
    "department": "Computer Science",
    "registration_number": "CS2023001",
    "status": "approved",
    "profile_photo_url": "https://backend.com/uploads/profile-photos/abc.jpg"
  }
}
```

### 3. Get Student Events

**Endpoint**: `GET /api/students/:id/events`

**Description**: Get events registered by a student

**Authentication**: Required

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "event_id": 1,
      "title": "Tech Fest 2026",
      "event_date": "2026-03-15",
      "registration_status": "confirmed"
    }
  ]
}
```

### 4. Upload Profile Photo

**Endpoint**: `POST /api/students/:id/photo`

**Description**: Upload or update student profile photo

**Authentication**: Required (Student own profile or Admin)

**Request**: `multipart/form-data`

**Form Fields**:
- `photo`: Image file (JPEG, PNG, GIF, WebP)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Profile photo updated successfully",
  "data": {
    "id": 1,
    "profile_photo_url": "https://backend.com/uploads/profile-photos/abc123.jpg"
  }
}
```

**cURL Example**:
```bash
curl -X POST https://backend.com/api/students/1/photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@/path/to/image.jpg"
```

### 5. Update Student Profile

**Endpoint**: `PUT /api/students/:id`

**Description**: Update student profile information

**Authentication**: Required (Student own profile or Admin)

**Request Body**:
```json
{
  "name": "John Updated",
  "phone": "9876543210",
  "address": "456 New Street"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "name": "John Updated",
    "phone": "9876543210"
  }
}
```

### 6. Update Student Status (Admin Only)

**Endpoint**: `PUT /api/students/:id/status`

**Description**: Approve or reject student registration

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "status": "approved"
}
```

Values: `approved`, `rejected`, `pending`

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Student status updated successfully",
  "data": {
    "id": 1,
    "status": "approved"
  }
}
```

### 7. Verify Student Email (Admin Only)

**Endpoint**: `PUT /api/students/:id/verify-email`

**Description**: Manually verify student email

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### 8. Delete Student (Admin Only)

**Endpoint**: `DELETE /api/students/:id`

**Description**: Delete student account

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Student deleted successfully"
}
```

---

## Event Endpoints

### 1. Get All Events (Public)

**Endpoint**: `GET /api/events`

**Description**: Get list of all events (upcoming and past)

**Authentication**: Optional

**Query Parameters**:
- `status` (optional): upcoming, ongoing, completed
- `search` (optional): Search by title or description

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Tech Fest 2026",
      "description": "Annual technology festival",
      "event_date": "2026-03-15",
      "event_time": "10:00:00",
      "location": "Main Auditorium",
      "max_participants": 100,
      "current_participants": 45,
      "status": "upcoming",
      "qr_code": "data:image/png;base64,..."
    }
  ]
}
```

### 2. Create Event (Admin Only)

**Endpoint**: `POST /api/events`

**Description**: Create a new event

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "title": "Tech Fest 2026",
  "description": "Annual technology festival",
  "event_date": "2026-03-15",
  "event_time": "10:00:00",
  "location": "Main Auditorium",
  "max_participants": 100,
  "registration_deadline": "2026-03-10"
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "id": 1,
    "title": "Tech Fest 2026",
    "qr_code": "data:image/png;base64,..."
  }
}
```

### 3. Get Event by ID

**Endpoint**: `GET /api/events/:id`

**Description**: Get specific event details

**Authentication**: Optional

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Tech Fest 2026",
    "description": "Annual technology festival",
    "event_date": "2026-03-15",
    "event_time": "10:00:00",
    "location": "Main Auditorium",
    "max_participants": 100,
    "current_participants": 45,
    "qr_code": "data:image/png;base64,..."
  }
}
```

### 4. Register for Event

**Endpoint**: `POST /api/events/:id/register`

**Description**: Register student for an event

**Authentication**: Required (Student)

**Request Body**: Empty `{}`

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "Successfully registered for event",
  "data": {
    "registration_id": 1,
    "event_id": 1,
    "student_id": 5,
    "status": "confirmed"
  }
}
```

### 5. Update Event (Admin Only)

**Endpoint**: `PUT /api/events/:id`

**Description**: Update event details

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "title": "Updated Event Title",
  "max_participants": 150
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Event updated successfully"
}
```

### 6. Delete Event (Admin Only)

**Endpoint**: `DELETE /api/events/:id`

**Description**: Delete an event

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

### 7. Get Event Participants

**Endpoint**: `GET /api/events/:id/participants`

**Description**: Get list of students registered for an event

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "student_id": 5,
      "name": "John Doe",
      "email": "john@student.com",
      "registration_status": "confirmed",
      "registered_at": "2026-02-15T10:00:00Z"
    }
  ]
}
```

### 8. Get Event Attendance

**Endpoint**: `GET /api/events/:id/attendance`

**Description**: Get attendance records for an event

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "student_id": 5,
      "name": "John Doe",
      "marked_at": "2026-03-15T10:30:00Z",
      "status": "present",
      "proof_photo_url": "https://backend.com/uploads/attendance-photos/xyz.jpg"
    }
  ]
}
```

---

## Attendance Endpoints

### 1. Generate QR Code for Event

**Endpoint**: `POST /api/attendance/generate-qr`

**Description**: Generate QR code for event attendance

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "eventId": 1
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "event_id": 1
  }
}
```

### 2. Mark Attendance (with Photo)

**Endpoint**: `POST /api/attendance/mark`

**Description**: Mark attendance with selfie photo and location

**Authentication**: Required (Student)

**Request Body**:
```json
{
  "eventId": 1,
  "studentId": 5,
  "photoData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "qrData": "event-1-qr-data"
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "Attendance marked successfully",
  "data": {
    "id": 1,
    "event_id": 1,
    "student_id": 5,
    "marked_at": "2026-03-15T10:30:00Z",
    "proof_photo_url": "https://backend.com/uploads/attendance-photos/event1_student5_123456.jpg",
    "latitude": 12.9716,
    "longitude": 77.5946
  }
}
```

### 3. Get Student Attendance History

**Endpoint**: `GET /api/attendance/student/:studentId`

**Description**: Get attendance history for a student

**Authentication**: Required (Student own or Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "event_id": 1,
      "event_title": "Tech Fest 2026",
      "marked_at": "2026-03-15T10:30:00Z",
      "status": "present"
    }
  ]
}
```

### 4. Get Event Attendance Records

**Endpoint**: `GET /api/attendance/event/:eventId`

**Description**: Get all attendance records for an event

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "student_id": 5,
      "student_name": "John Doe",
      "marked_at": "2026-03-15T10:30:00Z",
      "proof_photo_url": "https://backend.com/uploads/attendance-photos/xyz.jpg"
    }
  ]
}
```

### 5. Update Attendance Status (Admin Only)

**Endpoint**: `PUT /api/attendance/:id/status`

**Description**: Update attendance status

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "status": "present"
}
```

Values: `present`, `absent`, `late`

---

## Certificate Endpoints

### 1. Upload Certificate

**Endpoint**: `POST /api/certificates/upload`

**Description**: Upload a certificate (PDF or Image)

**Authentication**: Required (Student)

**Request**: `multipart/form-data`

**Form Fields**:
- `certificate`: File (PDF, JPEG, PNG)
- `title`: Certificate title (required)
- `category`: Certificate category (optional)
- `description`: Description (optional)
- `event_id`: Related event ID (optional)

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "Certificate uploaded successfully",
  "data": {
    "id": 1,
    "student_id": 5,
    "title": "Best Project Award",
    "certificate_type": "Achievement",
    "file_url": "https://backend.com/uploads/certificates/student_email/cert-123.pdf",
    "status": "Pending"
  }
}
```

**React Native Example**:
```javascript
const uploadCertificate = async (fileUri, title, category) => {
  const formData = new FormData();
  formData.append('certificate', {
    uri: fileUri,
    type: 'application/pdf',
    name: 'certificate.pdf',
  });
  formData.append('title', title);
  formData.append('category', category);

  const response = await fetch(`${API_URL}/certificates/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  return await response.json();
};
```

### 2. Get Student Certificates

**Endpoint**: `GET /api/certificates/student/:studentId`

**Description**: Get all certificates for a student

**Authentication**: Required (Student own or Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Best Project Award",
      "certificate_type": "Achievement",
      "file_url": "https://backend.com/uploads/certificates/student/cert.pdf",
      "status": "Approved",
      "uploaded_at": "2026-02-15T14:20:00Z"
    }
  ]
}
```

### 3. Get All Pending Certificates (Admin Only)

**Endpoint**: `GET /api/certificates/pending`

**Description**: Get certificates pending approval

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [...]
}
```

### 4. Approve/Reject Certificate (Admin Only)

**Endpoint**: `PUT /api/certificates/:id/status`

**Description**: Update certificate status

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "status": "Approved",
  "remarks": "Certificate verified and approved"
}
```

Status values: `Approved`, `Rejected`, `Pending`

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Certificate status updated successfully"
}
```

### 5. Add Remarks to Certificate (Admin Only)

**Endpoint**: `POST /api/certificates/:id/remarks`

**Description**: Add admin remarks to a certificate

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "remarks": "Please reupload with better quality"
}
```

### 6. Delete Certificate

**Endpoint**: `DELETE /api/certificates/:id`

**Description**: Delete a certificate

**Authentication**: Required (Student own or Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Certificate deleted successfully"
}
```

### 7. Get Certificate Statistics

**Endpoint**: `GET /api/certificates/stats`

**Description**: Get certificate statistics

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "total": 150,
    "approved": 100,
    "pending": 30,
    "rejected": 20
  }
}
```

### 8. Update Certificate (Admin Only)

**Endpoint**: `PUT /api/certificates/:id`

**Description**: Update certificate details

**Authentication**: Required (Admin)

---

## On-Duty Endpoints

### 1. Create On-Duty Request

**Endpoint**: `POST /api/onduty/request`

**Description**: Student creates an on-duty request

**Authentication**: Required (Student)

**Request**: `multipart/form-data`

**Form Fields**:
- `collegeName`: College name (required)
- `startDate`: Start date (required)
- `startTime`: Start time (required)
- `endDate`: End date (required)
- `endTime`: End time (required)
- `reason`: Reason for on-duty (required)
- `document`: Supporting document (optional, PDF/Image)

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "On-duty request submitted successfully",
  "data": {
    "id": 1,
    "student_id": 5,
    "college_name": "Engineering College",
    "start_date": "2026-03-20",
    "end_date": "2026-03-22",
    "status": "pending",
    "document_url": "https://backend.com/uploads/onduty-documents/doc123.pdf"
  }
}
```

### 2. Get Student On-Duty Requests

**Endpoint**: `GET /api/onduty/student/:studentId`

**Description**: Get on-duty requests for a student

**Authentication**: Required (Student own or Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "college_name": "Engineering College",
      "start_date": "2026-03-20",
      "end_date": "2026-03-22",
      "status": "approved",
      "submitted_at": "2026-03-10T09:00:00Z"
    }
  ]
}
```

### 3. Get All On-Duty Requests (Admin Only)

**Endpoint**: `GET /api/onduty/requests`

**Description**: Get all on-duty requests

**Authentication**: Required (Admin)

**Query Parameters**:
- `status` (optional): pending, approved, rejected

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [...]
}
```

### 4. Mark On-Duty Attendance

**Endpoint**: `POST /api/onduty/mark-attendance`

**Description**: Mark on-duty attendance with selfie

**Authentication**: Required (Student)

**Request**: `multipart/form-data`

**Form Fields**:
- `onDutyRequestId`: Request ID (required)
- `latitude`: GPS latitude (required)
- `longitude`: GPS longitude (required)
- `address`: Location address (optional)
- `qrData`: QR code data (required)
- `selfie`: Selfie photo (optional)

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "On-duty attendance marked successfully",
  "data": {
    "id": 1,
    "on_duty_request_id": 1,
    "check_in_time": "2026-03-20T09:30:00Z",
    "selfie_photo_url": "https://backend.com/uploads/onduty-selfies/selfie123.jpg"
  }
}
```

### 5. Get On-Duty Attendance Records

**Endpoint**: `GET /api/onduty/:requestId/attendance`

**Description**: Get attendance records for an on-duty request

**Authentication**: Required (Student own or Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "check_in_time": "2026-03-20T09:30:00Z",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "selfie_photo_url": "https://backend.com/uploads/onduty-selfies/selfie.jpg"
    }
  ]
}
```

### 6. Get Pending On-Duty Requests (Admin Only)

**Endpoint**: `GET /api/onduty/pending`

**Description**: Get pending on-duty requests

**Authentication**: Required (Admin)

### 7. Approve/Reject On-Duty Request (Admin Only)

**Endpoint**: `PUT /api/onduty/:id/status`

**Description**: Update on-duty request status

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "status": "approved",
  "remarks": "Approved for college fest participation"
}
```

Status values: `approved`, `rejected`, `pending`

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "On-duty request status updated successfully"
}
```

### 8. Update On-Duty Request

**Endpoint**: `PUT /api/onduty/:id`

**Description**: Update on-duty request details

**Authentication**: Required (Student own)

**Request**: `multipart/form-data`

### 9. Delete On-Duty Request

**Endpoint**: `DELETE /api/onduty/:id`

**Description**: Delete an on-duty request

**Authentication**: Required (Student own or Admin)

---

## Analytics Endpoints

### 1. Get Dashboard Statistics

**Endpoint**: `GET /api/analytics/dashboard`

**Description**: Get overall system statistics

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "students": {
      "total": 500,
      "approved": 450,
      "pending": 30,
      "rejected": 20
    },
    "events": {
      "total": 50,
      "upcoming": 10,
      "ongoing": 2,
      "completed": 38
    },
    "attendance": {
      "total": 2500,
      "present": 2300,
      "absent": 200
    },
    "certificates": {
      "total": 300,
      "approved": 250,
      "pending": 30,
      "rejected": 20
    }
  }
}
```

### 2. Get Student Analytics

**Endpoint**: `GET /api/analytics/students`

**Description**: Get student-related analytics

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "by_college": [...],
    "by_department": [...],
    "by_year": [...],
    "by_status": [...]
  }
}
```

### 3. Get Event Analytics

**Endpoint**: `GET /api/analytics/events`

**Description**: Get event-related analytics

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "total_events": 50,
    "total_registrations": 1500,
    "average_attendance": 85.5,
    "popular_events": [...]
  }
}
```

### 4. Get Certificate Analytics

**Endpoint**: `GET /api/analytics/certificates`

**Description**: Get certificate-related analytics

**Authentication**: Required (Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "total_certificates": 300,
    "approved_certificates": 250,
    "pending_certificates": 30,
    "by_category": [...]
  }
}
```

### 5. Get Student Dashboard

**Endpoint**: `GET /api/analytics/student/:studentId/dashboard`

**Description**: Get dashboard statistics for a specific student

**Authentication**: Required (Student own or Admin)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "events": {
      "registered": 10,
      "attended": 8
    },
    "certificates": {
      "total": 5,
      "approved": 4,
      "pending": 1
   GET /api/test-db` (database connection test)
- ` },
    "attendance_rate": 80
  }
}
```

---

## Error Responses

All endpoints follow a consistent error response format:

### Common Error Codes

**400 Bad Request**:
```json
{
  "success": false,
  "message": "Validation error message"
}
```

**401 Unauthorized**:
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**403 Forbidden**:
```json
{
  "success": false,
  "message": "You don't have permission to access this resource"
}
```

**404 Not Found**:
```json
{
  "success": false,
  "message": "Resource not found"
}
```

**409 Conflict**:
```json
{
  "success": false,
  "message": "Resource already exists"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Additional Notes

### File Upload Limits

- **Profile Photos**: 5MB max, JPEG/PNG/GIF/WebP
- **Certificates**: 10MB max, PDF/JPEG/PNG
- **On-Duty Documents**: 10MB max, PDF/JPEG/PNG/DOC/DOCX
- **Attendance Photos**: 50MB max (configurable), JPEG

### Date Format

All dates should be in ISO 8601 format: `YYYY-MM-DD`  
All timestamps are in ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`

### Pagination

Currently not implemented. All list endpoints return complete results.

### Rate Limiting

Currently not implemented. Consider implementing for production use.

---

## Quick Reference

### Authentication Required Endpoints

- All `/admin/*` endpoints (Admin only)
- All `/students/*` endpoints except GET list
- All `/certificates/*` endpoints
- All `/onduty/*` endpoints
- `/attendance/mark`, `/attendance/student/:id`
- `/events/:id/register`
- `/auth/me`, `/auth/logout`

### Public Endpoints (No Auth Required)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/admin/add-login` (can be restricted)
- `POST /api/admin/login`
- `GET /api/events` (list all events)
- `GET /api/events/:id` (event details)
- `/health` (health check)

---

**For React Native integration examples**, see [REACT_NATIVE_INTEGRATION.md](REACT_NATIVE_INTEGRATION.md)

**For deployment instructions**, see [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)
