/* ==========================================================================
   PORTAL CONFIGURATION & GLOBAL UTILITIES (js/config.js)
   ========================================================================== */

const API_BASE = 'https://video-play-api.newstreamcp.workers.dev/api';
const SESSION_KEY = 'video_portal_session';
const GOOGLE_SESSION_KEY = 'google_session';
const STARRED_KEY = 'video_portal_starred';
const WATCHED_KEY = 'video_portal_watched';
const TIMER_START_KEY = 'timer_start';
const STUDENT_NAME_KEY = 'student_display_name';
const RESET_DURATION = 3 * 24 * 60 * 60 * 1000; // 72 Hours

const SECTIONS = ['recorded', 'reasoning', 'quant', 'computer', 'english'];

const SECTION_CONFIG = {
  recorded: {
    id: 'recorded',
    title: 'Mathematics Complete',
    shortName: 'Maths',
    code: 'MATH-101',
    icon: 'fa-calculator',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #4338ca)',
    desc: 'Comprehensive arithmetic, advanced algebra, calculus, and mock sets for 2027.'
  },
  reasoning: {
    id: 'reasoning',
    title: 'Reasoning & Logic Masterclass',
    shortName: 'Reasoning',
    code: 'RSN-201',
    icon: 'fa-brain',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
    desc: 'Verbal & non-verbal analytical reasoning, puzzles, seating arrangements, syllogisms.'
  },
  quant: {
    id: 'quant',
    title: 'Quantitative Aptitude Special',
    shortName: 'Quantitative',
    code: 'QNT-301',
    icon: 'fa-chart-pie',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    desc: 'Data interpretation, speed math techniques, geometry, time & work mastery.'
  },
  computer: {
    id: 'computer',
    title: 'Computer Science & IT Aptitude',
    shortName: 'Computer',
    code: 'CS-401',
    icon: 'fa-laptop-code',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #047857)',
    desc: 'Hardware, networking, DBMS, cybersecurity foundations, and exam-focused MCQs.'
  },
  english: {
    id: 'english',
    title: 'General English & Vocab Vault',
    shortName: 'English',
    code: 'ENG-501',
    icon: 'fa-book-open',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #b45309)',
    desc: 'Grammar rules, daily root-word vocabulary, reading comprehension, and error spotting.'
  },
  starred: {
    id: 'starred',
    title: 'Starred Lectures & Revision Vault',
    shortName: 'Starred',
    code: 'REV-901',
    icon: 'fa-star',
    color: '#eab308',
    gradient: 'linear-gradient(135deg, #eab308, #a16207)',
    desc: 'Your personalized collection of bookmarked high-yield lectures and problem discussions.'
  }
};

// ===== HELPER UTILITIES =====

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
}

function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) return match[2];
  if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

function maskEmailForPrivacy(email) {
  if (!email) return 'Student';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 3) {
    return name + '***@' + domain;
  }
  return name.substring(0, 3) + '***@' + domain;
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) ? 'Mobile' : 'Desktop';
}

function showToast(message, type = 'info') {
  let toastEl = document.getElementById('globalToast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'globalToast';
    toastEl.style.position = 'fixed';
    toastEl.style.top = '24px';
    toastEl.style.left = '50%';
    toastEl.style.transform = 'translateX(-50%)';
    toastEl.style.padding = '10px 22px';
    toastEl.style.borderRadius = '30px';
    toastEl.style.fontSize = '0.88rem';
    toastEl.style.fontWeight = '700';
    toastEl.style.zIndex = '9999';
    toastEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.35)';
    toastEl.style.backdropFilter = 'blur(10px)';
    toastEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    document.body.appendChild(toastEl);
  }

  if (type === 'error') {
    toastEl.style.background = 'rgba(239, 68, 68, 0.95)';
    toastEl.style.color = '#fff';
    toastEl.style.border = '1px solid rgba(255, 255, 255, 0.2)';
  } else if (type === 'success') {
    toastEl.style.background = 'rgba(16, 185, 129, 0.95)';
    toastEl.style.color = '#fff';
    toastEl.style.border = '1px solid rgba(255, 255, 255, 0.2)';
  } else {
    toastEl.style.background = 'rgba(30, 41, 59, 0.95)';
    toastEl.style.color = '#e2e8f0';
    toastEl.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  }

  toastEl.innerHTML = message;
  toastEl.style.opacity = '1';
  toastEl.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(-50%) translateY(-10px)';
  }, 2800);
}

// ===== STARRED & WATCHED STORAGE =====

function getStarred() {
  try { return JSON.parse(localStorage.getItem(STARRED_KEY)) || []; } catch { return []; }
}

function saveStarred(arr) {
  localStorage.setItem(STARRED_KEY, JSON.stringify(arr));
}

function isStarred(chapterId) {
  return getStarred().includes(chapterId);
}

function toggleStarred(chapterId) {
  let starred = getStarred();
  const idx = starred.indexOf(chapterId);
  if (idx > -1) {
    starred.splice(idx, 1);
  } else {
    starred.push(chapterId);
  }
  saveStarred(starred);
  return isStarred(chapterId);
}

function getWatched() {
  try { return JSON.parse(localStorage.getItem(WATCHED_KEY)) || []; } catch { return []; }
}

function saveWatched(arr) {
  localStorage.setItem(WATCHED_KEY, JSON.stringify(arr));
}

function isWatched(chapterId) {
  return getWatched().includes(chapterId);
}

function toggleWatched(chapterId) {
  let watched = getWatched();
  const idx = watched.indexOf(chapterId);
  if (idx > -1) {
    watched.splice(idx, 1);
  } else {
    watched.push(chapterId);
  }
  saveWatched(watched);
  return isWatched(chapterId);
}

// ===== DISPLAY NAME =====

function getStudentDisplayName() {
  let saved = localStorage.getItem(STUDENT_NAME_KEY);
  if (saved && saved.trim()) return saved.trim();
  const googleSession = getGoogleSession();
  if (googleSession && googleSession.user && googleSession.user.name) return googleSession.user.name;
  const session = getSession();
  if (session && session.user && session.user.name) return session.user.name;
  const email = (session && session.user && session.user.email) || (googleSession && googleSession.user && googleSession.user.email);
  if (email) {
    const prefix = email.split('@')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return 'Student';
}

function promptEditDisplayName() {
  const curr = getStudentDisplayName();
  const newName = prompt('Apna chat display name likhein (Enter your name for Study Chat):', curr);
  if (newName && newName.trim()) {
    const trimmed = newName.trim().slice(0, 30);
    localStorage.setItem(STUDENT_NAME_KEY, trimmed);
    showToast('✅ Display name updated: ' + trimmed, 'success');
    return trimmed;
  }
  return curr;
}

// Theme handling (Light / Dark mode)
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  updateThemeButton(saved);
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  const theme = isDark ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  updateThemeButton(theme);
}

function updateThemeButton(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i> Light Mode' : '<i class="fas fa-moon"></i> Dark Mode';
  }
}
