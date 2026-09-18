const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// সাইটের সাধারণ সেটিংস
let SITE_SETTINGS = {
  institution_name: 'AL MUSLIM SCHOOL & COLLEGE',
  phone: '+880 1700-000000',
  email: 'info@almuslim.edu.bd',
  marquee_notice: '২০২৬ শিক্ষাবর্ষে প্লে থেকে একাদশ শ্রেণিতে ভর্তি কার্যক্রম চলছে • নির্ধারিত ক্লাসের ফি দেখে আবেদন করুন',
  bkash_number: '01700-000000',
  nagad_number: '01800-000000'
};

// শ্রেণিভিত্তিক ফি কাঠামো
let CLASS_FEES = {
  'Play / Nursery': { admission: 1500, monthly: 800 },
  'Class 1 - Class 5': { admission: 2000, monthly: 1000 },
  'Class 6 - Class 8': { admission: 2500, monthly: 1200 },
  'Class 9 - Class 10': { admission: 3500, monthly: 1500 },
  'Class 11 - Class 12 (College)': { admission: 5000, monthly: 2200 }
};

// শিক্ষক তালিকা (ছবি সহ)
let TEACHERS = [
  {
    id: 1,
    teacher_id: 'T-101',
    name: 'মাওলানা আব্দুর রহমান',
    designation: 'অধ্যক্ষ ও বিভাগীয় প্রধান',
    subject: 'ইসলামিক স্টাডিজ',
    phone: '01711000001',
    photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=200&fit=crop&crop=faces'
  },
  {
    id: 2,
    teacher_id: 'T-102',
    name: 'মোঃ রফিকুল ইসলাম',
    designation: 'সহকারী প্রধান শিক্ষক',
    subject: 'উচ্চতর গণিত',
    phone: '01711000002',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces'
  },
  {
    id: 3,
    teacher_id: 'T-103',
    name: 'মোসাম্মৎ পারভীন আক্তার',
    designation: 'সিনিয়র শিক্ষিকা',
    subject: 'ইংরেজি সাহিত্য',
    phone: '01711000003',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces'
  },
  {
    id: 4,
    teacher_id: 'T-104',
    name: 'ড. কামরুল হাসান',
    designation: 'প্রভাষক (কলেজ শাখা)',
    subject: 'পদার্থবিজ্ঞান',
    phone: '01711000004',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces'
  }
];

let ADMISSIONS = [];

// রেজাল্ট ডাটা স্টোর
let RESULTS = [
  {
    student_uid: 'AMSC-2026-1001',
    class_name: 'Class 9 - Class 10',
    roll_no: '01',
    name: 'আব্দুল্লাহ আল মামুন',
    exam_name: 'বার্ষিক মূল্যায়ন পরীক্ষা ২০২৬',
    gpa: '5.00',
    marks_list: [
      { subject: 'বাংলা ১ম পত্র', marks: 86, grade: 'A+' },
      { subject: 'বাংলা ২য় পত্র', marks: 80, grade: 'A+' },
      { subject: 'ইংরেজি ১ম পত্র', marks: 82, grade: 'A+' },
      { subject: 'ইংরেজি ২য় পত্র', marks: 85, grade: 'A+' },
      { subject: 'গণিত', marks: 95, grade: 'A+' },
      { subject: 'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)', marks: 48, grade: 'A+' },
      { subject: 'পদার্থবিজ্ঞান', marks: 88, grade: 'A+' },
      { subject: 'রসায়ন', marks: 84, grade: 'A+' },
      { subject: 'জীববিজ্ঞান', marks: 89, grade: 'A+' }
    ]
  }
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ================= এপিআইসমূহ =================

// সাইট সেটিংস
app.get('/api/settings', (req, res) => res.json(SITE_SETTINGS));
app.post('/api/admin/settings', (req, res) => {
  SITE_SETTINGS = { ...SITE_SETTINGS, ...req.body };
  res.json({ success: true, message: 'সাইট সেটিংস সফলভাবে আপডেট হয়েছে!', settings: SITE_SETTINGS });
});

// ফি সংক্রান্ত
app.get('/api/class-fees', (req, res) => res.json(CLASS_FEES));
app.post('/api/admin/update-fee', (req, res) => {
  const { class_name, admission_fee, monthly_fee } = req.body;
  CLASS_FEES[class_name] = { admission: parseInt(admission_fee), monthly: parseInt(monthly_fee) };
  res.json({ success: true, message: `${class_name}-এর ফি আপডেট হয়েছে!`, currentFees: CLASS_FEES });
});

// শিক্ষক তালিকা
app.get('/api/teachers', (req, res) => res.json(TEACHERS));

// নতুন শিক্ষক যোগ (ছবি সহ)
app.post('/api/admin/add-teacher', (req, res) => {
  const { name, designation, subject, phone, photo } = req.body;
  const newT = {
    id: Date.now(),
    teacher_id: 'T-' + Math.floor(100 + Math.random() * 900),
    name,
    designation,
    subject,
    phone,
    photo: photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces'
  };
  TEACHERS.push(newT);
  res.json({ success: true, message: 'নতুন শিক্ষক যুক্ত হয়েছেন!', teachers: TEACHERS });
});

// শিক্ষক ডিলিট / রিমুভ করার API
app.post('/api/admin/delete-teacher', (req, res) => {
  const { id } = req.body;
  TEACHERS = TEACHERS.filter(t => t.id != id);
  res.json({ success: true, message: 'শিক্ষক সফলভাবে তালিকা থেকে মুছে ফেলা হয়েছে!', teachers: TEACHERS });
});

// রেজাল্ট এন্ট্রি করা (সকল সরকারি বিষয় সহ)
app.post('/api/admin/add-result', (req, res) => {
  const { class_name, roll_no, name, exam_name, marks_list } = req.body;
  if (!name || !class_name || !roll_no || !marks_list || marks_list.length === 0) {
    return res.status(400).json({ error: 'শিক্ষার্থীর তথ্য ও বিষয়ের নম্বরসমূহ সঠিকভাবে দিন!' });
  }

  // স্বয়ংক্রিয় জিপিএ হিসাব
  let totalGradePoint = 0;
  let hasFailed = false;
  marks_list.forEach(m => {
    let point = 0;
    const mark = parseInt(m.marks) || 0;
    if (mark >= 80) point = 5.0;
    else if (mark >= 70) point = 4.0;
    else if (mark >= 60) point = 3.5;
    else if (mark >= 50) point = 3.0;
    else if (mark >= 40) point = 2.0;
    else if (mark >= 33) point = 1.0;
    else { point = 0.0; hasFailed = true; }
    totalGradePoint += point;
  });

  const calculatedGPA = hasFailed ? '0.00 (F)' : (totalGradePoint / marks_list.length).toFixed(2);

  const existingIdx = RESULTS.findIndex(r => r.class_name === class_name && r.roll_no === roll_no);
  const resultRecord = {
    student_uid: `AMSC-${roll_no}`,
    name,
    class_name,
    roll_no,
    exam_name: exam_name || 'বার্ষিক পরীক্ষা ২০২৬',
    gpa: calculatedGPA,
    marks_list
  };

  if (existingIdx !== -1) {
    RESULTS[existingIdx] = resultRecord;
  } else {
    RESULTS.unshift(resultRecord);
  }

  res.json({ success: true, message: `${class_name}, রোল ${roll_no} এর রেজাল্ট সফলভাবে সংরক্ষিত হয়েছে! মোট জিপিএ: ${calculatedGPA}` });
});

// রেজাল্ট খোঁজা
app.get('/api/student/check-result', (req, res) => {
  const { class_name, roll_no } = req.query;
  const match = RESULTS.find(r => r.class_name === class_name && r.roll_no === roll_no);
  if (match) {
    res.json({
      student: { name: match.name, class_name: match.class_name, roll_no: match.roll_no, student_uid: match.student_uid },
      exam_name: match.exam_name,
      gpa: match.gpa,
      results: match.marks_list
    });
  } else {
    res.status(404).json({ error: 'উক্ত শ্রেণি ও রোলে কোনো রেজাল্ট ডেটাবেজে পাওয়া যায়নি!' });
  }
});

// ভর্তি আবেদন ও পেমেন্ট
app.post('/api/admission/apply', (req, res) => {
  const { name, class_name, guardian_phone, payment_method, sender_phone, trx_id } = req.body;
  if (!name || !class_name || !guardian_phone || !payment_method || !sender_phone || !trx_id) {
    return res.status(400).json({ error: 'সকল প্রয়োজনীয় তথ্য ও পেমেন্ট প্রুফ দেওয়া আবশ্যক!' });
  }
  const feeInfo = CLASS_FEES[class_name] || { admission: 2500, monthly: 1200 };
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const student_uid = `AMSC-2026-${randomSuffix}`;
  const autoRoll = Math.floor(1 + Math.random() * 40).toString().padStart(2, '0');

  const application = {
    id: Date.now(),
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
    father_name: req.body.father_name || '',
    status: 'Pending (পেমেন্ট যাচাই বাকি)',
    applied_at: new Date().toLocaleDateString('bn-BD')
  };

  ADMISSIONS.unshift(application);
  res.json({ success: true, data: application, message: 'ভর্তি আবেদন সফলভাবে সম্পন্ন হয়েছে!' });
});

app.get('/api/admin/admissions', (req, res) => res.json(ADMISSIONS));
app.post('/api/admin/admission-status', (req, res) => {
  const { id, status } = req.body;
  const item = ADMISSIONS.find(a => a.id == id);
  if (item) {
    item.status = status;
    res.json({ success: true, message: `আবেদন স্ট্যাটাস '${status}' করা হয়েছে!` });
  } else {
    res.status(404).json({ error: 'আবেদন পাওয়া যায়নি!' });
  }
});

// ফি চেক
app.get('/api/student/check-fees', (req, res) => {
  const { class_name, roll_no } = req.query;
  const currentRate = CLASS_FEES[class_name] ? CLASS_FEES[class_name].monthly : 1500;
  res.json({
    student: { name: 'আব্দুল্লাহ আল মামুন', class_name: class_name || 'Class 9 - Class 10', roll_no: roll_no || '01' },
    monthly_rate: currentRate,
    fees: [
      { month: 'জানুয়ারি ২০২৬', amount: currentRate, status: 'Paid', txn: 'TXN-BKASH-JAN' },
      { month: 'ফেব্রুয়ারি ২০২৬', amount: currentRate, status: 'Paid', txn: 'TXN-BKASH-FEB' },
      { month: 'মার্চ ২০২৬', amount: currentRate, status: 'Due', txn: null },
      { month: 'এপ্রিল ২০২৬', amount: currentRate, status: 'Due', txn: null }
    ]
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, message: 'স্বাগতম প্রধান অ্যাডমিন!' });
  } else {
    res.status(401).json({ error: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`AL MUSLIM Super Server running on ${PORT}`));
