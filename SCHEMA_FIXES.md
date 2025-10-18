# Database Schema Fixes

## Summary

Fixed multiple API routes to match the actual database schema in `complete_schema.sql`.

## Date: October 18, 2025

---

## 1. Admin Routes Fix

### Issue

The `admins` table doesn't have an `email` column. Email is stored in the `users` table.

### Schema

```sql
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Changes Made

**File:** `src/routes/admin.routes.ts`

**Before:**

```typescript
const adminResult = await query(
  `INSERT INTO admins (user_id, name, email) 
   VALUES ($1, $2, $3) 
   RETURNING *`,
  [userId, name, email]
);
```

**After:**

```typescript
const adminResult = await query(
  `INSERT INTO admins (user_id, name) 
   VALUES ($1, $2) 
   RETURNING *`,
  [userId, name]
);
```

---

## 2. Certificate Routes Fix

### Issue

The `certificates` table doesn't have `category`, `issue_date`, or `description` columns. It uses `certificate_type` instead of `category`.

### Schema

```sql
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    certificate_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    remarks TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by UUID REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Changes Made

**File:** `src/routes/certificate.routes.ts`

#### Upload Certificate Endpoint

**Before:**

```typescript
const { title, category, issue_date, description } = req.body;

const result = await query(
  `INSERT INTO certificates (
    student_id, title, category, issue_date, description, 
    file_name, file_url, status
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
  RETURNING *`,
  [
    studentId,
    title,
    category || null,
    issue_date || null,
    description || null,
    req.file.originalname,
    fileUrl,
  ]
);
```

**After:**

```typescript
const { title, certificate_type } = req.body;

const result = await query(
  `INSERT INTO certificates (
    student_id, title, certificate_type, file_name, file_url, status
  ) VALUES ($1, $2, $3, $4, $5, 'Pending')
  RETURNING *`,
  [studentId, title, certificate_type || null, req.file.originalname, fileUrl]
);
```

#### Update Certificate Endpoint

**Before:**

```typescript
const { title, category, issue_date, description, status, remarks } = req.body;

const result = await query(
  `UPDATE certificates SET
    title = COALESCE($1, title),
    category = COALESCE($2, category),
    issue_date = COALESCE($3, issue_date),
    description = COALESCE($4, description),
    file_name = $5,
    file_url = $6,
    status = COALESCE($7, status),
    remarks = COALESCE($8, remarks),
    updated_at = NOW()
  WHERE id = $9
  RETURNING *`,
  [
    title,
    category,
    issue_date,
    description,
    originalFileName,
    fileUrl,
    isAdminUpdatingStatus ? status : null,
    userRole === "admin" ? remarks ?? null : existingCert.remarks,
    id,
  ]
);
```

**After:**

```typescript
const { title, certificate_type, status, remarks } = req.body;

const result = await query(
  `UPDATE certificates SET
    title = COALESCE($1, title),
    certificate_type = COALESCE($2, certificate_type),
    file_name = $3,
    file_url = $4,
    status = COALESCE($5, status),
    remarks = COALESCE($6, remarks),
    updated_at = NOW()
  WHERE id = $7
  RETURNING *`,
  [
    title,
    certificate_type,
    originalFileName,
    fileUrl,
    isAdminUpdatingStatus ? status : null,
    userRole === "admin" ? remarks ?? null : existingCert.remarks,
    id,
  ]
);
```

---

## Impact

### API Endpoints Fixed

1. **POST** `/api/admin/add-login` - Create admin account
2. **POST** `/api/certificates/upload` - Upload certificate
3. **PATCH** `/api/certificates/:id` - Update certificate

### Breaking Changes

The following request body fields have been changed:

#### Certificate Upload/Update

- ❌ Removed: `category`, `issue_date`, `description`
- ✅ Use instead: `certificate_type`

**Old Request Body:**

```json
{
  "title": "Certificate Title",
  "category": "Achievement",
  "issue_date": "2025-10-18",
  "description": "Description here"
}
```

**New Request Body:**

```json
{
  "title": "Certificate Title",
  "certificate_type": "Achievement"
}
```

---

## Next Steps

1. ✅ Rebuild backend: `npm run build`
2. ✅ Restart server on Ubuntu instance
3. 🔄 Update frontend/mobile apps to use `certificate_type` instead of `category`
4. 🔄 Update API documentation
5. 🔄 Update any API testing tools (Postman collections, etc.)

---

## Testing

### Test Admin Creation

```bash
curl -X POST http://43.204.143.235:3000/api/admin/add-login \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

### Test Certificate Upload

```bash
curl -X POST http://43.204.143.235:3000/api/certificates/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "certificate=@/path/to/file.pdf" \
  -F "title=My Certificate" \
  -F "certificate_type=Achievement"
```

---

## Status

✅ **All schema mismatches fixed and compiled successfully**

The backend code now matches the database schema defined in `database/complete_schema.sql`.
