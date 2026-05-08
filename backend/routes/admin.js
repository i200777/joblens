// routes/admin.js
const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const db = require('../db');

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/users - View all users
router.get('/users', (req, res) => {
  const users = db.users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin
  }));
  res.json({ success: true, users, total: users.length });
});

// PATCH /api/admin/users/:id/toggle - Activate/Deactivate user
router.patch('/users/:id/toggle', (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot deactivate admin.' });

  user.isActive = !user.isActive;
  res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, isActive: user.isActive });
});

// PATCH /api/admin/users/:id/role - Change user role
router.patch('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'candidate', 'hr'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role.' });
  }

  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  user.role = role;
  res.json({ success: true, message: `Role updated to ${role}.`, role });
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', (req, res) => {
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'User not found.' });
  if (db.users[idx].role === 'admin') return res.status(403).json({ success: false, message: 'Cannot delete admin.' });

  db.users.splice(idx, 1);
  res.json({ success: true, message: 'User deleted.' });
});

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', (req, res) => {
  const totalUsers = db.users.length;
  const activeUsers = db.users.filter(u => u.isActive).length;
  const totalInterviews = db.interviews.length;
  const completedInterviews = db.interviews.filter(i => i.status === 'completed').length;
  const totalReports = db.reports.length;

  res.json({
    success: true,
    stats: { totalUsers, activeUsers, totalInterviews, completedInterviews, totalReports }
  });
});

// GET /api/admin/interviews - All interviews
router.get('/interviews', (req, res) => {
  const interviews = db.interviews.map(interview => {
    const candidate = db.users.find(u => u.id === interview.candidateId);
    return { ...interview, candidateName: candidate?.name || 'Unknown' };
  });
  res.json({ success: true, interviews });
});

module.exports = router;
// admin interview export placeholder
