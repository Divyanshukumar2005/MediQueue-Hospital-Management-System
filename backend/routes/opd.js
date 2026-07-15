// routes/opd.js
const router = require('express').Router();
const { createOPD, addVisit, getOPDDetails, getAllOPD, updateOPD } = require('../controllers/opdController');
router.post('/create-opd', createOPD);
router.post('/add-visit', addVisit);
router.get('/opd/:user_id', getOPDDetails);
router.get('/opd-all', getAllOPD);
router.patch('/opd/:id', updateOPD);
module.exports = router;