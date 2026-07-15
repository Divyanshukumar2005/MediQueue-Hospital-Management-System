const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:         { type: DataTypes.STRING(100), allowNull: false },
  email:        { type: DataTypes.STRING(150), allowNull: false, unique: true },
  password:     { type: DataTypes.STRING(255), allowNull: true },  // null for Google login
  photo_url:    { type: DataTypes.TEXT, allowNull: true },
  role:         { type: DataTypes.ENUM('patient','doctor','admin','medicine_staff'), defaultValue: 'patient' },
  auth_provider:{ type: DataTypes.ENUM('local','google'), defaultValue: 'local' },
  is_active:    { type: DataTypes.BOOLEAN, defaultValue: true },
  phone:        { type: DataTypes.STRING(15), allowNull: true },
}, { tableName: 'users', timestamps: true });

module.exports = User;