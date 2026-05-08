// routes/interviews.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

router.use(authenticate);

// Interview questions bank
const questionBank = {
  technical: [
    { id: 'q1', question: 'Explain the difference between synchronous and asynchronous programming.', category: 'technical', difficulty: 'medium' },
    { id: 'q2', question: 'What is the time complexity of binary search and why?', category: 'technical', difficulty: 'medium' },
    { id: 'q3', question: 'Describe the concept of RESTful APIs and their key principles.', category: 'technical', difficulty: 'medium' },
    { id: 'q4', question: 'What are the SOLID principles in software engineering?', category: 'technical', difficulty: 'hard' },
    { id: 'q5', question: 'Explain how garbage collection works in modern languages.', category: 'technical', difficulty: 'hard' }
  ],
  behavioral: [
    { id: 'q6', question: 'Tell me about a challenging project you worked on and how you overcame obstacles.', category: 'behavioral', difficulty: 'medium' },
    { id: 'q7', question: 'Describe a time when you had to collaborate with a difficult team member.', category: 'behavioral', difficulty: 'medium' },
    { id: 'q8', question: 'How do you prioritize tasks when working on multiple deadlines?', category: 'behavioral', difficulty: 'easy' }
  ],
  coding: [
    { id: 'c1', question: 'Write a function to reverse a string without using built-in reverse methods.', category: 'coding', difficulty: 'easy', starterCode: 'function reverseString(str) {\n  // Write your solution here\n  \n}' },
    { id: 'c2', question: 'Implement a function to check if a number is prime.', category: 'coding', difficulty: 'easy', starterCode: 'function isPrime(n) {\n  // Write your solution here\n  \n}' },
    { id: 'c3', question: 'Write a function to find the two numbers in an array that add up to a target sum.', category: 'coding', difficulty: 'medium', starterCode: 'function twoSum(nums, target) {\n  // Write your solution here\n  // Return [index1, index2]\n  \n}' },
    { id: 'c4', question: 'Implement a stack data structure using an array with push, pop, peek, and isEmpty methods.', category: 'coding', difficulty: 'medium', starterCode: 'class Stack {\n  constructor() {\n    // Initialize your stack\n  }\n  push(item) { }\n  pop() { }\n  peek() { }\n  isEmpty() { }\n}' }
  ]
};

// GET /api/interviews/questions - Get interview questions
router.get('/questions', (req, res) => {
  const { type = 'all' } = req.query;
  let questions = [];

  if (type === 'all') {
    questions = [...questionBank.technical.slice(0, 2), ...questionBank.behavioral.slice(0, 2), ...questionBank.coding.slice(0, 1)];
  } else if (questionBank[type]) {
    questions = questionBank[type];
  }

  res.json({ success: true, questions });
});

// POST /api/interviews/start - Start an interview session
router.post('/start', (req, res) => {
  const { jobTitle, experience, techStack } = req.body;

  const interview = {
    id: uuidv4(),
    candidateId: req.user.id,
    candidateName: req.user.name,
    jobTitle: jobTitle || 'Software Engineer',
    experience: experience || '0-2 years',
    techStack: techStack || 'General',
    status: 'in-progress',
    startedAt: new Date().toISOString(),
    completedAt: null,
    answers: [],
    scores: null
  };

  db.interviews.push(interview);
  res.json({ success: true, interviewId: interview.id, interview });
});

// POST /api/interviews/:id/answer - Submit an answer
router.post('/:id/answer', (req, res) => {
  const interview = db.interviews.find(i => i.id === req.params.id);
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found.' });
  if (interview.candidateId !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied.' });

  const { questionId, answer, answerType, transcript, code } = req.body;

  // Check if answer already exists for this question
  const existingIdx = interview.answers.findIndex(a => a.questionId === questionId);

  const answerObj = {
    questionId,
    answer: answer || '',
    answerType: answerType || 'text',
    transcript: transcript || '',
    code: code || '',
    submittedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    interview.answers[existingIdx] = answerObj;
  } else {
    interview.answers.push(answerObj);
  }

  res.json({ success: true, message: 'Answer saved.' });
});

// POST /api/interviews/:id/complete - Complete interview & generate score
router.post('/:id/complete', (req, res) => {
  const interview = db.interviews.find(i => i.id === req.params.id);
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found.' });
  if (interview.candidateId !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied.' });

  interview.status = 'completed';
  interview.completedAt = new Date().toISOString();

  // Rubric-based scoring simulation
  const technicalAnswers = interview.answers.filter(a => a.answerType === 'verbal');
  const codingAnswers = interview.answers.filter(a => a.answerType === 'code');

  // Score each dimension (simulated AI scoring)
  const communicationScore = Math.min(100, 60 + Math.random() * 35 + (technicalAnswers.length * 5));
  const technicalScore = Math.min(100, 55 + Math.random() * 40 + (codingAnswers.length * 8));
  const clarityScore = Math.min(100, 58 + Math.random() * 37);
  const problemSolvingScore = Math.min(100, 50 + Math.random() * 45 + (codingAnswers.length * 5));
  const overallScore = (communicationScore + technicalScore + clarityScore + problemSolvingScore) / 4;

  interview.scores = {
    communication: Math.round(communicationScore),
    technical: Math.round(technicalScore),
    clarity: Math.round(clarityScore),
    problemSolving: Math.round(problemSolvingScore),
    overall: Math.round(overallScore),
    grade: overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : 'D',
    recommendation: overallScore >= 70 ? 'Recommended' : overallScore >= 55 ? 'Consider' : 'Not Recommended'
  };

  // Generate report
  const report = {
    id: uuidv4(),
    interviewId: interview.id,
    candidateId: req.user.id,
    candidateName: req.user.name,
    jobTitle: interview.jobTitle,
    scores: interview.scores,
    strengths: generateStrengths(interview.scores),
    improvements: generateImprovements(interview.scores),
    generatedAt: new Date().toISOString()
  };

  db.reports.push(report);
  interview.reportId = report.id;

  res.json({ success: true, interview, report });
});

// GET /api/interviews/my - Get my interviews
router.get('/my', (req, res) => {
  const interviews = db.interviews
    .filter(i => i.candidateId === req.user.id)
    .map(i => ({ ...i, password: undefined }));
  res.json({ success: true, interviews });
});

// GET /api/interviews/:id - Get single interview
router.get('/:id', (req, res) => {
  const interview = db.interviews.find(i => i.id === req.params.id);
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found.' });
  if (interview.candidateId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  res.json({ success: true, interview });
});

function generateStrengths(scores) {
  const strengths = [];
  if (scores.communication >= 75) strengths.push('Strong verbal communication and articulation skills');
  if (scores.technical >= 75) strengths.push('Solid technical knowledge and domain expertise');
  if (scores.clarity >= 75) strengths.push('Clear and structured thought process');
  if (scores.problemSolving >= 75) strengths.push('Effective problem-solving approach');
  if (strengths.length === 0) strengths.push('Shows potential and willingness to learn');
  return strengths;
}

function generateImprovements(scores) {
  const improvements = [];
  if (scores.communication < 75) improvements.push('Practice structured verbal communication (STAR method)');
  if (scores.technical < 75) improvements.push('Deepen technical fundamentals and data structures knowledge');
  if (scores.clarity < 75) improvements.push('Work on organizing thoughts before responding');
  if (scores.problemSolving < 75) improvements.push('Practice algorithmic thinking and coding challenges');
  if (improvements.length === 0) improvements.push('Continue building on existing strengths');
  return improvements;
}

module.exports = router;
