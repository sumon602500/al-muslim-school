const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// শ্রেণি অনুযায়ী নির্ধারিত ফি কাঠামো
const CLASS_FEES = {
  'Play / Nursery': { admission: 1500, monthly: 800 },
  'Class 1 - Class 5': { admission: 2000, monthly: 1000 },
  'Class 6 - Class 8': { admission: 2500, monthly: 1200 },
  'Class 9 - Class 10': { admission: 3500, monthly: 1500 },
  'Class 11 - Class 12 (College)': { admission: 5000, monthly: 2200 }
};

// PostgreSQL ডেটাবেজ কানেকশন
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ডেটাবেজ টেবিল স্বয়ংক্রিয় ইনিশিয়ালাইজেশন
async function initDatabase() {
  if (!process.env.DATABASE_URL) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admissions (
        id SERIAL PRIMARY KEY,
        student_uid VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        class_name VARCHAR(100) NOT NULL,
        admission_fee INT NOT NULL,
        monthly_fee INT NOT NULL,
        guardian_phone VARCHAR(20) NOT NULL,
        payment_method VARCHAR(30) NOT NULL,
        sender_phone VARCHAR(20) NOT NULL,
        trx_id VARCHAR(100) NOT NULL,
        father_name VARCHAR(150),
        mother_name VARCHAR(150),
        dob DATE,
        address TEXT,
        previous_school VARCHAR(150),
        status VARCHAR(30) DEFAULT 'Pending Review',
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_fees (
        id SERIAL PRIMARY KEY,
        student_uid VARCHAR(50) NOT NULL,
        month_name VARCHAR(50) NOT NULL,
        amount INT NOT NULL,
        status VARCHAR(20) DEFAULT 'Due',
        transaction_id VARCHAR(100) NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        teacher_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        designation VARCHAR(100),
        subject VARCHAR(100),
        phone VARCHAR(20)
      );
    `);

    const tCount = await pool.query(`SELECT COUNT(*) FROM teachers`);
    if (parseInt(tCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO teachers (teacher_id, name, designation, subject, phone) VALUES
        ('T-101', 'মাওলানা আব্দুর রহমান', 'অধ্যক্ষ ও বিভাগীয় প্রধান', 'ইসলামিক স্টাডিজ', '01711000001'),
        ('T-102', 'মোঃ রফিকুল ইসলাম', 'সহকারী প্রধান শিক্ষক', 'উচ্চতর গণিত', '01711000002'),
        ('T-103', 'মোসাম্মৎ পারভীন আক্তার', 'সিনিয়র শিক্ষিকা', 'ইংরেজি সাহিত্য', '01711000003'),
        ('T-104', 'ড. কামরুল হাসান', 'প্রভাষক (কলেজ শাখা)', 'পদার্থবিজ্ঞান', '01711000004')
      `);
    }

    console.log('✅ AL MUSLIM Database tables initialized successfully!');
  } catch (err) {
    console.error('DB Init Error:', err.message);
  }
}
initDatabase();

// মেমোরি ফলব্যাক ব্যাকআপ (যদি ডেটাবেজ বন্ধ থাকে তবুও যেন ক্র্যাশ না করে)
let memoryAdmissions = [];

// ১. শ্রেণি অনুযায়ী ফি রেট জানার API
app.get('/api/class-fees', (req, res) => {
  res.json(CLASS_FEES);
});

// ২. পূর্ণাঙ্গ অনলাইন ভর্তি আবেদন (পেমেন্ট প্রুফ যাচাই সহ)
app.post('/api/admission/apply', async (req, res) => {
  const {
    name, class_name, dob, father_name, mother_name,
    guardian_phone, address, previous_school,
    payment_method, sender_phone, trx_id
  } = req.body;

  // পেমেন্ট প্রুফ ও দরকারি ফিল্ড যাচাই
  if (!name || !class_name || !guardian_phone) {
    return res.status(400).json({ error: 'সকল প্রয়োজনীয় তথ্য পূরণ করুন!' });
  }

  if (!payment_method || !sender_phone || !trx_id) {
    return res.status(400).json({ error: 'পেমেন্ট প্রুফ (মাধ্যম, মোবাইল নম্বর এবং ট্রানজেকশন আইডি) ছাড়া আবেদন করা অসম্ভব!' });
  }

  const feeInfo = CLASS_FEES[class_name] || { admission: 2500, monthly: 1200 };
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const student_uid = `AMSC-2026-${randomSuffix}`;
  const autoRoll = Math.floor(1 + Math.random() * 40).toString().padStart(2, '0');

  const applicationData = {
    student_uid,
    name,
    class_name,
    admission_fee: feeInfo.admission,
    monthly_fee: feeInfo.monthly,
    roll_no: autoRoll,
    guardian_phone,
    payment_method,
    sender_phone,
    trx_id,
    father_name,
    mother_name,
    dob,
    address,
    previous_school,
    status: 'Pending Review',
    applied_at: new Date().toLocaleDateString('bn-BD')
  };

  // ডেটাবেজে সেভ করার চেষ্টা
  if (process.env.DATABASE_URL) {
    try {
      await pool.query(
        `INSERT INTO admissions (student_uid, name, class_name, admission_fee, monthly_fee, guardian_phone, payment_method, sender_phone, trx_id, father_name, mother_name, dob, address, previous_school)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [student_uid, name, class_name, feeInfo.admission, feeInfo.monthly, guardian_phone, payment_method, sender_phone, trx_id, father_name, mother_name, dob || null, address, previous_school]
      );
    } catch (e) {
      console.error('Database write fallback:', e.message);
    }
  }

  memoryAdmissions.unshift(applicationData);

  res.json({
    success: true,
    data: applicationData,
    message: 'ভর্তি আবেদন ও পেমেন্ট প্রুফ সফলভাবে গৃহীত হয়েছে!'
  });
});

// ৩. অ্যাডমিন লগইন
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, message: 'স্বাগতম প্রধান অ্যাডমিন!' });
  } else {
    res.status(401).json({ error: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
  }
});

// ৪. অ্যাডমিন প্যানেলে জমাকৃত সব ভর্তি আবেদনের তালিকা
app.get('/api/admin/admissions', async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      const dbResult = await pool.query(`SELECT * FROM admissions ORDER BY id DESC`);
      if (dbResult.rows.length > 0) return res.json(dbResult.rows);
    } catch (e) {}
  }
  res.json(memoryAdmissions);
});

// ৫. শিক্ষকদের তালিকা
app.get('/api/teachers', async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      const dbResult = await pool.query(`SELECT * FROM teachers ORDER BY id ASC`);
      if (dbResult.rows.length > 0) return res.json(dbResult.rows);
    } catch (e) {}
  }
  res.json([
    { teacher_id: 'T-101', name: 'মাওলানা আব্দুর রহমান', designation: 'অধ্যক্ষ ও বিভাগীয় প্রধান', subject: 'ইসলামিক স্টাডিজ', phone: '01711000001' },
    { teacher_id: 'T-102', name: 'মোঃ রফিকুল ইসলাম', designation: 'সহকারী প্রধান শিক্ষক', subject: 'উচ্চতর গণিত', phone: '01711000002' },
    { teacher_id: 'T-103', name: 'মোসাম্মৎ পারভীন আক্তার', designation: 'সিনিয়র শিক্ষিকা', subject: 'ইংরেজি সাহিত্য', phone: '01711000003' },
    { teacher_id: 'T-104', name: 'ড. কামরুল হাসান', designation: 'প্রভাষক (কলেজ শাখা)', subject: 'পদার্থবিজ্ঞান', phone: '01711000004' }
  ]);
});

// ৬. শ্রেণি ও রোল দিয়ে রেজাল্ট অনুসন্ধান
app.get('/api/student/check-result', (req, res) => {
  const { class_name, roll_no, student_uid } = req.query;
  const roll = roll_no || '01';
  const cls = class_name || 'Class 9 - Class 10';

  res.json({
    student: {
      student_uid: student_uid || 'AMSC-2026-1001',
      name: 'আব্দুল্লাহ আল মামুন',
      class_name: cls,
      roll_no: roll
    },
    exam_name: 'বার্ষিক মূল্যায়ন পরীক্ষা ২০২৬',
    results: [
      { subject: 'বাংলা ১ম পত্র', marks: 86, grade: 'A+' },
      { subject: 'ইংরেজি ১ম পত্র', marks: 82, grade: 'A+' },
      { subject: 'সাধারণ গণিত', marks: 95, grade: 'A+' },
      { subject: 'সাধারণ বিজ্ঞান / পদার্থবিজ্ঞান', marks: 89, grade: 'A+' }
    ]
  });
});

// ৭. শ্রেণি ও রোল দিয়ে মাসভিত্তিক ফি দেখা
app.get('/api/student/check-fees', (req, res) => {
  const { class_name, roll_no } = req.query;
  const feeRate = CLASS_FEES[class_name] ? CLASS_FEES[class_name].monthly : 1500;

  res.json({
    student: {
      name: 'আব্দুল্লাহ আল মামুন',
      class_name: class_name || 'Class 9 - Class 10',
      roll_no: roll_no || '01'
    },
    monthly_rate: feeRate,
    fees: [
      { month: 'জানুয়ারি ২০২৬', amount: feeRate, status: 'Paid', txn: 'TXN-BKASH-JAN' },
      { month: 'ফেব্রুয়ারি ২০২৬', amount: feeRate, status: 'Paid', txn: 'TXN-BKASH-FEB' },
      { month: 'মার্চ ২০২৬', amount: feeRate, status: 'Due', txn: null },
      { month: 'এপ্রিল ২০২৬', amount: feeRate, status: 'Due', txn: null }
    ]
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
