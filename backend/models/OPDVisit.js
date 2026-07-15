// models/OPDVisit.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const OPDVisit = sequelize.define('OPDVisit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  opd_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  token_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  symptoms: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  diagnosis: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  prescription: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  doctor_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  follow_up_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  visit_date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'opd_visits',
  timestamps: true,
});

module.exports = OPDVisit;
