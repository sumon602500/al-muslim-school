const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Atlas Connection URI
const MONGO_URI = 'mongodb+srv://almusimschoolandcollege2006_db_user:almusim2006@cluster0.sdlfu7w.mongodb.net/almuslim_school_db?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Atlas Connected Successfully!'))
  .catch(err => console.log('MongoDB Connection Error: ', err));

// Mongoose Student Schema & Model
const studentSchema = new mongoose.Schema({
  id: Number,
  student_uid: String,
  name: String,
  class_name: String,
  roll_no: String,
  guardian_phone: String,
  monthly_fee: Number,
  admission_type: String,
  fees_records: Array,
  photo: String,
  father_name: String,
  mother_name: String,
  address: String
}, { timestamps: true });

const Student = mongoose.model('Student', studentSchema);

// ব্রাউজারের ক্যাশ চিরতরে বন্ধ করার মিডলওয়্যার
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
  phone: '+880 1726-567936',
  email: 'almusimschoolandcollege2006@gmail.com',
  marquee_notice: '২০২৬ শিক্ষাবর্ষে ভর্তি চলছে • শিক্ষার্থী পোর্টালে ১২ মাসের বেতন বিবরণী সরাসরি দেখুন',
  bkash_number: '01726-567936',
  nagad_number: '01722-397607'
};

let CLASS_FEES = {
  'Play': { admission: 1500, monthly: 800 },
  'Nursery': { admission: 1500, monthly: 800 },
  'KG': { admission: 1600, monthly: 850 },
  'Class 1': { admission: 1800, monthly: 900 },
  'Class 2': { admission: 1900, monthly: 950 },
  'Class 3': { admission: 2000, monthly: 1000 },
  'Class 4': { admission: 2100, monthly: 1050 },
  'Class 5': { admission: 2200, monthly: 1100 },
  'Class 6': { admission: 2500, monthly: 1200 },
  'Class 7': { admission: 2600, monthly: 1250 },
  'Class 8': { admission: 2700, monthly: 1300 },
  'Class 9': { admission: 3200, monthly: 1450 },
  'Class 10': { admission: 3500, monthly: 1500 },
  'Class 11': { admission: 5000, monthly: 2200 },
  'Class 12': { admission: 5200, monthly: 2300 }
};

let TEACHERS = [
  { id: 1, name: 'মাওলানা আব্দুর রহমান', designation: 'অধ্যক্ষ ও বিভাগীয় প্রধান', subject: 'ইসলামিক স্টাডিজ', phone: '০১৭১১০০০০০১', photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&fit=crop' },
  { id: 2, name: 'মোঃ রফিকুল ইসলাম', designation: 'সহকারী প্রধান শিক্ষক', subject: 'উচ্চতর গণিত', phone: '০১৭১১০০০০০২', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&fit=crop' }
];

// API Endpoints
app.get('/api/settings', (req, res) => res.json(SITE_SETTINGS));
app.get('/api/class-fees', (req, res) => res.json(CLASS_FEES));
app.get('/api/teachers', (req, res) => res.json(TEACHERS));

// Get all students from MongoDB
app.get('/api/admin/all-students', async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or Update student in MongoDB
app.post('/api/students', async (req, res) => {
  try {
    const data = req.body;
    let student = await Student.findOne({ student_uid: data.student_uid });
    if (student) {
      Object.assign(student, data);
      await student.save();
    } else {
      student = new Student(data);
      await student.save();
    }
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete student from MongoDB
app.delete('/api/students/:id', async (req, res) => {
  try {
    let id = req.params.id;
    await Student.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    try {
      await Student.findOneAndDelete({ id: req.params.id });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Student login verification from MongoDB
app.post('/api/student/login', async (req, res) => {
  const { name, class_name, roll_no } = req.body;
  try {
    const student = await Student.findOne({ class_name: class_name, roll_no: roll_no.trim() });
    if (student) {
      res.json({ success: true, student });
    } else {
      res.json({ success: false, error: 'Student not found in database' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') res.json({ success: true });
  else res.status(401).json({ error: 'ভুল আইডি বা পাসওয়ার্ড!' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
