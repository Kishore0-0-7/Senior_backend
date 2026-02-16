import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { generateAttendancePhotoUrl } from "./urlHelper";

const getMaxPhotoSizeBytes = () => {
  const envValue = process.env.MAX_ATTENDANCE_PHOTO_SIZE_MB;
  const parsed = envValue ? Number(envValue) : NaN;
  const sizeMb = !Number.isNaN(parsed) && parsed > 0 ? parsed : 50; // default 50MB
  return sizeMb * 1024 * 1024;
};

// Ensure the attendance photos directory exists
const getAttendancePhotosDir = () => {
  const uploadsRoot = path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
  );
  const photosDir = path.join(uploadsRoot, "attendance-photos");

  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }

  return photosDir;
};

/**
 * Save attendance photo from base64 or file
 */
export const saveAttendancePhoto = async (
  photoData: string, // base64 encoded photo data
  eventId: string,
  studentId: string
): Promise<{
  photoUrl: string;
  fileName: string;
  fileSize: number;
}> => {
  try {
    const photosDir = getAttendancePhotosDir();

    // Remove data URL prefix if present
    let base64Data = photoData;
    if (photoData.includes(",")) {
      base64Data = photoData.split(",")[1];
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const fileName = `${eventId}_${studentId}_${timestamp}_${uniqueId}.jpg`;
    const filePath = path.join(photosDir, fileName);

    // Save file
    fs.writeFileSync(filePath, imageBuffer);

    // Get file size
    const fileSize = imageBuffer.length;

    // Return full URL using the URL helper
    const photoUrl = generateAttendancePhotoUrl(fileName);

    return {
      photoUrl,
      fileName,
      fileSize,
    };
  } catch (error) {
    console.error("Error saving attendance photo:", error);
    throw new Error(`Failed to save attendance photo: ${error}`);
  }
};

/**
 * Delete attendance photo if it exists
 */
export const deleteAttendancePhoto = (photoUrl: string): boolean => {
  try {
    if (!photoUrl) return false;

    const photosDir = getAttendancePhotosDir();
    const fileName = photoUrl.split("/").pop();

    if (!fileName) return false;

    const filePath = path.join(photosDir, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error deleting attendance photo:", error);
    return false;
  }
};

/**
 * Validate photo dimensions and size
 */
export const validatePhotoData = (
  photoData: string,
  maxSizeBytes: number = getMaxPhotoSizeBytes()
): {
  valid: boolean;
  error?: string;
} => {
  try {
    if (!photoData) {
      return { valid: false, error: "Photo data is required" };
    }

    // Remove data URL prefix if present
    let base64Data = photoData;
    if (photoData.includes(",")) {
      base64Data = photoData.split(",")[1];
    }

    // Estimate size of base64 data
    const estimatedSize = Buffer.byteLength(base64Data, "base64");

    if (estimatedSize > maxSizeBytes) {
      return {
        valid: false,
        error: `Photo size exceeds maximum of ${
          Math.round((maxSizeBytes / 1024 / 1024) * 10) / 10
        }MB`,
      };
    }

    // Check if it's valid base64
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      return { valid: false, error: "Invalid base64 format" };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Error validating photo data" };
  }
};
