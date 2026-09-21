/* ==========================================================================
   DEDICATED SUBJECT WORKSPACE CONTROLLER (js/subject.js)
   ========================================================================== */

let activeSectionKey = 'recorded';
let subjectPlaylists = [];
let currentSelectedPlaylist = null;
let allPlaylistsForStarredCache = null;

async function initSubjectWorkspace() {
  initTheme();

  // Must be logged in to view subject workspace
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  startSessionValidation();
  startResetTimer();
  startActiveUsersPolling(updateSubjectOnlineCount);

  const email = getCurrentUserEmail() || 'Student';
  const name = getStudentDisplayName();
  const emailEl = document.getElementById('userProfileEmail');
  const avatarEl = document.getElementById('userAvatarInitial');
  if (emailEl) emailEl.textContent = maskEmailForPrivacy(email);
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

  // Read ?sec= from URL
  const params = new URLSearchParams(window.location.search);
  const secParam = params.get('sec') || 'recorded';
  const queryParam = params.get('q') || '';

  if (SECTION_CONFIG[secParam]) {
    activeSectionKey = secParam;
  } else {
    activeSectionKey = 'recorded';
  }

  renderSubjectHeader();
  setupSubjectEvents();

  if (activeSectionKey === 'starred') {
    await loadStarredWorkspace();
  } else if (activeSectionKey === 'live') {
    await loadLiveSubjectWorkspace();
  } else {
    await loadSubjectData(queryParam);
  }
}

function updateSubjectOnlineCount(count) {
  const badge = document.getElementById('onlineUserCountText');
  if (badge) badge.textContent = `${count} Online`;
}

// Render Subject Hero Banner & Tabs
function renderSubjectHeader() {
  const config = SECTION_CONFIG[activeSectionKey] || SECTION_CONFIG.recorded;

  // Tabs highlight
  document.querySelectorAll('.subject-nav-tab').forEach(tab => {
    const isTabActive = tab.dataset.section === activeSectionKey;
    tab.classList.toggle('active', isTabActive);
  });

  // Hero Banner details
  const banner = document.getElementById('subjectHeroBanner');
  const iconBox = document.getElementById('subjectBannerIcon');
  const titleEl = document.getElementById('subjectBannerTitle');
  const descEl = document.getElementById('subjectBannerDesc');

  if (banner) {
    banner.style.setProperty('--subject-accent', config.color);
  }
  if (iconBox) {
    iconBox.innerHTML = `<i class="fas ${config.icon}"></i>`;
    iconBox.style.color = config.color;
    iconBox.style.background = `rgba(${hexToRgb(config.color)}, 0.15)`;
    iconBox.style.borderColor = `rgba(${hexToRgb(config.color)}, 0.35)`;
  }
  if (titleEl) titleEl.textContent = `${config.title} [${config.code}]`;
  if (descEl) descEl.textContent = config.desc;

  updateSubjectProgress();
}

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

// Update Progress for Current Subject
function updateSubjectProgress() {
  const watched = getWatched();
  let total = 0;
  let done = 0;

  if (activeSectionKey === 'starred') {
    const starred = getStarred();
    total = starred.length;
    starred.forEach(id => {
      if (watched.includes(id)) done++;
    });
  } else {
    subjectPlaylists.forEach(p => {
      if (p.chapters) {
        p.chapters.forEach(ch => {
          total++;
          if (ch.id && watched.includes(ch.id)) done++;
        });
      }
    });
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const label = document.getElementById('subjectProgressLabel');
  const fill = document.getElementById('subjectProgressFill');

  if (label) label.textContent = `${done}/${total} Lectures Completed (${pct}%)`;
  if (fill) fill.style.width = `${pct}%`;
}

// Load Regular Subject Playlists
async function loadSubjectData(initialSearchQuery = '') {
  const dropdown = document.getElementById('playlistDropdown');
  const chaptersContainer = document.getElementById('chaptersScrollList');
  const chapterCountBadge = document.getElementById('playlistChapterCountBadge');

  if (chaptersContainer) {
    chaptersContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Loading syllabus & lectures...</p></div>';
  }

  subjectPlaylists = await fetchPlaylists(activeSectionKey);

  if (dropdown) {
    dropdown.innerHTML = '';
    if (subjectPlaylists.length === 0) {
      dropdown.innerHTML = '<option value="">No playlists available</option>';
      if (chaptersContainer) {
        chaptersContainer.innerHTML = '<div class="chapter-empty-state"><i class="fas fa-folder-open"></i><p>No playlists found in this subject.</p></div>';
      }
      return;
    }

    subjectPlaylists.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.chapters ? p.chapters.length : 0} Lectures)`;
      dropdown.appendChild(opt);
    });

    currentSelectedPlaylist = subjectPlaylists[0];
    dropdown.value = currentSelectedPlaylist.id;
  }

  renderPlaylistPillBar();
  renderChapterList(initialSearchQuery);
  updateSubjectProgress();

  // Pre-load first chapter in cinema player so it's immediately ready
  if (currentSelectedPlaylist && currentSelectedPlaylist.chapters && currentSelectedPlaylist.chapters.length > 0) {
    playSelectedChapter(currentSelectedPlaylist.chapters[0]);
  }
}

// Render Interactive Playlist Modules Pill Bar
function renderPlaylistPillBar() {
  const bar = document.getElementById('subjectPlaylistsBar');
  if (!bar) return;

  if (activeSectionKey === 'starred') {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  bar.innerHTML = '';

  if (subjectPlaylists.length === 0) {
    bar.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted); padding: 6px;">No topics available in this module.</span>';
    return;
  }

  subjectPlaylists.forEach(p => {
    const isCurrent = currentSelectedPlaylist && currentSelectedPlaylist.id === p.id;
    const btn = document.createElement('button');
    btn.className = `playlist-topic-pill ${isCurrent ? 'active' : ''}`;
    btn.dataset.id = p.id;
    const count = p.chapters ? p.chapters.length : 0;
    btn.innerHTML = `<span>${p.name}</span> <span class="pill-badge">${count}</span>`;

    btn.addEventListener('click', () => {
      currentSelectedPlaylist = p;
      const dropdown = document.getElementById('playlistDropdown');
      if (dropdown) dropdown.value = p.id;

      document.querySelectorAll('.playlist-topic-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.id == p.id);
      });

      const searchInput = document.getElementById('chapterSearchInput');
      if (searchInput) searchInput.value = '';

      renderChapterList();

      // Immediately play first chapter of selected module
      if (p.chapters && p.chapters.length > 0) {
        playSelectedChapter(p.chapters[0]);
      }
    });

    bar.appendChild(btn);
  });
}

// Render Chapter Cards
function renderChapterList(searchFilter = '') {
  const container = document.getElementById('chaptersScrollList');
  const countBadge = document.getElementById('playlistChapterCountBadge');
  if (!container) return;

  if (!currentSelectedPlaylist || !currentSelectedPlaylist.chapters || currentSelectedPlaylist.chapters.length === 0) {
    container.innerHTML = '<div class="chapter-empty-state"><i class="fas fa-video-slash"></i><p>No lectures in this chapter module.</p></div>';
    if (countBadge) countBadge.textContent = '0 Lectures';
    return;
  }

  let chapters = currentSelectedPlaylist.chapters;
  if (searchFilter && searchFilter.trim()) {
    const q = searchFilter.trim().toLowerCase();
    chapters = chapters.filter(c => c.name.toLowerCase().includes(q));
  }

  if (countBadge) countBadge.textContent = `${chapters.length} Lectures`;

  if (chapters.length === 0) {
    container.innerHTML = `<div class="chapter-empty-state"><i class="fas fa-search"></i><p>No lectures matching "${searchFilter}"</p></div>`;
    return;
  }

  container.innerHTML = '';

  chapters.forEach((ch, idx) => {
    const isChWatched = isWatched(ch.id);
    const isChStarred = isStarred(ch.id);

    let formatTag = 'HD Video';
    if (ch.link && (ch.link.includes('youtube.com') || ch.link.includes('youtu.be'))) formatTag = 'YouTube';
    else if (ch.link && ch.link.includes('.m3u8')) formatTag = 'HLS Stream';
    else if (ch.link && ch.link.includes('.mp4')) formatTag = 'MP4';

    const item = document.createElement('div');
    item.className = `chapter-item ${isChWatched ? 'watched' : ''} ${currentPlayingChapterId === ch.id ? 'active' : ''}`;
    item.dataset.chapterId = ch.id;

    item.innerHTML = `
      <div class="chapter-num-badge">L-${String(idx + 1).padStart(2, '0')}</div>
      <div class="chapter-details">
        <div class="chapter-title">${ch.name}</div>
        <div class="chapter-meta">
          <span><i class="fas fa-play-circle"></i> ${formatTag}</span>
          <span><i class="fas fa-clock"></i> Interactive</span>
        </div>
      </div>
      <div class="chapter-actions">
        <button class="btn-icon-action star-btn ${isChStarred ? 'starred' : ''}" title="Save to Starred Revision" data-id="${ch.id}">
          <i class="${isChStarred ? 'fas' : 'far'} fa-star"></i>
        </button>
        <button class="btn-icon-action watched-btn ${isChWatched ? 'watched' : ''}" title="Mark as Watched" data-id="${ch.id}">
          <i class="fas ${isChWatched ? 'fa-check-circle' : 'fa-circle'}"></i>
        </button>
      </div>
    `;

    // Click anywhere on item -> Play Video
    item.addEventListener('click', (e) => {
      if (e.target.closest('.chapter-actions')) return;
      playSelectedChapter(ch);
      document.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
    });

    // Star button
    const starBtn = item.querySelector('.star-btn');
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const starredNow = toggleStarred(ch.id);
      starBtn.classList.toggle('starred', starredNow);
      starBtn.innerHTML = `<i class="${starredNow ? 'fas' : 'far'} fa-star"></i>`;
      showToast(starredNow ? '⭐ Added to Starred Revision' : 'Removed from Starred', 'info');
      updateSubjectProgress();
    });

    // Watched button
    const watchedBtn = item.querySelector('.watched-btn');
    watchedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const watchedNow = toggleWatched(ch.id);
      watchedBtn.classList.toggle('watched', watchedNow);
      watchedBtn.innerHTML = `<i class="fas ${watchedNow ? 'fa-check-circle' : 'fa-circle'}"></i>`;
      item.classList.toggle('watched', watchedNow);
      updateSubjectProgress();
    });

    container.appendChild(item);
  });
}

// Play chapter in the sticky cinema box
function playSelectedChapter(chapter) {
  const container = document.getElementById('subjectCinemaPlayerContainer');
  const titleEl = document.getElementById('activePlayingVideoTitle');
  const subEl = document.getElementById('activePlayingVideoSub');

  if (titleEl) titleEl.textContent = chapter.name;
  if (subEl) subEl.textContent = `${currentSelectedPlaylist ? currentSelectedPlaylist.name : 'Module'} • Targeted Lecture`;

  if (container) {
    loadVideoIntoContainer(container, chapter.link, chapter.id, chapter.name);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Load Starred Revision Vault
async function loadStarredWorkspace() {
  const dropdownWrapper = document.getElementById('playlistSelectWrapper');
  const container = document.getElementById('chaptersScrollList');
  const countBadge = document.getElementById('playlistChapterCountBadge');

  if (dropdownWrapper) dropdownWrapper.style.display = 'none';

  if (container) {
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Loading your starred bookmarks...</p></div>';
  }

  const starredIds = getStarred();
  if (starredIds.length === 0) {
    if (container) {
      container.innerHTML = `
        <div class="chapter-empty-state">
          <i class="fas fa-star" style="color: #eab308; font-size: 2.5rem; margin-bottom: 12px;"></i>
          <h3>No Starred Lectures Yet</h3>
          <p>Click the star icon (⭐) on any lecture across any subject to collect them here for quick revision before exams.</p>
        </div>
      `;
    }
    if (countBadge) countBadge.textContent = '0 Saved';
    updateSubjectProgress();
    return;
  }

  // Fetch all playlists to locate the chapters
  if (!allPlaylistsForStarredCache) {
    allPlaylistsForStarredCache = await fetchAllSectionPlaylists();
  }

  const allChapters = [];
  SECTIONS.forEach(sec => {
    const list = allPlaylistsForStarredCache[sec] || [];
    list.forEach(p => {
      if (p.chapters) {
        p.chapters.forEach(ch => {
          allChapters.push({
            ...ch,
            playlistName: p.name,
            sectionKey: sec
          });
        });
      }
    });
  });

  const starredChapters = allChapters.filter(ch => starredIds.includes(ch.id));

  currentSelectedPlaylist = {
    id: 'starred',
    name: 'Starred Revision Vault',
    chapters: starredChapters
  };

  renderChapterList();
  updateSubjectProgress();

  if (currentSelectedPlaylist && currentSelectedPlaylist.chapters && currentSelectedPlaylist.chapters.length > 0) {
    playSelectedChapter(currentSelectedPlaylist.chapters[0]);
  }
}

// Mark all lectures watched in active playlist
function markAllWatchedInCurrentPlaylist() {
  if (!currentSelectedPlaylist || !currentSelectedPlaylist.chapters) {
    showToast('⚠️ No playlist active', 'error');
    return;
  }

  let watched = getWatched();
  let added = 0;

  currentSelectedPlaylist.chapters.forEach(ch => {
    if (ch.id && !watched.includes(ch.id)) {
      watched.push(ch.id);
      added++;
    }
  });

  if (added > 0) {
    saveWatched(watched);
    renderChapterList();
    updateSubjectProgress();
    showToast(`✅ ${added} lectures marked as watched!`, 'success');
  } else {
    showToast('ℹ️ All lectures already marked as watched in this playlist', 'info');
  }
}

// Callback when player completes video
window.onChapterWatchedUpdate = function(chapterId) {
  const item = document.querySelector(`.chapter-item[data-chapter-id="${chapterId}"]`);
  if (item) {
    item.classList.add('watched');
    const watchedBtn = item.querySelector('.watched-btn');
    if (watchedBtn) {
      watchedBtn.classList.add('watched');
      watchedBtn.innerHTML = '<i class="fas fa-check-circle"></i>';
    }
  }
  updateSubjectProgress();
};

function setupSubjectEvents() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => logout());

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // Playlist selection change
  const dropdown = document.getElementById('playlistDropdown');
  if (dropdown) {
    dropdown.addEventListener('change', () => {
      const selectedId = dropdown.value;
      const found = subjectPlaylists.find(p => p.id === selectedId);
      if (found) {
        currentSelectedPlaylist = found;
        document.querySelectorAll('.playlist-topic-pill').forEach(b => {
          b.classList.toggle('active', b.dataset.id == selectedId);
        });
        const searchInput = document.getElementById('chapterSearchInput');
        if (searchInput) searchInput.value = '';
        renderChapterList();
        if (found.chapters && found.chapters.length > 0) {
          playSelectedChapter(found.chapters[0]);
        }
      }
    });
  }

  // In-page search input
  const searchInput = document.getElementById('chapterSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderChapterList(searchInput.value);
    });
  }

  // Global Header Search
  const globalSearch = document.getElementById('globalHeaderSearch');
  if (globalSearch) {
    globalSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = globalSearch.value.trim();
        if (q) {
          if (q.toLowerCase().includes('live')) {
            window.location.href = 'live.html';
          } else {
            const pageSearch = document.getElementById('chapterSearchInput');
            if (pageSearch) {
              pageSearch.value = q;
              renderChapterList(q);
            }
          }
        }
      }
    });
  }

  // Mark all watched button
  const markAllBtn = document.getElementById('markAllWatchedBtn');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', markAllWatchedInCurrentPlaylist);
  }

  // Floating Chat
  const chatTrigger = document.getElementById('floatingChatTrigger');
  if (chatTrigger) chatTrigger.addEventListener('click', toggleStudyChat);
}

// Load Live Subject Workspace
async function loadLiveSubjectWorkspace() {
  const dropdown = document.getElementById('playlistDropdown');
  const chaptersContainer = document.getElementById('chaptersScrollList');
  const chapterCountBadge = document.getElementById('playlistChapterCountBadge');
  const bar = document.getElementById('subjectPlaylistsBar');
  const markWatchedBtn = document.getElementById('markAllWatchedBtn');

  if (markWatchedBtn) markWatchedBtn.style.display = 'none';
  if (bar) bar.style.display = 'none';

  if (chaptersContainer) {
    chaptersContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Connecting to Live Broadcast Feed...</p></div>';
  }

  try {
    const liveItems = await fetchImportantClasses();

    if (dropdown) {
      dropdown.innerHTML = `<option value="live">🔴 Live Masterclasses (${liveItems.length} Sessions Available)</option>`;
      dropdown.disabled = true;
    }
    if (chapterCountBadge) {
      chapterCountBadge.textContent = `${liveItems.length} Live`;
    }

    const label = document.getElementById('subjectProgressLabel');
    const fill = document.getElementById('subjectProgressFill');
    if (label) label.textContent = `🔴 Live Broadcast Studio Stage (${liveItems.length} Streams Active)`;
    if (fill) {
      fill.style.width = '100%';
      fill.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
    }

    if (!liveItems || liveItems.length === 0) {
      if (chaptersContainer) {
        chaptersContainer.innerHTML = `
          <div class="chapter-empty-state">
            <i class="fas fa-satellite-dish" style="color: #ef4444;"></i>
            <h3>No Live Classes at this moment</h3>
            <p>Our educators are setting up the next broadcast stream. Please check scheduled classes or visit the dedicated studio.</p>
            <a href="live.html" class="btn-live-dash" style="display:inline-block; margin-top:12px; padding:8px 18px; border-radius:20px; background:#ef4444; color:#fff; text-decoration:none; font-weight:700;">Open Dedicated Live Studio</a>
          </div>
        `;
      }
      return;
    }

    // Render live sessions in chaptersScrollList
    chaptersContainer.innerHTML = '';
    
    // Add banner at top of list linking to dedicated studio
    const studioLinkBanner = document.createElement('div');
    studioLinkBanner.style.cssText = 'padding: 12px 14px; margin-bottom: 12px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;';
    studioLinkBanner.innerHTML = `
      <div style="font-size: 0.82rem; color: var(--text-primary);">
        <strong style="color: #ef4444;"><i class="fas fa-broadcast-tower"></i> Live Broadcast Mode:</strong> Tap any lecture below to play immediately in cinema stage.
      </div>
      <a href="live.html" style="font-size: 0.78rem; font-weight: 700; color: #fff; background: #ef4444; padding: 6px 14px; border-radius: 20px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
        <i class="fas fa-satellite-dish"></i> Cinema Stage Mode <i class="fas fa-arrow-right"></i>
      </a>
    `;
    chaptersContainer.appendChild(studioLinkBanner);

    liveItems.forEach((stream, idx) => {
      const card = document.createElement('div');
      card.className = 'chapter-item';
      card.dataset.streamId = stream.id;

      card.innerHTML = `
        <span class="chapter-number" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; font-weight: 800;">LIVE ${idx + 1}</span>
        <div class="chapter-info-col">
          <div class="chapter-name">${stream.title}</div>
          <div class="chapter-sub-meta">
            <span class="video-type-badge hls"><i class="fas fa-satellite-dish"></i> Live Stream</span>
            <span class="meta-chip">720p HD</span>
            <span class="meta-chip">Single Device Verified</span>
          </div>
        </div>
        <div class="chapter-actions">
          <button class="play-btn" style="background: #ef4444; color: #fff; border-color: #ef4444;" title="Watch Live Stream">
            <i class="fas fa-play"></i> Watch
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('active'));
        card.classList.add('active');
        playLiveStreamInSubject(stream);
      });

      chaptersContainer.appendChild(card);
    });

    // Auto-play first live session in cinema player
    if (liveItems.length > 0) {
      const firstCard = chaptersContainer.querySelector('.chapter-item');
      if (firstCard) firstCard.classList.add('active');
      playLiveStreamInSubject(liveItems[0]);
    }
  } catch (err) {
    console.error('Failed to load live subjects:', err);
    if (chaptersContainer) {
      chaptersContainer.innerHTML = '<div class="chapter-empty-state"><p>⚠️ Failed to load live classes. Please try refreshing the page.</p></div>';
    }
  }
}

function playLiveStreamInSubject(stream) {
  if (!stream) return;
  const container = document.getElementById('cinemaPlayerContainer');
  const titleEl = document.getElementById('cinemaLectureTitle');
  const chipEl = document.getElementById('cinemaLectureChapterChip');
  const noteEl = document.getElementById('cinemaLectureNotes');

  if (titleEl) titleEl.textContent = stream.title;
  if (chipEl) chipEl.textContent = '🔴 Live Interactive Broadcast';
  if (noteEl) noteEl.textContent = 'Streaming live masterclass session in 720p HD. Single-device security verified.';

  if (container) {
    loadVideoIntoContainer(container, stream.link, `live-${stream.id}`, stream.title);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

document.addEventListener('DOMContentLoaded', initSubjectWorkspace);
