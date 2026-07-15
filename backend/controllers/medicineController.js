// controllers/medicineController.js
const { Medicine, MedicineRequest, User, OPDVisit, Token } = require('../models');

// GET /api/medicines  — public: show all medicines with availability
const getMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.findAll({ order: [['name','ASC']] });
    return res.status(200).json({ success: true, medicines });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// GET /api/medicine-requests  — Medicine Admin Panel
const getMedicineRequests = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;

    const requests = await MedicineRequest.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id','name','email'] },
        { model: OPDVisit, as: 'visit', attributes: ['id','symptoms','diagnosis','prescription','doctor_name'] },
      ],
      order: [['createdAt','DESC']],
    });
    return res.status(200).json({ success: true, count: requests.length, requests });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// PATCH /api/medicine-requests/:id/status  — Update status
const updateMedicineStatus = async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const request = await MedicineRequest.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: ['id','name','email'] }],
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    const updateData = { status, admin_notes: admin_notes || request.admin_notes };
    if (status === 'ready') updateData.ready_at = new Date();
    await request.update(updateData);

    return res.status(200).json({ success: true, message: `Status updated to ${status}`, request });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// GET /api/medicine-requests/user/:user_id  — Patient checks their medicine status
const getUserMedicineStatus = async (req, res) => {
  try {
    const requests = await MedicineRequest.findAll({
      where: { user_id: req.params.user_id },
      order: [['createdAt','DESC']], limit: 5,
    });
    return res.status(200).json({ success: true, requests });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// POST /api/medicines  — Admin add medicine
const addMedicine = async (req, res) => {
  try {
    const { name, category, stock, unit, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Medicine name required' });
    const medicine = await Medicine.create({ name, category, stock: stock || 0, unit: unit || 'tablet', description });
    return res.status(201).json({ success: true, message: 'Medicine added', medicine });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// PATCH /api/medicines/:id  — Update stock
const updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByPk(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });
    await medicine.update(req.body);
    return res.status(200).json({ success: true, medicine });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getMedicines, getMedicineRequests, updateMedicineStatus, getUserMedicineStatus, addMedicine, updateMedicine };
