# React Native Integration Guide

Complete guide for integrating this backend with your React Native mobile application (iOS & Android).

## Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [API Client Setup](#api-client-setup)
3. [Authentication](#authentication)
4. [Image Upload & Display](#image-upload--display)
5. [File Handling](#file-handling)
6. [Offline Support](#offline-support)
7. [Error Handling](#error-handling)
8. [Performance Optimization](#performance-optimization)
9. [Common Issues](#common-issues)

---

## Setup & Configuration

### 1. Install Required Packages

```bash
# Core networking
npm install axios
# or use built-in fetch

# Image handling (choose one)
npm install expo-image-picker  # For Expo
npm install react-native-image-picker  # For bare React Native

# Image optimization
npm install expo-image-manipulator  # For Expo
npm install react-native-image-resizer  # For bare React Native

# Better image performance (recommended)
npm install react-native-fast-image

# Offline support
npm install @react-native-async-storage/async-storage
npm install @react-native-community/netinfo

# File viewing (for PDFs)
npm install react-native-pdf  # For viewing certificates
```

### 2. Environment Configuration

Create environment files:

**`.env.development`**:
```bash
API_URL=http://192.168.1.XXX:3000/api  # Your local machine IP
# Don't use localhost - won't work on physical devices!
```

**`.env.production`**:
```bash
API_URL=https://your-backend.onrender.com/api
```

**For Expo**, use `EXPO_PUBLIC_` prefix:
```bash
EXPO_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

### 3. API Configuration File

**`src/config/api.js`**:
```javascript
import { Platform } from 'react-native';

export const API_CONFIG = {
  // Use your local IP for development on physical devices
  BASE_URL: __DEV__ 
    ? 'http://192.168.1.100:3000/api'  // Replace with your IP
    : 'https://your-backend.onrender.com/api',
  
  TIMEOUT: 30000, // 30 seconds for mobile networks
  
  // Endpoints
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      VERIFY: '/auth/verify-email',
    },
    STUDENTS: {
      PROFILE: (id) => `/students/${id}`,
      PHOTO: (id) => `/students/${id}/photo`,
      UPDATE: (id) => `/students/${id}`,
    },
    EVENTS: {
      LIST: '/events',
      DETAILS: (id) => `/events/${id}`,
      REGISTER: (id) => `/events/${id}/register`,
    },
    ATTENDANCE: {
      MARK: '/attendance/mark',
      HISTORY: '/attendance/history',
    },
    CERTIFICATES: {
      UPLOAD: '/certificates/upload',
      LIST: (studentId) => `/certificates/student/${studentId}`,
    },
    ONDUTY: {
      REQUEST: '/onduty/request',
      LIST: '/onduty/requests',
      MARK: '/onduty/mark-attendance',
    },
  },
};
```

---

## API Client Setup

### Basic Fetch Wrapper

**`src/services/api.js`**:
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_CONFIG } from '../config/api';

class ApiClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  // Get auth token
  async getToken() {
    return await AsyncStorage.getItem('authToken');
  }

  // Build headers
  async getHeaders(isMultipart = false) {
    const token = await this.getToken();
    const headers = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  // Fetch with timeout
  async fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Check network connection
  async checkConnection() {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      throw new Error('No internet connection');
    }
  }

  // Generic request method
  async request(endpoint, options = {}) {
    await this.checkConnection();

    const url = `${this.baseURL}${endpoint}`;
    const headers = await this.getHeaders(options.isMultipart);

    const config = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    try {
      const response = await this.fetchWithTimeout(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // PUT request
  async put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload file (FormData)
  async upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
  }
}

export default new ApiClient();
```

---

## Authentication

### Login Flow

**`src/services/auth.js`**:
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { API_CONFIG } from '../config/api';

export const authService = {
  // Login
  async login(email, password) {
    const response = await api.post(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
      email,
      password,
    });

    if (response.success) {
      // Store token
      await AsyncStorage.setItem('authToken', response.token);
      // Store user data
      await AsyncStorage.setItem('userData', JSON.stringify(response.user));
      
      return response;
    }

    throw new Error(response.message || 'Login failed');
  },

  // Register
  async register(userData) {
    const response = await api.post(API_CONFIG.ENDPOINTS.AUTH.REGISTER, userData);
    return response;
  },

  // Logout
  async logout() {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
  },

  // Get current user
  async getCurrentUser() {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  },

  // Check if logged in
  async isLoggedIn() {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  },
};
```

### Usage in Component

```javascript
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { authService } from '../services/auth';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login(email, password);
      Alert.alert('Success', 'Logged in successfully');
      navigation.replace('Home');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button 
        title={loading ? 'Logging in...' : 'Login'} 
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
};
```

---

## Image Upload & Display

### Profile Photo Upload (Expo)

```javascript
import React, { useState } from 'react';
import { View, Button, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../services/api';
import { API_CONFIG } from '../config/api';

const ProfilePhotoUpload = ({ studentId, currentPhotoUrl, onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [photoUri, setPhotoUri] = useState(currentPhotoUrl);

  const pickAndUploadImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant photo library access');
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    try {
      setUploading(true);

      // Compress image
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 512 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Upload
      const formData = new FormData();
      formData.append('photo', {
        uri: compressed.uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });

      const response = await api.upload(
        API_CONFIG.ENDPOINTS.STUDENTS.PHOTO(studentId),
        formData
      );

      if (response.success) {
        setPhotoUri(response.data.profile_photo_url);
        Alert.alert('Success', 'Profile photo updated');
        onUploadSuccess?.(response.data.profile_photo_url);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      {photoUri && (
        <Image 
          source={{ uri: photoUri }} 
          style={{ width: 120, height: 120, borderRadius: 60 }}
        />
      )}
      <Button 
        title={uploading ? 'Uploading...' : 'Change Photo'} 
        onPress={pickAndUploadImage}
        disabled={uploading}
      />
    </View>
  );
};

export default ProfilePhotoUpload;
```

### Attendance Photo (Base64)

```javascript
import React, { useState } from 'react';
import { View, Button, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import api from '../services/api';

const AttendancePhoto = ({ eventId, studentId, onSuccess }) => {
  const [taking, setTaking] = useState(false);

  const takeSelfie = async () => {
    // Request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant camera access');
      return;
    }

    // Take photo
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled) return;

    setTaking(true);
    try {
      // Convert to base64
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const photoData = `data:image/jpeg;base64,${base64}`;

      // Get location (you'll need expo-location)
      const location = await getLocation(); // Implement this

      // Mark attendance
      const response = await api.post('/attendance/mark', {
        eventId,
        studentId,
        photoData,
        latitude: location.latitude,
        longitude: location.longitude,
      });

      if (response.success) {
        Alert.alert('Success', 'Attendance marked successfully');
        onSuccess?.();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to mark attendance: ' + error.message);
    } finally {
      setTaking(false);
    }
  };

  return (
    <Button 
      title={taking ? 'Processing...' : 'Take Attendance Photo'} 
      onPress={takeSelfie}
      disabled={taking}
    />
  );
};
```

### Display Images with Fast Image

```javascript
import FastImage from 'react-native-fast-image';

const UserAvatar = ({ photoUrl, size = 50 }) => {
  return (
    <FastImage
      source={{
        uri: photoUrl,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable,
      }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
};
```

---

## File Handling

### Certificate Upload (PDF/Image)

```javascript
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';

const uploadCertificate = async (title, category) => {
  try {
    // Pick document
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });

    if (result.type === 'cancel') return;

    // Check file size (10MB limit)
    if (result.size > 10 * 1024 * 1024) {
      Alert.alert('Error', 'File size must be less than 10MB');
      return;
    }

    // Upload
    const formData = new FormData();
    formData.append('certificate', {
      uri: result.uri,
      type: result.mimeType,
      name: result.name,
    });
    formData.append('title', title);
    formData.append('category', category);

    const response = await api.upload(
      '/certificates/upload',
      formData
    );

    if (response.success) {
      Alert.alert('Success', 'Certificate uploaded successfully');
      return response.data;
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to upload certificate');
    throw error;
  }
};
```

### View PDF Certificate

```javascript
import Pdf from 'react-native-pdf';

const CertificateViewer = ({ certificateUrl }) => {
  return (
    <Pdf
      source={{ uri: certificateUrl }}
      style={{ flex: 1 }}
      onError={(error) => console.log('PDF Error:', error)}
    />
  );
};
```

---

## Offline Support

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_KEYS = {
  EVENTS: 'cached_events',
  PROFILE: 'cached_profile',
  ATTENDANCE: 'cached_attendance',
};

export const cacheService = {
  // Save to cache
  async set(key, data) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  // Get from cache
  async get(key, maxAge = 3600000) { // 1 hour default
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      
      // Check if cache is still valid
      if (Date.now() - timestamp > maxAge) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  // Fetch with cache
  async fetchWithCache(cacheKey, fetchFn, maxAge) {
    const netInfo = await NetInfo.fetch();

    if (!netInfo.isConnected) {
      // Offline: return cached data
      const cached = await this.get(cacheKey, Infinity);
      if (cached) return cached;
      throw new Error('No internet connection and no cached data');
    }

    try {
      // Online: fetch fresh data
      const data = await fetchFn();
      await this.set(cacheKey, data);
      return data;
    } catch (error) {
      // Error: fallback to cache
      const cached = await this.get(cacheKey, Infinity);
      if (cached) return cached;
      throw error;
    }
  },
};

// Usage
const fetchEvents = async () => {
  return await cacheService.fetchWithCache(
    CACHE_KEYS.EVENTS,
    () => api.get(API_CONFIG.ENDPOINTS.EVENTS.LIST),
    300000 // 5 minutes
  );
};
```

---

## Error Handling

```javascript
import { Alert } from 'react-native';

export const handleApiError = (error, fallbackMessage = 'Something went wrong') => {
  let message = fallbackMessage;

  if (error.message === 'No internet connection') {
    message = 'No internet connection. Please check your network.';
  } else if (error.message === 'Request timeout') {
    message = 'Request timed out. Please try again.';
  } else if (error.message) {
    message = error.message;
  }

  Alert.alert('Error', message);
};

// Usage in component
try {
  const response = await api.get('/events');
} catch (error) {
  handleApiError(error, 'Failed to load events');
}
```

---

## Performance Optimization

### Image Preloading

```javascript
import FastImage from 'react-native-fast-image';

// Preload images when entering a screen
const EventDetailsScreen = ({ event }) => {
  useEffect(() => {
    const imagesToPreload = [
      event.banner_url,
      event.organizer_photo,
      ...event.participants.map(p => p.photo_url),
    ].filter(Boolean);

    FastImage.preload(
      imagesToPreload.map(uri => ({
        uri,
        priority: FastImage.priority.normal,
      }))
    );
  }, [event]);

  // ...
};
```

### Lazy Loading Lists

```javascript
import { FlatList } from 'react-native';

const EventsList = ({ events }) => {
  const renderEvent = ({ item }) => (
    <EventCard event={item} />
  );

  return (
    <FlatList
      data={events}
      renderItem={renderEvent}
      keyExtractor={(item) => item.id.toString()}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={true}
    />
  );
};
```

---

## Common Issues

### Issue: Images not loading

**Solution**:
```javascript
// Add error handling
<Image 
  source={{ uri: photoUrl }} 
  defaultSource={require('../assets/placeholder.png')}
  onError={(e) => console.log('Image error:', e.nativeEvent.error)}
/>
```

### Issue: Upload timeout on slow networks

**Solution**:
```javascript
// Increase timeout for uploads
const uploadWithLongTimeout = async (endpoint, formData) => {
  return api.request(endpoint, {
    method: 'POST',
    body: formData,
    isMultipart: true,
    timeout: 120000, // 2 minutes
  });
};
```

### Issue: Server sleeping (Render free tier)

**Solution**:
```javascript
// Add retry logic with user feedback
const fetchWithRetry = async (fetchFn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      if (i > 0) {
        Alert.alert('Retrying', 'Server is waking up, please wait...');
      }
      return await fetchFn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
};
```

---

## Complete Example: Event Registration

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, ActivityIndicator } from 'react-native';
import FastImage from 'react-native-fast-image';
import api from '../services/api';
import { handleApiError } from '../utils/errorHandler';

const EventDetailsScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetchEventDetails();
  }, []);

  const fetchEventDetails = async () => {
    try {
      const response = await api.get(`/events/${eventId}`);
      setEvent(response.data);
    } catch (error) {
      handleApiError(error, 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const response = await api.post(`/events/${eventId}/register`, {});
      Alert.alert('Success', 'Registered for event successfully');
      navigation.goBack();
    } catch (error) {
      handleApiError(error, 'Failed to register for event');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <View>
      <FastImage 
        source={{ uri: event.banner_url }}
        style={{ width: '100%', height: 200 }}
      />
      <Text>{event.title}</Text>
      <Text>{event.description}</Text>
      <Button 
        title={registering ? 'Registering...' : 'Register'}
        onPress={handleRegister}
        disabled={registering}
      />
    </View>
  );
};

export default EventDetailsScreen;
```

---

**Need help?** Check [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for backend setup and troubleshooting.
