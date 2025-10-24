# Quick Setup Guide - On-Duty System Backend

## 1. Database Setup (2 minutes)

Run the migration to create OD tables:

```bash
cd /media/kishore/LDisk1/projects/senior_project
psql -U your_username -d your_database -f database/add_onduty_tables.sql
```

Or connect to your database and run the SQL file manually.

## 2. Verify Backend Changes

All backend changes are complete! No additional npm packages needed.

**Created Files:**

- ✅ `backend/src/routes/onduty.routes.ts` - API routes
- ✅ `database/add_onduty_tables.sql` - Database schema
- ✅ `backend/ONDUTY_API_DOCUMENTATION.md` - API docs
- ✅ `backend/ONDUTY_BACKEND_CHANGES.md` - Change summary

**Modified Files:**

- ✅ `backend/src/config/upload.ts` - Added OD file upload configs
- ✅ `backend/src/server.ts` - Registered OD routes

## 3. Start Backend Server

```bash
cd backend
npm run dev
```

The server will:

- Create `uploads/onduty-documents/` directory
- Create `uploads/onduty-selfies/` directory
- Register routes at `/api/onduty/*`

## 4. Test API Endpoints

### Health Check

```bash
curl http://localhost:3000/health
```

### Test Student OD Request (requires auth token)

```bash
# Replace YOUR_STUDENT_TOKEN with actual token
curl -X GET "http://localhost:3000/api/onduty/my-requests" \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN"
```

### Test Admin OD Requests (requires auth token)

```bash
# Replace YOUR_ADMIN_TOKEN with actual token
curl -X GET "http://localhost:3000/api/onduty/admin/requests" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 5. API Endpoints Summary

**Student Routes (`/api/onduty/`):**

- POST `/request` - Create OD request
- GET `/my-requests` - Get my requests
- GET `/approved` - Get approved requests (today)
- POST `/attendance` - Mark attendance
- GET `/attendance-history` - Get history
- DELETE `/request/:id` - Delete pending request

**Admin Routes (`/api/onduty/admin/`):**

- GET `/requests` - Get all requests (with filters)
- PUT `/requests/:id` - Approve/reject request
- GET `/attendance` - Get all attendance records

## 6. Frontend Integration

Update `StudentApp/src/services/api.ts` to add API calls:

```typescript
// Add this to your existing api.ts file
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
```

## 7. Troubleshooting

### Issue: Database tables not created

**Solution:** Check PostgreSQL connection and run the SQL file manually

### Issue: Upload directory errors

**Solution:** Ensure the backend has write permissions to the `uploads/` directory

### Issue: File upload fails

**Solution:** Check file size (documents: 10MB, selfies: 5MB) and file type

### Issue: 401 Unauthorized errors

**Solution:** Ensure JWT token is valid and included in Authorization header

### Issue: Cannot mark attendance twice

**Solution:** This is by design - attendance can only be marked once per day per OD request

## 8. What's Next?

- [ ] Run database migration
- [ ] Start backend server
- [ ] Test endpoints with Postman or cURL
- [ ] Update StudentApp API service
- [ ] Create admin OnDutyManagementScreen
- [ ] Test complete flow: Request → Approve → Attendance

## Complete! 🎉

The backend is fully configured for the On-Duty system. All API endpoints are ready to use.

For detailed API documentation, see: `backend/ONDUTY_API_DOCUMENTATION.md`
