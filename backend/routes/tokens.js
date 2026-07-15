// routes/tokens.js
const router = require('express').Router();
const {
    generateToken,
    getAllTokens,
    getUserTokens,
    nextToken,
    completeToken,
    cancelToken,
    getQueueStatus,
    scanToken,
    getDoctorById,
    getAppointmentById,
    getDeptSlots,
    getAllDeptSettings,
    updateDeptSettings,
} = require('../controllers/tokenController');

// Token CRUD
router.post('/generate-token', generateToken);
router.get('/tokens', getAllTokens);
router.get('/tokens/user/:user_id', getUserTokens);
router.post('/next-token', nextToken);
router.post('/complete-token', completeToken);
router.patch('/tokens/:id/cancel', cancelToken);

// Queue & status
router.get('/queue-status', getQueueStatus);
router.get('/token-scan/:identifier', scanToken);

// Single lookups (used by token.html)
router.get('/doctors/:id', getDoctorById);
router.get('/appointments/:id', getAppointmentById);

// Department slots (used by appointment.html)
router.get('/departments/slots', getDeptSlots);

// Dept settings — admin only
router.get('/dept-settings', getAllDeptSettings);
router.patch('/dept-settings/:department', updateDeptSettings);

module.exports = router;