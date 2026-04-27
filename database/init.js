require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function init() {
  // Connect without database first to create it
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL');

  // Run schema
  
  // Seed demo users (skip if already exist)
  let schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
// Railway DB use karta hai, CREATE DATABASE aur USE remove karo
schema = schema
  .replace(/CREATE DATABASE.*?;/is, '')
  .replace(/USE.*?;/is, '');
await conn.query(`USE ${process.env.DB_NAME}`);
await conn.query(schema);

  const [existing] = await conn.query('SELECT COUNT(*) as cnt FROM users');
  if (existing[0].cnt > 0) {
    console.log('ℹ️  Users already seeded — skipping');
    await conn.end();
    return;
  }

  const password = await bcrypt.hash('password123', 10);

  const users = [
    [uuidv4(), 'Principal Admin', 'principal@school.com', password, 'principal'],
    [uuidv4(), 'Teacher Alice',   'alice@school.com',     password, 'teacher'],
    [uuidv4(), 'Teacher Bob',     'bob@school.com',       password, 'teacher'],
  ];

  await conn.query(
    'INSERT INTO users (id, name, email, password_hash, role) VALUES ?',
    [users]
  );

  console.log('✅ Demo users seeded:');
  console.log('   principal@school.com  / password123  (role: principal)');
  console.log('   alice@school.com      / password123  (role: teacher)');
  console.log('   bob@school.com        / password123  (role: teacher)');

  await conn.end();
  console.log('\n🎉 Database initialised successfully!');
}

init().catch(err => {
  console.error('❌ Init failed:', err.message);
  process.exit(1);
});
