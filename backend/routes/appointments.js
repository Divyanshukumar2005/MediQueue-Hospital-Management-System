// routes/appointments.js
const router = require('express').Router();
const { getDoctors, bookAppointment, getUserAppointments, getTodayAppointments, getTokenCount, cancelAppointment } = require('../controllers/appointmentController');
router.get('/doctors', getDoctors);
router.post('/appointments', bookAppointment);
router.get('/appointments/user/:user_id', getUserAppointments);
router.get('/appointments/today', getTodayAppointments);
router.get('/token-count', getTokenCount);
router.patch('/appointments/:id/cancel', cancelAppointment);
module.exports = router;