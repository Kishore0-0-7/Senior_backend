# API & Admin Creation Summary

Quick reference guide for the Student Event Management System backend APIs with focus on admin creation.

---

## 🧪 Database Connection Test

### Test Database Connection

**Endpoint**: `GET /api/test-db`

**Description**: Test database connection and get database information

**Authentication**: None (Public)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Database connection successful",
  "data": {
    "connected": true,
    "timestamp": "2026-02-16T10:30:00.000Z",
    "database": {
      "name": "student_event_management",
      "host": "localhost",
      "port": "5432",
      "version": "PostgreSQL 15.3..."
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

**Response (Error - 500):**
```json
{
  "success": false,
  "message": "Database connection failed",
  "error": {
    "message": "connection to server failed",
    "code": "ECONNREFUSED"
  }
}
```

**cURL Example:**
```bash
curl http://localhost:3000/api/test-db
```

**React Native Example:**
```javascript
const testDatabaseConnection = async () => {
  try {
    const response = await fetch(`${API_URL}/test-db`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Database connected');
      console.log('Records:', data.data.records);
    } else {
      console.error('❌ Database connection failed');
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

---

## 🔑 Admin Creation Using POST

### Primary Method: `/api/admin/add-login`

**Create admin accounts via POST request:**

```bash
POST https://your-backend.onrender.com/api/admin/add-login
Content-Type: application/json

{
  "name": "Admin Name",
  "email": "admin@example.com",
  "password": "secure_password"
}
```

**Validation:**
- ✅ Name: Required
- ✅ Email: Required, valid format
- ✅ Password: Required, minimum 6 characters

**Response (Success - 201):**
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
    "token": "eyJhbGci..."
  }
}
```

**Key Features:**
- 🔓 **No authentication required** (can be restricted in production)
- 🎫 **Returns JWT token** immediately for use
- 👤 **Creates both user and admin records**
- 🔐 **Password is hashed** with bcrypt

**Security Control:**
```bash
# In .env file, set to false in production
ALLOW_ADMIN_CREATION=false
```

---

## 📱 React Native Example

```javascript
// Create admin from mobile app
const createAdmin = async (name, email, password) => {
  try {
    const response = await fetch(
      'https://your-backend.onrender.com/api/admin/add-login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      }
    );

    const data = await response.json();

    if (data.success) {
      // Store the token
      await AsyncStorage.setItem('authToken', data.data.token);
      console.log('Admin created:', data.data.admin);
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Admin creation failed:', error.message);
    throw error;
  }
};

// Usage
await createAdmin('John Admin', 'john@admin.com', 'password123');
```

---

## 🌐 cURL Example

```bash
# Create admin using cURL
curl -X POST https://your-backend.onrender.com/api/admin/add-login \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Admin",
    "email": "super@admin.com",
    "password": "SecurePass123"
  }'
```

---

## 📊 Complete API Overview

### Base URLs
- **Production**: `https://your-backend.onrender.com/api`
- **Development**: `http://localhost:3000/api` or `http://192.168.1.XXX:3000/api`

### API Categories

#### 1️⃣ **Authentication APIs** (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Register student account |
| POST | `/login` | ❌ | Login (student/admin) |
| GET | `/me` | ✅ | Get current user profile |
| POST | `/logout` | ✅ | Logout user |
| POST | `/verify-email` | ❌ | Verify email with code |

#### 2️⃣ **Admin APIs** (`/api/admin`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/add-login` | ❌ | **Create admin account** |
| POST | `/login` | ❌ | Admin-specific login |
| GET | `/students` | 👑 Admin | Get all students |
| GET | `/events` | 👑 Admin | Get all events |
| GET | `/attendance` | 👑 Admin | Get all attendance |
| GET | `/certificates` | 👑 Admin | Get all certificates |

#### 3️⃣ **Student APIs** (`/api/students`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | 👑 Admin | List all students |
| GET | `/:id` | ✅ | Get student details |
| GET | `/:id/events` | ✅ | Get student events |
| POST | `/:id/photo` | ✅ | Upload profile photo |
| PUT | `/:id` | ✅ | Update student profile |
| PUT | `/:id/status` | 👑 Admin | Approve/reject student |
| PUT | `/:id/verify-email` | 👑 Admin | Verify email manually |
| DELETE | `/:id` | 👑 Admin | Delete student |

#### 4️⃣ **Event APIs** (`/api/events`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ❌ | List all events (public) |
| POST | `/` | 👑 Admin | Create new event |
| GET | `/:id` | ❌ | Get event details |
| POST | `/:id/register` | 👤 Student | Register for event |
| PUT | `/:id` | 👑 Admin | Update event |
| DELETE | `/:id` | 👑 Admin | Delete event |
| GET | `/:id/participants` | 👑 Admin | Get event participants |
| GET | `/:id/attendance` | 👑 Admin | Get event attendance |

#### 5️⃣ **Attendance APIs** (`/api/attendance`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/generate-qr` | 👑 Admin | Generate QR for event |
| POST | `/mark` | 👤 Student | Mark attendance with photo |
| GET | `/student/:id` | ✅ | Get student attendance |
| GET | `/event/:id` | 👑 Admin | Get event attendance |
| PUT | `/:id/status` | 👑 Admin | Update attendance status |
| POST | `/manual` | 👑 Admin | Mark manual attendance |

#### 6️⃣ **Certificate APIs** (`/api/certificates`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload` | 👤 Student | Upload certificate |
| GET | `/student/:id` | ✅ | Get student certificates |
| GET | `/pending` | 👑 Admin | Get pending certificates |
| PUT | `/:id/status` | 👑 Admin | Approve/reject certificate |
| POST | `/:id/remarks` | 👑 Admin | Add remarks |
| DELETE | `/:id` | ✅ | Delete certificate |
| GET | `/stats` | 👑 Admin | Get certificate stats |
| PUT | `/:id` | 👑 Admin | Update certificate |

#### 7️⃣ **On-Duty APIs** (`/api/onduty`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/request` | 👤 Student | Create on-duty request |
| GET | `/student/:id` | ✅ | Get student requests |
| GET | `/requests` | 👑 Admin | Get all requests |
| POST | `/mark-attendance` | 👤 Student | Mark on-duty attendance |
| GET | `/:id/attendance` | ✅ | Get attendance records |
| GET | `/pending` | 👑 Admin | Get pending requests |
| PUT | `/:id/status` | 👑 Admin | Approve/reject request |
| PUT | `/:id` | 👤 Student | Update request |
| DELETE | `/:id` | ✅ | Delete request |

#### 8️⃣ **Analytics APIs** (`/api/analytics`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard` | 👑 Admin | Overall statistics |
| GET | `/students` | 👑 Admin | Student analytics |
| GET | `/events` | 👑 Admin | Event analytics |
| GET | `/certificates` | 👑 Admin | Certificate analytics |
| GET | `/student/:id/dashboard` | ✅ | Student dashboard |

---

## 🔐 Authentication

### Authorization Header
```
Authorization: Bearer <jwt-token>
```

### Roles
- **Admin** (👑): Full system access
- **Student** (👤): Limited to own data
- **Public** (❌): No authentication needed

---

## 📤 File Upload Endpoints

### Upload Types

**1. Profile Photo** (`POST /api/students/:id/photo`)
```javascript
const formData = new FormData();
formData.append('photo', {
  uri: photoUri,
  type: 'image/jpeg',
  name: 'profile.jpg',
});
```

**2. Certificate** (`POST /api/certificates/upload`)
```javascript
const formData = new FormData();
formData.append('certificate', {
  uri: fileUri,
  type: 'application/pdf',
  name: 'certificate.pdf',
});
formData.append('title', 'Award Title');
formData.append('category', 'Achievement');
```

**3. Attendance Photo** (`POST /api/attendance/mark`)
```javascript
// Base64 encoded photo
{
  "eventId": 1,
  "studentId": 5,
  "photoData": "data:image/jpeg;base64,/9j/4AAQSkZJ...",
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

**4. On-Duty Document** (`POST /api/onduty/request`)
```javascript
const formData = new FormData();
formData.append('document', {
  uri: docUri,
  type: 'application/pdf',
  name: 'document.pdf',
});
formData.append('collegeName', 'College Name');
formData.append('startDate', '2026-03-20');
// ... other fields
```

---

## 🎯 Quick Start Guide

### 1. Create Admin
```bash
curl -X POST http://localhost:3000/api/admin/add-login \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@test.com","password":"admin123"}'
```

### 2. Login as Admin
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'
```

### 3. Use Token for Authenticated Requests
```bash
curl -X GET http://localhost:3000/api/admin/students \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📝 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## 🚀 React Native Integration

### Setup API Client
```javascript
// config/api.js
export const API_CONFIG = {
  BASE_URL: 'https://your-backend.onrender.com/api',
  TIMEOUT: 30000,
};

// Get token
const getToken = async () => {
  return await AsyncStorage.getItem('authToken');
};

// Make authenticated request
const apiCall = async (endpoint, method = 'GET', body = null) => {
  const token = await getToken();
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  };

  const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, options);
  return await response.json();
};
```

### Usage Examples

```javascript
// Create admin
await apiCall('/admin/add-login', 'POST', {
  name: 'Admin',
  email: 'admin@test.com',
  password: 'password123'
});

// Login
const loginData = await apiCall('/auth/login', 'POST', {
  email: 'student@test.com',
  password: 'password123'
});
await AsyncStorage.setItem('authToken', loginData.data.token);

// Get profile
const profile = await apiCall('/auth/me');

// Register for event
await apiCall('/events/1/register', 'POST', {});

// Upload certificate
const formData = new FormData();
formData.append('certificate', fileData);
formData.append('title', 'My Certificate');
// Use fetch directly for FormData
const response = await fetch(`${API_CONFIG.BASE_URL}/certificates/upload`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});
```

---

## 🔧 Environment Variables

```bash
# Required for admin creation
ALLOW_ADMIN_CREATION=true  # Set to false in production

# JWT Configuration
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# Base URL for file uploads
BASE_URL=https://your-backend.onrender.com
```

---

## 📚 Additional Resources

- **Full API Documentation**: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **React Native Integration**: [REACT_NATIVE_INTEGRATION.md](REACT_NATIVE_INTEGRATION.md)
- **Deployment Guide**: [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)
- **Quick Start**: [QUICK_START.md](QUICK_START.md)

---

## ✅ Testing Checklist

### Admin Creation
- [ ] Create admin via POST request
- [ ] Receive JWT token in response
- [ ] Login with admin credentials
- [ ] Access admin-only endpoints

### File Uploads
- [ ] Upload profile photo
- [ ] Upload certificate (PDF/Image)
- [ ] Mark attendance with photo
- [ ] Upload on-duty documents

### Authentication
- [ ] Register student account
- [ ] Login and receive token
- [ ] Access protected endpoints with token
- [ ] Handle expired tokens

### CRUD Operations
- [ ] Create event
- [ ] Read event list
- [ ] Update event details
- [ ] Delete event

---

**Last Updated**: February 16, 2026
