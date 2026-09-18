const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// রেন্ডার PostgreSQL ডেটাবেজ কানেকশন
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// সার্ভার চালু হলে স্বয়ংক্রিয়ভাবে টেবিল তৈরি ও প্রাথমিক ডেটা সেটআপ
async function initDatabase() {
  try {
    // ১. অ্যাডমিন টেবিল
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        name VARCHAR(100)
      );
    `);

    // ২. শিক্ষক তালিকা টেবিল
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        teacher_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        designation VARCHAR(100),
        subject VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100)
      );
    `);

    // ৩. পূর্ণাঙ্গ শিক্ষার্থী ও ভর্তি টেবিল
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        student_uid VARCHAR(50) UNIQUE NOT NULL, -- ইউনিক আইডি (যেমন: AMSC-2026-101)
        name VARCHAR(150) NOT NULL,
        class_name VARCHAR(50) NOT NULL,        -- শ্রেণি (যেমন: Class 9, Class 10)
        roll_no VARCHAR(20) NOT NULL,           -- ক্লাসের রোল
        dob DATE,
        father_name VARCHAR(150),
        mother_name VARCHAR(150),
        guardian_phone VARCHAR(20) NOT NULL,
        address TEXT,
        previous_school VARCHAR(150),
        admission_status VARCHAR(20) DEFAULT 'Approved'
      );
    `);

    // ৪. মাসভিত্তিক ফি টেবিল (কোন মাসের ফি জমা, কোনটা বাকি)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_fees (
        id SERIAL PRIMARY KEY,
        student_uid VARCHAR(50) NOT NULL,
        month_name VARCHAR(50) NOT NULL,       -- জানুয়ারি, ফেব্রুয়ারি, মার্চ ইত্যাদি
        year INT DEFAULT 2026,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'Due',      -- 'Paid' অথবা 'Due'
        paid_date TIMESTAMP NULL,
        transaction_id VARCHAR(100) NULL
      );
    `);

    // ৫. ক্লাস ও রোলভিত্তিক রেজাল্ট টেবিল
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exam_results (
        id SERIAL PRIMARY KEY,
        student_uid VARCHAR(50) NOT NULL,
        exam_name VARCHAR(100) NOT NULL,       -- অর্ধ-বার্ষিক / বার্ষিক
        subject VARCHAR(100) NOT NULL,
        marks INT NOT NULL,
        grade VARCHAR(5) NOT NULL
      );
    `);

    // প্রাথমিক অ্যাডমিন অ্যাকাউন্ট (যদি না থাকে)
    const adminCheck = await pool.query(`SELECT * FROM admins WHERE username = 'admin'`);
    if (adminCheck.rows.length === 0) {
      await pool.query(`INSERT INTO admins (username, password, name) VALUES ('admin', 'admin123', 'প্রধান সুপার অ্যাডমিন')`);
    }

    // প্রাথমিক কিছু শিক্ষক যুক্ত করা (টেস্টিংয়ের জন্য)
    const teacherCheck = await pool.query(`SELECT COUNT(*) FROM teachers`);
    if (parseInt(teacherCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO teachers (teacher_id, name, designation, subject, phone, email) VALUES
        ('T-101', 'মাওলানা আব্দুর রহমান', 'অধ্যক্ষ ও বিভাগীয় প্রধান', 'ইসলামিক স্টাডিজ', '01711000001', 'principal@almuslim.edu.bd'),
        ('T-102', 'মোঃ রফিকুল ইসলাম', 'সহকারী প্রধান শিক্ষক', 'উচ্চতর গণিত', '01711000002', 'rafiq@almuslim.edu.bd'),
        ('T-103', 'মোসাম্মৎ পারভীন আক্তার', 'সিনিয়র শিক্ষিকা', 'ইংরেজি সাহিত্য', '01711000003', 'parveen@almuslim.edu.bd'),
        ('T-104', 'ড. কামরুল হাসান', 'প্রভাষক (কলেজ শাখা)', 'পদার্থবিজ্ঞান', '01711000004', 'kamrul@almuslim.edu.bd')
      `);
    }

    // প্রাথমিক শিক্ষার্থী যুক্ত করা (টেস্টিংয়ের জন্য)
    const studentCheck = await pool.query(`SELECT * FROM students WHERE student_uid = 'AMSC-1001'`);
    if (studentCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO students (student_uid, name, class_name, roll_no, dob, father_name, mother_name, guardian_phone, address, previous_school)
        VALUES ('AMSC-1001', 'আব্দুল্লাহ আল মামুন', 'Class 10', '01', '2010-05-15', 'মোঃ রফিকুল ইসলাম', 'মোসাঃ রোকেয়া বেগম', '01700000001', 'মিরপুর-১০, ঢাকা', 'আল মুসলিম জুনিয়র একাডেমি')
      `);

      // মামুনের ফি রেকর্ড (জানুয়ারি ও ফেব্রুয়ারি দেওয়া, মার্চ বাকি)
      await pool.query(`
        INSERT INTO student_fees (student_uid, month_name, year, amount, status, paid_date, transaction_id) VALUES
        ('AMSC-1001', 'জানুয়ারি', 2026, 1500, 'Paid', NOW(), 'TXN-BKASH-01'),
        ('AMSC-1001', 'ফেব্রুয়ারি', 2026, 1500, 'Paid', NOW(), 'TXN-BKASH-02'),
        ('AMSC-1001', 'মার্চ', 2026, 1500, 'Due', NULL, NULL),
        ('AMSC-1001', 'এপ্রিল', 2026, 1500, 'Due', NULL, NULL)
      `);

      // মামুনের রেজাল্ট রেকর্ড
      await pool.query(`
        INSERT INTO exam_results (student_uid, exam_name, subject, marks, grade) VALUES
        ('AMSC-1001', 'অর্ধ-বার্ষিক পরীক্ষা ২০২৬', 'বাংলা ১ম পত্র', 85, 'A+'),
        ('AMSC-1001', 'অর্ধ-বার্ষিক পরীক্ষা ২০২৬', 'ইংরেজি ১ম পত্র', 82, 'A+'),
        ('AMSC-1001', 'অর্ধ-বার্ষিক পরীক্ষা ২০২৬', 'সাধারণ গণিত', 95, 'A+'),
        ('AMSC-1001', 'অর্ধ-বার্ষিক পরীক্ষা ২০২৬', 'পদার্থবিজ্ঞান', 88, 'A+')
      `);
    }

    console.log('✅ AL MUSLIM ডেটাবেজ ও সব টেবিল সম্পূর্ণ প্রস্তুত!');
  } catch (err) {
    console.error('Database Init Error:', err);
  }
}

if (process.env.DATABASE_URL) {
  initDatabase();
}

// ---------------- এপিআই রাউটসমূহ (APIs) ----------------

// ১. অ্যাডমিন লগইন
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM admins WHERE username = $1 AND password = $2`, [username, password]);
    if (result.rows.length > 0) {
      res.json({ success: true, admin: { name: result.rows[0].name, username: result.rows[0].username } });
    } else {
      res.status(401).json({ success: false, error: 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ২. শিক্ষকদের তালিকা আনা (অ্যাডমিনের জন্য)
app.get('/api/teachers', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM teachers ORDER BY id ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ৩. নতুন শিক্ষক যোগ করা (অ্যাডমিন প্যানেল থেকে)
app.post('/api/teachers', async (req, res) => {
  const { teacher_id, name, designation, subject, phone, email } = req.body;
  try {
    await pool.query(
      `INSERT INTO teachers (teacher_id, name, designation, subject, phone, email) VALUES ($1, $2, $3, $4, $5, $6)`,
      [teacher_id, name, designation, subject, phone, email]
    );
    res.json({ success: true, message: 'নতুন শিক্ষক সফলভাবে তালিকায় যুক্ত হয়েছেন!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ৪. পূর্ণাঙ্গ অনলাইন ভর্তি আবেদন সাবমিট
app.post('/api/admission/apply', async (req, res) => {
  const {
    name, class_name, dob, father_name, mother_name,
    guardian_phone, address, previous_school
  } = req.body;

  try {
    // একটি রিয়েল ইউনিক স্টুডেন্ট আইডি জেনারেট করা (যেমন: AMSC-2026-XXXX)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const student_uid = `AMSC-2026-${randomSuffix}`;
    const autoRoll = Math.floor(1 + Math.random() * 50).toString().padStart(2, '0');

    await pool.query(
      `INSERT INTO students (student_uid, name, class_name, roll_no, dob, father_name, mother_name, guardian_phone, address, previous_school)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [student_uid, name, class_name, autoRoll, dob, father_name, mother_name, guardian_phone, address, previous_school]
    );

    // শিক্ষার্থীর জন্য প্রাথমিক মাসের ফি স্লট তৈরি
    const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল'];
    for (const m of months) {
      await pool.query(
        `INSERT INTO student_fees (student_uid, month_name, year, amount, status) VALUES ($1, $2, 2026, 1500, 'Due')`,
        [student_uid, m]
      );
    }

    res.json({
      success: true,
      student_uid: student_uid,
      roll_no: autoRoll,
      class_name: class_name,
      message: 'ভর্তি আবেদন সফলভাবে সম্পন্ন হয়েছে!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ৫. ক্লাস + রোল অথবা ইউনিক আইডি দিয়ে রেজাল্ট চেক
app.get('/api/student/check-result', async (req, res) => {
  const { class_name, roll_no, student_uid } = req.query;
  try {
    let studentQuery = '';
    let params = [];

    if (student_uid) {
      studentQuery = `SELECT * FROM students WHERE student_uid = $1`;
      params = [student_uid];
    } else {
      studentQuery = `SELECT * FROM students WHERE class_name = $1 AND roll_no = $2`;
      params = [class_name, roll_no];
    }

    const studentRes = await pool.query(studentQuery, params);
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'উক্ত শ্রেণি ও রোলে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি!' });
    }

    const student = studentRes.rows[0];
    const results = await pool.query(`SELECT * FROM exam_results WHERE student_uid = $1`, [student.student_uid]);

    res.json({
      student: student,
      exam_name: 'অর্ধ-বার্ষিক মূল্যায়ন পরীক্ষা ২০২৬',
      results: results.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ৬. ক্লাস + রোল অথবা ইউনিক আইডি দিয়ে মাসিক ফি চেক
app.get('/api/student/check-fees', async (req, res) => {
  const { class_name, roll_no, student_uid } = req.query;
  try {
    let studentQuery = '';
    let params = [];

    if (student_uid) {
      studentQuery = `SELECT * FROM students WHERE student_uid = $1`;
      params = [student_uid];
    } else {
      studentQuery = `SELECT * FROM students WHERE class_name = $1 AND roll_no = $2`;
      params = [class_name, roll_no];
    }

    const studentRes = await pool.query(studentQuery, params);
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'শিক্ষার্থী খুঁজে পাওয়া যায়নি!' });
    }

    const student = studentRes.rows[0];
    const fees = await pool.query(`SELECT * FROM student_fees WHERE student_uid = $1 ORDER BY id ASC`, [student.student_uid]);

    res.json({
      student: student,
      fees: fees.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ৭. ফি পরিশোধ করা (bKash/Nagad পেমেন্ট কনফার্ম)
app.post('/api/student/pay-fee', async (req, res) => {
  const { fee_id, transaction_id } = req.body;
  try {
    await pool.query(
      `UPDATE student_fees SET status = 'Paid', paid_date = NOW(), transaction_id = $1 WHERE id = $2`,
      [transaction_id, fee_id]
    );
    res.json({ success: true, message: 'ফি সফলভাবে পরিশোধিত হয়েছে!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ৮. অ্যাডমিনের জন্য ভর্তি হওয়া সব ছাত্রের তালিকা
app.get('/api/admin/students', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM students ORDER BY id DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`AL MUSLIM ERP Engine running on Port ${PORT}`));
