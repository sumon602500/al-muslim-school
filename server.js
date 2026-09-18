const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// সাইট সাধারণ সেটিংস
let SITE_SETTINGS = {
  institution_name: 'AL MUSLIM SCHOOL & COLLEGE',
  phone: '+880 1700-000000',
  email: 'info@almuslim.edu.bd',
  marquee_notice: '২০২৬ শিক্ষাবর্ষে ভর্তি চলছে • নাম, শ্রেণি ও রোল দিয়ে শিক্ষার্থী পোর্টালে ১২ মাসের ফির হিসাব দেখুন',
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

// শিক্ষক তালিকা
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

// ১২ মাসের নাম
const ALL_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

// শিক্ষার্থী ডাটাবেজ (অনলাইন এবং সরাসরি অফিসে ভর্তি হওয়া সবাই এখানে থাকবে)
let STUDENTS = [
  {
    id: 1,
    student_uid: 'AMSC-2026-1001',
    name: 'আব্দুল্লাহ আল মামুন',
    class_name: 'Class 9 - Class 10',
    roll_no: '01',
    guardian_phone: '01700000001',
    father_name: 'মোঃ রফিকুল ইসলাম',
    admission_fee: 3500,
    monthly_fee: 1500,
    admission_type: 'অফিস / সরাসরি ভর্তি',
    status: 'Active',
    fees_records: ALL_MONTHS.map((m, idx) => ({
      month: m,
      amount: 1500,
      status: idx < 2 ? 'Paid' : 'Due', // জানুয়ারি ও ফেব্রুয়ারি পেইড, বাকিগুলো বাকি
      paid_at: idx < 2 ? 'অফিস ক্যাশ রসিদ' : null,
      trx_id: idx < 2 ? 'CASH-REC-001' : null
    }))
  }
];

let RESULTS = [];

// ================= API ROUTES =================

// ১. সাইট সেটিংস ও ফি
app.get('/api/settings', (req, res) => res.json(SITE_SETTINGS));
app.post('/api/admin/settings', (req, res) => {
  SITE_SETTINGS = { ...SITE_SETTINGS, ...req.body };
  res.json({ success: true, message: 'সাইট তথ্য ও পেমেন্ট নম্বর সংরক্ষিত হয়েছে!', settings: SITE_SETTINGS });
});

app.get('/api/class-fees', (req, res) => res.json(CLASS_FEES));
app.post('/api/admin/update-fee', (req, res) => {
  const { class_name, admission_fee, monthly_fee } = req.body;
  CLASS_FEES[class_name] = { admission: parseInt(admission_fee), monthly: parseInt(monthly_fee) };
  res.json({ success: true, message: `${class_name}-এর ফি সফলভাবে আপডেট হয়েছে!`, currentFees: CLASS_FEES });
});

// ২. শিক্ষার্থী পোর্টাল লগইন (নাম, শ্রেণি ও রোল নম্বর দিয়ে)
app.post('/api/student/login', (req, res) => {
  const { name, class_name, roll_no } = req.body;
  if (!name || !class_name || !roll_no) {
    return res.status(400).json({ error: 'নাম, শ্রেণি এবং রোল নম্বর সঠিকভাবে দিন!' });
  }

  const cleanName = name.trim().toLowerCase();
  const cleanRoll = roll_no.trim();

  // নাম মিলানোর ক্ষেত্রে আংশিক বা পূর্ণ মিল যাচাই
  const student = STUDENTS.find(s => 
    s.class_name === class_name &&
    s.roll_no === cleanRoll &&
    (s.name.toLowerCase().includes(cleanName) || cleanName.includes(s.name.toLowerCase()))
  );

  if (student) {
    res.json({ success: true, student });
  } else {
    res.status(404).json({ error: 'প্রদত্ত নাম, শ্রেণি ও রোলের কোনো শিক্ষার্থী পাওয়া যায়নি! বানান ও রোল নম্বর যাচাই করুন।' });
  }
});

// ৩. শিক্ষার্থী কর্তৃক নির্দিষ্ট মাসের ফি পরিশোধ করা (bKash/Nagad TrxID সহ)
app.post('/api/student/pay-fee', (req, res) => {
  const { student_id, month, method, sender_phone, trx_id } = req.body;
  const student = STUDENTS.find(s => s.id == student_id);
  if (!student) return res.status(404).json({ error: 'শিক্ষার্থী পাওয়া যায়নি!' });

  const record = student.fees_records.find(f => f.month === month);
  if (record) {
    record.status = 'Paid';
    record.paid_at = `${method} (${new Date().toLocaleDateString('bn-BD')})`;
    record.trx_id = `${trx_id} (নম্বর: ${sender_phone})`;
    res.json({ success: true, message: `${month} মাসের ফি সফলভাবে পরিশোধিত হয়েছে!` });
  } else {
    res.status(400).json({ error: 'মাসের তথ্য সঠিক নয়!' });
  }
});

// ৪. অ্যাডমিন কর্তৃক ম্যানুয়ালি সরাসরি শিক্ষার্থী ভর্তি (অফলাইন স্টুডেন্ট)
app.post('/api/admin/add-manual-student', (req, res) => {
  const { name, class_name, roll_no, guardian_phone, father_name, admission_fee, monthly_fee, initial_paid_months } = req.body;

  if (!name || !class_name || !roll_no || !guardian_phone) {
    return res.status(400).json({ error: 'শিক্ষার্থীর নাম, শ্রেণি, রোল ও মোবাইল নম্বর আবশ্যক!' });
  }

  // একই শ্রেণি ও রোলে ডুপ্লিকেট রোধ
  const exists = STUDENTS.find(s => s.class_name === class_name && s.roll_no === roll_no.trim());
  if (exists) {
    return res.status(400).json({ error: `এই শ্রেণির ${roll_no} রোলে ইতোমধ্যে "${exists.name}" ভর্তি রয়েছে!` });
  }

  const feeRate = parseInt(monthly_fee) || (CLASS_FEES[class_name] ? CLASS_FEES[class_name].monthly : 1200);
  const admFee = parseInt(admission_fee) || (CLASS_FEES[class_name] ? CLASS_FEES[class_name].admission : 2500);
  const paidMonthsList = Array.isArray(initial_paid_months) ? initial_paid_months : [];

  const newStudent = {
    id: Date.now(),
    student_uid: `AMSC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    name: name.trim(),
    class_name,
    roll_no: roll_no.trim(),
    guardian_phone: guardian_phone.trim(),
    father_name: father_name ? father_name.trim() : '',
    admission_fee: admFee,
    monthly_fee: feeRate,
    admission_type: 'অফিস / সরাসরি ভর্তি',
    status: 'Active',
    fees_records: ALL_MONTHS.map(m => ({
      month: m,
      amount: feeRate,
      status: paidMonthsList.includes(m) ? 'Paid' : 'Due',
      paid_at: paidMonthsList.includes(m) ? 'অফিস ক্যাশ গ্রহণ' : null,
      trx_id: paidMonthsList.includes(m) ? 'OFFICE-CASH' : null
    }))
  };

  STUDENTS.unshift(newStudent);
  res.json({ success: true, message: `শিক্ষার্থী "${name}" সফলভাবে ডেটাবেজে নিবন্ধিত হয়েছে!`, student: newStudent });
});

// ৫. অ্যাডমিন কর্তৃক শিক্ষার্থীর ফি স্ট্যাটাস পরিবর্তন (Paid / Due টগল)
app.post('/api/admin/toggle-student-fee', (req, res) => {
  const { student_id, month, new_status } = req.body;
  const student = STUDENTS.find(s => s.id == student_id);
  if (!student) return res.status(404).json({ error: 'শিক্ষার্থী পাওয়া যায়নি!' });

  const record = student.fees_records.find(f => f.month === month);
  if (record) {
    record.status = new_status;
    record.paid_at = new_status === 'Paid' ? 'অফিস ক্যাশ জমা' : null;
    record.trx_id = new_status === 'Paid' ? 'OFFICE-CASH' : null;
    res.json({ success: true, message: `${student.name}-এর ${month} মাসের ফি "${new_status === 'Paid' ? 'পরিশোধিত' : 'বকেয়া'}" করা হয়েছে!` });
  } else {
    res.status(400).json({ error: 'মাসের তথ্য পাওয়া যায়নি!' });
  }
});

// ৬. অনলাইন ওয়েবসাইট থেকে আসা ভর্তি আবেদন
app.post('/api/admission/apply', (req, res) => {
  const { name, class_name, guardian_phone, payment_method, sender_phone, trx_id, father_name } = req.body;
  if (!name || !class_name || !guardian_phone || !payment_method || !sender_phone || !trx_id) {
    return res.status(400).json({ error: 'সকল তথ্য ও ভর্তি ফির পেমেন্ট প্রুফ দেওয়া আবশ্যক!' });
  }

  const feeInfo = CLASS_FEES[class_name] || { admission: 2500, monthly: 1200 };
  const autoRoll = Math.floor(1 + Math.random() * 45).toString().padStart(2, '0');
  const uid = `AMSC-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const studentObj = {
    id: Date.now(),
    student_uid: uid,
    name: name.trim(),
    class_name,
    roll_no: autoRoll,
    guardian_phone: guardian_phone.trim(),
    father_name: father_name || '',
    admission_fee: feeInfo.admission,
    monthly_fee: feeInfo.monthly,
    admission_type: 'অনলাইন আবেদন',
    payment_method,
    sender_phone,
    trx_id,
    status: 'অনুমোদন পেন্ডিং',
    applied_at: new Date().toLocaleDateString('bn-BD'),
    fees_records: ALL_MONTHS.map(m => ({
      month: m,
      amount: feeInfo.monthly,
      status: 'Due',
      paid_at: null,
      trx_id: null
    }))
  };

  STUDENTS.unshift(studentObj);
  res.json({ success: true, data: studentObj, message: 'ভর্তি আবেদন ও ফি সফলভাবে জমা হয়েছে!' });
});

// ৭. অ্যাডমিনের জন্য সকল শিক্ষার্থীর তালিকা
app.get('/api/admin/all-students', (req, res) => {
  res.json(STUDENTS);
});

// ৮. শিক্ষক সংক্রান্ত
app.get('/api/teachers', (req, res) => res.json(TEACHERS));
app.post('/api/admin/add-teacher', (req, res) => {
  const { name, designation, subject, phone, photo_data } = req.body;
  const newT = {
    id: Date.now(),
    teacher_id: 'T-' + Math.floor(100 + Math.random() * 900),
    name, designation, subject, phone,
    photo: photo_data || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'
  };
  TEACHERS.push(newT);
  res.json({ success: true, message: 'শিক্ষক সফলভাবে যুক্ত হয়েছেন!', teachers: TEACHERS });
});

app.post('/api/admin/delete-teacher', (req, res) => {
  const { id } = req.body;
  TEACHERS = TEACHERS.filter(t => t.id != id);
  res.json({ success: true, message: 'শিক্ষক ডিলিট করা হয়েছে!', teachers: TEACHERS });
});

// ৯. প্রতি মাসের ১ তারিখের SMS ইঞ্জিন
app.post('/api/admin/send-monthly-fee-sms', (req, res) => {
  const { current_month, deadline_date } = req.body;
  const m = current_month || 'অক্টোবর ২০২৬';
  const d = deadline_date || '১০ তারিখের মধ্যে';

  const sentList = STUDENTS.map(std => ({
    student_name: std.name,
    roll_no: std.roll_no,
    class_name: std.class_name,
    guardian_phone: std.guardian_phone,
    monthly_fee: std.monthly_fee,
    sms_text: `সম্মানিত অভিভাবক, AL MUSLIM SCHOOL & COLLEGE-এ আপনার সন্তান ${std.name} (শ্রেণি: ${std.class_name}, রোল: ${std.roll_no})-এর ${m} মাসের বেতন ${std.monthly_fee} টাকা আগামী ${d} পরিশোধের অনুরোধ করা হলো। বিকাশ/নগদ: ${SITE_SETTINGS.bkash_number}`
  }));

  res.json({ success: true, total_sent: sentList.length, sent_details: sentList, message: `মোট ${sentList.length} জন অভিভাবকের ফোনে SMS সফলভাবে পাঠানো হয়েছে!` });
});

// ১০. রেজাল্ট এন্ট্রি ও সার্চ
app.post('/api/admin/add-result', (req, res) => {
  const { class_name, roll_no, name, exam_name, marks_list } = req.body;
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
  const gpa = (totalPoints / marks_list.length).toFixed(2);
  const rec = { student_uid: `AMSC-${roll_no}`, name, class_name, roll_no, exam_name, gpa, marks_list };
  const idx = RESULTS.findIndex(r => r.class_name === class_name && r.roll_no === roll_no);
  if (idx !== -1) RESULTS[idx] = rec;
  else RESULTS.unshift(rec);
  res.json({ success: true, message: 'রেজাল্ট সফলভাবে ডেটাবেজে সংরক্ষিত হয়েছে!' });
});

app.get('/api/student/check-result', (req, res) => {
  const { class_name, roll_no } = req.query;
  const match = RESULTS.find(r => r.class_name === class_name && r.roll_no === roll_no);
  if (match) res.json({ student: { name: match.name, class_name: match.class_name, roll_no: match.roll_no }, exam_name: match.exam_name, gpa: match.gpa, results: match.marks_list });
  else res.status(404).json({ error: 'উক্ত শ্রেণি ও রোলে কোনো রেজাল্ট পাওয়া যায়নি!' });
});

// ১১. অ্যাডমিন লগইন
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') res.json({ success: true, message: 'লগইন সফল!' });
  else res.status(401).json({ error: 'ভুল ইউজার আইডি বা পাসওয়ার্ড!' });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
