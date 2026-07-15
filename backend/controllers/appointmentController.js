// controllers/appointmentController.js
const { Appointment, Doctor, User, Token, DeptSettings } = require('../models');
const { Op } = require('sequelize');

const DEPTS = ['General', 'ENT', 'Cardiology', 'Orthopedics', 'Pediatrics'];

// Helper: get dept settings
async function getDeptSettings(department) {
    const { DeptSettings } = require('../models');
    let s = await DeptSettings.findOne({ where: { department } });
    if (!s) s = await DeptSettings.create({ department, max_tokens_per_day: 100, avg_minutes_per_patient: 10 });
    return s;
}

// GET /api/doctors?department=General
const getDoctors = async(req, res) => {
    try {
        const where = { is_active: true };
        if (req.query.department) where.department = req.query.department;
        const doctors = await Doctor.findAll({
            where,
            order: [
                ['name', 'ASC']
            ]
        });

        const selDate = req.query.date || new Date().toISOString().split('T')[0];

        const doctorsWithCount = await Promise.all(doctors.map(async(d) => {
            const settings = await getDeptSettings(d.department);
            // Per-doctor limit = max_tokens_per_day / number of active doctors in dept
            const deptDoctorCount = await Doctor.count({ where: { department: d.department, is_active: true } });
            const perDoctorLimit = Math.floor(settings.max_tokens_per_day / Math.max(deptDoctorCount, 1));

            const count = await Appointment.count({
                where: {
                    doctor_id: d.id,
                    appt_date: selDate,
                    status: {
                        [Op.in]: ['pending', 'confirmed']
                    }
                }
            });
            return {
                ...d.toJSON(),
                tokens_booked: count,
                tokens_remaining: Math.max(0, perDoctorLimit - count),
                per_doctor_limit: perDoctorLimit,
                is_full: count >= perDoctorLimit,
                avg_minutes_per_patient: settings.avg_minutes_per_patient,
            };
        }));

        return res.status(200).json({ success: true, doctors: doctorsWithCount });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

// POST /api/appointments
const bookAppointment = async(req, res) => {
    try {
        const { user_id, doctor_id, department, appt_date, notes } = req.body;
        if (!user_id || !department || !appt_date)
            return res.status(400).json({ success: false, message: 'user_id, department, appt_date required' });

        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // ── Booking window: closes at 12:00 PM of the appt_date ──
        if (appt_date === today && now.getHours() >= 12) {
            return res.status(403).json({
                success: false,
                message: 'Token booking for today is closed after 12:00 PM. Please try again tomorrow after 12:00 AM.'
            });
        }

        // ── Past date check ──
        if (appt_date < today)
            return res.status(400).json({ success: false, message: 'Appointments cannot be booked for past dates.' });

        // ── Max 1 month ahead ──
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 1);
        if (new Date(appt_date) > maxDate)
            return res.status(400).json({ success: false, message: 'Appointments can only be booked up to 1 month in advance.' });

        // ── Duplicate booking check ──
        const existing = await Appointment.findOne({
            where: {
                user_id,
                appt_date,
                department,
                status: {
                    [Op.in]: ['pending', 'confirmed']
                }
            }
        });
        if (existing)
            return res.status(409).json({ success: false, message: 'You already have an appointment for this date and department.', appointment: existing });

        // ── Get dept settings for max token check ──
        const settings = await getDeptSettings(department);
        const maxPerDay = settings.max_tokens_per_day;
        const deptDoctorCount = await Doctor.count({ where: { department, is_active: true } });
        const perDoctorLimit = Math.floor(maxPerDay / Math.max(deptDoctorCount, 1));

        if (doctor_id) {
            // Specific doctor limit
            const doctorCount = await Appointment.count({
                where: {
                    doctor_id,
                    appt_date,
                    status: {
                        [Op.in]: ['pending', 'confirmed']
                    }
                }
            });
            if (doctorCount >= perDoctorLimit)
                return res.status(409).json({
                    success: false,
                    message: `This doctor is fully booked for ${appt_date} (${perDoctorLimit} tokens max). Please choose another doctor or date.`
                });
        } else {
            // Any doctor — check whole dept
            const deptCount = await Appointment.count({
                where: {
                    department,
                    appt_date,
                    status: {
                        [Op.in]: ['pending', 'confirmed']
                    }
                }
            });
            if (deptCount >= maxPerDay)
                return res.status(409).json({
                    success: false,
                    message: `${department} department is fully booked for ${appt_date} (max ${maxPerDay} per day). Please choose another date.`
                });
        }

        const appointment = await Appointment.create({ user_id, doctor_id: doctor_id || null, department, appt_date, notes });
        const doctor = doctor_id ? await Doctor.findByPk(doctor_id) : null;

        return res.status(201).json({ success: true, message: 'Appointment booked successfully.', appointment, doctor });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

// GET /api/appointments/user/:user_id
const getUserAppointments = async(req, res) => {
    try {
        const appointments = await Appointment.findAll({
            where: { user_id: req.params.user_id },
            include: [{ model: Doctor, as: 'doctor' }],
            order: [
                ['appt_date', 'DESC']
            ],
        });
        return res.status(200).json({ success: true, appointments });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

// GET /api/appointments/today
const getTodayAppointments = async(req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const where = { appt_date: today };
        if (req.query.department) where.department = req.query.department;
        const appointments = await Appointment.findAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['id', 'name', 'email', 'photo_url'] },
                { model: Doctor, as: 'doctor' },
            ],
            order: [
                ['createdAt', 'ASC']
            ],
        });
        return res.status(200).json({ success: true, count: appointments.length, appointments });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

// GET /api/token-count?department=General&date=...
const getTokenCount = async(req, res) => {
    try {
        const { department, date, doctor_id } = req.query;
        const filterDate = date || new Date().toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        const settings = department ? await getDeptSettings(department) : { max_tokens_per_day: 100, avg_minutes_per_patient: 10 };

        const where = {
            status: {
                [Op.in]: ['pending', 'confirmed']
            },
            appt_date: filterDate
        };
        if (department) where.department = department;
        if (doctor_id) where.doctor_id = doctor_id;

        const count = await Appointment.count({ where });
        const now = new Date();
        const isToday = filterDate === today;
        const bookingOpen = !isToday || now.getHours() < 12;

        return res.status(200).json({
            success: true,
            count,
            tokens_remaining: settings.max_tokens_per_day - count,
            token_limit: settings.max_tokens_per_day,
            avg_minutes_per_patient: settings.avg_minutes_per_patient,
            estimated_wait_mins: count * settings.avg_minutes_per_patient,
            booking_open: bookingOpen,
            booking_window: isToday ? '12:00 AM – 12:00 PM (for today only)' : 'Open',
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

// PATCH /api/appointments/:id/cancel  (DB se delete karo + linked token bhi cancel)
const cancelAppointment = async(req, res) => {
    try {
        const appt = await Appointment.findByPk(req.params.id, {
            include: [{ model: Token, as: 'token' }]
        });
        if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
        if (appt.status === 'cancelled')
            return res.status(400).json({ success: false, message: 'Already cancelled.' });

        // Agar appointment ke saath token linked hai, usse bhi cancel karo
        if (appt.token_id) {
            const linkedToken = await Token.findByPk(appt.token_id);
            if (linkedToken && ['waiting', 'called'].includes(linkedToken.status)) {
                await linkedToken.update({ status: 'cancelled', completed_at: new Date() });
            }
        }

        // Appointment ko DB se delete karo (sirf status update nahi — pura row hata do)
        await appt.destroy();
        return res.status(200).json({ success: true, message: 'Appointment deleted from database.' });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getDoctors, bookAppointment, getUserAppointments, getTodayAppointments, getTokenCount, cancelAppointment };