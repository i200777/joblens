// db.js - In-memory database (simulates MongoDB/SQL)
// In production, replace with real DB (MongoDB, PostgreSQL, etc.)

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const db = {
  users: [],
  interviews: [],
  reports: [],
  resetTokens: []
};

// Seed admin user
async function seedAdmin() {
  const hashedPassword = await bcrypt.hash('Admin@123', 12);
  db.users.push({
    id: uuidv4(),
    name: 'Admin User',
    email: 'admin@joblens.ai',
    password: hashedPassword,
    role: 'admin',
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLogin: null
  });

  const hashedPassword2 = await bcrypt.hash('User@123', 12);
  db.users.push({
    id: uuidv4(),
    name: 'John Doe',
    email: 'john@example.com',
    password: hashedPassword2,
    role: 'candidate',
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLogin: null
  });

  console.log('✅ Database seeded with admin and sample user');
}

seedAdmin();

module.exports = db;
