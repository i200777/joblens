// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name too short'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .matches(/[@$!%*?&]/).withMessage('Password must contain a special character'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Passwords do not match');
    return true;
  })
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// POST /api/auth/register
router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = db.users.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Hash password - NEVER store plain text
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword, // Always stored hashed
      role: 'candidate',
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    db.users.push(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/login
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password, rememberMe } = req.body;

    const user = db.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });
    }

    // Secure hash comparison - never use string equality
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    user.lastLogin = new Date().toISOString();

    const expiresIn = rememberMe ? '7d' : '24h';
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge
    });

    res.json({
      success: true,
      message: 'Login successful!',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email } = req.body;
    const user = db.users.find(u => u.email === email);

    // Always respond success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    }

    // Generate secure token
    const resetToken = uuidv4();
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Remove old tokens for this user
    db.resetTokens = db.resetTokens.filter(t => t.userId !== user.id);
    db.resetTokens.push({ userId: user.id, token: resetToken, expiry });

    // In production: send email. For demo, return token directly
    res.json({
      success: true,
      message: 'Password reset link generated.',
      resetToken, // In prod: send via email, don't expose here
      resetLink: `/reset-password?token=${resetToken}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Must contain uppercase')
    .matches(/[0-9]/).withMessage('Must contain number')
    .matches(/[@$!%*?&]/).withMessage('Must contain special character')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { token, password } = req.body;

    const resetRecord = db.resetTokens.find(t => t.token === token);
    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Invalid reset token.' });
    }

    if (new Date() > new Date(resetRecord.expiry)) {
      db.resetTokens = db.resetTokens.filter(t => t.token !== token);
      return res.status(400).json({ success: false, message: 'Reset token expired. Request a new one.' });
    }

    const user = db.users.find(u => u.id === resetRecord.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Hash new password
    user.password = await bcrypt.hash(password, 12);

    // Invalidate used token
    db.resetTokens = db.resetTokens.filter(t => t.token !== token);

    res.json({ success: true, message: 'Password reset successfully. Please login.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }
  });
});

module.exports = router;
// session expiry handled gracefully
