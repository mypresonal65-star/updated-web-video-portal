/* ==========================================================================
   DASHBOARD CONTROLLER (js/dashboard.js)
   ========================================================================== */

let allSectionPlaylistsCache = null;

// Initialize Dashboard
async function initDashboard() {
  initTheme();
  handleGoogleAuthHash();

  // Check if redirected from a hijacked session
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('hijacked') === '1') {
    const reason = sessionStorage.getItem('hijack_reason') || '⚠️ Aapka account kisi dusre device par login kiya gaya hai. Is device se auto-logout kar diya gaya hai.';
    sessionStorage.removeItem('hijack_reason');
    logout(reason);
    return;
  }

  const logoutReason = sessionStorage.getItem('logout_reason');
  if (logoutReason) {
    sessionStorage.removeItem('logout_reason');
    logout(logoutReason);
    return;
  }

  // Session verification
  if (isLoggedIn()) {
    showDashboardView();
    startSessionValidation();
    startResetTimer();
    startActiveUsersPolling(updateDashboardOnlineCount);
    loadDashboardData();
  } else {
    showLoginView();
  }

  setupDashboardEvents();
  startLiveClock();
}

// Show / Hide Views
function showDashboardView() {
  const loginContainer = document.getElementById('loginContainer');
  const videoContent = document.getElementById('videoContent');
  const headerUserProfile = document.getElementById('headerUserProfile');
  const headerLiveCounter = document.getElementById('headerLiveCounter');
  const floatingChatTrigger = document.getElementById('floatingChatTrigger');
  const navCenterSearch = document.getElementById('navCenterSearch');
  const navLinks = document.getElementById('navLinks');
  const mobileBottomNav = document.getElementById('mobileBottomNav');

  if (loginContainer) loginContainer.style.display = 'none';
  if (videoContent) videoContent.style.display = 'block';
  if (headerUserProfile) headerUserProfile.style.display = 'flex';
  if (headerLiveCounter) headerLiveCounter.style.display = 'flex';
  if (floatingChatTrigger) floatingChatTrigger.style.display = 'flex';
  if (navCenterSearch) navCenterSearch.style.display = 'block';
  if (navLinks) navLinks.style.display = 'flex';
  if (mobileBottomNav) mobileBottomNav.style.display = 'flex';

  // User Profile
  const email = getCurrentUserEmail() || 'Student';
  const name = getStudentDisplayName();
  const emailEl = document.getElementById('userProfileEmail');
  const avatarEl = document.getElementById('userAvatarInitial');
  if (emailEl) emailEl.textContent = maskEmailForPrivacy(email);
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

  updateDashboardProgress();
}

function showLoginView() {
  const loginContainer = document.getElementById('loginContainer');
  const videoContent = document.getElementById('videoContent');
  const headerUserProfile = document.getElementById('headerUserProfile');
  const headerLiveCounter = document.getElementById('headerLiveCounter');
  const floatingChatTrigger = document.getElementById('floatingChatTrigger');
  const navCenterSearch = document.getElementById('navCenterSearch');
  const navLinks = document.getElementById('navLinks');
  const mobileBottomNav = document.getElementById('mobileBottomNav');

  if (loginContainer) loginContainer.style.display = 'block';
  if (videoContent) videoContent.style.display = 'none';
  if (headerUserProfile) headerUserProfile.style.display = 'none';
  if (headerLiveCounter) headerLiveCounter.style.display = 'none';
  if (floatingChatTrigger) floatingChatTrigger.style.display = 'none';
  if (navCenterSearch) navCenterSearch.style.display = 'none';
  if (navLinks) navLinks.style.display = 'none';
  if (mobileBottomNav) mobileBottomNav.style.display = 'none';
}

function updateDashboardOnlineCount(count) {
  const badge = document.getElementById('onlineUserCountText');
  if (badge) badge.textContent = `${count} Online`;
}

// Load curriculum data from API
async function loadDashboardData() {
  try {
    allSectionPlaylistsCache = await fetchAllSectionPlaylists();
    updateDashboardProgress();
  } catch (e) {
    console.error('Failed to load dashboard playlists:', e);
  }
}

// Update Circular Progress Meter & Card Stats
function updateDashboardProgress() {
  const watched = getWatched();
  let totalLectures = 0;

  if (allSectionPlaylistsCache) {
    SECTIONS.forEach(sec => {
      let secTotal = 0;
      let secWatched = 0;
      const playlists = allSectionPlaylistsCache[sec] || [];

      playlists.forEach(p => {
        if (p.chapters) {
          p.chapters.forEach(ch => {
            secTotal++;
            totalLectures++;
            if (ch.id && watched.includes(ch.id)) secWatched++;
          });
        }
      });

      const secPct = secTotal > 0 ? Math.round((secWatched / secTotal) * 100) : 0;
      const cardLectures = document.getElementById(`cardLectures-${sec}`);
      const cardDone = document.getElementById(`cardDone-${sec}`);
      const cardFill = document.getElementById(`cardFill-${sec}`);

      if (cardLectures) cardLectures.textContent = `${secWatched}/${secTotal} Lectures`;
      if (cardDone) cardDone.textContent = `${secPct}% Done`;
      if (cardFill) cardFill.style.width = `${secPct}%`;
    });
  }

  // Starred Revision Card
  const starred = getStarred();
  let starWatched = 0;
  starred.forEach(id => {
    if (watched.includes(id)) starWatched++;
  });
  const starPct = starred.length > 0 ? Math.round((starWatched / starred.length) * 100) : 0;
  const starLectures = document.getElementById('cardLectures-starred');
  const starDone = document.getElementById('cardDone-starred');
  const starFill = document.getElementById('cardFill-starred');

  if (starLectures) starLectures.textContent = `${starWatched}/${starred.length} Saved`;
  if (starDone) starDone.textContent = starred.length > 0 ? `${starPct}% Done` : '0 Saved';
  if (starFill) starFill.style.width = `${starred.length > 0 ? starPct : 0}%`;

  // Circular SVG Meter
  const completed = watched.length;
  const total = totalLectures > 0 ? totalLectures : 474; // Fallback estimate if API loading
  const pct = Math.min(100, Math.round((completed / total) * 100));

  const pctEl = document.getElementById('heroProgressPct');
  const countEl = document.getElementById('heroProgressLectures');
  const meterCircle = document.getElementById('heroProgressMeter');

  if (pctEl) pctEl.textContent = `${pct}%`;
  if (countEl) countEl.textContent = `${completed}/${total} Lectures`;
  if (meterCircle) {
    const circumference = 314.16; // 2 * PI * 50
    const offset = circumference - (circumference * pct) / 100;
    meterCircle.style.strokeDashoffset = offset;
  }
}

// Live Countdown Clock (Next Scheduled Session at 06:00 PM)
function startLiveClock() {
  function tick() {
    const now = new Date();
    let target = new Date();
    target.setHours(18, 0, 0, 0); // 6:00 PM today

    if (now > target) {
      // If passed, set for tomorrow 6:00 PM
      target.setDate(target.getDate() + 1);
    }

    const diff = target - now;
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    const clockEl = document.getElementById('liveBroadcastCountdown');
    if (clockEl) {
      clockEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  tick();
  setInterval(tick, 1000);
}

// Event Bindings
function setupDashboardEvents() {
  // Login Form
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail')?.value.trim();
      const key = document.getElementById('loginKey')?.value.trim();
      const errEl = document.getElementById('loginError');
      const succEl = document.getElementById('loginSuccess');

      if (errEl) errEl.style.display = 'none';
      if (succEl) succEl.style.display = 'none';

      loginBtn.disabled = true;
      loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';

      const result = await loginWithCredentials(email, key);
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Sign In to Portal <i class="fas fa-arrow-right"></i>';

      if (result.success) {
        if (succEl) {
          succEl.textContent = '✅ Login successful! Loading portal...';
          succEl.style.display = 'block';
        }
        setTimeout(() => {
          showDashboardView();
          loadDashboardData();
        }, 600);
      } else {
        if (errEl) {
          errEl.textContent = '❌ ' + (result.error || 'Login failed');
          errEl.style.display = 'block';
        }
      }
    });
  }

  // Key Generator
  const genKeyBtn = document.getElementById('genKeyBtn');
  if (genKeyBtn) {
    genKeyBtn.addEventListener('click', async () => {
      const email = document.getElementById('genKeyEmail')?.value.trim();
      const statusEl = document.getElementById('genKeyStatus');
      if (!statusEl) return;

      if (!email) {
        statusEl.innerHTML = '⚠️ Please enter your email address.';
        statusEl.className = 'key-gen-status error';
        return;
      }

      statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating key...';
      statusEl.className = 'key-gen-status info';

      try {
        const data = await generateStudentKey(email);
        if (data.success) {
          statusEl.innerHTML = `✅ Key generated: <strong>${data.key}</strong> (Copied to clipboard!)<br><span style="font-size:0.75rem;">⏱️ Valid for 1 hour. Remaining today: ${data.remaining_today || 3}</span>`;
          statusEl.className = 'key-gen-status success';
          if (navigator.clipboard) navigator.clipboard.writeText(data.key);
          const loginKeyInput = document.getElementById('loginKey');
          if (loginKeyInput) loginKeyInput.value = data.key;
          const loginEmailInput = document.getElementById('loginEmail');
          if (loginEmailInput) loginEmailInput.value = email;
        } else {
          statusEl.innerHTML = `❌ ${data.error || 'Failed to generate key'}`;
          statusEl.className = 'key-gen-status error';
        }
      } catch (err) {
        statusEl.innerHTML = `❌ ${err.message}`;
        statusEl.className = 'key-gen-status error';
      }
    });
  }

  // Logout Button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logout());
  }

  // Theme Toggle Button
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Global Search Input with Ctrl+K shortcut
  const globalSearch = document.getElementById('globalHeaderSearch');
  if (globalSearch) {
    globalSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = globalSearch.value.trim();
        if (q) {
          if (q.toLowerCase().includes('live')) {
            window.location.href = 'live.html';
          } else {
            window.location.href = `subject.html?sec=recorded&q=${encodeURIComponent(q)}`;
          }
        }
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (globalSearch) globalSearch.focus();
    }
  });

  // Curriculum Cards Click Navigation -> Dedicated subject.html or live.html
  document.querySelectorAll('.curriculum-card').forEach(card => {
    card.addEventListener('click', function(e) {
      // If clicked on action button, prevent double fire
      const section = this.dataset.section;
      if (section === 'live') {
        window.location.href = 'live.html';
      } else if (section) {
        window.location.href = `subject.html?sec=${section}`;
      }
    });
  });

  // Dedicated Live Studio Button
  const liveStudioBtn = document.getElementById('enterLiveStudioBtn');
  if (liveStudioBtn) {
    liveStudioBtn.addEventListener('click', () => {
      window.location.href = 'live.html';
    });
  }

  // Dismiss Notice Banner
  const dismissNoticeBtn = document.getElementById('dismissNoticeBtn');
  if (dismissNoticeBtn) {
    dismissNoticeBtn.addEventListener('click', () => {
      const banner = document.getElementById('noticeBanner');
      if (banner) banner.style.display = 'none';
    });
  }
}

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', initDashboard);
