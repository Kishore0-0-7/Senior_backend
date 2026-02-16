const { Pool } = require('pg');

const pool = new Pool({
  host: 'dpg-d66qnu06fj8s739bk8jg-a.singapore-postgres.render.com',
  port: 5432,
  database: 'student_event_management',
  user: 'kishore',
  password: 'vc3STfMi3LvO4bP3NgD4oGFbpra6ypG4',
  ssl: { rejectUnauthorized: false }
});

async function checkUrls() {
  try {
    console.log('Checking URLs in database...\n');
    
    // Check on_duty_requests
    const onDutyRequests = await pool.query(`
      SELECT id, document_url, created_at 
      FROM on_duty_requests 
      WHERE document_url IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 3;
    `);
    console.log('=== ON-DUTY REQUESTS ===');
    console.log(JSON.stringify(onDutyRequests.rows, null, 2));
    
    // Check on_duty_attendance
    const onDutyAttendance = await pool.query(`
      SELECT id, selfie_photo_url, created_at 
      FROM on_duty_attendance 
      WHERE selfie_photo_url IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 3;
    `);
    console.log('\n=== ON-DUTY ATTENDANCE ===');
    console.log(JSON.stringify(onDutyAttendance.rows, null, 2));
    
    // Check certificates
    const certificates = await pool.query(`
      SELECT id, file_url, uploaded_at 
      FROM certificates 
      ORDER BY uploaded_at DESC 
      LIMIT 3;
    `);
    console.log('\n=== CERTIFICATES ===');
    console.log(JSON.stringify(certificates.rows, null, 2));
    
    // Check attendance_logs
    const attendance = await pool.query(`
      SELECT id, proof_photo_url, created_at 
      FROM attendance_logs 
      WHERE proof_photo_url IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 3;
    `);
    console.log('\n=== ATTENDANCE LOGS ===');
    console.log(JSON.stringify(attendance.rows, null, 2));
    
    // Check students profile photos
    const students = await pool.query(`
      SELECT id, profile_photo_url, created_at 
      FROM students 
      WHERE profile_photo_url IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 3;
    `);
    console.log('\n=== STUDENT PROFILE PHOTOS ===');
    console.log(JSON.stringify(students.rows, null, 2));
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUrls();
