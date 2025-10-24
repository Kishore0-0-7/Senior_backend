import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../uploads");
const profilePhotosDir = path.join(uploadsDir, "profile-photos");
const onDutyDocumentsDir = path.join(uploadsDir, "onduty-documents");
const onDutySelfiesDir = path.join(uploadsDir, "onduty-selfies");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(profilePhotosDir)) {
  fs.mkdirSync(profilePhotosDir, { recursive: true });
}

if (!fs.existsSync(onDutyDocumentsDir)) {
  fs.mkdirSync(onDutyDocumentsDir, { recursive: true });
}

if (!fs.existsSync(onDutySelfiesDir)) {
  fs.mkdirSync(onDutySelfiesDir, { recursive: true });
}

// Configure multer storage for profile photos
const profilePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePhotosDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Configure multer storage for on-duty documents
const onDutyDocumentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, onDutyDocumentsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Configure multer storage for on-duty selfies
const onDutySelfieStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, onDutySelfiesDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter - only allow images
const imageFileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
      )
    );
  }
};

// File filter - allow documents and images
const documentFileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only images, PDF, and Word documents are allowed."
      )
    );
  }
};

// Create multer upload instance for profile photos
export const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Create multer upload instance for on-duty documents
export const uploadOnDutyDocument = multer({
  storage: onDutyDocumentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size for documents
  },
});

// Create multer upload instance for on-duty selfies
export const uploadOnDutySelfie = multer({
  storage: onDutySelfieStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});
