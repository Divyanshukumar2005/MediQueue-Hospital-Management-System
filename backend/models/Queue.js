// models/Queue.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Queue = sequelize.define('Queue', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  department: {
    type: DataTypes.ENUM('General', 'ENT', 'Cardiology', 'Orthopedics', 'Pediatrics'),
    allowNull: false,
    defaultValue: 'General',
  },
  current_token: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  room_number: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  doctor_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'queues',
  timestamps: true,
});

module.exports = Queue;
