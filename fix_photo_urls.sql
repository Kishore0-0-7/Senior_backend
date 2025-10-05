-- Fix profile photo URLs to use correct server IP
UPDATE students 
SET profile_photo_url = REPLACE(profile_photo_url, 'http://localhost:3000', 'http://10.159.43.89:3000') 
WHERE profile_photo_url LIKE 'http://localhost:3000%';

-- Verify the update
SELECT id, name, profile_photo_url FROM students WHERE profile_photo_url IS NOT NULL;
