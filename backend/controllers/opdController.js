// controllers/opdController.js
const { OPDCard, OPDVisit, User, Token, MedicineRequest } = require('../models');

const createOPD = async(req, res) => {
    try {
        const { user_id, blood_group, age, gender, phone, address } = req.body;
        if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });
        const user = await User.findByPk(user_id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        let opdCard = await OPDCard.findOne({ where: { user_id } });
        if (opdCard) return res.status(200).json({ success: true, message: 'OPD card exists', opdCard, isNew: false });

        const card_number = `OPD${Date.now().toString().slice(-6)}${Math.floor(Math.random()*99)}`;
        opdCard = await OPDCard.create({ user_id, card_number, blood_group, age, gender, phone, address });
        return res.status(201).json({ success: true, message: 'OPD card created', opdCard, isNew: true });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

const addVisit = async(req, res) => {
    try {
        const { opd_id, token_id, symptoms, diagnosis, prescription, doctor_name, follow_up_date, send_to_medicine } = req.body;
        if (!opd_id || !symptoms) return res.status(400).json({ success: false, message: 'opd_id and symptoms required' });

        const opdCard = await OPDCard.findByPk(opd_id);
        if (!opdCard) return res.status(404).json({ success: false, message: 'OPD card not found' });

        const visit = await OPDVisit.create({
            opd_id,
            token_id: token_id || null,
            symptoms,
            diagnosis: diagnosis || null,
            prescription: prescription || null,
            doctor_name: doctor_name || null,
            follow_up_date: follow_up_date || null,
            visit_date: new Date(),
        });

        if (token_id) await Token.update({ status: 'completed', completed_at: new Date() }, { where: { id: token_id } });

        // If doctor selected "Send to Medicine Store"
        let medicineRequest = null;
        if (send_to_medicine && prescription) {
            medicineRequest = await MedicineRequest.create({
                visit_id: visit.id,
                user_id: opdCard.user_id,
                token_id: token_id || null,
                prescription_text: prescription,
                status: 'pending',
            });
        }

        return res.status(201).json({ success: true, message: 'Visit recorded', visit, medicineRequest });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

const getOPDDetails = async(req, res) => {
    try {
        const opdCard = await OPDCard.findOne({
            where: { user_id: req.params.user_id },
            include: [
                { model: OPDVisit, as: 'visits', order: [
                        ['visit_date', 'DESC']
                    ] },
                { model: User, as: 'user', attributes: ['id', 'name', 'email', 'photo_url'] },
            ],
        });
        if (!opdCard) return res.status(404).json({ success: false, message: 'No OPD card found' });
        return res.status(200).json({ success: true, opdCard });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

const getAllOPD = async(req, res) => {
    try {
        const cards = await OPDCard.findAll({
            include: [
                { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
                { model: OPDVisit, as: 'visits', limit: 1, order: [
                        ['visit_date', 'DESC']
                    ] },
            ],
            order: [
                ['createdAt', 'DESC']
            ],
        });
        return res.status(200).json({ success: true, count: cards.length, cards });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

const updateOPD = async(req, res) => {
    try {
        const { age, gender, blood_group, phone, address } = req.body;
        const opdCard = await OPDCard.findByPk(req.params.id);
        if (!opdCard) return res.status(404).json({ success: false, message: 'OPD card not found' });
        await opdCard.update({
            age: age ?? opdCard.age,
            gender: gender ?? opdCard.gender,
            blood_group: blood_group ?? opdCard.blood_group,
            phone: phone ?? opdCard.phone,
            address: address ?? opdCard.address,
        });
        return res.status(200).json({ success: true, message: 'OPD card updated', opdCard });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { createOPD, addVisit, getOPDDetails, getAllOPD, updateOPD };