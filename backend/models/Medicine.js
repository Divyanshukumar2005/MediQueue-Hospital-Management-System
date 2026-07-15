// models/Medicine.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Medicine = sequelize.define('Medicine', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:     { type: DataTypes.STRING(150), allowNull: false },
  category: { type: DataTypes.STRING(80), allowNull: true },
  stock:    { type: DataTypes.INTEGER, defaultValue: 0 },
  unit:     { type: DataTypes.STRING(20), defaultValue: 'tablet' },
  is_available: { type: DataTypes.BOOLEAN, defaultValue: true },
  description: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'medicines', timestamps: true });

module.exports = Medicine;
