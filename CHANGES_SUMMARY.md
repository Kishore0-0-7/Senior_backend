# Changes Summary - Render Free Tier Configuration

## Date: February 16, 2026

This document summarizes the changes made to configure the backend for Render free tier deployment with local file storage.

## Changes Made

### 1. Created URL Helper Utility (`src/utils/urlHelper.ts`)

A new centralized utility for generating file URLs with BASE_URL support:

**Functions:**
- `getBaseUrl()` - Gets base URL from environment or localhost
- `generateFileUrl(relativePath)` - Generates full URL from relative path
- `generateUploadUrl(type, filename)` - Generic upload URL generator
- `generateCertificateUrl(folder, filename)` - Certificate-specific URL
- `generateAttendancePhotoUrl(filename)` - Attendance photo URL
- `generateProfilePhotoUrl(filename)` - Profile photo URL
- `generateOnDutyDocumentUrl(filename)` - On-duty document URL
- `generateOnDutySelfieUrl(filename)` - On-duty selfie URL

**Benefits:**
- Centralized URL generation logic
- Automatic BASE_URL handling for production
- Easy migration to cloud storage in the future
- Consistent URL format across the application

### 2. Updated Photo Storage (`src/utils/photoStorage.ts`)

**Changes:**
- Added import for `generateAttendancePhotoUrl`
- Updated `saveAttendancePhoto()` to return full URLs instead of relative paths
- URLs now include the BASE_URL when set in environment

**Impact:**
- Attendance photos are now accessible with full URLs
- Compatible with Render deployment
- Frontend can access photos from any domain

### 3. Updated Certificate Routes (`src/routes/certificate.routes.ts`)

**Changes:**
- Added import for `generateCertificateUrl`
- Updated `buildCertificateUrl()` to use the URL helper
- All certificate URLs now include BASE_URL

**Impact:**
- Certificate PDFs and images return full URLs
- Files accessible from frontend regardless of hosting
- Proper URL format for Render deployment

### 4. Updated Student Routes (`src/routes/student.routes.ts`)

**Changes:**
- Added import for `generateProfilePhotoUrl`
- Replaced manual URL construction with URL helper
- Removed inline `baseUrl` logic

**Impact:**
- Profile photos use consistent URL generation
- Cleaner code, easier to maintain
- Full URLs for all profile images

### 5. Updated On-Duty Routes (`src/routes/onduty.routes.ts`)

**Changes:**
- Added imports for `generateOnDutyDocumentUrl` and `generateOnDutySelfieUrl`
- Updated document URL generation in request creation
- Updated selfie URL generation in attendance marking
- Fixed incorrect path in update endpoint (`/uploads/onduty/` → proper helper usage)

**Impact:**
- On-duty documents return full URLs
- On-duty selfies use consistent URL format
- All on-duty files accessible with BASE_URL

### 6. Enhanced Environment Configuration (`.env.example`)

**Additions:**
- Added `MAX_ATTENDANCE_PHOTO_SIZE_MB` configuration
- Added `API_BODY_LIMIT` configuration
- Comprehensive Render deployment section with:
  - Step-by-step configuration guide
  - Ephemeral storage warning
  - Environment variable examples
  - Production considerations

**Benefits:**
- Clear configuration for Render deployment
- Developers understand storage limitations
- Production-ready environment variables documented

### 7. Created Comprehensive Deployment Guide (`RENDER_DEPLOYMENT.md`)

A complete guide covering:
- Overview of file storage structure
- Ephemeral storage warnings and implications
- Step-by-step Render deployment instructions
- Environment variable configuration
- Database setup
- File upload testing procedures
- Frontend configuration
- Troubleshooting common issues
- Monitoring and logging
- Security best practices
- Production checklist
- Migration path to cloud storage

**Benefits:**
- Complete deployment documentation
- Covers all edge cases and gotchas
- Production-ready configuration
- Easy onboarding for new developers

## Technical Details

### File Storage Strategy

**Current Implementation:**
- All files stored locally in `./uploads/` directory
- Files organized by category (attendance-photos, certificates, etc.)
- Files served via Express static middleware at `/uploads`

**URL Format:**
- Development: `http://localhost:3000/uploads/{category}/{filename}`
- Production: `https://your-app.onrender.com/uploads/{category}/{filename}`

### How BASE_URL Works

1. **Not Set (Development)**:
   ```javascript
   BASE_URL=
   // URLs: http://localhost:3000/uploads/...
   ```

2. **Set (Production)**:
   ```javascript
   BASE_URL=https://senior-backend.onrender.com
   // URLs: https://senior-backend.onrender.com/uploads/...
   ```

### File Upload Flow

1. Client uploads file (FormData or base64)
2. Server saves file to local `./uploads/{category}/` directory
3. Server generates full URL using `urlHelper`
4. Full URL stored in database
5. Full URL returned to client
6. Client can access file directly via URL

## Important Warnings

⚠️ **Ephemeral Storage**: Files on Render free tier are temporary and will be deleted on:
- Service restart (after 15 min inactivity)
- Redeployment
- Service scaling

⚠️ **Production Use**: For production, consider:
- Render paid tier with persistent disk
- External storage (AWS S3, Cloudinary, etc.)
- Alternative hosting with persistent storage

## Migration Path

The code is structured to make future migration easy:

1. All URL generation is in `src/utils/urlHelper.ts`
2. All file operations are in `src/utils/photoStorage.ts` and `src/config/upload.ts`
3. To migrate to cloud storage:
   - Update these utility files
   - Install cloud SDK (AWS SDK, Cloudinary, etc.)
   - Add credentials to environment
   - No route file changes needed

## Testing Checklist

- [ ] Profile photo upload works and returns full URL
- [ ] Certificate upload works and returns full URL
- [ ] Attendance photo submission works
- [ ] On-duty document upload works
- [ ] On-duty selfie upload works
- [ ] All uploaded files are accessible via returned URLs
- [ ] Files are saved in correct directories
- [ ] BASE_URL is properly included in all URLs
- [ ] CORS is configured correctly
- [ ] File size limits are respected

## Files Modified

1. `/src/utils/urlHelper.ts` - **Created**
2. `/src/utils/photoStorage.ts` - Modified
3. `/src/routes/certificate.routes.ts` - Modified
4. `/src/routes/student.routes.ts` - Modified
5. `/src/routes/onduty.routes.ts` - Modified
6. `/.env.example` - Enhanced
7. `/RENDER_DEPLOYMENT.md` - **Created**

## Next Steps

1. **Deploy to Render**:
   - Follow the guide in `RENDER_DEPLOYMENT.md`
   - Set `BASE_URL` environment variable
   - Configure database connection
   - Test all file upload endpoints

2. **Update Frontend**:
   - Configure API URL to point to Render backend
   - Ensure CORS_ORIGIN includes frontend URL
   - Test file uploads from frontend

3. **Monitor**:
   - Watch Render logs for errors
   - Test file accessibility
   - Verify URLs are correct

4. **Future Improvements**:
   - Consider implementing cloud storage for production
   - Add file compression/optimization
   - Implement cleanup for old files
   - Add file size analytics

## Support

For issues or questions:
- See `RENDER_DEPLOYMENT.md` for troubleshooting
- Check Render logs for errors
- Review environment variables configuration
- Verify BASE_URL is set correctly

---

**Summary**: The backend is now fully configured for Render free tier deployment with local file storage. All file uploads return full URLs that include the BASE_URL, making them accessible from any frontend regardless of hosting. The system is production-ready with proper documentation, but be aware of ephemeral storage limitations on the free tier.
