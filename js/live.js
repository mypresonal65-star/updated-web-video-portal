/* ==========================================================================
   LIVE BROADCAST STUDIO CONTROLLER (js/live.js)
   ========================================================================== */

let currentLiveItems = [];
let activeStreamId = null;

async function initLiveStudio() {
  initTheme();
  
  // Must be logged in to view live studio
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  startSessionValidation();
  startResetTimer();
  startActiveUsersPolling(updateLiveStudioOnlineCount);

  const email = getCurrentUserEmail() || 'Student';
  const name = getStudentDisplayName();
  const emailEl = document.getElementById('userProfileEmail');
  const avatarEl = document.getElementById('userAvatarInitial');
  if (emailEl) emailEl.textContent = maskEmailForPrivacy(email);
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

  setupLiveStudioEvents();
  await loadLiveBroadcastData();
}

function updateLiveStudioOnlineCount(count) {
  const badge = document.getElementById('onlineUserCountText');
  const liveViewersCount = document.getElementById('liveViewersCount');
  if (badge) badge.textContent = `${count} Online`;
  if (liveViewersCount) liveViewersCount.textContent = count;
}

// Fetch live classes from API
async function loadLiveBroadcastData() {
  const stage = document.getElementById('liveCinemaStage');
  const scheduleList = document.getElementById('liveScheduleList');
  const liveGrid = document.getElementById('liveLecturesGrid');
  const totalCountChip = document.getElementById('liveLecturesTotalCount');
  const liveTitle = document.getElementById('activeLiveTitle');
  const liveSubtitle = document.getElementById('activeLiveSubtitle');

  try {
    currentLiveItems = await fetchImportantClasses();

    if (Array.isArray(currentLiveItems) && currentLiveItems.length > 0) {
      if (totalCountChip) totalCountChip.textContent = `${currentLiveItems.length} Live Masterclasses`;
      
      // Check if URL specified a specific live stream ID (?id=...)
      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get('id');
      let targetStream = currentLiveItems[0];
      if (targetId) {
        const found = currentLiveItems.find(s => s.id == targetId);
        if (found) targetStream = found;
      }

      activeStreamId = targetStream.id;

      if (liveTitle) liveTitle.textContent = targetStream.title || 'Live Interactive Class';
      if (liveSubtitle) liveSubtitle.textContent = 'Streaming in High Definition • Interactive Classroom & Q&A';

      // Load cinema player
      if (stage) {
        loadVideoIntoContainer(stage, targetStream.link, `live-${targetStream.id}`, targetStream.title);
      }

      // Render the Full Live Lectures Library Grid
      renderLiveGrid(currentLiveItems);

      // Render sidebar quick list
      if (scheduleList) {
        scheduleList.innerHTML = '';
        currentLiveItems.forEach((stream, idx) => {
          const item = document.createElement('div');
          item.className = `live-schedule-item ${stream.id === activeStreamId ? 'active' : ''}`;
          item.dataset.streamId = stream.id;
          item.innerHTML = `
            <div class="sched-thumb"><i class="fas fa-play"></i></div>
            <div class="sched-info">
              <div class="sched-title">${stream.title}</div>
              <div class="sched-time"><i class="fas fa-broadcast-tower" style="color:#ef4444;"></i> Session ${idx + 1}</div>
            </div>
          `;
          item.addEventListener('click', () => {
            selectAndPlayLiveLecture(stream);
          });
          scheduleList.appendChild(item);
        });
      }
    } else {
      // No live stream right now
      if (totalCountChip) totalCountChip.textContent = '0 Available';
      if (liveTitle) liveTitle.textContent = 'Live Broadcast Studio (Standby)';
      if (liveSubtitle) liveSubtitle.textContent = 'No ongoing live lecture at this moment. Scheduled sessions appear below.';
      
      if (stage) {
        stage.innerHTML = `
          <div class="live-no-stream">
            <div class="live-no-stream-icon">
              <i class="fas fa-satellite-dish"></i>
            </div>
            <h3>Broadcast Studio is on Standby</h3>
            <p>Our educators are preparing for the next scheduled live session. Meanwhile, you can review subject modules or chat with classmates.</p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <a href="index.html" class="btn-live-dash" style="padding: 10px 20px; border-radius: var(--radius-full); background: var(--brand-primary); color: #fff; text-decoration: none; font-weight: 700; font-size: 0.88rem;">
                <i class="fas fa-arrow-left"></i> Return to Dashboard
              </a>
              <button onclick="toggleStudyChat()" style="padding: 10px 20px; border-radius: var(--radius-full); background: var(--bg-surface-elevated); color: var(--text-primary); border: 1px solid var(--border-light); font-weight: 700; font-size: 0.88rem; cursor: pointer;">
                <i class="fas fa-comments"></i> Open Study Chat
              </button>
            </div>
          </div>
        `;
      }

      if (liveGrid) {
        liveGrid.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: 1 / -1;">
            <i class="fas fa-calendar-times fa-2x" style="margin-bottom: 10px; color: #ef4444;"></i>
            <p>No recorded live classes available right now. Please check back during scheduled class hours.</p>
          </div>
        `;
      }

      if (scheduleList) {
        scheduleList.innerHTML = `
          <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">
            <p>Next class scheduled at <strong>06:00 PM IST</strong>.</p>
          </div>
        `;
      }
    }
  } catch (e) {
    console.error('Error in Live Studio:', e);
    if (liveGrid) {
      liveGrid.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: 1 / -1;">
          <p>⚠️ Failed to load live lectures. Please refresh the page.</p>
        </div>
      `;
    }
  }
}

// Render the full grid of Live Lecture Cards
function renderLiveGrid(streams, searchFilter = '') {
  const liveGrid = document.getElementById('liveLecturesGrid');
  if (!liveGrid) return;

  let filtered = streams;
  if (searchFilter && searchFilter.trim()) {
    const q = searchFilter.trim().toLowerCase();
    filtered = streams.filter(s => s.title.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    liveGrid.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: 1 / -1;">
        <i class="fas fa-search fa-2x" style="margin-bottom: 10px; color: var(--brand-primary);"></i>
        <p>No live classes matching "${searchFilter}"</p>
      </div>
    `;
    return;
  }

  liveGrid.innerHTML = '';

  filtered.forEach((stream, idx) => {
    const isCurrentActive = stream.id === activeStreamId;
    const card = document.createElement('div');
    card.className = `live-lecture-card ${isCurrentActive ? 'active-stream' : ''}`;
    card.dataset.streamId = stream.id;

    card.innerHTML = `
      <div class="live-card-thumb">
        <span class="live-card-tag"><i class="fas fa-circle"></i> LIVE SESSION #${idx + 1}</span>
        <button class="live-card-play-btn" title="Play Lecture"><i class="fas fa-play"></i></button>
      </div>
      <div class="live-card-content">
        <h3 class="live-card-title">${stream.title}</h3>
        <div class="live-card-meta">
          <span><i class="fas fa-broadcast-tower" style="color: #ef4444;"></i> Live Stage</span>
          <span><i class="fas fa-check-circle" style="color: #10b981;"></i> 720p HD Stream</span>
        </div>
        <button class="btn-play-live-lecture">
          <i class="fas fa-play"></i> Watch Now
        </button>
      </div>
    `;

    card.addEventListener('click', () => {
      selectAndPlayLiveLecture(stream);
    });

    liveGrid.appendChild(card);
  });
}

// Select a live lecture and play it in the cinema stage
function selectAndPlayLiveLecture(stream) {
  if (!stream) return;
  activeStreamId = stream.id;

  const stage = document.getElementById('liveCinemaStage');
  const liveTitle = document.getElementById('activeLiveTitle');
  const liveSubtitle = document.getElementById('activeLiveSubtitle');

  if (liveTitle) liveTitle.textContent = stream.title;
  if (liveSubtitle) liveSubtitle.textContent = 'Streaming Live in HD • Interactive Classroom';

  if (stage) {
    loadVideoIntoContainer(stage, stream.link, `live-${stream.id}`, stream.title);
    stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Highlight active cards
  document.querySelectorAll('.live-lecture-card').forEach(c => {
    c.classList.toggle('active-stream', c.dataset.streamId == stream.id);
  });

  document.querySelectorAll('.live-schedule-item').forEach(el => {
    el.classList.toggle('active', el.dataset.streamId == stream.id);
  });

  showToast(`▶ Playing: ${stream.title}`, 'success');
}

function setupLiveStudioEvents() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => logout());

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // Search input in live catalog
  const searchInput = document.getElementById('liveCatalogSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderLiveGrid(currentLiveItems, searchInput.value);
    });
  }

  // Floating chat button
  const chatTrigger = document.getElementById('floatingChatTrigger');
  if (chatTrigger) chatTrigger.addEventListener('click', toggleStudyChat);
}

document.addEventListener('DOMContentLoaded', initLiveStudio);
