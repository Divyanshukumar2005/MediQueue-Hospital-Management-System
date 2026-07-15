// models/DeptSettings.js — Per-department admin-controlled settings
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const DeptSettings = sequelize.define('DeptSettings', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    department: {
        type: DataTypes.ENUM('General', 'ENT', 'Cardiology', 'Orthopedics', 'Pediatrics'),
        allowNull: false,
        unique: true,
    },
    max_tokens_per_day: {
        type: DataTypes.INTEGER,
        defaultValue: 100, // Admin sets this
        allowNull: false,
    },
    avg_minutes_per_patient: {
        type: DataTypes.INTEGER,
        defaultValue: 10, // Admin sets this — realistic per-dept avg
        allowNull: false,
    },
}, { tableName: 'dept_settings', timestamps: true });

module.exports = DeptSettings;