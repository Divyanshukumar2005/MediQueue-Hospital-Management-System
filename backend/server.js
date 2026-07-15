// server.js — MediQueue V3
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB, sequelize } = require('./config/db');
require('./models');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET is not set in .env — refusing to start with an insecure default.');
    process.exit(1);
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/tokens'));
app.use('/api', require('./routes/opd'));
app.use('/api', require('./routes/appointments'));
app.use('/api', require('./routes/medicines'));

// ── Admin: list all staff/users
app.get('/api/admin/users', authMiddleware(['admin']), async(req, res) => {
    const { User } = require('./models');
    const users = await User.findAll({
        attributes: { exclude: ['password'] },
        order: [
            ['createdAt', 'DESC']
        ]
    });
    res.json({ success: true, users });
});

// ── Admin: create doctor or medicine_staff account
app.post('/api/admin/create-staff', authMiddleware(['admin']), async(req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;
        const { User } = require('./models');
        if (!['doctor', 'medicine_staff', 'admin'].includes(role))
            return res.status(400).json({ success: false, message: 'Invalid role.' });
        if (!name || !email || !password)
            return res.status(400).json({ success: false, message: 'Name, email and password required.' });
        const existing = await User.findOne({ where: { email } });
        if (existing) return res.status(409).json({ success: false, message: 'Email already in use.' });
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            password: hashed,
            role,
            phone: phone || null,
            auth_provider: 'local',
            photo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=128`,
        });

        // ── If doctor, also create entry in Doctor table so they appear in appointment booking
        let doctorEntry = null;
        if (role === 'doctor') {
            const { Doctor } = require('./models');
            const { department, specialization, room_number, available_days } = req.body;
            doctorEntry = await Doctor.create({
                name,
                department: department || 'General',
                specialization: specialization || null,
                room_number: room_number || null,
                available_days: available_days || 'Mon,Tue,Wed,Thu,Fri',
                photo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=128`,
                is_active: true,
            });
        }

        res.status(201).json({ success: true, message: `${role} account created.`, user: { id: user.id, name: user.name, email: user.email, role: user.role }, doctorEntry });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Admin: update user role / active status
app.patch('/api/admin/users/:id', authMiddleware(['admin']), async(req, res) => {
    try {
        const { User } = require('./models');
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        const { role, is_active, name, phone } = req.body;
        await user.update({
            role: role || user.role,
            is_active: is_active !== undefined ? is_active : user.is_active,
            name: name || user.name,
            phone: phone !== undefined ? phone : user.phone,
        });
        res.json({ success: true, message: 'User updated.', user: { id: user.id, name: user.name, role: user.role, is_active: user.is_active, phone: user.phone } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Admin: list ALL doctors (including inactive)
app.get('/api/admin/doctors', authMiddleware(['admin']), async(req, res) => {
    try {
        const { Doctor } = require('./models');
        const doctors = await Doctor.findAll({ order: [
                ['name', 'ASC']
            ] });
        res.json({ success: true, doctors });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Admin: edit doctor details
app.patch('/api/admin/doctors/:id', authMiddleware(['admin']), async(req, res) => {
    try {
        const { Doctor } = require('./models');
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });
        const { name, department, specialization, room_number, available_days, is_active } = req.body;
        await doctor.update({
            name: name ?? doctor.name,
            department: department ?? doctor.department,
            specialization: specialization ?? doctor.specialization,
            room_number: room_number ?? doctor.room_number,
            available_days: available_days ?? doctor.available_days,
            is_active: is_active !== undefined ? is_active : doctor.is_active,
        });
        res.json({ success: true, message: 'Doctor updated.', doctor });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Admin: remove doctor
app.delete('/api/admin/doctors/:id', authMiddleware(['admin']), async(req, res) => {
    try {
        const { Doctor } = require('./models');
        await Doctor.destroy({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Doctor removed.' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Admin: delete user
app.delete('/api/admin/users/:id', authMiddleware(['admin']), async(req, res) => {
    try {
        const { User } = require('./models');
        await User.destroy({ where: { id: req.params.id } });
        res.json({ success: true, message: 'User deleted.' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Dept settings routes (admin only)
app.get("/api/dept-settings", authMiddleware(["admin"]), async(req, res) => {
    const { DeptSettings } = require("./models");
    const all = await DeptSettings.findAll();
    res.json({ success: true, settings: all });
});
app.patch("/api/dept-settings/:department", authMiddleware(["admin"]), async(req, res) => {
    try {
        const { DeptSettings } = require("./models");
        const DEPTS = ["General", "ENT", "Cardiology", "Orthopedics", "Pediatrics"];
        const dept = req.params.department;
        if (!DEPTS.includes(dept)) return res.status(400).json({ success: false, message: "Invalid department" });
        let s = await DeptSettings.findOne({ where: { department: dept } });
        if (!s) s = await DeptSettings.create({ department: dept, max_tokens_per_day: 100, avg_minutes_per_patient: 10 });
        const { max_tokens_per_day, avg_minutes_per_patient } = req.body;
        await s.update({ max_tokens_per_day: max_tokens_per_day ?? s.max_tokens_per_day, avg_minutes_per_patient: avg_minutes_per_patient ?? s.avg_minutes_per_patient });
        res.json({ success: true, message: "Settings updated", settings: s });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/health', async (req, res) => {
    try {
        // Runs a tiny query against the DB so external uptime pingers
        // (e.g. cron-job.org) also keep the database connection/instance
        // active, not just this web service.
        await sequelize.authenticate();
        res.json({ success: true, message: 'MediQueue V3 Running 🏥', db: 'connected' });
    } catch (err) {
        console.error('⚠️  /api/health DB check failed:', err.message);
        res.status(503).json({ success: false, message: 'MediQueue V3 Running, DB unreachable ⚠️', db: 'disconnected' });
    }
});
app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.use((err, req, res, next) => res.status(500).json({ success: false, message: err.message }));

function authMiddleware(roles = []) {
    return (req, res, next) => {
        const h = req.headers.authorization;
        if (!h) return res.status(401).json({ success: false, message: 'Authentication required.' });
        try {
            const decoded = jwt.verify(h.split(' ')[1], JWT_SECRET);
            if (roles.length && !roles.includes(decoded.role))
                return res.status(403).json({ success: false, message: 'Access denied.' });
            req.user = decoded;
            next();
        } catch (e) { return res.status(401).json({ success: false, message: 'Invalid session.' }); }
    };
}

const start = async() => {
    await connectDB();
    await sequelize.sync({ alter: { drop: false } });
    console.log('✅ Database synced');

    const { Doctor, Medicine, User } = require('./models');

    // Seed doctors list (no login accounts — those are created by admin)
    const docCount = await Doctor.count();
    if (docCount === 0) {
        await Doctor.bulkCreate([
            { name: 'Dr. Rajesh Sharma', department: 'General', room_number: 'OPD-101', specialization: 'General Physician' },
            { name: 'Dr. Priya Mehta', department: 'General', room_number: 'OPD-102', specialization: 'General Physician' },
            { name: 'Dr. Anil Kumar', department: 'ENT', room_number: 'OPD-205', specialization: 'ENT Specialist' },
            { name: 'Dr. Sunita Rao', department: 'Cardiology', room_number: 'OPD-310', specialization: 'Cardiologist' },
            { name: 'Dr. Vikram Singh', department: 'Orthopedics', room_number: 'OPD-412', specialization: 'Orthopedic Surgeon' },
            { name: 'Dr. Kavya Nair', department: 'Pediatrics', room_number: 'OPD-115', specialization: 'Pediatrician' },
        ]);
        console.log('✅ Doctors seeded');
    }

    const medCount = await Medicine.count();
    if (medCount === 0) {
        await Medicine.bulkCreate([
            { name: 'Paracetamol 500mg', category: 'Analgesic', stock: 500, unit: 'tablet', is_available: true },
            { name: 'Amoxicillin 250mg', category: 'Antibiotic', stock: 200, unit: 'capsule', is_available: true },
            { name: 'Omeprazole 20mg', category: 'Antacid', stock: 300, unit: 'capsule', is_available: true },
            { name: 'Cetirizine 10mg', category: 'Antihistamine', stock: 150, unit: 'tablet', is_available: true },
            { name: 'Metformin 500mg', category: 'Antidiabetic', stock: 0, unit: 'tablet', is_available: false },
            { name: 'Atorvastatin 10mg', category: 'Statin', stock: 100, unit: 'tablet', is_available: true },
            { name: 'Azithromycin 500mg', category: 'Antibiotic', stock: 80, unit: 'tablet', is_available: true },
            { name: 'Ibuprofen 400mg', category: 'NSAID', stock: 250, unit: 'tablet', is_available: true },
        ]);
        console.log('✅ Medicines seeded');
    }

    // Create default admin if none exists
    // SECURITY: a random password is generated on first run instead of a
    // fixed one, so the same credentials can't be reused across every
    // deployment of this codebase. It is printed to the console ONCE —
    // copy it immediately (check your Render logs) and change it after login.
    const adminCount = await User.count({ where: { role: 'admin' } });
    if (adminCount === 0) {
        const crypto = require('crypto');
        const generatedPassword = process.env.DEFAULT_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
        const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@hospital.com';
        const hashed = await bcrypt.hash(generatedPassword, 10);
        await User.create({
            name: 'Hospital Admin',
            email: adminEmail,
            password: hashed,
            role: 'admin',
            auth_provider: 'local',
            photo_url: 'https://ui-avatars.com/api/?name=Admin&background=1d4ed8&color=fff&size=128',
        });
        console.log('════════════════════════════════════════════════════════');
        console.log('✅ Default admin account created');
        console.log(`   Email:    ${adminEmail}`);
        console.log(`   Password: ${generatedPassword}`);
        console.log('   ⚠️  Copy this password now — log in and change it immediately.');
        console.log('   (Set DEFAULT_ADMIN_PASSWORD in .env to control this instead.)');
        console.log('════════════════════════════════════════════════════════');
    }

    // Seed DeptSettings
    const { DeptSettings } = require('./models');
    const DEPT_LIST = ['General', 'ENT', 'Cardiology', 'Orthopedics', 'Pediatrics'];
    const DEPT_DEFAULTS = { General: { max_tokens_per_day: 80, avg_minutes_per_patient: 8 }, ENT: { max_tokens_per_day: 50, avg_minutes_per_patient: 10 }, Cardiology: { max_tokens_per_day: 40, avg_minutes_per_patient: 15 }, Orthopedics: { max_tokens_per_day: 40, avg_minutes_per_patient: 15 }, Pediatrics: { max_tokens_per_day: 60, avg_minutes_per_patient: 10 } };
    for (const dept of DEPT_LIST) {
        const exists = await DeptSettings.findOne({ where: { department: dept } });
        if (!exists) await DeptSettings.create({ department: dept, ...DEPT_DEFAULTS[dept] });
    }
    console.log('✅ Dept settings ready');

    app.listen(PORT, () => console.log(`🚀 Server → http://localhost:${PORT}`));
};

start();