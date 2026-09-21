/* ==========================================================================
   VIDEO PLAYER & PLAYBACK CONTROLLER (js/player.js)
   ========================================================================== */

let activeVideoPlayer = null;
let activeHlsInstance = null;
let currentPlayingChapterId = null;

// Clean up previous video player
function disposePlayer() {
  if (activeHlsInstance) {
    try {
      activeHlsInstance.destroy();
    } catch (e) {}
    activeHlsInstance = null;
  }

  if (activeVideoPlayer) {
    try {
      activeVideoPlayer.off('timeupdate');
      activeVideoPlayer.off('ended');
      activeVideoPlayer.off('loadstart');
      activeVideoPlayer.dispose();
    } catch (e) {}
    activeVideoPlayer = null;
  }

  currentPlayingChapterId = null;
}

// Double-Tap YouTube style 10s Seek
function showDoubleTapAnimation(container, side, text) {
  let ripple = container.querySelector(`.double-tap-ripple.${side}`);
  if (!ripple) {
    ripple = document.createElement('div');
    ripple.className = `double-tap-ripple ${side}`;
    ripple.innerHTML = `<i class="fas ${side === 'right' ? 'fa-forward' : 'fa-backward'}"></i><span>${text}</span>`;
    container.appendChild(ripple);
  } else {
    const span = ripple.querySelector('span');
    if (span) span.textContent = text;
  }

  ripple.classList.remove('active');
  void ripple.offsetWidth; // trigger reflow
  ripple.classList.add('active');

  clearTimeout(ripple._timer);
  ripple._timer = setTimeout(() => {
    ripple.classList.remove('active');
  }, 600);
}

function enableDoubleTapSeek(player) {
  const el = player.el();
  let lastTapTime = 0;

  el.addEventListener('touchend', function(e) {
    if (e.target.closest('.vjs-control-bar')) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    const currentTime = Date.now();
    const tapGap = currentTime - lastTapTime;
    const rect = el.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const isRightSide = touchX > (rect.width / 2);

    if (tapGap > 40 && tapGap < 320) {
      e.preventDefault();
      const isLive = player.hasClass('vjs-live');
      if (isLive) {
        showToast('⛔ LIVE stream mein seek disabled hai', 'error');
        return;
      }

      const curr = player.currentTime() || 0;
      const dur = player.duration() || 0;

      if (isRightSide) {
        const nextTime = Math.min(dur, curr + 10);
        player.currentTime(nextTime);
        showDoubleTapAnimation(el, 'right', '+10s');
      } else {
        const prevTime = Math.max(0, curr - 10);
        player.currentTime(prevTime);
        showDoubleTapAnimation(el, 'left', '-10s');
      }
      lastTapTime = 0;
    } else {
      lastTapTime = currentTime;
    }
  });
}

// Attach keyboard shortcuts (ArrowLeft/Right for 10s seek, Space for play/pause)
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (!activeVideoPlayer) return;
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

  const isLive = activeVideoPlayer.hasClass('vjs-live');
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (isLive) return;
    const cur = activeVideoPlayer.currentTime() || 0;
    const dur = activeVideoPlayer.duration() || 0;
    activeVideoPlayer.currentTime(Math.min(dur, cur + 10));
    showToast('⏩ +10s', 'info');
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (isLive) return;
    const cur = activeVideoPlayer.currentTime() || 0;
    activeVideoPlayer.currentTime(Math.max(0, cur - 10));
    showToast('⏪ -10s', 'info');
  } else if (e.code === 'Space') {
    e.preventDefault();
    if (activeVideoPlayer.paused()) activeVideoPlayer.play();
    else activeVideoPlayer.pause();
  }
});

// Main Player Loader
function loadVideoIntoContainer(container, link, chapterId, title = '') {
  disposePlayer();
  currentPlayingChapterId = chapterId;

  if (!container || !link) return;
  container.innerHTML = '';
  container.style.display = 'block';

  // 1. YouTube link
  if (link.includes('youtube.com') || link.includes('youtu.be')) {
    const videoId = extractYouTubeId(link);
    if (videoId) {
      const googleSession = getGoogleSession();
      let embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
      if (googleSession) {
        embedUrl += `&origin=${encodeURIComponent(window.location.origin)}`;
      }
      container.innerHTML = `
        <iframe 
          class="yt-iframe-container"
          src="${embedUrl}" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      `;
      return;
    }
  }

  // 2. HLS (.m3u8) Stream
  if (link.includes('.m3u8') && typeof Hls !== 'undefined' && Hls.isSupported()) {
    const videoEl = document.createElement('video');
    videoEl.className = 'video-js vjs-default-skin';
    videoEl.setAttribute('controls', '');
    videoEl.setAttribute('preload', 'auto');
    container.appendChild(videoEl);

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: 30,
      maxMaxBufferLength: 60
    });

    hls.loadSource(link);
    hls.attachMedia(videoEl);
    activeHlsInstance = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, function() {
      videoEl.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, function(event, data) {
      if (data.fatal) {
        tryFallbackHLS(videoEl, link);
      }
    });

    const player = videojs(videoEl, {
      controls: true,
      fluid: true,
      inactivityTimeout: 2500
    });

    setupPlayerEventListeners(player);
    activeVideoPlayer = player;
    return;
  }

  // 3. MP4 / Direct Video
  if (link.includes('.mp4') || link.includes('.webm')) {
    const videoEl = document.createElement('video');
    videoEl.className = 'video-js vjs-default-skin';
    videoEl.setAttribute('controls', '');
    videoEl.setAttribute('preload', 'auto');
    container.appendChild(videoEl);

    const player = videojs(videoEl, {
      autoplay: true,
      controls: true,
      fluid: true,
      inactivityTimeout: 2500
    });

    player.src({ src: link, type: 'video/mp4' });
    setupPlayerEventListeners(player);
    activeVideoPlayer = player;
    return;
  }

  // Fallback if unsupported
  container.innerHTML = `
    <div style="padding: 40px; text-align: center; color: var(--text-muted);">
      <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #f59e0b; margin-bottom: 10px;"></i>
      <p>⚠️ Unsupported video format. Supported: YouTube, HLS (.m3u8), MP4</p>
    </div>
  `;
}

function tryFallbackHLS(videoEl, link) {
  if (activeHlsInstance) {
    try { activeHlsInstance.destroy(); } catch (e) {}
    activeHlsInstance = null;
  }

  const player = videojs(videoEl, {
    autoplay: true,
    controls: true,
    fluid: true,
    html5: {
      hls: { overrideNative: true }
    }
  });

  player.src({ src: link, type: 'application/x-mpegURL' });
  setupPlayerEventListeners(player);
  activeVideoPlayer = player;
  player.play().catch(() => {});
}

function setupPlayerEventListeners(player) {
  enableDoubleTapSeek(player);

  player.on('timeupdate', function() {
    const cur = player.currentTime() || 0;
    const durEl = document.getElementById('durationDisplay');
    if (durEl) {
      const h = Math.floor(cur / 3600);
      const m = Math.floor((cur % 3600) / 60);
      const s = Math.floor(cur % 60);
      durEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  });

  player.on('ended', function() {
    const durEl = document.getElementById('durationDisplay');
    if (durEl) durEl.textContent = '00:00:00';
    if (currentPlayingChapterId) {
      toggleWatched(currentPlayingChapterId);
      if (typeof window.onChapterWatchedUpdate === 'function') {
        window.onChapterWatchedUpdate(currentPlayingChapterId);
      }
    }
  });
}
