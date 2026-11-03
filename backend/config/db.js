const { Pool } = require('pg');

// If a full connection string is provided (e.g. Neon, Render, Supabase, Railway)
const isCloudDb = Boolean(
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes('neon.tech') ||
   process.env.DATABASE_URL.includes('render.com') ||
   process.env.DATABASE_URL.includes('supabase') ||
   process.env.DATABASE_URL.includes('railway') ||
   process.env.NODE_ENV === 'production')
);

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isCloudDb ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
      database: process.env.DB_NAME || 'mentorplug',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool(poolConfig);

module.exports = pool;

