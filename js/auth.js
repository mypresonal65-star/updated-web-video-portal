/* ==========================================================================
   AUTHENTICATION & SINGLE-DEVICE SESSION ENGINE (js/auth.js)
   ========================================================================== */

let currentUser = null;
let sessionValidationInterval = null;
let resetCheckInterval = null;
let isHijacked = false;

// ===== SESSION STORAGE =====

function generateSessionId() {
  return 'sid_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8) + '_' + Math.random().toString(36).substring(2, 6);
}

function saveSession(user, key, sessionId) {
  const session = {
    user,
    key,
    sessionId: sessionId || generateSessionId(),
    loginTime: Date.now(),
    device: getDeviceInfo()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  currentUser = user;
  return session;
}

function getSession() {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  if (sessionValidationInterval) {
    clearInterval(sessionValidationInterval);
    sessionValidationInterval = null;
  }
}

function getGoogleSession() {
  try {
    const data = localStorage.getItem(GOOGLE_SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveGoogleSession(user, accessToken) {
  const data = {
    user,
    accessToken,
    loginTime: Date.now()
  };
  localStorage.setItem(GOOGLE_SESSION_KEY, JSON.stringify(data));
}

function checkGoogleSession() {
  const session = getGoogleSession();
  if (!session) return false;
  // 7 Days expiration for Google access tokens
  if (Date.now() - session.loginTime > 7 * 24 * 60 * 60 * 1000) {
    localStorage.removeItem(GOOGLE_SESSION_KEY);
    return false;
  }
  return true;
}

function isLoggedIn() {
  const session = getSession();
  if (session && session.user) return true;
  return checkGoogleSession();
}

function getCurrentUserEmail() {
  const session = getSession();
  if (session && session.user && session.user.email) return session.user.email;
  const googleSession = getGoogleSession();
  if (googleSession && googleSession.user && googleSession.user.email) return googleSession.user.email;
  return null;
}

// ===== OFFLINE BEACON =====

function sendOfflineSignal() {
  try {
    const email = getCurrentUserEmail();
    const session = getSession();
    if (email) {
      const payload = JSON.stringify({
        email: email,
        sessionId: session ? session.sessionId : undefined
      });
      const url = API_BASE + '/session/offline';
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true
        }).catch(() => {});
      }
    }
  } catch (e) {}
}

window.addEventListener('beforeunload', sendOfflineSignal);

// ===== SINGLE-DEVICE VALIDATION (5-SECOND POLLING) =====

async function validateSession() {
  const session = getSession();
  if (!session || !session.user) {
    return false;
  }

  try {
    const response = await fetch(API_BASE + '/session/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        email: session.user.email,
        name: getStudentDisplayName(),
        device: session.device || 'Unknown'
      })
    });

    if (!response.ok) {
      // Offline or server hiccup -> Keep user logged in
      return true;
    }

    const data = await response.json();

    // Trigger auto-logout when user logs in from another device or session is superseded
    if (data.valid === false || data.hijacked === true || data.loggedOutByOtherDevice === true) {
      isHijacked = true;
      const reasonMsg = data.reason || '⚠️ Aapka account kisi dusre device par login kiya gaya hai. Is device se auto-logout kar diya gaya hai.';
      clearSession();
      localStorage.removeItem(GOOGLE_SESSION_KEY);
      
      // Stop any media players
      if (typeof window.disposePlayer === 'function') window.disposePlayer();

      // Check if we are on secondary page
      const currentPath = window.location.pathname;
      if (currentPath.includes('live.html') || currentPath.includes('subject.html')) {
        sessionStorage.setItem('hijack_reason', reasonMsg);
        window.location.href = 'index.html?hijacked=1';
        return false;
      }

      logout(reasonMsg);
      return false;
    }
    return true;
  } catch (e) {
    // Offline -> graceful continuation
    return true;
  }
}

function startSessionValidation() {
  if (sessionValidationInterval) clearInterval(sessionValidationInterval);
  
  // Fast initial check after 800ms
  setTimeout(() => {
    if (isLoggedIn() && !isHijacked) validateSession();
  }, 800);

  // Responsive polling check every 5 seconds for rapid single-device enforcement
  sessionValidationInterval = setInterval(() => {
    if (isLoggedIn() && !isHijacked) validateSession();
  }, 5000);
}

// ===== 72-HOUR RESET TIMER =====

function startResetTimer(onExpire) {
  if (resetCheckInterval) clearInterval(resetCheckInterval);
  let savedStart = localStorage.getItem(TIMER_START_KEY);
  if (!savedStart) {
    savedStart = Date.now().toString();
    localStorage.setItem(TIMER_START_KEY, savedStart);
  }
  const timerStartTime = parseInt(savedStart);

  function updateTimerUI() {
    const elapsed = Date.now() - timerStartTime;
    const timeLeft = Math.max(0, RESET_DURATION - elapsed);
    const timerEl = document.getElementById('sessionTimer');
    if (timerEl) {
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
      timerEl.textContent = `⏰ ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      timerEl.className = 'session-timer-pill' + (timeLeft < 60 * 60 * 1000 ? ' danger' : timeLeft < 3 * 60 * 60 * 1000 ? ' warning' : '');
    }

    if (timeLeft <= 0) {
      localStorage.removeItem(TIMER_START_KEY);
      clearSession();
      if (typeof onExpire === 'function') onExpire();
      else logout('⌛ 72 Hours session period expired. Please sign in again.');
    }
  }

  updateTimerUI();
  resetCheckInterval = setInterval(updateTimerUI, 1000);
}

// ===== AUTH ACTIONS =====

async function loginWithCredentials(email, key) {
  if (!email) {
    return { success: false, error: 'Please enter your student email' };
  }

  try {
    const sessionId = generateSessionId();
    const device = getDeviceInfo();
    const response = await fetch(API_BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: getStudentDisplayName(),
        key: key || '',
        sessionId,
        device
      })
    });

    const data = await response.json();
    if (data.success) {
      const actualSessionId = data.sessionId || sessionId;
      saveSession(data.user, key, actualSessionId);
      if (!localStorage.getItem(TIMER_START_KEY)) {
        localStorage.setItem(TIMER_START_KEY, Date.now().toString());
      }
      isHijacked = false;
      startSessionValidation();
      return { success: true, user: data.user, sessionId: actualSessionId };
    } else {
      let errMsg = data.error || 'Login failed';
      if (errMsg.includes('already logged in')) {
        errMsg = '❌ You are already logged in on another device.';
      }
      return { success: false, error: errMsg };
    }
  } catch (err) {
    return { success: false, error: 'Connection error: ' + err.message };
  }
}

async function logout(reasonMessage) {
  sendOfflineSignal();
  const session = getSession();
  if (session && session.user && !isHijacked) {
    try {
      await fetch(API_BASE + '/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          email: session.user.email
        })
      });
    } catch(e) {}
  }

  clearSession();
  localStorage.removeItem(GOOGLE_SESSION_KEY);
  if (resetCheckInterval) {
    clearInterval(resetCheckInterval);
    resetCheckInterval = null;
  }

  // If on another page, redirect to index.html
  const currentPath = window.location.pathname;
  if (currentPath.includes('live.html') || currentPath.includes('subject.html')) {
    if (reasonMessage) sessionStorage.setItem('logout_reason', reasonMessage);
    window.location.href = 'index.html';
    return;
  }

  // Update UI on index.html
  const loginContainer = document.getElementById('loginContainer');
  const videoContent = document.getElementById('videoContent');
  const userProfile = document.getElementById('headerUserProfile');
  const liveCounter = document.getElementById('headerLiveCounter');

  if (loginContainer) loginContainer.style.display = 'block';
  if (videoContent) videoContent.style.display = 'none';
  if (userProfile) userProfile.style.display = 'none';
  if (liveCounter) liveCounter.style.display = 'none';

  const loginError = document.getElementById('loginError');
  if (loginError) {
    if (reasonMessage) {
      loginError.innerHTML = `<strong>${reasonMessage}</strong>`;
      loginError.style.display = 'block';
    } else {
      loginError.textContent = '';
      loginError.style.display = 'none';
    }
  }

  const hijackNotification = document.getElementById('hijackNotification');
  if (hijackNotification && reasonMessage) {
    hijackNotification.textContent = reasonMessage;
    hijackNotification.classList.add('show');
    setTimeout(() => hijackNotification.classList.remove('show'), 7000);
  }

  if (typeof window.disposePlayer === 'function') window.disposePlayer();
}

// Google OAuth Token Fragment Handler (runs on load if #access_token is in URL)
function handleGoogleAuthHash() {
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const user = {
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          id: payload.sub
        };
        saveGoogleSession(user, token);
        window.history.replaceState(null, null, window.location.pathname);
        showToast('✅ Google Sign-In successful!', 'success');
        return true;
      } catch (e) {
        console.error('Google token decode error:', e);
      }
    }
  }
  return false;
}
