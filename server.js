require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// FIXED: This wrapper allows 'require' to work with the new 'open' package version
const open = (...args) => import('open').then(({default: open}) => open(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'space-commander-secret-99';

// --- BROADCAST STORAGE ---
let globalAlert = "Welcome to Cholo Space! All systems nominal.";

// 1. HIDDEN KEYS
const NASA_API_KEY = 'DEMO_KEY'; 

// 2. ENSURE UPLOADS FOLDER EXISTS
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// UPDATED LINE: Using process.env to hide your password
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🚀 Secure DB Connected'))
  .catch(err => console.log('❌ DB Error:', err));

// --- SCHEMA DEFINITIONS ---
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, required: false }, // UPDATED: Added email field
  password: { type: String, required: true },
  avatar: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/1047/1047711.png' },
  role: { type: String, default: 'pilot' } 
}));

const Log = mongoose.model('Log', new mongoose.Schema({
  username: String,
  message: String,
  isPublic: { type: Boolean, default: false },
  date: { type: Date, default: Date.now }
}));

// MIDDLEWARE
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- BROADCAST ROUTES ---
app.post('/admin/broadcast', (req, res) => {
    const { username, message } = req.body;
    if (username === 'JunaidRafi') {
        globalAlert = message;
        console.log(`📢 Broadcast Updated by Admin: ${message}`);
        res.json({ success: true });
    } else {
        res.status(403).send("Unauthorized Access");
    }
});

app.get('/api/alert', (req, res) => {
    res.json({ message: globalAlert });
});

// --- NEW: GOOD VIEW (MASTER FEED) ---
app.get('/admin/master-feed', async (req, res) => {
    try {
        const allLogs = await Log.find().sort({ date: -1 });
        const allUsers = await User.find().select('-password'); 
        res.json({ logs: allLogs, users: allUsers });
    } catch (e) {
        res.status(500).send("Error fetching mission data");
    }
});

// NASA PROXY
app.get('/api/nasa-discovery', async (req, res) => {
  try {
    const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Satellite link failed" });
  }
});

// REGISTER (Updated to save email)
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body; // Added email
    const role = (username === 'JunaidRafi') ? 'admin' : 'pilot';
    const user = new User({ 
        username, 
        email: email || "", // Added email
        password: await bcrypt.hash(password, 10),
        role: role 
    });
    await user.save();
    res.send('Registration Successful!');
  } catch (e) { res.status(400).send('User already exists'); }
});

// LOGIN
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    res.json({ token: jwt.sign({ username: user.username, role: user.role }, SECRET) });
  } else { res.status(401).send('Invalid credentials'); }
});

app.post('/save-log', async (req, res) => {
  const newLog = new Log(req.body);
  await newLog.save();
  console.log(`📝 LOG RECORDED: User [${req.body.username}] sent a message.`);
  res.send('Saved');
});

app.post('/share-log/:id', async (req, res) => {
  await Log.findByIdAndUpdate(req.params.id, { isPublic: true });
  res.send('Shared');
});

app.delete('/delete-log/:id', async (req, res) => {
    try {
      await Log.findByIdAndDelete(req.params.id);
      res.send('Deleted');
    } catch (e) {
      res.status(500).send('Error deleting log');
    }
});

app.get('/public-logs', async (req, res) => {
  const logs = await Log.find({ isPublic: true }).sort({ date: -1 }).limit(20);
  res.json(logs);
});

app.get('/get-data/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  const logs = await Log.find({ username: req.params.username }).sort({ date: -1 });
  res.json({ avatar: user.avatar, logs: logs, role: user.role });
});

app.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
    try {
      const filePath = `/uploads/${req.file.filename}`;
      await User.findOneAndUpdate({ username: req.body.username }, { avatar: filePath });
      res.json({ path: filePath });
    } catch (e) {
      res.status(500).send('Upload failed');
    }
});

// --- UPDATED LISTEN BLOCK ---
app.listen(PORT, async () => {
    const url = `http://localhost:${PORT}`;
    const startTime = new Date().toLocaleTimeString();
    
    console.log(`\n--- MISSION START: ${startTime} ---`);
    console.log(`🛰️  MISSION CONTROL LIVE`);
    console.log(`🔗 Click to open: \x1b[36m${url}\x1b[0m`); 
    console.log(`🚀 Secure DB Connected\n`);

    open(url);
});