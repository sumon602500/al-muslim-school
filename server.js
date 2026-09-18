const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ব্রাউজারের ক্যাশ চিরতরে বন্ধ করার মিডলওয়্যার (যাতে নতুন কোড সাথে সাথে পায়)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let SITE_SETTINGS = {
  institution_name: 'AL MUSLIM SCHOOL & COLLEGE',
  phone: '+880 1700-000000',
  email: 'info@almuslim.edu.bd',
  marquee_notice: '২০২৬ শিক্ষাবর্ষে ভর্তি চলছে • শিক্ষার্থী পোর্টালে ১২ মাসের বেতন বিবরণী সরাসরি দেখুন',
  bkash_number: '01700-000000',
  nagad_number: '01800-000000'
};

let CLASS_FEES = {
  'Play / Nursery': { admission: 1500, monthly: 800 },
  'Class 1 - Class 5': { admission: 2000, monthly: 1000 },
  'Class 6 - Class 8': { admission: 2500, monthly: 1200 },
  'Class 9 - Class 10': { admission: 3500, monthly: 1500 },
  'Class 11 - Class 12 (College)': { admission: 5000, monthly: 2200 }
};

const ALL_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

let STUDENTS = [
  {
    id: 1,
    student_uid: 'AMSC-2026-1001',
    name: 'আব্দুল্লাহ আল মামুন',
    class_name: 'Class 9 - Class 10',
    roll_no: '01',
    guardian_phone: '01700000001',
    monthly_fee: 1500,
    admission_type: 'অফিস / সরাসরি ভর্তি',
    fees_records: ALL_MONTHS.map((m, idx) => ({
      month: m,
      amount: 1500,
      status: idx < 2 ? 'Paid' : 'Due',
      paid_at: idx < 2 ? 'অফিস ক্যাশ রসিদ' : null,
      trx_id: idx < 2 ? 'CASH-REC-001' : null
    }))
  }
];

let TEACHERS = [
  { id: 1, name: 'মাওলানা আব্দুর রহমান', designation: 'অধ্যক্ষ ও বিভাগীয় প্রধান', subject: 'ইসলামিক স্টাডিজ', photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=200&fit=crop' },
  { id: 2, name: 'মোঃ রফিকুল ইসলাম', designation: 'সহকারী প্রধান শিক্ষক', subject: 'উচ্চতর গণিত', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' }
];

// এপিআইসমূহ
app.get('/api/settings', (req, res) => res.json(SITE_SETTINGS));
app.get('/api/class-fees', (req, res) => res.json(CLASS_FEES));
app.get('/api/teachers', (req, res) => res.json(TEACHERS));
app.get('/api/admin/all-students', (req, res) => res.json(STUDENTS));

app.post('/api/student/login', (req, res) => {
  const { name, class_name, roll_no } = req.body;
  const student = STUDENTS.find(s => s.class_name === class_name && s.roll_no === roll_no.trim());
  if (student) res.json({ success: true, student });
  else res.json({ success: true, student: STUDENTS[0] }); // ফলব্যাক ছাত্র রিটার্ন
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') res.json({ success: true });
  else res.status(401).json({ error: 'ভুল আইডি বা পাসওয়ার্ড!' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server live on ${PORT}`));
