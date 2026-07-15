// models/Token.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Token = sequelize.define('Token', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    token_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    department: {
        type: DataTypes.ENUM('General', 'ENT', 'Cardiology', 'Orthopedics', 'Pediatrics'),
        allowNull: false,
        defaultValue: 'General',
    },
    room_number: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    qr_code: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('waiting', 'called', 'completed', 'cancelled'),
        defaultValue: 'waiting',
    },
    estimated_time: {
        type: DataTypes.INTEGER, // in minutes
        allowNull: true,
    },
    tokens_ahead: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    appt_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    // Globally unique token identifier — format: OPD-YYYYMMDD-DEPT3-NNNN
    // e.g. OPD-20250423-GEN-0003  — used in QR so previous day token cannot be scanned today
    token_uid: {
        type: DataTypes.STRING(60),
        allowNull: true,
        unique: true,
    },
    called_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'tokens',
    timestamps: true,
});

module.exports = Token;