const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = require('./db');

const initDb = async () => {
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('Executing schema.sql...');
    await pool.query(schemaSql);
    console.log('Database tables created successfully!');
  } catch (error) {
    console.error('Error initializing database:', error.message);
  } finally {
    await pool.end();
  }
};

initDb();
