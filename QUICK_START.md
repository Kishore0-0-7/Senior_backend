# Quick Start - Render Deployment for React Native App

## For Render Free Tier Deployment

### 1. Set Environment Variable

In your Render dashboard, set this critical environment variable:

```bash
BASE_URL=https://your-backend-name.onrender.com
```

Replace `your-backend-name` with your actual Render service name.

### 2. Deploy Configuration

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

### 3. Required Environment Variables

Copy these to Render environment tab:

```bash
# Server
NODE_ENV=production
PORT=3000
BASE_URL=https://your-backend.onrender.com

# Database (use your Render PostgreSQL credentials)
DB_HOST=your-db-host.onrender.com
DB_PORT=5432
DB_NAME=student_event_management
DB_USER=your_user
DB_PASSWORD=your_password

# Security
JWT_SECRET=your_very_long_random_secret_at_least_32_characters
JWT_EXPIRES_IN=7d

# CORS (React Native apps don't need CORS restrictions)
CORS_ORIGIN=*

# File Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf
MAX_ATTENDANCE_PHOTO_SIZE_MB=50
API_BODY_LIMIT=100mb

# API
API_PREFIX=/api
ALLOW_ADMIN_CREATION=false
```

### 4. What's Changed

✅ All file uploads now save to local `./uploads/` directory  
✅ All file URLs include full BASE_URL automatically  
✅ Compatible with Render free tier  
✅ Optimized for React Native mobile apps (iOS & Android)
✅ No external storage services needed  

### 5. File Storage Structure

```
uploads/
├── attendance-photos/
├── certificates/
│   └── {student_email}/
├── onduty-documents/
├── onduty-selfies/
└── profile-photos/
```

### 6. Important Warning

⚠️ **Render Free Tier**: Files are **ephemeral** (temporary)
- Files persist during runtime ✅
- Files **deleted** on restart/redeploy ❌
- Backend sleeps after 15 min inactivity
- First request after sleep: ~30-60 seconds

**For Production**: Upgrade to paid tier or use cloud storage (S3, Cloudinary)

### 7. Test Your Deployment

```bash
# Health check
curl https://your-backend.onrender.com/health

# Should return:
# {"status":"OK","timestamp":"...","uptime":123}
```

### 8. React Native App Configuration

Update your React Native app environment:

```javascript
// .env or .env.production
API_URL=https://your-backend.onrender.com/api

// For Expo
EXPO_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

**In your config file:**

```javascript
// config/api.js
export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'http://localhost:3000/api'  // Development
    : 'https://your-backend.onrender.com/api', // Production
  TIMEOUT: 30000, // 30 seconds for mobile networks
};
```

### 9. Mobile App Essentials

**Image Upload Example:**

```javascript
import * as ImagePicker from 'expo-image-picker';

const uploadPhoto = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8, // Compress for mobile
  });

  if (!result.canceled) {
    const formData = new FormData();
    formData.append('photo', {
      uri: result.assets[0].uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    });

    const response = await fetch(
      `${API_CONFIG.BASE_URL}/students/${id}/photo`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      }
    );
    
    const data = await response.json();
    // Use data.profile_photo_url - it's a full URL!
  }
};
```

**Display Images:**

```javascript
import { Image } from 'react-native';

// Backend returns full URLs
<Image 
  source={{ uri: user.profile_photo_url }}
  style={{ width: 100, height: 100 }}
/>
```

### 10. Mobile Permissions

**Android** (`AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

**iOS** (`Info.plist`):
```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photos to upload profile pictures</string>
<key>NSCameraUsageDescription</key>
<string>We need camera access to take photos</string>
```

---

## Need More Help?

📖 **Detailed Guide**: See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) - includes React Native examples  
📋 **Changes Made**: See [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md)  
⚙️ **Environment Setup**: See [.env.example](.env.example)

## Quick Troubleshooting

**Images not loading in app?**
→ Check BASE_URL is set correctly  
→ Verify URLs are full URLs (start with https://)  
→ Test URL in mobile browser

**Upload fails?**
→ Compress images before upload (quality: 0.7-0.8)  
→ Check file size limits  
→ Add 60-second timeout for mobile networks

**App slow to start?**
→ Render free tier sleeps after 15 min  
→ Show loading message: "Waking up server..."  
→ Implement retry logic

**CORS errors?**
→ Pure React Native doesn't need CORS  
→ Only if using WebView: set CORS_ORIGIN=*

---

**Ready to Deploy Your React Native App!** 🚀📱
