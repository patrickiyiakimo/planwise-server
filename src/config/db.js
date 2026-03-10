// require("dotenv").config();
// const Pool = require("pg").Pool;

// const pool = new Pool({
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   database: process.env.DB_NAME,
// });

// module.exports = pool;

const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

console.log('📊 Attempting to connect to Render PostgreSQL...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render's SSL
  },
  // Increase timeouts for cloud database
  connectionTimeoutMillis: 80000, // 10 seconds (was 2 seconds)
  idleTimeoutMillis: 30000,
  max: 20, // Maximum number of clients in the pool
});

// Handle connection errors
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err.message);
});

// Test connection with async/await instead of callback
const testConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Successfully connected to Render PostgreSQL!');
    console.log(`📅 Server time: ${result.rows[0].current_time}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to database:', err.message);
    
    // Provide helpful error messages
    if (err.message.includes('timeout')) {
      console.error('   ⏰ Connection timeout - Render might be slow to respond');
      console.error('   💡 Try increasing connectionTimeoutMillis in your config');
    } else if (err.message.includes('password')) {
      console.error('   🔑 Password authentication failed - check your DATABASE_URL');
    } else if (err.message.includes('exist')) {
      console.error('   🏢 Database does not exist - check the database name');
    } else if (err.message.includes('SSL')) {
      console.error('   🔒 SSL connection error - make sure ?sslmode=require is in the URL');
    }
    
    return false;
  } finally {
    if (client) client.release();
  }
};

// Run test immediately (but don't block)
testConnection().then(success => {
  if (!success) {
    console.warn('⚠️  Continuing despite connection error - check your database configuration');
  }
});

module.exports = pool;