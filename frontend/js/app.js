// app.js - JobLens Frontend Application

const API = 'http://localhost:3001/api';

// =================== STATE ===================
let state = {
  user: null,
  token: null,
  currentInterview: null,
  currentQuestions: [],
  currentQuestionIdx: 0,
  answers: {},
  isRecording: false,
  mediaRecorder: null,
  recordingTimer: null,
  recordingSeconds: 0,
  recognition: null
};

// =================== API HELPERS ===================
async function api(path, options = {}) {
  const token = state.token || localStorage.getItem('joblens_token');
  const res = await fetch(API + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: 'include',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return res.json();
}

// =================== TOAST ===================
function toast(msg, type = 'info', duration = 4000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// =================== NAVIGATION ===================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('active');
    page.classList.add('fade-in');
    setTimeout(() => page.classList.remove('fade-in'), 500);
  }
  updateNav();
  window.scrollTo(0, 0);
}

function updateNav() {
  const navPublic = document.getElementById('nav-public');
  const navAuth = document.getElementById('nav-auth');
  const navAdmin = document.getElementById('nav-admin');
  const navUser = document.getElementById('nav-user');

  if (state.user) {
    navPublic.style.display = 'none';
    navAuth.style.display = 'flex';
    navUser.style.display = 'flex';
    navAdmin.style.display = state.user.role === 'admin' ? 'flex' : 'none';
    document.getElementById('nav-username').textContent = state.user.name.split(' ')[0];
    document.getElementById('nav-role-badge').textContent = state.user.role;
    document.getElementById('nav-role-badge').className = `role-badge ${state.user.role}`;
    document.getElementById('nav-avatar-letter').textContent = state.user.name[0].toUpperCase();
  } else {
    navPublic.style.display = 'flex';
    navAuth.style.display = 'none';
    navAdmin.style.display = 'none';
    navUser.style.display = 'none';
  }
}

// =================== AUTH ===================
async function login(email, password, rememberMe = false) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: { email, password, rememberMe }
  });

  if (data.success) {
    state.user = data.user;
    state.token = data.token;
    localStorage.setItem('joblens_token', data.token);
    localStorage.setItem('joblens_user', JSON.stringify(data.user));
    toast('Welcome back, ' + data.user.name + '!', 'success');
    if (data.user.role === 'admin') {
      showPage('page-admin');
      loadAdminDashboard();
    } else {
      showPage('page-dashboard');
      loadCandidateDashboard();
    }
    return true;
  } else {
    const msg = data.errors ? data.errors[0].msg : data.message;
    toast(msg, 'error');
    return false;
  }
}

async function register(name, email, password, confirmPassword) {
  const data = await api('/auth/register', {
    method: 'POST',
    body: { name, email, password, confirmPassword }
  });

  if (data.success) {
    state.user = data.user;
    state.token = data.token;
    localStorage.setItem('joblens_token', data.token);
    localStorage.setItem('joblens_user', JSON.stringify(data.user));
    toast('Account created! Welcome to JobLens.', 'success');
    showPage('page-dashboard');
    loadCandidateDashboard();
    return true;
  } else {
    const msg = data.errors ? data.errors.map(e => e.msg).join(', ') : data.message;
    toast(msg, 'error');
    return false;
  }
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (e) {}
  state.user = null;
  state.token = null;
  localStorage.removeItem('joblens_token');
  localStorage.removeItem('joblens_user');
  toast('Logged out successfully.', 'info');
  showPage('page-home');
}

async function autoLogin() {
  const token = localStorage.getItem('joblens_token');
  const user = localStorage.getItem('joblens_user');
  if (token && user) {
    state.token = token;
    const data = await api('/auth/me');
    if (data.success) {
      state.user = data.user;
      updateNav();
    } else {
      localStorage.removeItem('joblens_token');
      localStorage.removeItem('joblens_user');
    }
  }
}

// =================== VALIDATION ===================
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getPasswordStrength(pass) {
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[@$!%*?&]/.test(pass)) score++;
  const levels = ['', 'weak', 'fair', 'good', 'strong'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return { level: levels[score], label: labels[score], score };
}

function showFieldError(inputId, msg) {
  const input = document.getElementById(inputId);
  const err = document.getElementById(inputId + '-error');
  if (input) input.classList.add('error');
  if (err) { err.textContent = msg; err.classList.add('show'); }
}

function clearFieldError(inputId) {
  const input = document.getElementById(inputId);
  const err = document.getElementById(inputId + '-error');
  if (input) input.classList.remove('error');
  if (err) err.classList.remove('show');
}

function clearAllErrors(prefix) {
  document.querySelectorAll(`[id^="${prefix}"]`).forEach(el => {
    el.classList.remove('error');
    el.classList.remove('show');
  });
}

// =================== LOGIN FORM ===================
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors('login-');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const rememberMe = document.getElementById('login-remember')?.checked || false;
  let valid = true;

  if (!email || !validateEmail(email)) {
    showFieldError('login-email', 'Please enter a valid email address.');
    valid = false;
  }
  if (!password) {
    showFieldError('login-password', 'Password is required.');
    valid = false;
  }
  if (!valid) return;

  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  await login(email, password, rememberMe);
  btn.disabled = false;
  btn.textContent = 'Sign In';
});

// =================== REGISTER FORM ===================
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors('reg-');
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm').value;
  let valid = true;

  if (!name || name.length < 2) { showFieldError('reg-name', 'Name must be at least 2 characters.'); valid = false; }
  if (!email || !validateEmail(email)) { showFieldError('reg-email', 'Please enter a valid email.'); valid = false; }
  if (!password || password.length < 8) { showFieldError('reg-password', 'Password must be at least 8 characters.'); valid = false; }
  if (password !== confirmPassword) { showFieldError('reg-confirm', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true; btn.textContent = 'Creating account...';
  await register(name, email, password, confirmPassword);
  btn.disabled = false; btn.textContent = 'Create Account';
});

// Password strength meter
document.getElementById('reg-password')?.addEventListener('input', function () {
  const { level, label } = getPasswordStrength(this.value);
  const fill = document.getElementById('strength-fill');
  const text = document.getElementById('strength-text');
  if (fill) { fill.className = `strength-fill ${level}`; }
  if (text) text.textContent = label ? `Strength: ${label}` : '';
});

// =================== FORGOT PASSWORD ===================
document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  if (!email || !validateEmail(email)) {
    showFieldError('forgot-email', 'Enter a valid email.');
    return;
  }
  const data = await api('/auth/forgot-password', { method: 'POST', body: { email } });
  if (data.success) {
    toast('Reset link sent! (Demo: Token: ' + (data.resetToken || 'check server') + ')', 'success', 8000);
    showPage('page-login');
  }
});

// Reset password
document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = document.getElementById('reset-token').value.trim();
  const password = document.getElementById('reset-password').value;
  const data = await api('/auth/reset-password', { method: 'POST', body: { token, password } });
  if (data.success) {
    toast('Password reset! Please login.', 'success');
    showPage('page-login');
  } else {
    toast(data.message, 'error');
  }
});

// =================== CANDIDATE DASHBOARD ===================
async function loadCandidateDashboard() {
  const interviewsData = await api('/interviews/my');
  const reportsData = await api('/reports/my');

  const interviews = interviewsData.interviews || [];
  const reports = reportsData.reports || [];
  const completed = interviews.filter(i => i.status === 'completed').length;
  const avgScore = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + r.scores.overall, 0) / reports.length)
    : 0;

  document.getElementById('dash-total-interviews').textContent = interviews.length;
  document.getElementById('dash-completed').textContent = completed;
  document.getElementById('dash-avg-score').textContent = avgScore ? avgScore + '%' : '--';
  document.getElementById('dash-reports').textContent = reports.length;

  // Recent interviews
  const tbody = document.getElementById('recent-interviews-body');
  if (interviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:32px">No interviews yet. Start your first interview!</td></tr>`;
  } else {
    tbody.innerHTML = interviews.slice(-5).reverse().map(i => `
      <tr>
        <td>${i.jobTitle}</td>
        <td>${new Date(i.startedAt).toLocaleDateString()}</td>
        <td><span class="badge badge-${i.status === 'completed' ? 'completed' : 'progress'}">${i.status}</span></td>
        <td>${i.scores ? i.scores.overall + '%' : '--'}</td>
        <td>
          ${i.status === 'completed' && i.reportId
            ? `<button class="btn btn-sm btn-outline" onclick="viewReport('${i.reportId}')">View Report</button>`
            : i.status === 'in-progress'
              ? `<button class="btn btn-sm btn-primary" onclick="resumeInterview('${i.id}')">Resume</button>`
              : '--'}
        </td>
      </tr>
    `).join('');
  }
}

// =================== INTERVIEW SETUP ===================
document.getElementById('interview-setup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.user) { showPage('page-login'); return; }

  const jobTitle = document.getElementById('setup-job').value;
  const experience = document.getElementById('setup-exp').value;
  const techStack = document.getElementById('setup-tech').value;

  const data = await api('/interviews/start', {
    method: 'POST', body: { jobTitle, experience, techStack }
  });

  if (data.success) {
    state.currentInterview = data.interview;
    await loadInterviewQuestions();
    showPage('page-interview');
    startInterview();
  } else {
    toast(data.message, 'error');
  }
});

async function loadInterviewQuestions() {
  const data = await api('/interviews/questions?type=all');
  state.currentQuestions = data.questions || [];
  state.currentQuestionIdx = 0;
  state.answers = {};
}

function startInterview() {
  renderQuestion();
}

function renderQuestion() {
  const total = state.currentQuestions.length;
  const idx = state.currentQuestionIdx;
  const q = state.currentQuestions[idx];

  if (!q) return;

  // Progress
  document.getElementById('q-progress').textContent = `Question ${idx + 1} of ${total}`;
  document.getElementById('q-progress-fill').style.width = `${((idx + 1) / total) * 100}%`;

  // Question meta
  document.getElementById('q-type-badge').textContent = q.category;
  document.getElementById('q-type-badge').className = `q-type ${q.category}`;
  document.getElementById('q-difficulty').textContent = q.difficulty;
  document.getElementById('q-text').textContent = q.question;

  // Show appropriate answer section
  const audioSection = document.getElementById('audio-section');
  const codeSection = document.getElementById('code-section');
  const textSection = document.getElementById('text-section');

  audioSection.style.display = 'none';
  codeSection.style.display = 'none';
  textSection.style.display = 'none';

  if (q.category === 'coding') {
    codeSection.style.display = 'block';
    document.getElementById('code-editor').value = q.starterCode || '// Write your solution here\n';
    document.getElementById('code-output').textContent = '// Output will appear here';
  } else if (q.category === 'behavioral' || q.category === 'technical') {
    audioSection.style.display = 'block';
    // Also allow text fallback
    textSection.style.display = 'block';
    document.getElementById('text-answer').value = state.answers[q.id]?.answer || '';
    document.getElementById('transcript-display').textContent = state.answers[q.id]?.transcript || 'Your transcribed answer will appear here...';
    resetRecorder();
  }

  // Nav buttons
  document.getElementById('btn-prev').disabled = idx === 0;
  document.getElementById('btn-next').textContent = idx === total - 1 ? 'Finish Interview' : 'Next →';
}

// =================== AUDIO RECORDING ===================
function resetRecorder() {
  if (state.recognition) { try { state.recognition.stop(); } catch (e) {} }
  if (state.recordingTimer) clearInterval(state.recordingTimer);
  state.isRecording = false;
  state.recordingSeconds = 0;
  document.getElementById('rec-btn').classList.remove('recording');
  document.getElementById('rec-btn').innerHTML = '🎙️';
  document.getElementById('rec-status').textContent = 'Click to start recording your answer';
  document.getElementById('rec-timer').textContent = '00:00';
}

document.getElementById('rec-btn')?.addEventListener('click', toggleRecording);

function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  state.isRecording = true;
  document.getElementById('rec-btn').classList.add('recording');
  document.getElementById('rec-btn').innerHTML = '⏹️';
  document.getElementById('rec-status').textContent = 'Recording... Speak your answer clearly';
  document.getElementById('transcript-display').textContent = '';

  // Web Speech API for transcription
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.recognition = new SR();
    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.lang = 'en-US';

    let finalTranscript = '';
    state.recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
        else interim = e.results[i][0].transcript;
      }
      document.getElementById('transcript-display').textContent = (finalTranscript + interim) || 'Listening...';
    };

    state.recognition.onerror = () => {
      document.getElementById('rec-status').textContent = 'Speech recognition error. Try typing below.';
    };

    state.recognition.start();
  } else {
    document.getElementById('rec-status').textContent = 'Speech API not supported. Please type your answer below.';
  }

  // Timer
  state.recordingSeconds = 0;
  state.recordingTimer = setInterval(() => {
    state.recordingSeconds++;
    const m = Math.floor(state.recordingSeconds / 60).toString().padStart(2, '0');
    const s = (state.recordingSeconds % 60).toString().padStart(2, '0');
    document.getElementById('rec-timer').textContent = `${m}:${s}`;
    if (state.recordingSeconds >= 180) stopRecording(); // Max 3 min
  }, 1000);
}

function stopRecording() {
  if (!state.isRecording) return;
  state.isRecording = false;
  clearInterval(state.recordingTimer);

  if (state.recognition) { try { state.recognition.stop(); } catch (e) {} }

  document.getElementById('rec-btn').classList.remove('recording');
  document.getElementById('rec-btn').innerHTML = '🎙️';
  document.getElementById('rec-status').textContent = 'Recording saved. You can re-record or continue.';

  const q = state.currentQuestions[state.currentQuestionIdx];
  const transcript = document.getElementById('transcript-display').textContent;
  const textAnswer = document.getElementById('text-answer').value;

  state.answers[q.id] = {
    questionId: q.id,
    answerType: 'verbal',
    transcript: transcript !== 'Your transcribed answer will appear here...' ? transcript : '',
    answer: textAnswer || transcript
  };
}

// Run code button
document.getElementById('btn-run-code')?.addEventListener('click', () => {
  const code = document.getElementById('code-editor').value;
  const output = document.getElementById('code-output');
  try {
    const logs = [];
    const mockConsole = { log: (...args) => logs.push(args.join(' ')) };
    const fn = new Function('console', code);
    fn(mockConsole);
    output.textContent = logs.length > 0 ? logs.join('\n') : '// No output';
    output.style.color = 'var(--green)';
  } catch (err) {
    output.textContent = '// Error: ' + err.message;
    output.style.color = 'var(--red)';
  }
});

// Save code answer
function saveCodeAnswer() {
  const q = state.currentQuestions[state.currentQuestionIdx];
  const code = document.getElementById('code-editor').value;
  state.answers[q.id] = {
    questionId: q.id,
    answerType: 'code',
    code,
    answer: code
  };
}

// Navigation
document.getElementById('btn-next')?.addEventListener('click', async () => {
  const q = state.currentQuestions[state.currentQuestionIdx];

  // Save current answer
  if (q.category === 'coding') {
    saveCodeAnswer();
  } else {
    const transcript = document.getElementById('transcript-display').textContent;
    const textAnswer = document.getElementById('text-answer').value;
    if (!state.answers[q.id]) {
      state.answers[q.id] = {
        questionId: q.id,
        answerType: 'verbal',
        transcript: transcript !== 'Your transcribed answer will appear here...' ? transcript : '',
        answer: textAnswer || transcript
      };
    }
  }

  // Submit to API
  if (state.answers[q.id] && state.currentInterview) {
    await api(`/interviews/${state.currentInterview.id}/answer`, {
      method: 'POST',
      body: state.answers[q.id]
    });
  }

  if (state.currentQuestionIdx === state.currentQuestions.length - 1) {
    // Last question - complete interview
    await finishInterview();
  } else {
    state.currentQuestionIdx++;
    renderQuestion();
    stopRecording();
  }
});

document.getElementById('btn-prev')?.addEventListener('click', () => {
  if (state.currentQuestionIdx > 0) {
    stopRecording();
    state.currentQuestionIdx--;
    renderQuestion();
  }
});

async function finishInterview() {
  if (!state.currentInterview) return;
  showPage('page-loading');
  document.getElementById('loading-msg').textContent = 'Analyzing your responses...';

  setTimeout(async () => {
    const data = await api(`/interviews/${state.currentInterview.id}/complete`, { method: 'POST' });
    if (data.success) {
      toast('Interview complete! Generating your report...', 'success');
      renderReport(data.report);
      showPage('page-report');
    } else {
      toast('Error completing interview.', 'error');
      showPage('page-dashboard');
    }
  }, 2000);
}

// =================== REPORTS ===================
async function viewReport(reportId) {
  const data = await api('/reports/' + reportId);
  if (data.success) {
    renderReport(data.report);
    showPage('page-report');
  } else {
    toast('Could not load report.', 'error');
  }
}

function renderReport(report) {
  document.getElementById('report-candidate').textContent = report.candidateName;
  document.getElementById('report-job').textContent = report.jobTitle;
  document.getElementById('report-date').textContent = new Date(report.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const scores = report.scores;
  document.getElementById('report-overall').textContent = scores.overall + '%';
  document.getElementById('report-grade').textContent = 'Grade ' + scores.grade;
  document.getElementById('report-recommendation').textContent = scores.recommendation;

  const recEl = document.getElementById('report-recommendation');
  recEl.className = 'badge ' + (scores.recommendation === 'Recommended' ? 'badge-active' : scores.recommendation === 'Consider' ? 'badge-progress' : 'badge-inactive');

  // Circular ring
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (scores.overall / 100) * circumference;
  document.getElementById('ring-fill').style.strokeDasharray = circumference;
  document.getElementById('ring-fill').style.strokeDashoffset = offset;
  const color = scores.overall >= 70 ? 'var(--green)' : scores.overall >= 55 ? 'var(--amber)' : 'var(--red)';
  document.getElementById('ring-fill').style.stroke = color;
  document.getElementById('report-overall').style.color = color;

  // Metrics
  const metrics = [
    { key: 'communication', label: 'Communication', val: scores.communication },
    { key: 'technical', label: 'Technical', val: scores.technical },
    { key: 'clarity', label: 'Clarity', val: scores.clarity },
    { key: 'problemSolving', label: 'Problem Solving', val: scores.problemSolving }
  ];

  document.getElementById('report-metrics').innerHTML = metrics.map(m => {
    const c = m.val >= 75 ? 'var(--green)' : m.val >= 55 ? 'var(--amber)' : 'var(--red)';
    return `<div class="metric-card">
      <div class="metric-label">${m.label}</div>
      <div class="metric-score" style="color:${c}">${m.val}%</div>
      <div class="metric-bar"><div class="metric-fill" style="width:${m.val}%;background:${c}"></div></div>
    </div>`;
  }).join('');

  // Strengths & improvements
  document.getElementById('report-strengths').innerHTML = (report.strengths || []).map(s => `<li>✅ ${s}</li>`).join('');
  document.getElementById('report-improvements').innerHTML = (report.improvements || []).map(s => `<li>🎯 ${s}</li>`).join('');
}

// =================== ADMIN DASHBOARD ===================
async function loadAdminDashboard() {
  const statsData = await api('/admin/stats');
  if (statsData.success) {
    const s = statsData.stats;
    document.getElementById('admin-total-users').textContent = s.totalUsers;
    document.getElementById('admin-active-users').textContent = s.activeUsers;
    document.getElementById('admin-total-interviews').textContent = s.totalInterviews;
    document.getElementById('admin-total-reports').textContent = s.totalReports;
  }
  loadAdminUsers();
  loadAdminInterviews();
  loadAdminReports();
}

async function loadAdminReports() {
  const data = await api("/reports");
  const tbody = document.getElementById("admin-reports-body");
  if (!data.success || data.reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px">No reports yet. Candidates must complete interviews first.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.reports.map(r => {
    const color = r.scores.overall>=70?"var(--green)":r.scores.overall>=55?"var(--amber)":"var(--red)";
    return `<tr>
      <td style="color:var(--text);font-weight:600">${r.candidateName}</td>
      <td>${r.jobTitle}</td>
      <td style="color:var(--text3);font-size:0.8rem">${new Date(r.generatedAt).toLocaleDateString()}</td>
      <td><span style="font-family:Space Mono,monospace;font-weight:700;color:${color}">${r.scores.overall}%</span></td>
      <td><span class="badge badge-${r.scores.grade}">${r.scores.grade}</span></td>
      <td><button class="btn btn-sm btn-outline" onclick="viewReport(${JSON.stringify(r.id)})">View</button></td>
    </tr>`;
  }).join("");
}

async function loadAdminUsers() {
  const data = await api('/admin/users');
  if (!data.success) return;

  const tbody = document.getElementById('admin-users-body');
  tbody.innerHTML = data.users.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="nav-avatar" style="width:32px;height:32px;font-size:13px">${u.name[0]}</div>
          <div>
            <div style="font-weight:600;color:var(--text)">${u.name}</div>
            <div style="font-size:0.75rem;color:var(--text3)">${u.email}</div>
          </div>
        </div>
      </td>
      <td><span class="role-badge ${u.role}">${u.role}</span></td>
      <td><span class="badge badge-${u.isActive ? 'active' : 'inactive'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
      <td style="color:var(--text3);font-size:0.8rem">${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <select class="form-control" style="padding:4px 8px;font-size:0.78rem;width:auto" onchange="changeRole('${u.id}', this.value)">
            <option ${u.role === 'candidate' ? 'selected' : ''} value="candidate">Candidate</option>
            <option ${u.role === 'hr' ? 'selected' : ''} value="hr">HR</option>
            <option ${u.role === 'admin' ? 'selected' : ''} value="admin">Admin</option>
          </select>
          <button class="btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'}" onclick="toggleUser('${u.id}')">
            ${u.isActive ? 'Deactivate' : 'Activate'}
          </button>
          ${u.role !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">Delete</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadAdminInterviews() {
  const data = await api('/admin/interviews');
  if (!data.success) return;
  const tbody = document.getElementById('admin-interviews-body');
  if (data.interviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:32px">No interviews yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.interviews.map(i => `
    <tr>
      <td style="color:var(--text)">${i.candidateName}</td>
      <td>${i.jobTitle}</td>
      <td>${new Date(i.startedAt).toLocaleDateString()}</td>
      <td><span class="badge badge-${i.status === 'completed' ? 'completed' : 'progress'}">${i.status}</span></td>
      <td>${i.scores ? `<span class="badge badge-${i.scores.grade}">${i.scores.overall}% (${i.scores.grade})</span>` : '--'}</td>
    </tr>
  `).join('');
}

async function toggleUser(userId) {
  const data = await api(`/admin/users/${userId}/toggle`, { method: 'PATCH' });
  if (data.success) {
    toast(data.message, 'success');
    loadAdminUsers();
    loadAdminDashboard();
  }
}

async function changeRole(userId, role) {
  const data = await api(`/admin/users/${userId}/role`, { method: 'PATCH', body: { role } });
  if (data.success) { toast(data.message, 'success'); loadAdminUsers(); }
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  const data = await api(`/admin/users/${userId}`, { method: 'DELETE' });
  if (data.success) { toast('User deleted.', 'success'); loadAdminUsers(); loadAdminDashboard(); }
}

// Admin sidebar nav
document.querySelectorAll('.admin-nav-item').forEach(item => {
  item.addEventListener('click', function () {
    document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    this.classList.add('active');
    const section = this.dataset.section;
    if (section) document.getElementById('admin-' + section)?.classList.add('active');
  });
});

// =================== CONTACT FORM ===================
document.getElementById('contact-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const subject = document.getElementById('contact-subject').value.trim();
  const message = document.getElementById('contact-message').value.trim();

  if (!name || !email || !message) { toast('Please fill all required fields.', 'error'); return; }
  if (!validateEmail(email)) { toast('Invalid email address.', 'error'); return; }

  toast(`Thank you, ${name}! We'll get back to you at ${email} soon.`, 'success');
  e.target.reset();
});

// =================== GLOBAL BUTTON HANDLERS ===================
window.showPage = showPage;
window.viewReport = viewReport;
window.toggleUser = toggleUser;
window.changeRole = changeRole;
window.deleteUser = deleteUser;
window.logout = logout;
window.loadAdminDashboard = loadAdminDashboard;
window.loadAdminUsers = loadAdminUsers;
window.loadAdminInterviews = loadAdminInterviews;
window.loadCandidateDashboard = loadCandidateDashboard;

window.resumeInterview = function (id) {
  toast('Interview resume feature - starting new interview...', 'info');
  showPage('page-start-interview');
};

// =================== INIT ===================
(async () => {
  await autoLogin();
  showPage('page-home');
})();
// v1.1 - added password strength meter client-side
// breadcrumb navigation support
