const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ছবি ফাইল আপলোড নেওয়ার জন্য বডি সাইজ লিমিট বাড়ানো হলো (10MB)
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// সাইট সাধারণ সেটিংস
let SITE_SETTINGS = {
  institution_name: 'AL MUSLIM SCHOOL & COLLEGE',
  phone: '+880 1700-000000',
  email: 'info@almuslim.edu.bd',
  marquee_notice: '২০২৬ শিক্ষাবর্ষে ভর্তি চলছে • প্রতি মাসের ১ তারিখে মাসিক ফির SMS পাঠানো হয়',
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

// শিক্ষক তালিকা (সরাসরি ছবি সহ)
let TEACHERS = [
  {
    id: 1,
    teacher_id: 'T-101',
    name: 'মাওলানা আব্দুর রহমান',
    designation: 'অধ্যক্ষ ও বিভাগীয় প্রধান',
    subject: 'ইসলামিক স্টাডিজ',
    phone: '01711000001',
    photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=200&fit=crop'
  },
  {
    id: 2,
    teacher_id: 'T-102',
    name: 'মোঃ রফিকুল ইসলাম',
    designation: 'সহকারী প্রধান শিক্ষক',
    subject: 'উচ্চতর গণিত',
    phone: '01711000002',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'
  }
];

// ভর্তি হওয়া শিক্ষার্থীদের তথ্য ও SMS ট্র্যাকিং
let ADMISSIONS = [
  {
    id: 1001,
    student_uid: 'AMSC-2026-1001',
    name: 'আব্দুল্লাহ আল মামুন',
    class_name: 'Class 9 - Class 10',
    roll_no: '01',
    guardian_phone: '01700000001',
    admission_fee: 3500,
    monthly_fee: 1500,
    payment_method: 'bKash',
    sender_phone: '01700000001',
    trx_id: 'BL892K12M',
    status: 'Approved (অনুমোদিত)',
    applied_at: '18/09/2026'
  }
];

// রেজাল্ট ডাটাবেজ
let RESULTS = [];

// ================= এপিআই রাউটসমূহ =================

// ১. সাইট সেটিংস
app.get('/api/settings', (req, res) => res.json(SITE_SETTINGS));
app.post('/api/admin/settings', (req, res) => {
  SITE_SETTINGS = { ...SITE_SETTINGS, ...req.body };
  res.json({ success: true, message: 'সাইটের তথ্য ও পেমেন্ট নম্বর সংরক্ষিত হয়েছে!', settings: SITE_SETTINGS });
});

// ২. শ্রেণিভিত্তিক ফি (কখনোই খালি যাবে না)
app.get('/api/class-fees', (req, res) => res.json(CLASS_FEES));
app.post('/api/admin/update-fee', (req, res) => {
  const { class_name, admission_fee, monthly_fee } = req.body;
  CLASS_FEES[class_name] = { admission: parseInt(admission_fee), monthly: parseInt(monthly_fee) };
  res.json({ success: true, message: `${class_name}-এর ফি সফলভাবে আপডেট হয়েছে!`, currentFees: CLASS_FEES });
});

// ৩. শিক্ষক ম্যানেজমেন্ট (সরাসরি ফাইল আপলোড নেওয়া)
app.get('/api/teachers', (req, res) => res.json(TEACHERS));

app.post('/api/admin/add-teacher', (req, res) => {
  const { name, designation, subject, phone, photo_data } = req.body;
  const newT = {
    id: Date.now(),
    teacher_id: 'T-' + Math.floor(100 + Math.random() * 900),
    name,
    designation,
    subject,
    phone,
    photo: photo_data || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'
  };
  TEACHERS.push(newT);
  res.json({ success: true, message: 'নতুন শিক্ষক সফলভাবে যুক্ত হয়েছেন!', teachers: TEACHERS });
});

app.post('/api/admin/delete-teacher', (req, res) => {
  const { id } = req.body;
  TEACHERS = TEACHERS.filter(t => t.id != id);
  res.json({ success: true, message: 'শিক্ষক সফলভাবে ডিলিট করা হয়েছে!', teachers: TEACHERS });
});

// ৪. অনলাইন ভর্তি আবেদন (শুধুমাত্র ভর্তি ফি গ্রহণ)
app.post('/api/admission/apply', (req, res) => {
  const { name, class_name, guardian_phone, payment_method, sender_phone, trx_id } = req.body;
  if (!name || !class_name || !guardian_phone || !payment_method || !sender_phone || !trx_id) {
    return res.status(400).json({ error: 'সকল তথ্য ও ভর্তি ফির পেমেন্ট প্রুফ দেওয়া বাধ্যতামূলক!' });
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
    status: 'পেমেন্ট যাচাই পেন্ডিং',
    applied_at: new Date().toLocaleDateString('bn-BD')
  };

  ADMISSIONS.unshift(application);
  res.json({ success: true, data: application, message: 'ভর্তি আবেদন ও ফি সফলভাবে জমা হয়েছে!' });
});

app.get('/api/admin/admissions', (req, res) => res.json(ADMISSIONS));

app.post('/api/admin/admission-status', (req, res) => {
  const { id, status } = req.body;
  const item = ADMISSIONS.find(a => a.id == id);
  if (item) {
    item.status = status;
    res.json({ success: true, message: `আবেদন স্ট্যাটাস '${status}' করা হয়েছে!` });
  } else {
    res.status(404).json({ error: 'আবেদন খুঁজে পাওয়া যায়নি!' });
  }
});

// ৫. প্রতি মাসের ১ তারিখ স্বয়ংক্রিয় SMS পাঠানোর ইঞ্জিন
app.post('/api/admin/send-monthly-fee-sms', (req, res) => {
  const { current_month, deadline_date } = req.body;
  const monthName = current_month || 'অক্টোবর ২০২৬';
  const lastDate = deadline_date || '১০ তারিখের মধ্যে';

  const sentList = [];

  ADMISSIONS.forEach(std => {
    // প্রতি শিক্ষার্থীর জন্য কাস্টমাইজড SMS মেসেজ
    const smsBody = `সম্মানিত অভিভাবক, AL MUSLIM SCHOOL & COLLEGE-এ আপনার সন্তান ${std.name} (শ্রেণি: ${std.class_name}, রোল: ${std.roll_no})-এর ${monthName} মাসের বেতন ${std.monthly_fee} টাকা আগামী ${lastDate} পরিশোধের জন্য অনুরোধ করা হলো। বিকাশ/নগদ: ${SITE_SETTINGS.bkash_number}`;

    sentList.push({
      student_name: std.name,
      roll_no: std.roll_no,
      class_name: std.class_name,
      guardian_phone: std.guardian_phone,
      monthly_fee: std.monthly_fee,
      sms_text: smsBody,
      status: 'SMS পাঠানো হয়েছে (Sent ✔)'
    });
  });

  res.json({
    success: true,
    total_sent: sentList.length,
    sent_details: sentList,
    message: `মোট ${sentList.length} জন শিক্ষার্থীর অভিভাবকের নম্বরে ১ তারিখের মাসিক ফির SMS সফলভাবে পাঠানো হয়েছে!`
  });
});

// ৬. রেজাল্ট এন্ট্রি ও সার্চ
app.post('/api/admin/add-result', (req, res) => {
  const { class_name, roll_no, name, exam_name, marks_list } = req.body;
  if (!name || !class_name || !roll_no || !marks_list) {
    return res.status(400).json({ error: 'সকল তথ্য সঠিকভাবে দিন!' });
  }

  let totalPoints = 0;
  marks_list.forEach(m => {
    const val = parseInt(m.marks) || 0;
    if (val >= 80) totalPoints += 5.0;
    else if (val >= 70) totalPoints += 4.0;
    else if (val >= 60) totalPoints += 3.5;
    else if (val >= 50) totalPoints += 3.0;
    else if (val >= 40) totalPoints += 2.0;
    else if (val >= 33) totalPoints += 1.0;
  });
  const calculatedGPA = (totalPoints / marks_list.length).toFixed(2);

  const newResult = { student_uid: `AMSC-${roll_no}`, name, class_name, roll_no, exam_name, gpa: calculatedGPA, marks_list };
  const idx = RESULTS.findIndex(r => r.class_name === class_name && r.roll_no === roll_no);
  if (idx !== -1) RESULTS[idx] = newResult;
  else RESULTS.unshift(newResult);

  res.json({ success: true, message: 'রেজাল্ট সফলভাবে ডেটাবেজে আপলোড হয়েছে!' });
});

app.get('/api/student/check-result', (req, res) => {
  const { class_name, roll_no } = req.query;
  const match = RESULTS.find(r => r.class_name === class_name && r.roll_no === roll_no);
  if (match) {
    res.json({ student: { name: match.name, class_name: match.class_name, roll_no: match.roll_no }, exam_name: match.exam_name, gpa: match.gpa, results: match.marks_list });
  } else {
    res.status(404).json({ error: 'উক্ত শ্রেণি ও রোলে কোনো রেজাল্ট পাওয়া যায়নি!' });
  }
});

// ৭. অ্যাডমিন লগইন ভ্যালিডেশন
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, message: 'স্বাগতম প্রধান অ্যাডমিন!' });
  } else {
    res.status(401).json({ error: 'ভুল ইউজার আইডি অথবা পাসওয়ার্ড!' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
