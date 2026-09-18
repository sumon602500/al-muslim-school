const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/result', async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) {
    return res.status(400).json({ error: 'স্টুডেন্ট আইডি দিন!' });
  }

  res.json({
    institution: "AL MUSLIM SCHOOL & COLLEGE",
    studentId: studentId,
    studentName: "আব্দুল্লাহ আল মামুন",
    className: "১০ম শ্রেণি",
    exam: "বার্ষিক মূল্যায়ন ২০২৬",
    gpa: "5.00",
    results: [
      { subject: "বাংলা", marks: 85, grade: "A+" },
      { subject: "ইংরেজি", marks: 80, grade: "A+" },
      { subject: "গণিত", marks: 92, grade: "A+" },
      { subject: "বিজ্ঞান", marks: 88, grade: "A+" }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
