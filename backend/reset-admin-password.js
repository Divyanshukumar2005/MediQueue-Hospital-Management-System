// reset-admin-password.js
// One-time script to reset (or create) the admin account's password.
// Run locally with: node reset-admin-password.js
//
// Fill in your Aiven connection details below, and set your desired
// new admin email + password in the CONFIG section.

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// ====== AIVEN CONFIG ======
const DB_HOST = process.env.DB_HOST || 'mediqueue-divyanshu-82e9.b.aivencloud.com';
const DB_PORT = process.env.DB_PORT || 16105;
const DB_NAME = process.env.DB_NAME || 'defaultdb';
const DB_USER = process.env.DB_USER || 'avnadmin';
const DB_PASS = process.env.DB_PASS || 'PASTE_YOUR_AIVEN_PASSWORD_HERE';
// ===========================

// ====== ADMIN LOGIN YOU WANT ======
const ADMIN_EMAIL = 'admin@hospital.com';
const NEW_ADMIN_PASSWORD = 'change_this_password'; // change this to whatever you want
// ===================================

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
});

// Minimal User model matching your schema (only fields we need)
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: DataTypes.STRING,
  email: { type: DataTypes.STRING, unique: true },
  password: DataTypes.STRING,
  role: DataTypes.STRING,
  is_active: DataTypes.BOOLEAN,
  photo_url: DataTypes.TEXT,
}, { tableName: 'users', timestamps: true });

async function run() {
  try {
    console.log('🔌 Connecting to Aiven MySQL...');
    await sequelize.authenticate();
    console.log('✅ Connected.');

    const hashed = await bcrypt.hash(NEW_ADMIN_PASSWORD, 10);

    const [admin, created] = await User.findOrCreate({
      where: { email: ADMIN_EMAIL },
      defaults: {
        name: 'Hospital Admin',
        email: ADMIN_EMAIL,
        password: hashed,
        role: 'admin',
        is_active: true,
        photo_url: 'https://ui-avatars.com/api/?name=Admin&background=1d4ed8&color=fff&size=128',
      },
    });

    if (!created) {
      admin.password = hashed;
      admin.role = 'admin';
      admin.is_active = true;
      await admin.save();
      console.log('🔁 Existing admin found — password reset.');
    } else {
      console.log('🆕 No admin existed — new admin account created.');
    }

    console.log('🎉 Done! You can now log in with:');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${NEW_ADMIN_PASSWORD}`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

run();
