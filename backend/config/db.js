// config/db.js
// Sequelize MySQL connection configuration

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'hospital_queue_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false, // Set to console.log to see SQL queries
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      // Recycle idle connections BEFORE Railway's proxy has a chance to
      // silently kill them — this is what causes "Connection lost: The
      // server closed the connection" crash loops on Railway MySQL.
      idle: 20000,
      evict: 15000,
    },
    dialectOptions: {
      // Keeps the underlying TCP socket active so the DB host's connection
      // proxy doesn't treat it as idle and close it from its side.
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 20000,
      // Set DB_SSL=true in your environment variables for hosts that
      // require SSL (e.g. Aiven). Leave unset/false for plain local MySQL.
      ...(process.env.DB_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {}),
    },
    retry: {
      max: 3, // retry a query up to 3 times if it fails on a stale connection
    },
    define: {
      timestamps: true,
      underscored: false,
    },
  }
);

// Test the connection, with a few retries — a single transient network
// hiccup on startup shouldn't take the whole app down and crash-loop it.
const connectDB = async (retries = 5, delayMs = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sequelize.authenticate();
      console.log('✅ MySQL connected via Sequelize');
      return;
    } catch (error) {
      console.error(`❌ DB Connection Error (attempt ${attempt}/${retries}):`, error.message);
      if (attempt === retries) {
        console.error('❌ Could not connect to the database after multiple attempts. Exiting.');
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

// If a query fails mid-flight because the pool handed out a connection
// Railway had already closed, log it clearly instead of crashing the
// whole process — Sequelize's pool will discard and replace it on the
// next request.
sequelize.connectionManager.on?.('error', (err) => {
  console.error('⚠️  MySQL pool connection error (will retry on next request):', err.message);
});

module.exports = { sequelize, connectDB };
