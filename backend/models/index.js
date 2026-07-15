// models/index.js — all models + associations
const User = require('./User');
const OPDCard = require('./OPDCard');
const Token = require('./Token');
const OPDVisit = require('./OPDVisit');
const Queue = require('./Queue');
const Appointment = require('./Appointment');
const Doctor = require('./Doctor');
const Medicine = require('./Medicine');
const MedicineRequest = require('./MedicineRequest');
const DeptSettings = require('./DeptSettings');

User.hasOne(OPDCard, { foreignKey: 'user_id', as: 'opdCard' });
OPDCard.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Token, { foreignKey: 'user_id', as: 'tokens' });
Token.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

OPDCard.hasMany(OPDVisit, { foreignKey: 'opd_id', as: 'visits' });
OPDVisit.belongsTo(OPDCard, { foreignKey: 'opd_id', as: 'opdCard' });

Token.hasOne(OPDVisit, { foreignKey: 'token_id', as: 'visit' });
OPDVisit.belongsTo(Token, { foreignKey: 'token_id', as: 'token' });

User.hasMany(Appointment, { foreignKey: 'user_id', as: 'appointments' });
Appointment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Doctor.hasMany(Appointment, { foreignKey: 'doctor_id', as: 'appointments' });
Appointment.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });

Token.hasOne(Appointment, { foreignKey: 'token_id', as: 'appointment' });
Appointment.belongsTo(Token, { foreignKey: 'token_id', as: 'token' });

OPDVisit.hasOne(MedicineRequest, { foreignKey: 'visit_id', as: 'medicineRequest' });
MedicineRequest.belongsTo(OPDVisit, { foreignKey: 'visit_id', as: 'visit' });

User.hasMany(MedicineRequest, { foreignKey: 'user_id', as: 'medicineRequests' });
MedicineRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = { User, OPDCard, Token, OPDVisit, Queue, Appointment, Doctor, Medicine, MedicineRequest, DeptSettings };