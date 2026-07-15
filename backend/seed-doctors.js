// seed-doctors.js
// One-time script to populate the `doctors` table with sample data.
// Run this locally (NOT on Render) with:  node seed-doctors.js
//
// Before running, fill in your Aiven connection details in the
// AIVEN CONFIG section below, OR set these as environment variables:
//   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// ====== AIVEN CONFIG — fill these in if not using a .env file ======
const DB_HOST = process.env.DB_HOST || 'mediqueue-divyanshu-82e9.b.aivencloud.com';
const DB_PORT = process.env.DB_PORT || 16105;
const DB_NAME = process.env.DB_NAME || 'defaultdb';
const DB_USER = process.env.DB_USER || 'avnadmin';
const DB_PASS = process.env.DB_PASS || 'PASTE_YOUR_PASSWORD_HERE';
// =====================================================================

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
});

const Doctor = sequelize.define('Doctor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  department: {
    type: DataTypes.ENUM('General', 'ENT', 'Cardiology', 'Orthopedics', 'Pediatrics'),
    allowNull: false,
  },
  room_number: { type: DataTypes.STRING(10), allowNull: true },
  specialization: { type: DataTypes.STRING(100), allowNull: true },
  available_days: { type: DataTypes.STRING(50), defaultValue: 'Mon,Tue,Wed,Thu,Fri' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  photo_url: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'doctors', timestamps: true });

const doctors = [
  // General
  { name: 'Dr. Rajesh Sharma', department: 'General', room_number: 'G-101', specialization: 'General Physician', available_days: 'Mon,Tue,Wed,Thu,Fri' },
  { name: 'Dr. Anjali Verma', department: 'General', room_number: 'G-102', specialization: 'Family Medicine', available_days: 'Mon,Wed,Fri' },
  { name: 'Dr. Suresh Iyer', department: 'General', room_number: 'G-103', specialization: 'Internal Medicine', available_days: 'Tue,Thu,Sat' },
  { name: 'Dr. Priya Nair', department: 'General', room_number: 'G-104', specialization: 'General Physician', available_days: 'Mon,Tue,Wed,Thu,Fri' },
  { name: 'Dr. Ramesh Gupta', department: 'General', room_number: 'G-105', specialization: 'Family Medicine', available_days: 'Mon,Wed,Fri,Sat' },
  { name: 'Dr. Kavita Joshi', department: 'General', room_number: 'G-106', specialization: 'General Physician', available_days: 'Tue,Thu,Sat' },

  // ENT
  { name: 'Dr. Vikram Malhotra', department: 'ENT', room_number: 'E-201', specialization: 'Ear, Nose & Throat', available_days: 'Mon,Tue,Wed,Thu,Fri' },
  { name: 'Dr. Neha Kapoor', department: 'ENT', room_number: 'E-202', specialization: 'Otolaryngology', available_days: 'Mon,Wed,Fri' },
  { name: 'Dr. Arvind Menon', department: 'ENT', room_number: 'E-203', specialization: 'Head & Neck Surgery', available_days: 'Tue,Thu,Sat' },
  { name: 'Dr. Shalini Rao', department: 'ENT', room_number: 'E-204', specialization: 'ENT & Audiology', available_days: 'Mon,Tue,Thu,Fri' },
  { name: 'Dr. Manoj Pillai', department: 'ENT', room_number: 'E-205', specialization: 'Ear, Nose & Throat', available_days: 'Wed,Fri,Sat' },

  // Cardiology
  { name: 'Dr. Ashok Reddy', department: 'Cardiology', room_number: 'C-301', specialization: 'Interventional Cardiology', available_days: 'Mon,Tue,Wed,Thu,Fri' },
  { name: 'Dr. Sunita Bhatia', department: 'Cardiology', room_number: 'C-302', specialization: 'Cardiac Electrophysiology', available_days: 'Mon,Wed,Fri' },
  { name: 'Dr. Manish Chawla', department: 'Cardiology', room_number: 'C-303', specialization: 'Clinical Cardiology', available_days: 'Tue,Thu,Sat' },
  { name: 'Dr. Deepa Krishnan', department: 'Cardiology', room_number: 'C-304', specialization: 'Preventive Cardiology', available_days: 'Mon,Tue,Thu,Fri' },
  { name: 'Dr. Sanjay Bose', department: 'Cardiology', room_number: 'C-305', specialization: 'Interventional Cardiology', available_days: 'Wed,Fri,Sat' },
  { name: 'Dr. Ritu Agarwal', department: 'Cardiology', room_number: 'C-306', specialization: 'Cardiac Surgery', available_days: 'Mon,Wed,Thu' },

  // Orthopedics
  { name: 'Dr. Harish Choudhary', department: 'Orthopedics', room_number: 'O-401', specialization: 'Joint Replacement Surgery', available_days: 'Mon,Tue,Wed,Thu,Fri' },
  { name: 'Dr. Meera Desai', department: 'Orthopedics', room_number: 'O-402', specialization: 'Sports Medicine', available_days: 'Mon,Wed,Fri' },
  { name: 'Dr. Ajay Trivedi', department: 'Orthopedics', room_number: 'O-403', specialization: 'Spine Surgery', available_days: 'Tue,Thu,Sat' },
  { name: 'Dr. Pooja Saxena', department: 'Orthopedics', room_number: 'O-404', specialization: 'Pediatric Orthopedics', available_days: 'Mon,Tue,Thu,Fri' },
  { name: 'Dr. Nikhil Bhatt', department: 'Orthopedics', room_number: 'O-405', specialization: 'Trauma & Fracture Care', available_days: 'Wed,Fri,Sat' },

  // Pediatrics
  { name: 'Dr. Sneha Kulkarni', department: 'Pediatrics', room_number: 'P-501', specialization: 'General Pediatrics', available_days: 'Mon,Tue,Wed,Thu,Fri' },
  { name: 'Dr. Rohit Bansal', department: 'Pediatrics', room_number: 'P-502', specialization: 'Neonatology', available_days: 'Mon,Wed,Fri' },
  { name: 'Dr. Anita Sinha', department: 'Pediatrics', room_number: 'P-503', specialization: 'Pediatric Immunology', available_days: 'Tue,Thu,Sat' },
  { name: 'Dr. Karan Mehta', department: 'Pediatrics', room_number: 'P-504', specialization: 'General Pediatrics', available_days: 'Mon,Tue,Thu,Fri' },
  { name: 'Dr. Lakshmi Pillai', department: 'Pediatrics', room_number: 'P-505', specialization: 'Pediatric Nutrition', available_days: 'Wed,Fri,Sat' },
];

async function run() {
  try {
    console.log('🔌 Connecting to Aiven MySQL...');
    await sequelize.authenticate();
    console.log('✅ Connected.');

    await Doctor.sync(); // creates table if it doesn't exist yet

    console.log(`🌱 Inserting ${doctors.length} doctors...`);
    await Doctor.bulkCreate(doctors);

    console.log('🎉 Done! All doctors added successfully.');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

run();
