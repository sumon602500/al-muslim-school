const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// প্রাথমিক ডিফল্ট ফি কাঠামো
let CLASS_FEES = {
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

// ডেটাবেজ টেবিল তৈরি ও ইনিশিয়ালাইজেশন
async function initDatabase() {
  if (!process.env.DATABASE_URL) return;
  try {
    // ১. ডায়নামিক ফি টেবিল
    await pool.query(`
      CREATE TABLE IF NOT EXISTS class_fees (
        id SERIAL PRIMARY KEY,
        class_name VARCHAR(100) UNIQUE NOT NULL,
        admission_fee INT NOT NULL,
        monthly_fee INT NOT NULL
      );
    `);

    // প্রাথমিক ফি ডেটাবেজে সিড করা
    for (const [cls, fees] of Object.entries(CLASS_FEES)) {
      await pool.query(`
        INSERT INTO class_fees (class_name, admission_fee, monthly_fee)
        VALUES ($1, $2, $3)
        ON CONFLICT (class_name) DO NOTHING;
      `, [cls, fees.admission, fees.monthly]);
    }

    // ডেটাবেজ থেকে সেভ করা ফি লোড করে মেমোরিতে নেওয়া
    const feeRes = await pool.query(`SELECT * FROM class_fees`);
    feeRes.rows.forEach(r => {
      CLASS_FEES[r.class_name] = { admission: r.admission_fee, monthly: r.monthly_fee };
    });

    // ২. ভর্তি আবেদন টেবিল
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

    // ৩. শিক্ষক টেবিল
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
        ('T-101', 'মাওলানা আব্দুর রহমান', 'অধ্যক্ষ ও বিভাগীয় প্রধান', 'ইসলামিক স্টাডিজ', '01711000001'),
        ('T-102', 'মোঃ রফিকুল ইসলাম', 'সহকারী প্রধান শিক্ষক', 'উচ্চতর গণিত', '01711000002'),
        ('T-103', 'মোসাম্মৎ পারভীন আক্তার', 'সিনিয়র শিক্ষিকা', 'ইংরেজি সাহিত্য', '01711000003'),
        ('T-104', 'ড. কামরুল হাসান', 'প্রভাষক (কলেজ শাখা)', 'পদার্থবিজ্ঞান', '01711000004')
      `);
    }

    console.log('✅ AL MUSLIM Database tables initialized with dynamic fees!');
  } catch (err) {
    console.error('DB Init Error:', err.message);
  }
}
initDatabase();

let memoryAdmissions = [];

// ================= এপিআই রাউটসমূহ =================

// ১. ফি কাঠামো পাওয়ার এপিআই (পাবলিক এবং অ্যাডমিন উভয়ের জন্য)
app.get('/api/class-fees', async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      const result = await pool.query(`SELECT * FROM class_fees ORDER BY id ASC`);
      if (result.rows.length > 0) {
        const feesObj = {};
        result.rows.forEach(r => {
          feesObj[r.class_name] = { admission: r.admission_fee, monthly: r.monthly_fee };
        });
        CLASS_FEES = feesObj;
      }
    } catch (e) {}
  }
  res.json(CLASS_FEES);
});

// ২. অ্যাডমিন কর্তৃক ফি পরিবর্তন বা আপডেট করার এপিআই
app.post('/api/admin/update-fee', async (req, res) => {
  const { class_name, admission_fee, monthly_fee } = req.body;

  if (!class_name || admission_fee === undefined || monthly_fee === undefined) {
    return res.status(400).json({ error: 'সকল তথ্য সঠিকভাবে দিন!' });
  }

  const admFee = parseInt(admission_fee);
  const monFee = parseInt(monthly_fee);

  // মেমোরি আপডেট
  CLASS_FEES[class_name] = { admission: admFee, monthly: monFee };

  // ডেটাবেজ আপডেট
  if (process.env.DATABASE_URL) {
    try {
      await pool.query(`
        INSERT INTO class_fees (class_name, admission_fee, monthly_fee)
        VALUES ($1, $2, $3)
        ON CONFLICT (class_name) 
        DO UPDATE SET admission_fee = $2, monthly_fee = $3;
      `, [class_name, admFee, monFee]);
    } catch (e) {
      console.error('DB Fee Update Error:', e.message);
    }
  }

  res.json({
    success: true,
    message: `${class_name}-এর ভর্তি ফি (${admFee}৳) এবং মাসিক বেতন (${monFee}৳) সফলভাবে আপডেট হয়েছে!`,
    currentFees: CLASS_FEES
  });
});

// ৩. ভর্তি আবেদন ও পেমেন্ট প্রুফ সাবমিশন
app.post('/api/admission/apply', async (req, res) => {
  const {
    name, class_name, dob, father_name, mother_name,
    guardian_phone, address, previous_school,
    payment_method, sender_phone, trx_id
  } = req.body;

  if (!name || !class_name || !guardian_phone) {
    return res.status(400).json({ error: 'শিক্ষার্থীর মূল তথ্যগুলো পূরণ করুন!' });
  }

  if (!payment_method || !sender_phone || !trx_id) {
    return res.status(400).json({ error: 'পেমেন্ট প্রুফ (মাধ্যম, মোবাইল নম্বর এবং ট্রানজেকশন আইডি) দেওয়া বাধ্যতামূলক!' });
  }

  // অ্যাডমিন নির্ধারিত বর্তমান ফি ব্যবহার করা
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
    status: 'পেমেন্ট যাচাই পেন্ডিং',
    applied_at: new Date().toLocaleDateString('bn-BD')
  };

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
    message: 'ভর্তি আবেদন সফলভাবে সম্পন্ন হয়েছে!'
  });
});

// ৪. অ্যাডমিন লগইন
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, message: 'স্বাগতম প্রধান অ্যাডমিন!' });
  } else {
    res.status(401).json({ error: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
  }
});

// ৫. অ্যাডমিন ড্যাশবোর্ডে আবেদনের তালিকা
app.get('/api/admin/admissions', async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      const dbResult = await pool.query(`SELECT * FROM admissions ORDER BY id DESC`);
      if (dbResult.rows.length > 0) return res.json(dbResult.rows);
    } catch (e) {}
  }
  res.json(memoryAdmissions);
});

// ৬. শিক্ষক তালিকা
app.get('/api/teachers', async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      const dbResult = await pool.query(`SELECT * FROM teachers ORDER BY id ASC`);
      if (dbResult.rows.length > 0) return res.json(dbResult.rows);
    } catch (e) {}
  }
  res.json([
    { teacher_id: 'T-101', name: 'মাওলানা আব্দুর রহমান', designation: 'অধ্যক্ষ ও বিভাগীয় প্রধান', subject: 'ইসলামিক স্টাডিজ', phone: '01711000001' },
    { teacher_id: 'T-102', name: 'মোঃ রফিকুল ইসলাম', designation: 'সহকারী প্রধান শিক্ষক', subject: 'উচ্চতর গণিত', phone: '01711000002' },
    { teacher_id: 'T-103', name: 'মোসাম্মৎ পারভীন আক্তার', designation: 'সিনিয়র শিক্ষিকা', subject: 'ইংরেজি সাহিত্য', phone: '01711000003' },
    { teacher_id: 'T-104', name: 'ড. কামরুল হাসান', designation: 'প্রভাষক (কলেজ শাখা)', subject: 'পদার্থবিজ্ঞান', phone: '01711000004' }
  ]);
});

// ৭. শ্রেণি ও রোল দিয়ে রেজাল্ট অনুসন্ধান
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

// ৮. মাসভিত্তিক ফি দেখার এপিআই (অ্যাডমিন নির্ধারিত বর্তমান রেট অনুযায়ী দেখাবে)
app.get('/api/student/check-fees', (req, res) => {
  const { class_name, roll_no } = req.query;
  const currentRate = CLASS_FEES[class_name] ? CLASS_FEES[class_name].monthly : 1500;

  res.json({
    student: {
      name: 'আব্দুল্লাহ আল মামুন',
      class_name: class_name || 'Class 9 - Class 10',
      roll_no: roll_no || '01'
    },
    monthly_rate: currentRate,
    fees: [
      { month: 'জানুয়ারি ২০২৬', amount: currentRate, status: 'Paid', txn: 'TXN-BKASH-JAN' },
      { month: 'ফেব্রুয়ারি ২০২৬', amount: currentRate, status: 'Paid', txn: 'TXN-BKASH-FEB' },
      { month: 'মার্চ ২০২৬', amount: currentRate, status: 'Due', txn: null },
      { month: 'এপ্রিল ২০২৬', amount: currentRate, status: 'Due', txn: null }
    ]
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
