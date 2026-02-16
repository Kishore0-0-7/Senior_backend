#!/usr/bin/env node
/**
 * Database URL Fixer
 * Updates all file URLs in the database to use the production BASE_URL
 */

const { Pool } = require('pg');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'https://senior-backend-ebwu.onrender.com';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false
});

async function fixDatabaseUrls() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting database URL fix...');
    console.log(`📍 Using BASE_URL: ${BASE_URL}\n`);

    await client.query('BEGIN');

    // Fix on_duty_requests document URLs
    console.log('1️⃣  Fixing on_duty_requests...');
    const result1 = await client.query(`
      UPDATE on_duty_requests
      SET document_url = CASE
          WHEN document_url LIKE 'http://localhost:%' THEN 
              REPLACE(document_url, SUBSTRING(document_url FROM 'http://localhost:[0-9]+'), $1)
          WHEN document_url LIKE '/uploads/%' THEN 
              $1 || document_url
          WHEN document_url NOT LIKE 'http%' AND document_url NOT LIKE '/uploads/%' THEN
              $1 || '/uploads/onduty-documents/' || document_url
          ELSE document_url
      END
      WHERE document_url IS NOT NULL
      RETURNING id, document_url;
    `, [BASE_URL]);
    console.log(`   ✅ Updated ${result1.rowCount} records`);

    // Fix on_duty_attendance selfie URLs
    console.log('2️⃣  Fixing on_duty_attendance...');
    const result2 = await client.query(`
      UPDATE on_duty_attendance
      SET selfie_photo_url = CASE
          WHEN selfie_photo_url LIKE 'http://localhost:%' THEN 
              REPLACE(selfie_photo_url, SUBSTRING(selfie_photo_url FROM 'http://localhost:[0-9]+'), $1)
          WHEN selfie_photo_url LIKE '/uploads/%' THEN 
              $1 || selfie_photo_url
          WHEN selfie_photo_url NOT LIKE 'http%' AND selfie_photo_url NOT LIKE '/uploads/%' THEN
              $1 || '/uploads/onduty-selfies/' || selfie_photo_url
          ELSE selfie_photo_url
      END
      WHERE selfie_photo_url IS NOT NULL
      RETURNING id, selfie_photo_url;
    `, [BASE_URL]);
    console.log(`   ✅ Updated ${result2.rowCount} records`);

    // Fix certificates file URLs
    console.log('3️⃣  Fixing certificates...');
    const result3 = await client.query(`
      UPDATE certificates
      SET file_url = CASE
          WHEN file_url LIKE 'http://localhost:%' THEN 
              REPLACE(file_url, SUBSTRING(file_url FROM 'http://localhost:[0-9]+'), $1)
          WHEN file_url LIKE '/uploads/%' THEN 
              $1 || file_url
          WHEN file_url NOT LIKE 'http%' AND file_url NOT LIKE '/uploads/%' THEN
              $1 || '/uploads/certificates/' || file_url
          ELSE file_url
      END
      RETURNING id, file_url;
    `, [BASE_URL]);
    console.log(`   ✅ Updated ${result3.rowCount} records`);

    // Fix attendance_logs proof photo URLs
    console.log('4️⃣  Fixing attendance_logs...');
    const result4 = await client.query(`
      UPDATE attendance_logs
      SET proof_photo_url = CASE
          WHEN proof_photo_url LIKE 'http://localhost:%' THEN 
              REPLACE(proof_photo_url, SUBSTRING(proof_photo_url FROM 'http://localhost:[0-9]+'), $1)
          WHEN proof_photo_url LIKE '/uploads/%' THEN 
              $1 || proof_photo_url
          WHEN proof_photo_url NOT LIKE 'http%' AND proof_photo_url NOT LIKE '/uploads/%' THEN
              $1 || '/uploads/attendance-photos/' || proof_photo_url
          ELSE proof_photo_url
      END
      WHERE proof_photo_url IS NOT NULL
      RETURNING id, proof_photo_url;
    `, [BASE_URL]);
    console.log(`   ✅ Updated ${result4.rowCount} records`);

    // Fix students profile photo URLs
    console.log('5️⃣  Fixing students...');
    const result5 = await client.query(`
      UPDATE students
      SET profile_photo_url = CASE
          WHEN profile_photo_url LIKE 'http://localhost:%' THEN 
              REPLACE(profile_photo_url, SUBSTRING(profile_photo_url FROM 'http://localhost:[0-9]+'), $1)
          WHEN profile_photo_url LIKE '/uploads/%' THEN 
              $1 || profile_photo_url
          WHEN profile_photo_url NOT LIKE 'http%' AND profile_photo_url NOT LIKE '/uploads/%' THEN
              $1 || '/uploads/profile-photos/' || profile_photo_url
          ELSE profile_photo_url
      END
      WHERE profile_photo_url IS NOT NULL
      RETURNING id, profile_photo_url;
    `, [BASE_URL]);
    console.log(`   ✅ Updated ${result5.rowCount} records`);

    await client.query('COMMIT');

    console.log('\n📊 Summary:');
    console.log(`   On-duty requests: ${result1.rowCount} updated`);
    console.log(`   On-duty attendance: ${result2.rowCount} updated`);
    console.log(`   Certificates: ${result3.rowCount} updated`);
    console.log(`   Attendance logs: ${result4.rowCount} updated`);
    console.log(`   Student profiles: ${result5.rowCount} updated`);
    
    // Show sample URLs
    console.log('\n🔍 Sample URLs after fix:');
    
    const samples = await client.query(`
      SELECT 'on_duty_requests' as table_name, document_url as url 
      FROM on_duty_requests 
      WHERE document_url IS NOT NULL 
      LIMIT 1
      UNION ALL
      SELECT 'certificates', file_url 
      FROM certificates 
      LIMIT 1
      UNION ALL
      SELECT 'students', profile_photo_url 
      FROM students 
      WHERE profile_photo_url IS NOT NULL 
      LIMIT 1;
    `);
    
    samples.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.url}`);
    });

    console.log('\n✅ Database URLs fixed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing database URLs:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
fixDatabaseUrls().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
