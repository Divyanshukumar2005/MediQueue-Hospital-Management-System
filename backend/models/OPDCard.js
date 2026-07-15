// models/OPDCard.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const OPDCard = sequelize.define('OPDCard', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  card_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  blood_group: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  gender: {
    type: DataTypes.ENUM('Male', 'Female', 'Other'),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'opd_cards',
  timestamps: true,
});

module.exports = OPDCard;
