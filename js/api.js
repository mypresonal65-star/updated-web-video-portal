/* ==========================================================================
   API CLIENT & DATA PROVIDER (js/api.js)
   ========================================================================== */

let activeUsersPollTimer = null;

// Fetch playlists for a specific section ('recorded', 'reasoning', etc.)
async function fetchPlaylists(sectionKey) {
  try {
    const response = await fetch(`${API_BASE}/playlists?section=${encodeURIComponent(sectionKey)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return (data.success && Array.isArray(data.playlists)) ? data.playlists : [];
  } catch (error) {
    console.error(`Error fetching playlists for ${sectionKey}:`, error);
    return [];
  }
}

// Fetch all sections concurrently
async function fetchAllSectionPlaylists() {
  const results = {};
  await Promise.all(
    SECTIONS.map(async (sec) => {
      results[sec] = await fetchPlaylists(sec);
    })
  );
  return results;
}

// Fetch Important / Live Classes
async function fetchImportantClasses() {
  try {
    const response = await fetch(`${API_BASE}/important`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return (data.success && Array.isArray(data.items)) ? data.items : [];
  } catch (error) {
    console.error('Error fetching important classes:', error);
    return [];
  }
}

// Fetch real-time active users count
async function fetchActiveUsersCount() {
  try {
    const response = await fetch(`${API_BASE}/active-users`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.activeCount !== undefined) {
        return data.activeCount;
      }
    }
  } catch (e) {}
  return 1;
}

// Fetch active users list with details
async function fetchActiveUsersList() {
  try {
    const response = await fetch(`${API_BASE}/active-users/list`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.users)) {
        return data.users;
      }
    }
  } catch (e) {
    console.error('Error fetching active users list:', e);
  }
  return [];
}

// Generate an access key for a student email
async function generateStudentKey(email) {
  if (!email) throw new Error('Please enter a valid email address.');
  const response = await fetch(`${API_BASE}/key/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return await response.json();
}

// Start polling active user counter
function startActiveUsersPolling(onUpdate) {
  if (activeUsersPollTimer) clearInterval(activeUsersPollTimer);
  
  async function tick() {
    const count = await fetchActiveUsersCount();
    if (typeof onUpdate === 'function') onUpdate(count);
  }

  tick();
  activeUsersPollTimer = setInterval(tick, 12000);
}
