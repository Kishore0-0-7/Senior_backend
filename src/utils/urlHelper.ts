/**
 * URL Helper Utility
 * 
 * Generates full URLs for file uploads, ensuring compatibility with
 * Render deployment and other cloud hosting platforms.
 */

/**
 * Get the base URL for the application
 * 
 * Priority:
 * 1. BASE_URL environment variable (for production/Render)
 * 2. Fallback to localhost with PORT (for development)
 */
export const getBaseUrl = (): string => {
  const baseUrl = process.env.BASE_URL;
  
  if (baseUrl) {
    // Remove trailing slash if present
    return baseUrl.replace(/\/$/, '');
  }
  
  // Fallback for development
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
};

/**
 * Generate a full URL for an uploaded file
 * 
 * @param relativePath - Relative path starting with /uploads/... or just the path after uploads/
 * @returns Full URL with base URL prepended
 * 
 * @example
 * // Development (BASE_URL not set)
 * generateFileUrl('/uploads/profile-photos/abc.jpg')
 * // Returns: 'http://localhost:3000/uploads/profile-photos/abc.jpg'
 * 
 * // Production (BASE_URL = 'https://myapp.onrender.com')
 * generateFileUrl('/uploads/profile-photos/abc.jpg')
 * // Returns: 'https://myapp.onrender.com/uploads/profile-photos/abc.jpg'
 */
export const generateFileUrl = (relativePath: string): string => {
  const baseUrl = getBaseUrl();
  
  // Ensure path starts with /
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  
  return `${baseUrl}${path}`;
};

/**
 * Generate a full URL for a specific upload type
 * 
 * @param uploadType - Type of upload (e.g., 'profile-photos', 'certificates', etc.)
 * @param filename - Name of the file
 * @returns Full URL for the file
 */
export const generateUploadUrl = (uploadType: string, filename: string): string => {
  return generateFileUrl(`/uploads/${uploadType}/${filename}`);
};

/**
 * Generate a full URL for certificate uploads
 * 
 * @param folderName - Student's email-based folder name
 * @param filename - Certificate filename
 * @returns Full URL for the certificate
 */
export const generateCertificateUrl = (folderName: string, filename: string): string => {
  return generateFileUrl(`/uploads/certificates/${folderName}/${filename}`);
};

/**
 * Generate a full URL for attendance photo uploads
 * 
 * @param filename - Attendance photo filename
 * @returns Full URL for the attendance photo
 */
export const generateAttendancePhotoUrl = (filename: string): string => {
  return generateUploadUrl('attendance-photos', filename);
};

/**
 * Generate a full URL for profile photo uploads
 * 
 * @param filename - Profile photo filename
 * @returns Full URL for the profile photo
 */
export const generateProfilePhotoUrl = (filename: string): string => {
  return generateUploadUrl('profile-photos', filename);
};

/**
 * Generate a full URL for on-duty document uploads
 * 
 * @param filename - On-duty document filename
 * @returns Full URL for the on-duty document
 */
export const generateOnDutyDocumentUrl = (filename: string): string => {
  return generateUploadUrl('onduty-documents', filename);
};

/**
 * Generate a full URL for on-duty selfie uploads
 * 
 * @param filename - On-duty selfie filename
 * @returns Full URL for the on-duty selfie
 */
export const generateOnDutySelfieUrl = (filename: string): string => {
  return generateUploadUrl('onduty-selfies', filename);
};
