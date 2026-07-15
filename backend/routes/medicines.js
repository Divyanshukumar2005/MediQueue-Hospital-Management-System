// routes/medicines.js
const router = require('express').Router();
const { getMedicines, getMedicineRequests, updateMedicineStatus, getUserMedicineStatus, addMedicine, updateMedicine } = require('../controllers/medicineController');

router.get('/medicines', getMedicines);
router.post('/medicines', addMedicine);
router.patch('/medicines/:id', updateMedicine);
router.get('/medicine-requests', getMedicineRequests);
router.patch('/medicine-requests/:id/status', updateMedicineStatus);
router.get('/medicine-requests/user/:user_id', getUserMedicineStatus);

module.exports = router;
