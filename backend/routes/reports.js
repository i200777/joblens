// routes/reports.js
const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const db = require('../db');

router.use(authenticate);

// GET /api/reports/my - Get my reports
router.get('/my', (req, res) => {
  const reports = db.reports.filter(r => r.candidateId === req.user.id);
  res.json({ success: true, reports });
});

// GET /api/reports/:id - Get single report
router.get('/:id', (req, res) => {
  const report = db.reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
  if (report.candidateId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  res.json({ success: true, report });
});

// GET /api/reports - Admin: get all reports
router.get('/', requireAdmin, (req, res) => {
  res.json({ success: true, reports: db.reports });
});

module.exports = router;
