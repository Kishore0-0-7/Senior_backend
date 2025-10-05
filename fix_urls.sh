#!/bin/bash

# Fix profile photo URLs in database
echo "Fixing profile photo URLs in database..."

PGPASSWORD=1234 psql -h localhost -U postgres -d student_event_management << EOF
UPDATE students 
SET profile_photo_url = REPLACE(profile_photo_url, 'http://localhost:3000', 'http://10.159.43.89:3000') 
WHERE profile_photo_url LIKE 'http://localhost:3000%';

SELECT 'Updated URLs:';
SELECT id, name, profile_photo_url FROM students WHERE profile_photo_url IS NOT NULL;
EOF

echo "Done! Profile photo URLs have been updated."
