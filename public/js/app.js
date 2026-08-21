/**
 * OpenRoom BMU - Complete Single Page Application Engine
 * Includes: Live Room Finder, 2FA with Emergency Recovery, Profile Customization,
 * Reddit-Style Community Threads & Nested Peer Replies, and Full Admin Operations.
 */

const state = {
  rooms: [],
  user: JSON.parse(localStorage.getItem('openroom_user') || 'null'),
  token: localStorage.getItem('openroom_token') || null,
  filters: { building: '', search: '', status: '' },
  threadFilter: { tag: 'All', sort: 'hot' }
};

// UI Notification Controller
function toast(message, type = 'default') {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${message}</span>`;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// Global API Dispatcher
async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Server request failure.');
    }
    return data;
  } catch (err) {
    toast(err.message, 'error');
    throw err;
  }
}

// Navigation Bar
function renderNav() {
  const nav = document.getElementById('navBar');
  if (!nav) return;
  const hash = location.hash || '#/';

  let html = `
    <button class="nav-item ${hash === '#/' ? 'active' : ''}" data-route="#/">Explore</button>
    <button class="nav-item ${hash === '#/rooms' ? 'active' : ''}" data-route="#/rooms">Find Room</button>
    <button class="nav-item ${hash === '#/reviews' ? 'active' : ''}" data-route="#/reviews">Discussions & Reviews</button>
  `;

  if (state.user) {
    if (state.user.role === 'admin') {
      html += `<button class="btn btn-sm btn-primary" data-route="#/admin">⚡ Admin Panel</button>`;
    } else {
      html += `<button class="btn btn-sm btn-ghost" data-route="#/account">My Account</button>`;
    }
    html += `<button class="btn btn-sm btn-ghost" id="logoutAction">Log Out</button>`;
  } else {
    html += `
      <button class="btn btn-sm btn-ghost" data-route="#/request-access">Day Scholar Signup</button>
      <button class="btn btn-sm btn-primary" data-route="#/login">Login</button>
    `;
  }
  nav.innerHTML = html;
}

// ==========================================
// VIEWS
// ==========================================

// 1. Home View
async function HomeView() {
  let rooms = [];
  try {
    const res = await api('/api/rooms');
    state.rooms = res.data || [];
    rooms = state.rooms;
  } catch (err) {
    console.warn('Could not fetch rooms immediately:', err.message);
  }

  const emptyCount = rooms.filter(r => r.status === 'empty').length;
  const sample = rooms.slice(0, 8);

  return `
    <div class="hero-wrapper">
      <div class="hero-grid">
        <div>
          <div class="eyebrow-pill"><span class="pulsing-dot"></span> Live BMU Campus Coverage</div>
          <h1 class="hero-title">Find an <span>empty room</span> across BMU in seconds.</h1>
          <p class="hero-lead">OpenRoom is designed for BML Munjal University day scholars. Real-time availability of classrooms, study pods, and computer labs across E-2 Building, Gateway Building, Central Library, and Innovation Hub.</p>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <button class="btn btn-open" data-route="#/rooms">Check Free Rooms</button>
            <button class="btn btn-ghost" data-route="#/request-access">Request Day Scholar Login</button>
          </div>
          <div class="hero-metrics">
            <div class="metric-box"><b>${emptyCount}</b><span>Free Now</span></div>
            <div class="metric-box"><b>${rooms.length}</b><span>Rooms Tracked</span></div>
            <div class="metric-box"><b>4</b><span>Buildings</span></div>
          </div>
        </div>
        <div class="blueprint-card">
          <div class="blueprint-head">
            <span>CAMPUS LIVE DIRECTORY</span>
            <span style="color:var(--open); font-size:12px;">● LIVE</span>
          </div>
          <div class="mini-grid">
            ${sample.map(r => `
              <div class="mini-room-slot ${r.status}" data-route="#/room/${r.code}">
                <i></i>
                <span>${r.code}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// 2. Rooms Directory View
async function RoomsView() {
  const res = await api('/api/rooms');
  state.rooms = res.data;
  const BUILDINGS = ['E-2 Building', 'Gateway Building', 'Central Library', 'Innovation Hub'];

  return `
    <div class="container">
      <div style="margin-bottom:20px;">
        <h2 style="font-family:var(--font-display); font-size:28px;">Campus Rooms</h2>
        <p style="color:var(--ink-soft);">Crowdsourced live status. Updates auto-reset after 90 minutes.</p>
      </div>

      <div class="filter-card">
        <input type="text" id="filterSearch" placeholder="Search room code (e.g. E2-101, GW-201, LIB-101)...">
        <select id="filterBuilding">
          <option value="">All Buildings</option>
          ${BUILDINGS.map(b => `<option value="${b}">${b}</option>`).join('')}
        </select>
        <select id="filterStatus">
          <option value="">All Statuses</option>
          <option value="empty">Empty Only</option>
          <option value="busy">Occupied Only</option>
        </select>
      </div>

      <div class="rooms-matrix" id="roomsMatrix"></div>
    </div>
  `;
}

function renderRoomsMatrix() {
  const container = document.getElementById('roomsMatrix');
  if (!container) return;

  const { building, search, status } = state.filters;
  const filtered = state.rooms.filter(r => {
    if (building && r.building !== building) return false;
    if (status && r.status !== status) return false;
    if (search && !r.code.toLowerCase().includes(search.toLowerCase()) && !r.type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--ink-soft);">No matching rooms found.</div>`;
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="room-unit ${r.status}" data-route="#/room/${r.code}">
      <div class="status-bar"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="font-family:var(--font-mono); font-size:18px;">${r.code}</strong>
        <span class="status-pill ${r.status}"><i></i>${r.status}</span>
      </div>
      <div style="font-weight:600; font-size:14px; margin-bottom:4px;">${r.type}</div>
      <div style="font-size:12px; color:var(--ink-soft);">📍 ${r.building}, Floor ${r.floor} · 👥 ${r.capacity} seats</div>
    </div>
  `).join('');
}

// 3. Room Detail View
async function RoomDetailView(code) {
  const res = await api('/api/rooms');
  state.rooms = res.data;
  const room = state.rooms.find(r => r.code.toUpperCase() === code.toUpperCase());
  
  if (!room) {
    return NotFoundView(`Room code "<b>${code.toUpperCase()}</b>" was not found in the BMU Campus Directory.`);
  }

  return `
    <div class="container">
      <button class="btn btn-ghost btn-sm" data-route="#/rooms" style="margin-bottom:16px;">← Back to Rooms</button>
      <div class="content-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <span class="status-pill ${room.status}" style="margin-bottom:10px;"><i></i>${room.status}</span>
            <h1 style="font-family:var(--font-mono); font-size:32px;">${room.code}</h1>
            <p style="color:var(--ink-soft);">${room.type} · ${room.building}, Floor ${room.floor}</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px; color:var(--ink-soft);">Capacity</div>
            <strong style="font-size:18px;">${room.capacity} seats</strong>
          </div>
        </div>

        <hr style="border:none; border-top:1px solid var(--line); margin:20px 0;">

        <div>
          <h4 style="margin-bottom:8px;">Update Room Availability:</h4>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-open btn-sm" id="voteEmpty" ${room.status === 'empty' ? 'disabled' : ''}>Mark as Empty</button>
            <button class="btn btn-busy btn-sm" id="voteBusy" ${room.status === 'busy' ? 'disabled' : ''}>Mark as Occupied</button>
          </div>
        </div>

        <div class="box-highlight" id="arrivalFlowBox">
          <h4>Heading to this room?</h4>
          <p style="font-size:13px; color:var(--ink-soft); margin:6px 0 14px;">Confirm when you arrive to keep the live campus map accurate.</p>
          <button class="btn btn-primary btn-sm" id="btnStartWalking">I am walking to this room</button>
        </div>

        <div class="box-highlight">
          <h4>Report Makeup / Extra Lecture</h4>
          <p style="font-size:13px; color:var(--ink-soft); margin-bottom:10px;">If an extra lecture is in session, flag it immediately to reroute students.</p>
          <div class="form-field" style="margin-bottom:8px;">
            <input type="text" id="reportReason" placeholder="e.g. Unscheduled faculty lecture running">
          </div>
          <button class="btn btn-busy btn-sm" id="btnSubmitReport">Report Occupied & Suggest Alternative</button>
          <div id="reportResultFeedback" style="margin-top:10px;"></div>
        </div>
      </div>
    </div>
  `;
}

// 4. Request Access (Signup) View
function RequestAccessView() {
  return `
    <div class="auth-panel">
      <h2 style="font-family:var(--font-display); font-size:24px; margin-bottom:6px;">Day Scholar Access</h2>
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:20px;">
        Register your details. Your entry is logged to the Admin Excel Sheet. Once approved, you will receive your custom <b>@openroom.xyz</b> login credentials.
      </p>
      <div id="requestInlineErr" style="display:none;" class="inline-error"></div>
      <form id="accessRequestForm">
        <div class="form-field">
          <label>Full Name</label>
          <input type="text" id="reqName" required placeholder="e.g. Tanmay Sharma">
        </div>
        <div class="form-field">
          <label>Official BMU Email</label>
          <input type="email" id="reqBmuEmail" required placeholder="e.g. tanmay.sharma.23cse@bmu.edu.in">
        </div>
        <div class="form-field">
          <label>Mobile Number (Optional)</label>
          <input type="tel" id="reqMobile" placeholder="e.g. +91 9876543210">
        </div>
        <button type="submit" class="btn btn-primary btn-block">Submit Signup Request</button>
      </form>
      <p style="font-size:12px; color:var(--ink-soft); margin-top:14px; text-align:center;">
        Already received credentials? <a href="#/login" style="color:var(--navy); font-weight:600;">Sign in here</a>
      </p>
    </div>
  `;
}

// 5. Login View (Holds Login, 2FA Challenge, QR Setup, and Emergency Reset)
function LoginView() {
  return `
    <div class="auth-panel" id="loginCard">
      <h2 style="font-family:var(--font-display); font-size:24px; margin-bottom:6px;">Sign In</h2>
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:20px;">Use your assigned <b>@openroom.xyz</b> email or BMU credentials.</p>
      <div id="loginInlineErr" style="display:none;" class="inline-error"></div>
      
      <form id="userLoginForm">
        <div class="form-field">
          <label>Login Email</label>
          <input type="text" id="loginEmail" required placeholder="Enter your email">
        </div>
        <div class="form-field">
          <label>Password</label>
          <input type="password" id="loginPassword" required placeholder="••••••••">
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="btnSubmitLogin">Sign In</button>
      </form>
      <div style="margin-top:16px; font-size:12px; color:var(--ink-soft); text-align:center;">
        Need an account? <a href="#/request-access" style="color:var(--navy); font-weight:600;">Request Day Scholar Access</a>
      </div>
    </div>

    <!-- Container for 2FA Verification / Initial QR Code Setup / Emergency Reset -->
    <div class="auth-panel" id="twoFactorCard" style="display:none;"></div>
  `;
}

// 6. User Profile Customization View
async function AccountView() {
  if (!state.user || !state.token) return LoginView();

  try {
    const res = await api('/api/auth/me');
    if (res.user) {
      state.user = { ...state.user, ...res.user };
      localStorage.setItem('openroom_user', JSON.stringify(state.user));
    }
  } catch (err) {
    console.warn('Using local cache for account view');
  }

  const u = state.user;
  const initial = (u.name || 'U').charAt(0).toUpperCase();
  const color = u.avatarColor || '#118A5E';

  const branchOptions = [
    'B.Tech CSE',
    'B.Tech AI & DS',
    'B.Tech ECE',
    'B.Tech Mechanical',
    'BBA',
    'MBA',
    'B.Com (Hons)',
    'School of Law',
    'Staff / Faculty',
    'Administration'
  ];

  return `
    <div class="container" style="max-width:680px;">
      <div class="content-card" style="padding:28px; margin-bottom:24px;">
        
        <!-- Profile Header Badge -->
        <div style="display:flex; align-items:center; gap:18px; margin-bottom:20px; flex-wrap:wrap;">
          <div id="profileAvatarBadge" style="width:72px; height:72px; border-radius:50%; background:${color}; color:#ffffff; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-size:30px; font-weight:700; box-shadow:0 4px 14px rgba(0,0,0,0.12); transition: background-color 0.2s;">
            ${initial}
          </div>
          <div>
            <h2 id="profileHeaderName" style="font-family:var(--font-display); font-size:24px; margin:0 0 4px 0;">${u.name}</h2>
            <div style="font-size:13px; color:var(--ink-soft);">
              <code>${u.email}</code> &bull; <span class="status-pill empty" style="font-size:11px; margin-left:4px;">${(u.role || 'student').toUpperCase()}</span>
            </div>
            <div id="profileHeaderSub" style="font-size:12px; color:var(--ink-soft); margin-top:3px;">
              ${u.branch || 'B.Tech CSE'} &bull; Batch ${u.batchYear || '2026'}
            </div>
          </div>
        </div>

        <div id="accountInlineMsg" style="display:none; padding:10px 14px; border-radius:6px; font-size:13px; margin-bottom:18px;"></div>

        <hr style="border:none; border-top:1px solid var(--line); margin:18px 0 22px 0;">

        <!-- Profile Customization Form -->
        <h3 style="margin-bottom:14px; font-size:18px;">Profile Details</h3>
        <form id="updateProfileForm">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div class="form-field">
              <label>Full Display Name</label>
              <input type="text" id="profName" value="${u.name || ''}" required placeholder="Your full name">
            </div>
            <div class="form-field">
              <label>Contact / Mobile No.</label>
              <input type="tel" id="profMobile" value="${u.mobile && u.mobile !== 'N/A' ? u.mobile : ''}" placeholder="+91 9876543210">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div class="form-field">
              <label>Branch / School</label>
              <select id="profBranch">
                ${branchOptions.map(b => `<option value="${b}" ${(u.branch || 'B.Tech CSE') === b ? 'selected' : ''}>${b}</option>`).join('')}
              </select>
            </div>
            <div class="form-field">
              <label>Graduation Batch Year</label>
              <input type="text" id="profBatch" value="${u.batchYear || '2026'}" placeholder="e.g. 2026">
            </div>
          </div>

          <div class="form-field">
            <label>Avatar Theme Accent</label>
            <div style="display:flex; gap:12px; align-items:center; margin-top:6px;">
              <input type="color" id="profColor" value="${color}" style="width:48px; height:38px; border:1px solid var(--line); border-radius:6px; cursor:pointer; background:none; padding:2px;">
              <div style="display:flex; gap:6px;">
                ${['#118A5E', '#131D35', '#DC9222', '#D9383A', '#2563EB', '#7C3AED'].map(c => `
                  <button type="button" class="btnPresetColor" data-color="${c}" style="width:24px; height:24px; border-radius:50%; background:${c}; border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.2); cursor:pointer;"></button>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="form-field">
            <label>Bio / Campus Status</label>
            <input type="text" id="profBio" value="${u.bio || ''}" placeholder="e.g. 3rd Year CSE Day Scholar &bull; E-2 Building Study Group">
          </div>

          <button type="submit" class="btn btn-primary btn-sm" id="btnSaveProfile" style="margin-top:6px;">Save Changes</button>
        </form>

        <hr style="border:none; border-top:1px solid var(--line); margin:28px 0;">

        <!-- Security & Password -->
        <h3 style="margin-bottom:14px; font-size:18px;">Security & Password</h3>
        <form id="changePasswordForm">
          <div class="form-field">
            <label>Current Password</label>
            <input type="password" id="currentPass" required placeholder="Current password">
          </div>
          <div class="form-field">
            <label>New Password</label>
            <input type="password" id="newPass" required placeholder="At least 6 characters">
          </div>
          <button type="submit" class="btn btn-ghost btn-sm" id="btnSavePassword">Update Password</button>
        </form>

      </div>
    </div>
  `;
}

// 7. Reddit-Style Community Threads & Spot Reviews View
async function ReviewsView() {
  let reviews = [];
  try {
    const res = await api('/api/reviews');
    reviews = res.data || [];
  } catch (err) {
    console.error('Failed to load discussions:', err);
  }

  const currentUser = state.user;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const tags = ['All', 'General', 'E-2 Building', 'Gateway Building', 'Library', 'Innovation Hub', 'WiFi/AC'];

  return `
    <div class="container" style="max-width:840px;">
      <div style="margin-bottom:24px; text-align:center;">
        <h1 style="font-family:var(--font-display); font-size:30px; margin-bottom:6px;">Campus Discussions & Spot Reviews</h1>
        <p style="color:var(--ink-soft);">Connect with other day scholars, share room tips, and collaborate on campus life.</p>
      </div>

      <!-- Create Thread Card -->
      ${currentUser ? `
        <div class="content-card" style="margin:0 0 24px 0; padding:22px;">
          <h3 style="margin-bottom:14px; font-size:17px;">Create a Discussion Post</h3>
          <form id="newReviewForm">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
              <div class="form-field" style="margin:0;">
                <label>Category</label>
                <select id="reviewKind">
                  <option value="review">Campus Room Review</option>
                  <option value="suggestion">Feature Suggestion</option>
                  <option value="discussion">General Question / Discussion</option>
                </select>
              </div>
              <div class="form-field" style="margin:0;">
                <label>Campus Tag</label>
                <select id="reviewTag">
                  <option value="General">General</option>
                  <option value="E-2 Building">E-2 Building</option>
                  <option value="Gateway Building">Gateway Building</option>
                  <option value="Library">Library</option>
                  <option value="Innovation Hub">Innovation Hub</option>
                  <option value="WiFi/AC">WiFi & AC</option>
                </select>
              </div>
            </div>
            <div class="form-field">
              <label>Your Message / Tip</label>
              <textarea id="reviewBody" rows="3" required placeholder="e.g. Innovation Hub 2nd floor study pods have great AC and plenty of charging ports right now..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Post to Community</button>
          </form>
        </div>
      ` : `
        <div class="box-highlight" style="text-align:center; padding:24px; margin-bottom:24px;">
          <h3>Join the BMU Day Scholar Community</h3>
          <p style="font-size:14px; color:var(--ink-soft); margin:8px 0 16px;">Sign in to start discussions, upvote helpful study spot reviews, and reply to peers.</p>
          <button class="btn btn-primary btn-sm" data-route="#/login">Log In to Participate</button>
        </div>
      `}

      <!-- Tags Filter Bar -->
      <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:10px; margin-bottom:16px;">
        ${tags.map(t => `
          <button class="btn btn-sm ${state.threadFilter.tag === t ? 'btn-primary' : 'btn-ghost'} btnTagFilter" data-tag="${t}" style="border-radius:20px; font-size:12px; padding:4px 14px; white-space:nowrap;">
            ${t}
          </button>
        `).join('')}
      </div>

      <!-- Thread Feed -->
      <div id="threadList" style="display:flex; flex-direction:column; gap:16px;">
        ${reviews.length ? reviews.map(r => renderThreadCard(r, currentUser, isAdmin)).join('') : `
          <div style="text-align:center; padding:40px; color:var(--ink-soft); background:#fff; border-radius:10px; border:1px solid var(--line);">
            No discussions found. Be the first to start a conversation!
          </div>
        `}
      </div>
    </div>
  `;
}

function renderThreadCard(r, currentUser, isAdmin) {
  const upvoted = currentUser && r.upvotes && r.upvotes.includes(currentUser.email);
  const comments = r.comments || [];
  const isPostOwner = currentUser && r.authorEmail && r.authorEmail.toLowerCase() === currentUser.email.toLowerCase();
  const canDeletePost = isPostOwner || isAdmin;

  return `
    <div class="content-card thread-card" style="margin:0; padding:20px; border-left:4px solid ${r.isNoted ? 'var(--line)' : r.kind === 'suggestion' ? 'var(--navy)' : 'var(--open)'};" data-thread-id="${r._id}">
      <div style="display:flex; gap:14px;">
        
        <!-- Left Reddit Voting Column -->
        <div style="display:flex; flex-direction:column; align-items:center; min-width:32px;">
          <button class="vote-btn ${upvoted ? 'active' : ''}" onclick="voteThread('${r._id}')" style="background:none; border:none; cursor:pointer; font-size:16px; color:${upvoted ? 'var(--open)' : 'var(--ink-soft)'};" title="Upvote">
            ▲
          </button>
          <span style="font-weight:700; font-size:13px; color:var(--ink); margin:2px 0;">${r.score || (r.upvotes?.length || 0)}</span>
        </div>

        <!-- Main Thread Content -->
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="width:26px; height:26px; border-radius:50%; background:${r.avatarColor || '#131D35'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">
                ${(r.author || 'S').charAt(0).toUpperCase()}
              </div>
              <strong style="font-size:14px;">${r.author}</strong>
              <span class="status-pill ${r.kind === 'suggestion' ? 'empty' : 'busy'}" style="font-size:11px;">
                ${r.kind === 'suggestion' ? '💡 Idea' : r.kind === 'discussion' ? '💬 Discussion' : '📍 Review'}
              </span>
              <span style="background:var(--paper); color:var(--ink-soft); font-size:11px; padding:2px 8px; border-radius:10px; font-weight:600;">
                ${r.tag || 'General'}
              </span>
              ${r.isNoted ? `<span style="background:#f1f5f9; color:#475569; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:600;">📌 NOTED</span>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; color:var(--ink-soft);">
                ${new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              ${canDeletePost ? `
                <button onclick="deleteThread('${r._id}')" style="background:none; border:none; cursor:pointer; color:#d9383a; font-size:13px; padding:2px 6px; border-radius:4px;" title="Delete Post">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>

          <p style="font-size:14px; color:var(--ink); line-height:1.5; margin-bottom:12px;">${r.body}</p>

          <!-- Official Admin Reply Badge if exists -->
          ${r.adminReply && r.adminReply.message ? `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <div style="width:22px; height:22px; border-radius:50%; background:var(--navy); color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">⚡</div>
                <strong style="font-size:12px; color:var(--navy);">${r.adminReply.repliedBy || 'BMU Administrator'}</strong>
                <span style="background:var(--open-soft); color:var(--open); font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px;">OFFICIAL ADMIN</span>
              </div>
              <p style="font-size:13px; color:#334155; margin:0; padding-left:30px; line-height:1.4;">${r.adminReply.message}</p>
            </div>
          ` : ''}

          <!-- Thread Actions Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--ink-soft); border-top:1px solid var(--line); padding-top:10px; margin-top:10px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; gap:12px; align-items:center;">
              <span style="cursor:pointer; font-weight:600; color:var(--navy);">
                💬 ${comments.length} ${comments.length === 1 ? 'Comment' : 'Comments'}
              </span>
            </div>

            <!-- Admin Note Action Control -->
            ${isAdmin && !r.isNoted ? `
              <button class="btn btn-ghost btn-sm btnMarkNoted" data-id="${r._id}" style="padding:2px 8px; font-size:11px;">
                📌 Note
              </button>
            ` : ''}
          </div>

          <!-- Nested Comments List -->
          <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
            ${comments.map(c => {
              const isCommentOwner = currentUser && c.authorEmail && c.authorEmail.toLowerCase() === currentUser.email.toLowerCase();
              const canDeleteComment = isCommentOwner || isAdmin;

              return `
                <div style="display:flex; gap:10px; background:var(--paper); padding:10px 12px; border-radius:8px; font-size:13px;">
                  <div style="width:22px; height:22px; border-radius:50%; background:${c.avatarColor || '#131D35'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; flex-shrink:0;">
                    ${(c.author || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                      <span style="font-weight:700; font-size:12px; color:var(--ink);">
                        ${c.author} ${c.authorRole === 'admin' ? '<span style="color:var(--open); font-size:10px;">(Admin)</span>' : ''}
                      </span>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:11px; color:var(--ink-soft);">${new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        ${canDeleteComment ? `
                          <button onclick="deleteComment('${r._id}', '${c._id}')" style="background:none; border:none; cursor:pointer; color:#d9383a; font-size:11px; padding:0 2px;" title="Delete Reply">
                            ✕
                          </button>
                        ` : ''}
                      </div>
                    </div>
                    <div style="color:var(--ink);">${c.body}</div>
                  </div>
                </div>
              `;
            }).join('')}

            <!-- Quick Comment Box -->
            ${currentUser ? `
              <form onsubmit="submitComment(event, '${r._id}')" style="display:flex; gap:8px; margin-top:6px;">
                <input type="text" id="comment-input-${r._id}" placeholder="Write a reply to ${r.author}..." required style="flex:1; padding:7px 12px; border-radius:6px; border:1px solid var(--line); font-size:12.5px;" />
                <button type="submit" class="btn btn-primary btn-sm" style="padding:6px 12px; font-size:12px;">Reply</button>
              </form>
            ` : ''}
          </div>

        </div>
      </div>
    </div>
  `;
}

// Global window actions
window.voteThread = async function(threadId) {
  if (!state.token) {
    toast('Please sign in to upvote discussions.', 'default');
    location.hash = '#/login';
    return;
  }
  try {
    await api(`/api/reviews/${threadId}/vote`, { method: 'POST' });
    router();
  } catch (err) {}
};

window.submitComment = async function(e, threadId) {
  e.preventDefault();
  if (!state.token) {
    toast('Please sign in to reply.', 'default');
    location.hash = '#/login';
    return;
  }
  const input = document.getElementById(`comment-input-${threadId}`);
  const body = input ? input.value.trim() : '';
  if (!body) return;

  try {
    await api(`/api/reviews/${threadId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
    toast('Reply posted!', 'success');
    router();
  } catch (err) {}
};

window.deleteThread = async function(threadId) {
  if (!confirm('Are you sure you want to delete this discussion?')) return;
  try {
    const res = await api(`/api/reviews/${threadId}`, { method: 'DELETE' });
    toast(res.message || 'Discussion deleted.', 'success');
    router();
  } catch (err) {}
};

window.deleteComment = async function(threadId, commentId) {
  if (!confirm('Are you sure you want to delete this reply?')) return;
  try {
    const res = await api(`/api/reviews/${threadId}/comments/${commentId}`, { method: 'DELETE' });
    toast(res.message || 'Reply deleted.', 'success');
    router();
  } catch (err) {}
};

// Global window actions for direct onclick handling
window.voteThread = async function(threadId) {
  if (!state.token) {
    toast('Please sign in to upvote discussions.', 'default');
    location.hash = '#/login';
    return;
  }
  try {
    await api(`/api/reviews/${threadId}/vote`, { method: 'POST' });
    router();
  } catch (err) {
    // Handled by API dispatcher
  }
};

window.submitComment = async function(e, threadId) {
  e.preventDefault();
  if (!state.token) {
    toast('Please sign in to reply.', 'default');
    location.hash = '#/login';
    return;
  }
  const input = document.getElementById(`comment-input-${threadId}`);
  const body = input ? input.value.trim() : '';
  if (!body) return;

  try {
    await api(`/api/reviews/${threadId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
    toast('Reply posted!', 'success');
    router();
  } catch (err) {
    // Handled by API dispatcher
  }
};

// 8. Admin View
async function AdminView() {
  if (!state.user || state.user.role !== 'admin') {
    return `
      <div class="container" style="text-align:center; padding:80px 24px;">
        <h2>Administrator Access Required</h2>
        <p style="color:var(--ink-soft); margin:12px 0 20px;">Please sign in with administrator credentials.</p>
        <button class="btn btn-primary" data-route="#/login">Admin Sign In</button>
      </div>
    `;
  }

  const [overviewRes, roomsRes] = await Promise.all([
    api('/api/admin/overview'),
    api('/api/rooms')
  ]);

  const { stats, requests, reports } = overviewRes;
  const allRooms = roomsRes.data;

  return `
    <div class="container">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
        <div>
          <h1 style="font-family:var(--font-display); font-size:30px;">BMU Administrator Center</h1>
          <p style="color:var(--ink-soft);">Assign custom <b>@openroom.xyz</b> emails, manage passwords, and sync Excel roster.</p>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="btnOpenAddRoomModal">➕ Add New Room</button>
          <a href="/api/admin/export-excel" class="btn btn-excel btn-sm" download>
            📥 Download Day Scholars Excel (.xlsx)
          </a>
        </div>
      </div>

      <!-- Campus Statistics Counters -->
      <div class="hero-metrics" style="margin-top:0; margin-bottom:24px;">
        <div class="metric-box"><b>${stats.totalRooms}</b><span>Total Rooms</span></div>
        <div class="metric-box"><b>${stats.emptyRooms}</b><span>Free Rooms</span></div>
        <div class="metric-box"><b>${stats.occupiedRooms}</b><span>Occupied</span></div>
        <div class="metric-box"><b>${stats.pendingRequests}</b><span>Pending Signups</span></div>
      </div>

      <!-- Student Registration & Excel Queue -->
      <div class="content-card" style="max-width:100%; margin:0 0 30px 0; padding:22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3>Day Scholar User Management (${requests.length})</h3>
            <p style="font-size:13px; color:var(--ink-soft);">Set custom @openroom.xyz email addresses, passwords, and reset credentials anytime.</p>
          </div>
        </div>
        
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>BMU Email</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>Assigned Login (@openroom.xyz)</th>
                <th>Current Password</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${requests.length ? requests.map(r => `
                <tr>
                  <td><b>${r.name}</b></td>
                  <td>${r.bmuEmail}</td>
                  <td>${r.mobile || 'N/A'}</td>
                  <td><span class="status-pill ${r.status === 'approved' ? 'empty' : 'busy'}">${r.status}</span></td>
                  <td><code style="font-weight:600; color:var(--navy);">${r.provisionedEmail || '—'}</code></td>
                  <td><code style="background:var(--paper); padding:2px 6px; border-radius:4px;">${r.temporaryPassword || '—'}</code></td>
                  <td>
                    ${r.status === 'pending' ? `
                      <button class="btn btn-primary btn-sm btnOpenProvisionModal"
                        data-id="${r._id}"
                        data-name="${r.name}"
                        data-bmu="${r.bmuEmail}"
                        data-mobile="${r.mobile}">
                        Approve & Assign Login
                      </button>
                    ` : `
                      <button class="btn btn-ghost btn-sm btnOpenResetModal"
                        data-id="${r._id}"
                        data-name="${r.name}"
                        data-email="${r.provisionedEmail || ''}"
                        data-pass="${r.temporaryPassword || ''}">
                        🔑 Edit / Change Pass
                      </button>
                    `}
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--ink-soft);">No signup requests logged yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Live Room Management Section -->
      <div class="content-card" style="max-width:100%; margin:0 0 30px 0; padding:22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3>All Campus Rooms (${allRooms.length})</h3>
            <p style="font-size:13px; color:var(--ink-soft);">Toggle availability manually or delete obsolete rooms.</p>
          </div>
          <input type="text" id="adminRoomSearch" placeholder="Search room in table..." style="padding:7px 12px; border:1px solid var(--line); border-radius:6px; font-size:13px;">
        </div>

        <div style="max-height:380px; overflow-y:auto; border:1px solid var(--line); border-radius:8px;">
          <table class="data-table" id="adminRoomsTable">
            <thead>
              <tr>
                <th>Room Code</th>
                <th>Building & Floor</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${allRooms.map(r => `
                <tr data-code="${r.code}">
                  <td><strong style="font-family:var(--font-mono); font-size:15px;">${r.code}</strong></td>
                  <td>${r.building} (Floor ${r.floor})</td>
                  <td>${r.type}</td>
                  <td>${r.capacity} seats</td>
                  <td><span class="status-pill ${r.status}"><i></i>${r.status}</span></td>
                  <td>
                    <button class="btn btn-ghost btn-sm btnAdminToggle" data-code="${r.code}" data-current="${r.status}">
                      Toggle Status
                    </button>
                    <button class="btn btn-busy btn-sm btnAdminDelete" data-code="${r.code}" style="margin-left:6px;">
                      Delete
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Report Incidents -->
      <div class="content-card" style="max-width:100%; margin:0; padding:22px;">
        <h3>Recent Room Reports (${reports.length})</h3>
        <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
          ${reports.length ? reports.map(rp => `
            <div style="padding:12px; background:var(--paper); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <b>Room ${rp.roomCode}</b> &bull; <span style="color:var(--ink-soft); font-size:13px;">${rp.note || 'No note provided'}</span>
              </div>
              <span style="font-size:12px; color:var(--ink-soft);">${new Date(rp.reportedAt).toLocaleTimeString()}</span>
            </div>
          `).join('') : '<p style="color:var(--ink-soft);">No incidents reported recently.</p>'}
        </div>
      </div>
    </div>

    <!-- Modal 1: Approve & Assign Custom Email / Password -->
    <div id="provisionModal" class="modal-overlay" style="display:none;">
      <div class="modal-window">
        <h3>Assign Student Credentials</h3>
        <p style="font-size:13px; color:var(--ink-soft); margin:6px 0 16px;">Set their custom email address and initial password. This will auto-update the Excel file.</p>
        <form id="provisionForm">
          <input type="hidden" id="provReqId">
          <input type="hidden" id="provMobile">
          <div class="form-field">
            <label>Student Name</label>
            <input type="text" id="provName" readonly style="background:var(--paper);">
          </div>
          <div class="form-field">
            <label>Official BMU Email</label>
            <input type="text" id="provBmuEmail" readonly style="background:var(--paper);">
          </div>
          <div class="form-field">
            <label>Custom Login Email (Ending with @openroom.xyz)</label>
            <input type="email" id="provCustomEmail" required placeholder="tanmay@openroom.xyz">
          </div>
          <div class="form-field">
            <label>Assigned Password</label>
            <input type="text" id="provPassword" required placeholder="BMU@123456">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-ghost btn-sm" id="btnCloseProvisionModal">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">Approve & Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal 2: Change/Reset Student Password -->
    <div id="resetStudentModal" class="modal-overlay" style="display:none;">
      <div class="modal-window">
        <h3>Edit Student Credentials</h3>
        <p style="font-size:13px; color:var(--ink-soft); margin:6px 0 16px;">Update their assigned login email or assign a new password.</p>
        <form id="resetStudentForm">
          <input type="hidden" id="resetReqId">
          <div class="form-field">
            <label>Student Name</label>
            <input type="text" id="resetName" readonly style="background:var(--paper);">
          </div>
          <div class="form-field">
            <label>Assigned Login Email (@openroom.xyz)</label>
            <input type="email" id="resetCustomEmail" required>
          </div>
          <div class="form-field">
            <label>New Password</label>
            <input type="text" id="resetNewPass" required placeholder="New password">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-ghost btn-sm" id="btnCloseResetModal">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">Update Password</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal 3: Add Room -->
    <div id="addRoomModal" class="modal-overlay" style="display:none;">
      <div class="modal-window">
        <h3>Add Room to BMU Directory</h3>
        <form id="createRoomForm" style="margin-top:16px;">
          <div class="form-field">
            <label>Room Code (e.g. E2-101, GW-202, LIB-101)</label>
            <input type="text" id="mCode" required placeholder="E2-101">
          </div>
          <div class="form-field">
            <label>Building</label>
            <select id="mBuilding" required>
              <option value="E-2 Building">E-2 Building</option>
              <option value="Gateway Building">Gateway Building</option>
              <option value="Central Library">Central Library</option>
              <option value="Innovation Hub">Innovation Hub</option>
            </select>
          </div>
          <div class="form-field">
            <label>Floor Number</label>
            <input type="number" id="mFloor" min="1" max="5" value="1" required>
          </div>
          <div class="form-field">
            <label>Room Type</label>
            <select id="mType" required>
              <option value="Classroom">Classroom</option>
              <option value="Seminar Hall">Seminar Hall</option>
              <option value="Study Pod">Study Pod</option>
              <option value="Computer Lab">Computer Lab</option>
              <option value="Discussion Room">Discussion Room</option>
            </select>
          </div>
          <div class="form-field">
            <label>Seating Capacity</label>
            <input type="number" id="mCapacity" min="1" value="35" required>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-ghost btn-sm" id="btnCloseAddRoomModal">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">Create Room</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// 9. Custom 404 Radar View
function NotFoundView(customMessage = null) {
  return `
    <div class="container">
      <div class="notfound-card">
        <div class="notfound-radar">
          <div class="notfound-radar-icon">🧭</div>
        </div>
        <div class="notfound-badge">
          <span>●</span> 404 &bull; ROOM OR PAGE NOT FOUND
        </div>
        <div class="notfound-code">404</div>
        <h1 class="notfound-title">Lost on Campus?</h1>
        <p class="notfound-desc">
          ${customMessage || "The classroom code or URL you entered doesn't exist on the BML Munjal University live directory."}
        </p>
        <div class="notfound-actions">
          <button class="btn btn-primary" data-route="#/rooms">
            🔍 Check Live Free Rooms
          </button>
          <button class="btn btn-ghost" data-route="#/">
            🏛️ Campus Overview
          </button>
        </div>
        <div style="margin-top: 32px; padding-top: 18px; border-top: 1px solid var(--line); font-size: 12px; color: var(--ink-soft);">
          Looking for a specific building? Check <b>E-2 Building</b>, <b>Gateway Building</b>, <b>Central Library</b>, or <b>Innovation Hub</b>.
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// SPA ROUTER DISPATCHER
// ==========================================
async function router() {
  renderNav();
  const host = document.getElementById('viewPort');
  if (!host) return;
  const hash = location.hash || '#/';

  try {
    if (hash === '#/') {
      host.innerHTML = await HomeView();
    } else if (hash === '#/rooms') {
      host.innerHTML = await RoomsView();
      renderRoomsMatrix();
      attachFilterListeners();
    } else if (hash.startsWith('#/room/')) {
      const code = hash.split('/')[2];
      host.innerHTML = await RoomDetailView(code);
      attachDetailListeners(code);
    } else if (hash === '#/request-access') {
      host.innerHTML = RequestAccessView();
      attachAccessRequestForm();
    } else if (hash === '#/login') {
      host.innerHTML = LoginView();
      attachLoginForm();
    } else if (hash === '#/account') {
      host.innerHTML = await AccountView();
      attachAccountForm();
    } else if (hash === '#/reviews') {
      host.innerHTML = await ReviewsView();
      attachReviewForm();
    } else if (hash === '#/admin') {
      host.innerHTML = await AdminView();
      attachAdminHandlers();
    } else {
      host.innerHTML = NotFoundView();
    }
  } catch (err) {
    console.error('Route Dispatch Error:', err);
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

// Route click delegation & Logout
document.addEventListener('click', (e) => {
  const routeTarget = e.target.closest('[data-route]');
  if (routeTarget) {
    location.hash = routeTarget.getAttribute('data-route');
  }
  if (e.target.id === 'logoutAction') {
    localStorage.removeItem('openroom_user');
    localStorage.removeItem('openroom_token');
    state.user = null;
    state.token = null;
    toast('Logged out successfully', 'success');
    location.hash = '#/';
  }
});

// ==========================================
// DOM EVENT ATTACHERS
// ==========================================

function attachFilterListeners() {
  document.getElementById('filterSearch')?.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderRoomsMatrix();
  });
  document.getElementById('filterBuilding')?.addEventListener('change', (e) => {
    state.filters.building = e.target.value;
    renderRoomsMatrix();
  });
  document.getElementById('filterStatus')?.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    renderRoomsMatrix();
  });
}

function attachDetailListeners(code) {
  document.getElementById('voteEmpty')?.addEventListener('click', async () => {
    await api(`/api/rooms/${code}/vote`, { method: 'POST', body: JSON.stringify({ action: 'empty' }) });
    toast(`${code} marked as empty.`, 'success');
    router();
  });
  document.getElementById('voteBusy')?.addEventListener('click', async () => {
    const res = await api(`/api/rooms/${code}/vote`, { method: 'POST', body: JSON.stringify({ action: 'busy' }) });
    toast(res.message, 'default');
    router();
  });

  const arrivalBox = document.getElementById('arrivalFlowBox');
  document.getElementById('btnStartWalking')?.addEventListener('click', () => {
    arrivalBox.innerHTML = `
      <h4>You are walking to ${code}</h4>
      <p style="font-size:13px; color:var(--ink-soft); margin:6px 0 12px;">Did you arrive? Was the room empty as indicated?</p>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-open btn-sm" id="btnArrivalYes">Yes, it was empty!</button>
        <button class="btn btn-busy btn-sm" id="btnArrivalNo">No, it is occupied</button>
      </div>
    `;

    document.getElementById('btnArrivalYes')?.addEventListener('click', () => {
      arrivalBox.innerHTML = `
        <div style="background:var(--open-soft); color:var(--open); padding:12px; border-radius:8px; font-weight:600;">
          🎉 Hope it helped! Have a productive study session.
        </div>
      `;
    });

    document.getElementById('btnArrivalNo')?.addEventListener('click', async () => {
      const res = await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ roomCode: code, note: 'Found occupied upon arrival' })
      });
      let altHtml = res.alternativeRoom 
        ? `<div style="margin-top:8px;">Try this nearby room: <a href="#/room/${res.alternativeRoom.code}"><b>${res.alternativeRoom.code}</b> (${res.alternativeRoom.building})</a></div>`
        : '';
      arrivalBox.innerHTML = `
        <div style="background:var(--busy-soft); color:var(--busy); padding:12px; border-radius:8px;">
          😔 <b>Sorry about that!</b> We have marked ${code} as occupied so others don't get misled. ${altHtml}
        </div>
      `;
    });
  });

  document.getElementById('btnSubmitReport')?.addEventListener('click', async () => {
    const note = document.getElementById('reportReason').value;
    const res = await api('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ roomCode: code, note })
    });
    const feedback = document.getElementById('reportResultFeedback');
    feedback.innerHTML = `
      <div style="color:var(--busy); font-size:13px; font-weight:600;">Report recorded. Room status set to occupied.</div>
      ${res.alternativeRoom ? `<div style="font-size:13px; margin-top:4px;">Alternative suggested: <a href="#/room/${res.alternativeRoom.code}"><b>${res.alternativeRoom.code}</b> (${res.alternativeRoom.building})</a></div>` : ''}
    `;
  });
}

function attachAccessRequestForm() {
  document.getElementById('accessRequestForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reqName').value;
    const bmuEmail = document.getElementById('reqBmuEmail').value;
    const mobile = document.getElementById('reqMobile').value;
    const errBox = document.getElementById('requestInlineErr');

    try {
      const res = await api('/api/auth/request-access', {
        method: 'POST',
        body: JSON.stringify({ name, bmuEmail, mobile })
      });
      toast(res.message, 'success');
      location.hash = '#/';
    } catch (err) {
      errBox.innerText = err.message;
      errBox.style.display = 'block';
    }
  });
}

function attachLoginForm() {
  const loginForm = document.getElementById('userLoginForm');
  const loginCard = document.getElementById('loginCard');
  const twoFactorCard = document.getElementById('twoFactorCard');
  const errBox = document.getElementById('loginInlineErr');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (res.require2FASetup) {
        loginCard.style.display = 'none';
        twoFactorCard.style.display = 'block';
        twoFactorCard.innerHTML = `
          <div style="text-align:center;">
            <div style="font-size:32px; margin-bottom:8px;">🔐</div>
            <h2 style="font-family:var(--font-display); font-size:22px;">Set Up Google Authenticator</h2>
            <p style="font-size:13px; color:var(--ink-soft); margin:6px 0 16px;">
              Open <b>Google Authenticator</b> on your phone, tap <b>+</b>, and scan this QR code:
            </p>
            <div style="background:#fff; padding:12px; display:inline-block; border-radius:10px; border:1px solid var(--line); margin-bottom:12px;">
              <img src="${res.qrCode}" alt="2FA QR Code" style="width:190px; height:190px; display:block;">
            </div>
            <p style="font-size:11px; color:var(--ink-soft); margin-bottom:14px;">
              Can't scan? Enter key manually: <br><code style="font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--navy);">${res.manualKey}</code>
            </p>
            <div id="twoFactorErr" style="display:none;" class="inline-error"></div>
            <form id="verify2FAForm">
              <input type="hidden" id="twoFactorUserId" value="${res.userId}">
              <div class="form-field">
                <label>Enter 6-Digit Code from App</label>
                <input type="text" id="totpCode" maxlength="6" pattern="[0-9]{6}" required placeholder="e.g. 482910" autofocus style="text-align:center; font-size:20px; font-weight:700; letter-spacing:4px;">
              </div>
              <button type="submit" class="btn btn-primary btn-block">Activate 2FA & Enter Admin</button>
            </form>
          </div>
        `;
        attach2FAVerification();
        return;
      }

      if (res.require2FA) {
        loginCard.style.display = 'none';
        twoFactorCard.style.display = 'block';
        twoFactorCard.innerHTML = `
          <div style="text-align:center;">
            <div style="font-size:32px; margin-bottom:8px;">🛡️</div>
            <h2 style="font-family:var(--font-display); font-size:22px;">Two-Factor Authentication</h2>
            <p style="font-size:13px; color:var(--ink-soft); margin:6px 0 16px;">
              Enter the 6-digit verification code from your <b>Google Authenticator</b> app.
            </p>
            <div id="twoFactorErr" style="display:none;" class="inline-error"></div>
            <form id="verify2FAForm">
              <input type="hidden" id="twoFactorUserId" value="${res.userId}">
              <div class="form-field">
                <label>6-Digit Authenticator Code</label>
                <input type="text" id="totpCode" maxlength="6" pattern="[0-9]{6}" required placeholder="000000" autofocus style="text-align:center; font-size:22px; font-weight:700; letter-spacing:5px;">
              </div>
              <button type="submit" class="btn btn-primary btn-block">Verify Code</button>
              
              <div style="margin-top:14px; display:flex; flex-direction:column; gap:6px; font-size:12px;">
                <a href="javascript:void(0)" id="btnOpenRecoveryModal" style="color:#d9383a; font-weight:600;">Lost your Authenticator device?</a>
                <a href="javascript:void(0)" id="btnCancel2FA" style="color:var(--ink-soft);">← Back to login</a>
              </div>
            </form>

            <div id="emergencyResetBox" style="display:none; margin-top:20px; text-align:left; border-top:1px solid var(--line); padding-top:16px;">
              <h4 style="color:#d9383a; margin-bottom:6px;">Emergency 2FA Reset</h4>
              <p style="font-size:12px; color:var(--ink-soft); margin-bottom:12px;">Enter your admin password and Master Recovery Key.</p>
              <form id="emergencyResetForm">
                <div class="form-field">
                  <label>Admin Email</label>
                  <input type="email" id="recEmail" value="${email}" required>
                </div>
                <div class="form-field">
                  <label>Admin Password</label>
                  <input type="password" id="recPass" required placeholder="Admin password">
                </div>
                <div class="form-field">
                  <label>Master Recovery Key</label>
                  <input type="password" id="recKey" required placeholder="Paste emergency recovery key">
                </div>
                <button type="submit" class="btn btn-busy btn-block btn-sm">Reset 2FA & Generate New QR</button>
                <button type="button" class="btn btn-ghost btn-block btn-sm" id="btnCancelRecovery" style="margin-top:6px;">Cancel Recovery</button>
              </form>
            </div>
          </div>
        `;
        attach2FAVerification();
        return;
      }

      localStorage.setItem('openroom_token', res.token);
      localStorage.setItem('openroom_user', JSON.stringify(res.user));
      state.user = res.user;
      state.token = res.token;
      toast(`Welcome back, ${res.user.name}`, 'success');
      location.hash = res.user.role === 'admin' ? '#/admin' : '#/rooms';
    } catch (err) {
      errBox.innerText = err.message;
      errBox.style.display = 'block';
    }
  });
}

function attach2FAVerification() {
  const form = document.getElementById('verify2FAForm');
  const errBox = document.getElementById('twoFactorErr');
  const btnCancel = document.getElementById('btnCancel2FA');
  const btnOpenRecovery = document.getElementById('btnOpenRecoveryModal');
  const btnCancelRecovery = document.getElementById('btnCancelRecovery');
  const recoveryBox = document.getElementById('emergencyResetBox');
  const recForm = document.getElementById('emergencyResetForm');

  btnCancel?.addEventListener('click', () => {
    document.getElementById('twoFactorCard').style.display = 'none';
    document.getElementById('loginCard').style.display = 'block';
  });

  btnOpenRecovery?.addEventListener('click', () => {
    if (recoveryBox) recoveryBox.style.display = 'block';
  });

  btnCancelRecovery?.addEventListener('click', () => {
    if (recoveryBox) recoveryBox.style.display = 'none';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('twoFactorUserId').value;
    const code = document.getElementById('totpCode').value;

    try {
      const res = await api('/api/auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify({ userId, code })
      });

      localStorage.setItem('openroom_token', res.token);
      localStorage.setItem('openroom_user', JSON.stringify(res.user));
      state.user = res.user;
      state.token = res.token;

      toast('2FA Verified Successfully! Welcome Admin.', 'success');
      location.hash = '#/admin';
    } catch (err) {
      errBox.innerText = err.message;
      errBox.style.display = 'block';
    }
  });

  recForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('recEmail').value;
    const password = document.getElementById('recPass').value;
    const recoveryKey = document.getElementById('recKey').value;

    try {
      const res = await api('/api/auth/reset-2fa-emergency', {
        method: 'POST',
        body: JSON.stringify({ email, password, recoveryKey })
      });

      toast(res.message, 'success');
      document.getElementById('twoFactorCard').style.display = 'none';
      document.getElementById('loginCard').style.display = 'block';
      document.getElementById('loginEmail').value = email;
      document.getElementById('loginPassword').value = '';
    } catch (err) {
      errBox.innerText = err.message;
      errBox.style.display = 'block';
    }
  });
}

function attachAccountForm() {
  const colorInput = document.getElementById('profColor');
  const avatarBadge = document.getElementById('profileAvatarBadge');
  const msgBox = document.getElementById('accountInlineMsg');

  colorInput?.addEventListener('input', (e) => {
    if (avatarBadge) avatarBadge.style.backgroundColor = e.target.value;
  });

  document.querySelectorAll('.btnPresetColor').forEach(btn => {
    btn.addEventListener('click', () => {
      const selected = btn.getAttribute('data-color');
      if (colorInput) colorInput.value = selected;
      if (avatarBadge) avatarBadge.style.backgroundColor = selected;
    });
  });

  document.getElementById('profName')?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val && avatarBadge) {
      avatarBadge.innerText = val.charAt(0).toUpperCase();
    }
  });

  document.getElementById('updateProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveProfile');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const payload = {
      name: document.getElementById('profName').value.trim(),
      mobile: document.getElementById('profMobile').value.trim(),
      branch: document.getElementById('profBranch').value,
      batchYear: document.getElementById('profBatch').value.trim(),
      avatarColor: document.getElementById('profColor').value,
      bio: document.getElementById('profBio').value.trim()
    };

    try {
      const res = await api('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      state.user = res.user;
      localStorage.setItem('openroom_user', JSON.stringify(res.user));

      toast('Profile updated and saved!', 'success');
      
      const headerName = document.getElementById('profileHeaderName');
      const headerSub = document.getElementById('profileHeaderSub');
      if (headerName) headerName.innerText = res.user.name;
      if (headerSub) headerSub.innerText = `${res.user.branch} • Batch ${res.user.batchYear}`;

      if (msgBox) {
        msgBox.style.display = 'block';
        msgBox.style.background = 'var(--open-soft)';
        msgBox.style.color = 'var(--open)';
        msgBox.innerText = '✓ All profile details saved to MongoDB & synced to Excel.';
        setTimeout(() => { msgBox.style.display = 'none'; }, 4000);
      }
    } catch (err) {
      if (msgBox) {
        msgBox.style.display = 'block';
        msgBox.style.background = 'var(--busy-soft)';
        msgBox.style.color = 'var(--busy)';
        msgBox.innerText = err.message || 'Failed to save profile.';
      }
    } finally {
      btn.disabled = false;
      btn.innerText = 'Save Changes';
    }
  });

  document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPass').value;
    const newPassword = document.getElementById('newPass').value;
    const btn = document.getElementById('btnSavePassword');

    btn.disabled = true;

    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      toast('Password updated successfully!', 'success');
      document.getElementById('currentPass').value = '';
      document.getElementById('newPass').value = '';
    } catch (err) {
      // Handled by API dispatcher
    } finally {
      btn.disabled = false;
    }
  });
}

function attachReviewForm() {
  document.getElementById('newReviewForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kind = document.getElementById('reviewKind').value;
    const tag = document.getElementById('reviewTag').value;
    const body = document.getElementById('reviewBody').value;

    await api('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ kind, tag, body })
    });
    toast('Discussion posted to community!', 'success');
    router();
  });

  document.querySelectorAll('.btnTagFilter').forEach(btn => {
    btn.addEventListener('click', () => {
      state.threadFilter.tag = btn.getAttribute('data-tag');
      document.querySelectorAll('.thread-card').forEach(card => {
        const tag = card.querySelector('span[style*="font-weight:600"]')?.innerText.trim();
        if (state.threadFilter.tag === 'All' || tag === state.threadFilter.tag) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
      document.querySelectorAll('.btnTagFilter').forEach(b => {
        b.className = b.getAttribute('data-tag') === state.threadFilter.tag ? 'btn btn-sm btn-primary btnTagFilter' : 'btn btn-sm btn-ghost btnTagFilter';
      });
    });
  });

  document.querySelectorAll('.btnMarkNoted').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const res = await api(`/api/reviews/${id}/note`, { method: 'POST' });
      toast(res.message, 'success');
      router();
    });
  });

  document.querySelectorAll('.btnDeleteReview').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Are you sure you want to delete this discussion?')) return;

      await api(`/api/reviews/${id}`, { method: 'DELETE' });
      toast('Discussion removed successfully.', 'success');
      router();
    });
  });
}

function attachAdminHandlers() {
  const provModal = document.getElementById('provisionModal');
  const resetModal = document.getElementById('resetStudentModal');
  const addRoomModal = document.getElementById('addRoomModal');

  document.getElementById('btnOpenAddRoomModal')?.addEventListener('click', () => addRoomModal.style.display = 'flex');
  document.getElementById('btnCloseAddRoomModal')?.addEventListener('click', () => addRoomModal.style.display = 'none');

  document.getElementById('btnCloseProvisionModal')?.addEventListener('click', () => provModal.style.display = 'none');
  document.getElementById('btnCloseResetModal')?.addEventListener('click', () => resetModal.style.display = 'none');

  document.querySelectorAll('.btnOpenProvisionModal').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const bmuEmail = btn.getAttribute('data-bmu');
      const mobile = btn.getAttribute('data-mobile');

      document.getElementById('provReqId').value = id;
      document.getElementById('provName').value = name;
      document.getElementById('provBmuEmail').value = bmuEmail;
      document.getElementById('provMobile').value = mobile;

      const cleanHandle = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      document.getElementById('provCustomEmail').value = `${cleanHandle}@openroom.xyz`;
      document.getElementById('provPassword').value = `BMU@${Math.floor(100000 + Math.random() * 900000)}`;

      provModal.style.display = 'flex';
    });
  });

  document.getElementById('provisionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const requestId = document.getElementById('provReqId').value;
    const name = document.getElementById('provName').value;
    const bmuEmail = document.getElementById('provBmuEmail').value;
    const mobile = document.getElementById('provMobile').value;
    const customEmail = document.getElementById('provCustomEmail').value.trim();
    const password = document.getElementById('provPassword').value.trim();

    await api('/api/admin/provision-user', {
      method: 'POST',
      body: JSON.stringify({ requestId, name, bmuEmail, customEmail, password, mobile })
    });

    toast(`Account created & saved to Excel roster!`, 'success');
    provModal.style.display = 'none';
    router();
  });

  document.querySelectorAll('.btnOpenResetModal').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const email = btn.getAttribute('data-email');
      const pass = btn.getAttribute('data-pass');

      document.getElementById('resetReqId').value = id;
      document.getElementById('resetName').value = name;
      document.getElementById('resetCustomEmail').value = email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@openroom.xyz`;
      document.getElementById('resetNewPass').value = pass || `BMU@${Math.floor(100000 + Math.random() * 900000)}`;

      resetModal.style.display = 'flex';
    });
  });

  document.getElementById('resetStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const requestId = document.getElementById('resetReqId').value;
    const newEmail = document.getElementById('resetCustomEmail').value.trim();
    const newPassword = document.getElementById('resetNewPass').value.trim();

    await api('/api/admin/reset-student-password', {
      method: 'POST',
      body: JSON.stringify({ requestId, newEmail, newPassword })
    });

    toast(`Credentials updated! Password saved to Excel.`, 'success');
    resetModal.style.display = 'none';
    router();
  });

  document.getElementById('adminRoomSearch')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#adminRoomsTable tbody tr').forEach(row => {
      const txt = row.innerText.toLowerCase();
      row.style.display = txt.includes(term) ? '' : 'none';
    });
  });

  document.querySelectorAll('.btnAdminToggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-code');
      const current = btn.getAttribute('data-current');
      const newStatus = current === 'empty' ? 'busy' : 'empty';

      await api(`/api/rooms/${code}/vote`, {
        method: 'POST',
        body: JSON.stringify({ action: newStatus })
      });
      toast(`Room ${code} set to ${newStatus}.`, 'success');
      router();
    });
  });

  document.querySelectorAll('.btnAdminDelete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-code');
      if (!confirm(`Are you sure you want to permanently delete room ${code}?`)) return;

      await api(`/api/rooms/${code}`, { method: 'DELETE' });
      toast(`Room ${code} deleted permanently.`, 'success');
      router();
    });
  });

  document.getElementById('createRoomForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('mCode').value.trim();
    const building = document.getElementById('mBuilding').value;
    const floor = document.getElementById('mFloor').value;
    const type = document.getElementById('mType').value;
    const capacity = document.getElementById('mCapacity').value;

    await api('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ code, building, floor, type, capacity })
    });
    toast(`Room ${code} created successfully!`, 'success');
    addRoomModal.style.display = 'none';
    router();
  });
}