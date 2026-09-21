/* ==========================================================================
   STUDY GROUP & 1-ON-1 CHAT CONTROLLER (js/chat.js)
   ========================================================================== */

let chatPollInterval = null;
let isChatOpen = false;
let currentChatMode = 'group'; // 'group' | 'direct'
let activeDirectStudent = null; // { email: '', name: '' }
let lastRenderedChatCount = 0;

// Toggle Open / Close Chat Drawer
function toggleStudyChat() {
  if (!isLoggedIn()) {
    showToast('⚠️ Please sign in first to access Study Chat', 'error');
    return;
  }
  if (isChatOpen) closeStudyChat();
  else openStudyChat();
}

function openStudyChat() {
  const chatWin = document.getElementById('studyChatWindow');
  const badge = document.getElementById('chatUnreadBadge');
  if (!chatWin) return;

  isChatOpen = true;
  chatWin.classList.add('open');
  if (badge) {
    badge.style.display = 'none';
    badge.textContent = '0';
  }

  fetchChatMessages(true);

  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(() => {
    fetchChatMessages(false);
  }, 3500);

  setTimeout(() => {
    const input = document.getElementById('studyChatInput');
    if (input) input.focus();
  }, 150);
}

function closeStudyChat() {
  const chatWin = document.getElementById('studyChatWindow');
  if (!chatWin) return;
  isChatOpen = false;
  chatWin.classList.remove('open');
  if (chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
}

// Switch between Group chat and Direct 1-on-1 chat
function setChatMode(mode, targetStudent = null) {
  currentChatMode = mode;
  activeDirectStudent = targetStudent;

  const groupTabBtn = document.getElementById('chatTabGroup');
  const directTabBtn = document.getElementById('chatTabDirect');
  const titleEl = document.getElementById('chatTargetTitle');

  if (groupTabBtn && directTabBtn) {
    groupTabBtn.classList.toggle('active', mode === 'group');
    directTabBtn.classList.toggle('active', mode === 'direct');
  }

  if (titleEl) {
    if (mode === 'direct' && targetStudent) {
      titleEl.textContent = `Direct: ${targetStudent.name || targetStudent.email}`;
    } else {
      titleEl.textContent = 'Batch Study Room';
    }
  }

  fetchChatMessages(true);
}

// Fetch chat messages from API
async function fetchChatMessages(forceScrollBottom = false) {
  if (!isLoggedIn()) return;
  const box = document.getElementById('studyChatMessages');
  if (!box) return;

  const myEmail = (getCurrentUserEmail() || '').toLowerCase();
  let url = `${API_BASE}/chat/messages`;

  if (currentChatMode === 'direct') {
    if (!activeDirectStudent || !activeDirectStudent.email) {
      box.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: var(--text-muted); font-size: 0.85rem;">
          <i class="fas fa-user-friends" style="font-size: 2rem; margin-bottom: 12px; color: var(--brand-primary);"></i>
          <p>Online students list khol kar kisi student ko message bhejein!</p>
          <button onclick="openOnlineUsersModal()" class="btn-msg-user" style="margin-top: 10px;">
            👥 View Online Students
          </button>
        </div>
      `;
      return;
    }
    url += `?type=direct&myEmail=${encodeURIComponent(myEmail)}&withEmail=${encodeURIComponent(activeDirectStudent.email)}`;
  } else {
    url += `?type=group`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.messages)) return;

    const messages = data.messages;

    if (!isChatOpen && messages.length > lastRenderedChatCount && lastRenderedChatCount > 0) {
      const unread = messages.length - lastRenderedChatCount;
      const badge = document.getElementById('chatUnreadBadge');
      if (badge) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = 'flex';
      }
    }

    const isNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight) < 80;

    if (messages.length === 0) {
      box.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: var(--text-muted); font-size: 0.85rem;">
          <p>👋 No messages yet. Start asking doubts or discuss today's classes!</p>
        </div>
      `;
      lastRenderedChatCount = 0;
      return;
    }

    if (messages.length !== lastRenderedChatCount || forceScrollBottom || box.children.length <= 1) {
      box.innerHTML = '';
      messages.forEach(m => {
        const isSelf = myEmail && m.email && (myEmail === m.email.toLowerCase());
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isSelf ? 'outgoing' : 'incoming'}`;

        const sender = document.createElement('div');
        sender.className = 'bubble-sender';
        const senderName = m.sender_name || maskEmailForPrivacy(m.email);
        sender.textContent = isSelf ? 'You' : senderName;

        const content = document.createElement('div');
        content.className = 'bubble-content';
        content.textContent = m.message;

        const time = document.createElement('div');
        time.className = 'bubble-time';
        time.textContent = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        bubble.appendChild(sender);
        bubble.appendChild(content);
        bubble.appendChild(time);
        box.appendChild(bubble);
      });

      lastRenderedChatCount = messages.length;

      if (forceScrollBottom || isNearBottom) {
        box.scrollTop = box.scrollHeight;
      }
    }
  } catch (e) {
    console.error('Chat error:', e);
  }
}

// Send Message
async function sendStudyMessage(e) {
  if (e) e.preventDefault();
  if (!isLoggedIn()) {
    showToast('⚠️ Please sign in first to send messages', 'error');
    return;
  }

  const input = document.getElementById('studyChatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const myEmail = getCurrentUserEmail();
  const myName = getStudentDisplayName();

  const payload = {
    message: text,
    email: myEmail,
    sender_name: myName,
    type: currentChatMode
  };

  if (currentChatMode === 'direct') {
    if (!activeDirectStudent || !activeDirectStudent.email) {
      showToast('⚠️ Select a recipient student first', 'error');
      return;
    }
    payload.receiver_email = activeDirectStudent.email;
    payload.receiver_name = activeDirectStudent.name || activeDirectStudent.email;
  }

  input.value = '';

  try {
    const res = await fetch(`${API_BASE}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      fetchChatMessages(true);
    } else {
      showToast('❌ ' + (data.error || 'Failed to send message'), 'error');
    }
  } catch (err) {
    showToast('❌ Network error sending message', 'error');
  }
}

// Online Active Users Modal
async function openOnlineUsersModal() {
  if (!isLoggedIn()) {
    showToast('⚠️ Sign in to view online students', 'error');
    return;
  }
  const modal = document.getElementById('activeUsersModal');
  const list = document.getElementById('activeUsersList');
  if (!modal || !list) return;

  modal.classList.add('open');
  list.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-muted);">⏳ Loading active students...</div>';

  const users = await fetchActiveUsersList();
  if (users.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-muted);">No other students online right now</div>';
    return;
  }

  const myEmail = (getCurrentUserEmail() || '').toLowerCase();
  list.innerHTML = '';

  users.forEach(u => {
    const isMe = myEmail && u.email && (myEmail === u.email.toLowerCase());
    const name = u.name || maskEmailForPrivacy(u.email);
    const initial = name.charAt(0).toUpperCase();

    const row = document.createElement('div');
    row.className = 'user-item-row';
    row.innerHTML = `
      <div class="user-item-info">
        <div class="user-avatar-initials">${initial}</div>
        <div>
          <div class="user-item-name">${name} ${isMe ? '<span style="color:#10b981;font-size:0.75rem;">(You)</span>' : ''}</div>
          <div class="user-item-device">${u.device || 'Online'} • Active now</div>
        </div>
      </div>
      ${!isMe ? `<button class="btn-msg-user" onclick="startDirectChat('${u.email}', '${name.replace(/'/g, "\\'")}')"><i class="fas fa-comment-dots"></i> Message</button>` : ''}
    `;
    list.appendChild(row);
  });
}

function closeOnlineUsersModal() {
  const modal = document.getElementById('activeUsersModal');
  if (modal) modal.classList.remove('open');
}

function startDirectChat(email, name) {
  closeOnlineUsersModal();
  openStudyChat();
  setChatMode('direct', { email, name });
}
