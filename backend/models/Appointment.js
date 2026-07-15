// models/Appointment.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id:    { type: DataTypes.INTEGER, allowNull: false },
  doctor_id:  { type: DataTypes.INTEGER, allowNull: true },
  department: {
    type: DataTypes.ENUM('General','ENT','Cardiology','Orthopedics','Pediatrics'),
    defaultValue: 'General',
  },
  appt_date:  { type: DataTypes.DATEONLY, allowNull: false },
  token_id:   { type: DataTypes.INTEGER, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending','confirmed','visited','cancelled'),
    defaultValue: 'pending',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'appointments', timestamps: true });

module.exports = Appointment;
