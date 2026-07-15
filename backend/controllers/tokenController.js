// controllers/tokenController.js
const QRCode = require('qrcode');
const { Token, User, Queue, Appointment, Doctor, DeptSettings } = require('../models');
const { Op } = require('sequelize');

const DEPT_ROOMS = {
    General: 'OPD-101',
    ENT: 'OPD-205',
    Cardiology: 'OPD-310',
    Orthopedics: 'OPD-412',
    Pediatrics: 'OPD-115',
};

const DEPTS = ['General', 'ENT', 'Cardiology', 'Orthopedics', 'Pediatrics'];

// Helper: get dept settings (with fallback defaults)
async function getDeptSettings(department) {
    let s = await DeptSettings.findOne({ where: { department } });
    if (!s) {
        s = await DeptSettings.create({ department, max_tokens_per_day: 100, avg_minutes_per_patient: 10 });
    }
    return s;
}

// Get next sequential token number for dept + date
async function getNextTokenNumber(department, apptDate) {
    const count = await Token.count({ where: { department, appt_date: apptDate } });
    return count + 1;
}

// ──────────────────────────────────────────────────────────────────────────────
// Generate globally unique token_uid
// Format: OPD<DEPT3><DDMMYYYY><DOC3><PAT3><NNN>
// Example: OPDGEN23042026DIVMOH003
//   OPD   = prefix
//   GEN   = department (first 3 letters, uppercase)
//   23042026 = date in DDMMYYYY format
//   DIV   = doctor first name first 3 letters (uppercase)
//   MOH   = patient first name first 3 letters (uppercase)
//   003   = sequential token number (3 digits)
//
// WHY: token_number is only 1,2,3... — kal ka Token#2 aur aaj ka Token#2
// same numbers but different tokens. token_uid mein date+doctor+patient embed
// hai isliye ye NEVER clash karega aur 100% unique rehga.
// ──────────────────────────────────────────────────────────────────────────────
function buildTokenUid(department, apptDate, tokenNumber, doctorName, patientName) {
    // DEPT3: first 3 letters of department, uppercase
    const deptCode = department.slice(0, 3).toUpperCase(); // GEN, ENT, CAR, ORT, PED

    // Date in DDMMYYYY format
    const [yyyy, mm, dd] = apptDate.split('-');
    const dateStr = `${dd}${mm}${yyyy}`; // 23042026

    // DOC3: first name ke first 3 chars, uppercase. No doctor = "DOC"
    const docFirstName = doctorName ? doctorName.replace(/^Dr\.?\s*/i, '').split(' ')[0] : 'DOC';
    const docCode = docFirstName.slice(0, 3).toUpperCase().padEnd(3, 'X');

    // PAT3: patient first name ke first 3 chars, uppercase
    const patFirstName = patientName ? patientName.split(' ')[0] : 'PAT';
    const patCode = patFirstName.slice(0, 3).toUpperCase().padEnd(3, 'X');

    // Token number: 3 digits, zero-padded
    const numStr = String(tokenNumber).padStart(3, '0');

    return `OPD${deptCode}${dateStr}${docCode}${patCode}${numStr}`;
}

// POST /api/generate-token
const generateToken = async(req, res) => {
    try {
        const { user_id, department = 'General', appointment_id } = req.body;
        if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });

        const user = await User.findByPk(user_id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Get appointment date + doctor
        let apptDate = new Date().toISOString().split('T')[0];
        let apptObj = null;
        if (appointment_id) {
            apptObj = await Appointment.findByPk(appointment_id, {
                include: [{ model: Doctor, as: 'doctor' }]
            });
            if (apptObj) apptDate = apptObj.appt_date;
        }

        // Check dept settings for max tokens
        const settings = await getDeptSettings(department);
        const issuedCount = await Token.count({ where: { department, appt_date: apptDate } });
        if (issuedCount >= settings.max_tokens_per_day) {
            return res.status(409).json({
                success: false,
                message: `${department} department is fully booked for ${apptDate}. Max ${settings.max_tokens_per_day} tokens per day.`
            });
        }

        // Duplicate active token check
        const existing = await Token.findOne({
            where: {
                user_id,
                department,
                appt_date: apptDate,
                status: {
                    [Op.in]: ['waiting', 'called']
                }
            }
        });
        if (existing) return res.status(409).json({ success: false, message: 'You already have an active token for this date.', token: existing });

        // Count waiting tokens ahead
        const waitingCount = await Token.count({ where: { department, appt_date: apptDate, status: 'waiting' } });

        const token_number = await getNextTokenNumber(department, apptDate);
        const avgMin = settings.avg_minutes_per_patient || 10;
        const estimated_time = waitingCount * avgMin;
        const room_number = DEPT_ROOMS[department] || 'OPD-101';
        const doctorName = apptObj?.doctor?.name || null;
        const doctor_id = apptObj?.doctor_id || null;

        // ── Build unique token_uid — yahi QR mein jaayega ──
        // Format: OPDGEN23042026DIVMOH003 (dept+date+doctor+patient+num)
        const token_uid = buildTokenUid(department, apptDate, token_number, doctorName, user.name);

        // ── QR mein token_uid + token_number + date — sab kuch unique ──
        const qrData = JSON.stringify({
            token_uid, // PRIMARY identifier for scanning
            tokenId: null, // filled below after DB insert
            token: token_number, // display number
            dept: department,
            room: room_number,
            user: user.name,
            userId: user.id,
            doctor: doctorName,
            apptDate,
            issued: new Date().toISOString(),
        });

        // Generate QR with token_uid
        const qr_code = await QRCode.toDataURL(qrData, { width: 250, margin: 2 });

        const newToken = await Token.create({
            user_id,
            token_number,
            department,
            room_number,
            qr_code,
            status: 'waiting',
            estimated_time,
            tokens_ahead: waitingCount,
            appt_date: apptDate,
            token_uid,
        });

        // ── Regenerate QR with actual DB id now that we have it ──
        // (tokenId is used as fallback scan method)
        const qrDataFinal = JSON.stringify({
            token_uid,
            tokenId: newToken.id,
            token: token_number,
            dept: department,
            room: room_number,
            user: user.name,
            userId: user.id,
            doctor: doctorName,
            apptDate,
            issued: new Date().toISOString(),
        });
        const qr_code_final = await QRCode.toDataURL(qrDataFinal, { width: 250, margin: 2 });
        await newToken.update({ qr_code: qr_code_final });

        if (appointment_id) {
            await Appointment.update({ token_id: newToken.id, status: 'confirmed' }, { where: { id: appointment_id } });
        }

        return res.status(201).json({
            success: true,
            message: 'Token generated successfully',
            token: {...newToken.toJSON(), doctor_name: doctorName, doctor_id },
            doctorName,
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

// GET /api/tokens
const getAllTokens = async(req, res) => {
    try {
        const { department, status, date } = req.query;
        const where = {};
        if (department) where.department = department;
        if (status) where.status = status;
        const filterDate = date || new Date().toISOString().split('T')[0];
        where.appt_date = filterDate;
        const tokens = await Token.findAll({
            where,
            order: [
                ['token_number', 'ASC']
            ],
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'photo_url'] }],
        });
        return res.status(200).json({ success: true, count: tokens.length, tokens });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// GET /api/tokens/user/:user_id
const getUserTokens = async(req, res) => {
    try {
        const tokens = await Token.findAll({
            where: { user_id: req.params.user_id },
            order: [
                ['createdAt', 'DESC']
            ],
            limit: 20,
            include: [{
                model: Appointment,
                as: 'appointment',
                include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization', 'room_number'] }]
            }]
        });

        const enriched = tokens.map(t => {
            const tok = t.toJSON();
            if (tok.appointment?.doctor) {
                tok.doctor_name = tok.appointment.doctor.name;
                tok.doctor_id = tok.appointment.doctor.id;
            }
            return tok;
        });

        return res.status(200).json({ success: true, tokens: enriched });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// GET /api/doctors/:id
const getDoctorById = async(req, res) => {
    try {
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
        return res.json({ success: true, ...doctor.toJSON() });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// GET /api/appointments/:id
const getAppointmentById = async(req, res) => {
    try {
        const appt = await Appointment.findByPk(req.params.id, {
            include: [{ model: Doctor, as: 'doctor' }]
        });
        if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
        return res.json({ success: true, ...appt.toJSON() });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// POST /api/next-token
const nextToken = async(req, res) => {
    try {
        const { department = 'General' } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const nextTok = await Token.findOne({
            where: { department, status: 'waiting', appt_date: today },
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
            order: [
                ['token_number', 'ASC']
            ],
        });
        if (!nextTok) return res.status(200).json({ success: false, message: 'No waiting tokens in queue.' });
        await nextTok.update({ status: 'called', called_at: new Date() });

        let queue = await Queue.findOne({ where: { department } });
        if (!queue) {
            queue = await Queue.create({ department, current_token: nextTok.token_number, room_number: DEPT_ROOMS[department] });
        } else {
            await queue.update({ current_token: nextTok.token_number });
        }
        return res.status(200).json({ success: true, message: `Token #${nextTok.token_number} called`, token: nextTok, queue });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// POST /api/complete-token
const completeToken = async(req, res) => {
    try {
        const token = await Token.findByPk(req.body.token_id);
        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        await token.update({ status: 'completed', completed_at: new Date() });
        return res.status(200).json({ success: true, token });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// GET /api/queue-status
const getQueueStatus = async(req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await Promise.all(DEPTS.map(async dept => {
            const settings = await getDeptSettings(dept);
            const calledTok = await Token.findOne({
                where: { department: dept, status: 'called', appt_date: today },
                order: [
                    ['called_at', 'DESC']
                ],
            });
            const waiting = await Token.count({ where: { department: dept, status: 'waiting', appt_date: today } });
            const completed = await Token.count({ where: { department: dept, status: 'completed', appt_date: today } });
            const total = await Token.count({ where: { department: dept, appt_date: today } });
            const nextWaiting = await Token.findOne({
                where: { department: dept, status: 'waiting', appt_date: today },
                order: [
                    ['token_number', 'ASC']
                ],
            });
            return {
                department: dept,
                room_number: DEPT_ROOMS[dept],
                current_token: calledTok ? calledTok.token_number : null,
                next_token: nextWaiting ? nextWaiting.token_number : null,
                waiting_count: waiting,
                completed_count: completed,
                total_today: total,
                max_tokens_per_day: settings.max_tokens_per_day,
                avg_minutes_per_patient: settings.avg_minutes_per_patient,
                is_active: true,
            };
        }));
        return res.status(200).json({ success: true, queues: result });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// GET /api/departments/slots
const getDeptSlots = async(req, res) => {
    try {
        const { dept, date } = req.query;
        if (!dept) return res.status(400).json({ success: false, message: 'dept required' });
        const filterDate = date || new Date().toISOString().split('T')[0];
        const settings = await getDeptSettings(dept);
        const booked = await Token.count({ where: { department: dept, appt_date: filterDate } });
        const available = Math.max(0, settings.max_tokens_per_day - booked);
        return res.json({ success: true, department: dept, date: filterDate, max_tokens: settings.max_tokens_per_day, booked_count: booked, available, avg_minutes_per_patient: settings.avg_minutes_per_patient });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// GET /api/dept-settings
const getAllDeptSettings = async(req, res) => {
    try {
        const all = await Promise.all(DEPTS.map(d => getDeptSettings(d)));
        return res.json({ success: true, settings: all });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// PATCH /api/dept-settings/:department
const updateDeptSettings = async(req, res) => {
    try {
        const dept = req.params.department;
        if (!DEPTS.includes(dept)) return res.status(400).json({ success: false, message: 'Invalid department' });
        const { max_tokens_per_day, avg_minutes_per_patient } = req.body;
        const s = await getDeptSettings(dept);
        await s.update({
            max_tokens_per_day: max_tokens_per_day ?? s.max_tokens_per_day,
            avg_minutes_per_patient: avg_minutes_per_patient ?? s.avg_minutes_per_patient,
        });
        return res.json({ success: true, message: 'Settings updated', settings: s });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// ──────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
// GET /api/token-scan/:identifier?doctor_id=X&department=General
//
// SMART SCAN — 3 step fallback:
// 1. token_uid match (BEST — OPDGEN23042026DIVMOH003 / old OPD-YYYY-DEPT-NNN)
// 2. DB id match    (GOOD — fallback for older tokens)
// 3. token_number + TODAY + doctor's department (FILTERED — sirf us doctor ka patient)
//
// doctor_id / department filter ensures doctor sirf apne patients dekhe
// ──────────────────────────────────────────────────────────────────────────────
const scanToken = async(req, res) => {
    try {
        const identifier = req.params.identifier;
        const { OPDCard, OPDVisit } = require('../models');

        // ── IST-aware "today" calculation ────────────────────────────────────
        // India IST = UTC+5:30. Raat 12am-5:30am IST pe UTC date ek din peeche
        // hoti hai — isliye IST ke hisaab se aaj ki date nikaalte hain.
        // Sirf IST today ka token valid hoga — kal ya parso ka NAHI.
        const now = new Date();
        // IST offset: +5:30 = 330 minutes
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffsetMs);
        const istToday = istNow.toISOString().split('T')[0]; // YYYY-MM-DD in IST
        const validDates = [istToday]; // Sirf aaj ka token valid — kal/parso NAHI

        // Doctor filtering
        const filterDoctorId   = req.query.doctor_id ? parseInt(req.query.doctor_id) : null;
        const filterDepartment = req.query.department || null;

        let token = null;

        // Step 1: token_uid match (OPD prefix) — globally unique, best method
        if (identifier && identifier.toUpperCase().startsWith('OPD')) {
            token = await Token.findOne({
                where: { token_uid: identifier.toUpperCase() },
                include: [{ model: User, as: 'user' }],
            });
        }

        // Step 2: numeric → token_number + IST-safe date + department filter
        // Doctor always manually types token NUMBER (1,2,3...) not DB id
        // DB id lookup pehle hota tha aur galat purana token pakad leta tha — FIX!
        if (!token && /^\d+$/.test(identifier)) {
            const numId = parseInt(identifier);
            const whereClause = {
                token_number: numId,
                appt_date: { [Op.in]: validDates },
            };
            if (filterDepartment) whereClause.department = filterDepartment;
            token = await Token.findOne({
                where: whereClause,
                include: [{ model: User, as: 'user' }],
                order: [['createdAt', 'DESC']],
            });
        }

        // Step 3: DB id — last resort fallback only
        if (!token && /^\d+$/.test(identifier)) {
            token = await Token.findOne({
                where: { id: parseInt(identifier) },
                include: [{ model: User, as: 'user' }],
            });
        }

        if (!token) {
            return res.status(404).json({
                success: false,
                message: filterDepartment
                    ? `Token not found in ${filterDepartment} department for today. Check token number.`
                    : 'Token not found. This token is not for today or does not exist.'
            });
        }

        // ── Department validation: doctor sirf apne department ka patient dekhe ──
        if (filterDepartment && token.department !== filterDepartment) {
            return res.status(403).json({
                success: false,
                message: `This token belongs to ${token.department} department, not ${filterDepartment}. Please verify the patient is at the correct counter.`,
                errorType: 'WRONG_DEPARTMENT',
                token: {
                    token_number: token.token_number,
                    token_uid: token.token_uid,
                    appt_date: token.appt_date,
                    department: token.department,
                    status: token.status,
                }
            });
        }

        // ── Doctor validation removed ─────────────────────────────────────────
        // Department filter already ensures doctor sirf apne department ke patients
        // dekhe. doctor_id check false negatives deta tha jab appointment ka
        // doctor_id aur myDoctorProfile.id DB mein alag hote the.

        // ── Date validation: future/past date tokens block karo ──
        // validDates = [utcToday, utcTomorrow] — IST timezone ke liye dono valid hain
        if (token.appt_date && !validDates.includes(token.appt_date)) {
            const tokenDate = new Date(token.appt_date);
            const todayDate = new Date(istToday);
            const isPast = tokenDate < todayDate;
            return res.status(403).json({
                success: false,
                message: isPast
                    ? `This token ${token.appt_date} ka hai — expired. Aaj ke liye valid nahi.`
                    : `This token ${token.appt_date} ka hai — abhi valid nahi. Appointment date par aayein.`,
                token: {
                    token_number: token.token_number,
                    token_uid: token.token_uid,
                    appt_date: token.appt_date,
                    department: token.department,
                    status: token.status,
                },
                errorType: isPast ? 'EXPIRED' : 'FUTURE',
            });
        }

        const opdCard = await OPDCard.findOne({
            where: { user_id: token.user_id },
            include: [{ model: OPDVisit, as: 'visits', limit: 5, order: [
                    ['visit_date', 'DESC']
                ] }],
        });

        return res.status(200).json({ success: true, token, opdCard, isNewPatient: !opdCard });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// PATCH /api/tokens/:id/cancel  — token DB se delete + linked appointment bhi clean karo
const cancelToken = async(req, res) => {
    try {
        const token = await Token.findByPk(req.params.id);
        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        if (['completed', 'cancelled'].includes(token.status))
            return res.status(400).json({ success: false, message: `Token already ${token.status}.` });

        // Linked appointment ko bhi DB se delete karo
        const linkedAppt = await Appointment.findOne({ where: { token_id: token.id } });
        if (linkedAppt) await linkedAppt.destroy();

        // Token ko bhi DB se delete karo
        const tokenData = { token_number: token.token_number, department: token.department };
        await token.destroy();

        return res.status(200).json({ success: true, message: 'Token deleted from database.', token: tokenData });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

module.exports = {
    generateToken,
    getAllTokens,
    getUserTokens,
    nextToken,
    completeToken,
    getQueueStatus,
    scanToken,
    getDoctorById,
    getAppointmentById,
    getDeptSlots,
    getAllDeptSettings,
    updateDeptSettings,
    cancelToken,
};