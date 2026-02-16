# Render Deployment Guide for React Native Mobile App

This guide explains how to deploy the Student Event Management Backend to Render's free tier with local file storage, specifically configured for React Native mobile applications.

## Overview

The application has been configured to save all file uploads (images and PDFs) locally in the backend's file system. This makes it compatible with Render's free tier deployment without requiring external storage services. All file URLs are generated as full absolute URLs, making them directly accessible from your React Native mobile app running on iOS and Android devices.

## File Storage Structure

All uploads are saved in the following directory structure:

```
uploads/
├── attendance-photos/      # Student attendance selfie photos
├── certificates/           # Student certificates (organized by email)
│   └── {email_folder}/
├── onduty-documents/       # On-duty request documents
├── onduty-selfies/         # On-duty attendance selfies
└── profile-photos/         # Student profile photos
```

## Important: Ephemeral Storage Warning

⚠️ **CRITICAL**: Render's free tier uses **ephemeral storage**, which means:

- Files will be stored and accessible during runtime
- Files will be **PERMANENTLY DELETED** when the service:
  - Restarts (automatic after 15 minutes of inactivity)
  - Redeploys (when you push new code)
  - Scales or moves to a different instance

### Recommendations:

1. **For Development/Testing**: The free tier with local storage is acceptable
2. **For Production**: Consider one of these options:
   - Upgrade to Render's paid tier with persistent disk storage
   - Use external storage services (AWS S3, Cloudinary, Google Cloud Storage)
   - Use a different hosting provider with persistent storage

## Deployment Steps

### 1. Create a New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub/GitLab repository
4. Configure the service:
   - **Name**: `senior-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your deployment branch)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

### 2. Configure Environment Variables

In the Render dashboard, go to **Environment** tab and add these variables:

#### Required Variables:

```bash
NODE_ENV=production
PORT=3000
BASE_URL=https://your-backend.onrender.com
```

#### Database Configuration:

```bash
DB_HOST=your-database-host.onrender.com
DB_PORT=5432
DB_NAME=student_event_management
DB_USER=your_db_user
DB_PASSWORD=your_secure_password
```

#### Security Configuration:

```bash
JWT_SECRET=your_long_random_secure_jwt_secret_min_32_chars
JWT_EXPIRES_IN=7d
```

#### CORS Configuration:

```bash
# For React Native mobile apps, you can use * 
# React Native doesn't have browser CORS restrictions
CORS_ORIGIN=*

# Note: If you also have a web admin panel, you can specify multiple origins:
# CORS_ORIGIN=*
# Or use a comma-separated list for specific origins
```

#### File Upload Configuration:

```bash
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf
MAX_ATTENDANCE_PHOTO_SIZE_MB=50
API_BODY_LIMIT=100mb
```

#### Optional Configuration:

```bash
API_PREFIX=/api
ALLOW_ADMIN_CREATION=false
```

### 3. Important: Set BASE_URL Correctly

The `BASE_URL` environment variable is **critical** for file uploads to work properly:

1. After creating the service, Render will provide you with a URL like:
   ```
   https://senior-backend.onrender.com
   ```

2. Set the `BASE_URL` environment variable to this exact URL (without trailing slash):
   ```bash
   BASE_URL=https://senior-backend.onrender.com
   ```

3. This ensures all file URLs returned to the frontend are absolute URLs that can be accessed from anywhere.

### 4. Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Build the TypeScript code
   - Start the server

### 5. Verify Deployment

Once deployed, test these endpoints:

#### Health Check:
```bash
curl https://your-backend.onrender.com/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2026-02-16T...",
  "uptime": 123.456
}
```

#### API Status:
```bash
curl https://your-backend.onrender.com/api
```

### 6. Database Setup

If you're using Render PostgreSQL:

1. Create a PostgreSQL database on Render
2. Get the connection details from the database dashboard
3. Update the environment variables with the database credentials
4. Run migrations (if needed):
   ```bash
   # Connect to the Render shell
   npm run migrate
   ```

## File Upload Testing

### Test Profile Photo Upload:

```bash
curl -X POST https://your-backend.onrender.com/api/students/{id}/photo \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "photo=@/path/to/image.jpg"
```

### Test Certificate Upload:

```bash
curl -X POST https://your-backend.onrender.com/api/certificates/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "certificate=@/path/to/certificate.pdf" \
  -F "title=My Certificate" \
  -F "category=Achievement"
```

## File URL Format

All file URLs returned by the API will be in this format:

```
https://your-backend.onrender.com/uploads/{category}/{filename}
```

Examples:
- Profile photo: `https://your-backend.onrender.com/uploads/profile-photos/abc123.jpg`
- Certificate: `https://your-backend.onrender.com/uploads/certificates/email_folder/cert-xyz.pdf`
- AReact Native App Configuration

Update your React Native app to use the Render backend URL:

### Using Environment Variables

```javascript
// .env or .env.production
API_URL=https://your-backend.onrender.com/api

// For Expo
EXPO_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

### In Your Config File

```javascript
// config/api.js or constants/config.js
export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'http://localhost:3000/api'  // Development (use your local IP for physical devices)
    : 'https://your-backend.onrender.com/api', // Production
  TIMEOUT: 30000, // 30 seconds for mobile networks
};

// For physical device testing during development:
// BASE_URL: 'http://192.168.1.XXX:3000/api' // Replace with your computer's local IP
```

### Image Loading in React Native

```javascript
// Using full URLs from backend
import { Image } from 'react-native';

// The backend returns full URLs like:
// "https://your-backend.onrender.com/uploads/profile-photos/abc123.jpg"

<Image 
  source={{ uri: user.profile_photo_url }}
  style={{ width: 100, height: 100 }}
/>

// With FastImage for better performance
import FastImage from 'react-native-fast-image';

<FastImage
  source={{ 
    uri: user.profile_photo_url,
    priority: FastImage.priority.normal,
  }}
  style={{ width: 100, height: 100 }}
  resizeMode={FastImage.resizeMode.cover}
/>
```

### File Upload from React Native

```javascript
// Using expo-image-picker
import * as ImagePicker from 'expo-image-picker';

const uploadProfilePhoto = async () => {
  // Request permissions
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Permission required!');
    return;
  }

  // Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8, // Compress for mobile
  });

  if (!result.canceled) {
    const formData = new FormData();
    formData.append('photo', {
      uri: result.assets[0].uri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    });

    const response = await fetch(
      `${API_CONFIG.BASE_URL}/students/${studentId}/photo`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      }
    );

    const data = await response.json();
    console.log('Photo URL:', data.profile_photo_url);
  }
};
```

### Using react-native-image-picker

```javascript
import { launchImageLibrary } from 'react-native-image-picker';

const uploadPhoto = async () => {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    quality: 0.8,
    maxWidth: 1024,
    maxHeight: 1024,
  });

  if (!result.didCancel && result.assets) {
    const formData = new FormData();
    formData.append('photo', {
      uri: result.assets[0].uri,
      type: result.assets[0].type,
      name: result.assets[0].fileName,
    });

    // Upload to backend
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/students/${studentId}/photo`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      }
    );
  }
};
// or
REACT_APP_API_URL=https://your-backend.onrender.com/api
```

## Troubleshooting

### Issue: Files not accessible from mobile app

**Solution**: 
1. Check `BASE_URL` is set correctly in environment variables
2. Verify the URL returned by backend is a full URL (starts with https://)
3. Test the URL directly in a mobile browser

### Issue: CORS errors (if using WebView)

**Note**: Pure React Native apps don't have CORS restrictions. Only if you're using WebView:

**Solution**: Set CORS_ORIGIN in environment:
```bash
CORS_ORIGIN=*
```

### Issue: Images not loading on Android/iOS

**Possible causes**:
1. Network permissions not set in app
2. HTTP URLs blocked (requires HTTPS)
3. Image URL is invalid

**Solutions**:
```xml
<!-- Android: Add to AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- For HTTP URLs in development (not recommended for production) -->
<application
  android:usesCleartextTraffic="true">
</application>
```

```xml
<!-- iOS: Add to Info.plist if using HTTP in development -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
```

### Issue: File upload fails from mobile

**Possible causes**:
1. File size exceeds `MAX_FILE_SIZE`
2. File type not allowed
3. Network timeout on mobile connection
4. FormData format incorrect

**Solutions**:
1. Compress images before upload:
```javascript
import * as ImageManipulator from 'expo-image-manipulator';

const compressedImage = await ImageManipulator.manipulateAsync(
  imageUri,
  [{ resize: { width: 1024 } }],
  { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
);
```

2. Increase timeout for mobile networks:
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds

fetch(url, {
  signal: controller.signal,
  // ... other options
});
```

3. Adjust backend limits:
```bash
MAX_FILE_SIZE=20971520  # 20MB
API_BODY_LIMIT=200mb
```

### Issue: Service sleeps after inactivity

**Cause**: Render's free tier spins down after 15 minutes of inactivity.

**Impact on Mobile Apps**: First API call after sleep takes ~30-60 seconds

**Solutions**:
1. Show loading indicator in app: "Waking up server, please wait..."
2. Implement retry logic:
```javascript
const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};
```

3. Implement offline-first architecture with AsyncStorage
4. Use UptimeRobot to ping every 14 minutes (keeps service awake)
5. Upgrade to paid Render plan (no sleep)

### Issue: Files deleted after restart

**Cause**: This is expected behavior on Render's free tier (ephemeral storage).

**Solutions**:
1. For production, upgrade to Render paid tier with persistent disk
2. Implement external storage (AWS S3, Cloudinary)
3. Accept data loss for development/testing purposes

## Monitoring and Logs

### View Logs:
1. Go to Render Dashboard
2. Select your service
3. Click on **"Logs"** tab
4. View real-time application logs

### Monitor Service:
- **Metrics**: View CPU, memory usage in the dashboard
- **Events**: Check deployment history and status
- **Shell**: Access service shell for debugging

## Auto-Deploy

Render automatically redeploys when you push to your connected branch:

1. Push code to GitHub/GitLab
2. Render detects the change
3. Automatically builds and deploys
4. **Warning**: This will delete all uploaded files!

## Mobile App Optimization

### Image Optimization for Mobile

Mobile devices have limited bandwidth and storage. Optimize images before upload:

#### Client-Side Compression (Recommended)

```javascript
// Using expo-image-manipulator
import * as ImageManipulator from 'expo-image-manipulator';

const optimizeImage = async (uri) => {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [
      { resize: { width: 1024 } }, // Max width
    ],
    {
      compress: 0.7, // 70% quality
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return manipResult.uri;
};

// Before upload
const optimizedUri = await optimizeImage(pickedImage.uri);
```

#### Recommended Image Sizes

- **Profile Photos**: 512x512px, 70-80% quality
- **Attendance Photos**: 1024x1024px max, 70% quality  
- **Certificates**: Original quality (PDFs), compress JPEGs to 80%
- **On-Duty Selfies**: 800x800px, 70% quality

### Caching Strategy

Implement caching to reduce backend load and improve app performance:

```javascript
// Using react-native-fast-image (recommended)
import FastImage from 'react-native-fast-image';

<FastImage
  source={{
    uri: user.profile_photo_url,
    priority: FastImage.priority.normal,
    cache: FastImage.cacheControl.immutable, // Cache forever
  }}
  style={{ width: 100, height: 100 }}
/>

// Preload important images
FastImage.preload([
  { uri: user.profile_photo_url },
  { uri: event.banner_url },
]);
```

### Offline Support

Implement offline-first architecture for better UX:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const fetchWithOfflineSupport = async (url, cacheKey) => {
  // Check network connection
  const netInfo = await NetInfo.fetch();
  
  if (!netInfo.isConnected) {
    // Return cached data
    const cached = await AsyncStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    // Cache the data
    await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    
    return data;
  } catch (error) {
    // Fallback to cache on error
    const cached = await AsyncStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }
};
```

### Network Request Optimization

```javascript
// Batch requests when possible
const fetchUserData = async (userId) => {
  // Instead of multiple requests:
  // const profile = await fetch(`/students/${userId}`);
  // const events = await fetch(`/students/${userId}/events`);
  // const attendance = await fetch(`/students/${userId}/attendance`);
  
  // Use Promise.all for parallel requests:
  const [profile, events, attendance] = await Promise.all([
    fetch(`${API_URL}/students/${userId}`),
    fetch(`${API_URL}/students/${userId}/events`),
    fetch(`${API_URL}/students/${userId}/attendance`),
  ]);
  
  return {
    profile: await profile.json(),
    events: await events.json(),
    attendance: await attendance.json(),
  };
};
```

### Loading States for Mobile

Handle slow networks gracefully:

```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const uploadPhoto = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const response = await fetchWithTimeout(url, options, 60000);
    // Success
  } catch (err) {
    setError('Upload failed. Please check your connection.');
  } finally {
    setLoading(false);
  }
};

// Helper function
const fetchWithTimeout = (url, options, timeout = 30000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
};
```

### Push Notifications (Optional)

For real-time updates when files are processed:

```javascript
// Backend: Send notification when certificate is approved
// Frontend: Use expo-notifications or react-native-push-notification

import * as Notifications from 'expo-notifications';

// Register for push notifications
const registerForPushNotifications = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  
  const token = await Notifications.getExpoPushTokenAsync();
  // Send token to backend
  await fetch(`${API_URL}/users/push-token`, {
    method: 'POST',
    body: JSON.stringify({ token: token.data }),
  });
};
```

Render Free Tier includes:
- 750 hours/month free (enough for 1 service running 24/7)
- Automatic HTTPS
- 100GB bandwidth
- Global CDN

To optimize:
- Use efficient database queries
- Implement caching where possible
- Compress images before upload
- Set appropriate file size limits

## Security Best Practices

1. **Never commit `.env` file** - Use environment variables only
2. **Use strong JWT_SECRET** - Minimum 32 random characters
3. **Set ALLOW_ADMIN_CREATION=false** in production
4. **Whitelist CORS_ORIGIN** to your frontend domain only
5. **Use HTTPS** only (Render provides this automatically)
6. **Regularly update dependencies**: `npm update`
7. **Set appropriate file upload limits**

## Production Checklist for React Native Apps

Before going live, ensure:

**Backend Configuration:**
- [ ] `NODE_ENV=production`
- [ ] `BASE_URL` is set to your Render URL
- [ ] Strong `JWT_SECRET` is configured (32+ characters)
- [ ] Database credentials are secure
- [ ] `CORS_ORIGIN=*` (or specific if using WebView)
- [ ] `ALLOW_ADMIN_CREATION=false`
- [ ] File upload limits are appropriate
- [ ] SSL/HTTPS is enabled (automatic on Render)
- [ ] Database backups are configured
- [ ] Health check endpoint responds

**Mobile App Configuration:**
- [ ] Production API URL configured
- [ ] Image compression implemented
- [ ] Error handling for network failures
- [ ] Loading states for all API calls
- [ ] Offline support implemented (optional but recommended)
- [ ] Retry logic for failed requests
- [ ] Timeout handling (30-60 seconds)
- [ ] Cache strategy implemented
- [ ] Network permission in AndroidManifest.xml
- [ ] App Transport Security configured (iOS)

**Testing Checklist:**
- [ ] Test on slow 3G/4G networks
- [ ] Test offline behavior
- [ ] Test file uploads on both iOS and Android
- [ ] Test image loading with poor connectivity
- [ ] Test app cold start (server asleep)
- [ ] Verify all images load correctly
- [ ] Test with large files
- [ ] Test concurrent uploads
- [ ] Memory leak testing (image loading)
- [ ] Battery usage testing

## Upgrading to Persistent Storage

If you need persistent file storage, consider:

### Option 1: Render Paid Plan
- Add persistent disk to your service
- Costs ~$0.25/GB/month
- Simple integration, no code changes needed

### Option 2: AWS S3
- Install AWS SDK: `npm install aws-sdk`
- Create S3 bucket
- Update upload configuration to use S3
- Add AWS credentials to environment variables

### Option 3: Cloudinary
- Free tier available (25 credits/month)
- Install: `npm install cloudinary`
- Create Cloudinary account
- Update upload configuration
- Add Cloudinary credentials to environment

## Support and Resources

- [Render Documentation](https://render.com/docs)
- [Render Community Forum](https://community.render.com/)
- [Express.js Static Files](https://expressjs.com/en/starter/static-files.html)
- [Multer Documentation](https://github.com/expressjs/multer)

## Migration from Local to Cloud Storage

If you later decide to migrate to cloud storage (S3, Cloudinary), the codebase is structured to make this easy:

1. All URL generation is centralized in `/src/utils/urlHelper.ts`
2. File storage logic is in `/src/utils/photoStorage.ts` and `/src/config/upload.ts`
3. Update these files to use cloud storage SDK instead of local file system
4. Environment variables will control storage location
5. No changes needed in route files

---

**Last Updated**: February 16, 2026
