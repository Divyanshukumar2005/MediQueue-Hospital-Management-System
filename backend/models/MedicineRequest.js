// models/MedicineRequest.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const MedicineRequest = sequelize.define('MedicineRequest', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  visit_id:   { type: DataTypes.INTEGER, allowNull: false },
  user_id:    { type: DataTypes.INTEGER, allowNull: false },
  token_id:   { type: DataTypes.INTEGER, allowNull: true },
  prescription_text: { type: DataTypes.TEXT, allowNull: false },
  medicines_json:    { type: DataTypes.TEXT('long'), allowNull: true }, // JSON array
  status: {
    type: DataTypes.ENUM('pending','preparing','ready','dispensed'),
    defaultValue: 'pending',
  },
  admin_notes: { type: DataTypes.TEXT, allowNull: true },
  ready_at:    { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'medicine_requests', timestamps: true });

module.exports = MedicineRequest;
