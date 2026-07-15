// models/Doctor.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Doctor = sequelize.define('Doctor', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:       { type: DataTypes.STRING(100), allowNull: false },
  department: {
    type: DataTypes.ENUM('General','ENT','Cardiology','Orthopedics','Pediatrics'),
    allowNull: false,
  },
  room_number:  { type: DataTypes.STRING(10), allowNull: true },
  specialization: { type: DataTypes.STRING(100), allowNull: true },
  available_days: { type: DataTypes.STRING(50), defaultValue: 'Mon,Tue,Wed,Thu,Fri' },
  is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
  photo_url:  { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'doctors', timestamps: true });

module.exports = Doctor;
