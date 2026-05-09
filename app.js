// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDXQesoe9GP_QcC2YjpzMiYuanueagFMlk",
  authDomain: "etshub-26725.firebaseapp.com",
  projectId: "etshub-26725",
  storageBucket: "etshub-26725.firebasestorage.app",
  messagingSenderId: "626690152384",
  appId: "1:626690152384:web:c04d1306735fd846445a25",
  measurementId: "G-BVW8VV1CK8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
auth.signInAnonymously().catch(console.error);

// ----- Bad Word Filter -----
const badWords = [
  'fuck', 'shit', 'ass', 'bitch', 'bastard', 'dick', 'piss', 'pussy', 'motherfucker', 'cunt', 'asshole', 'jerk', 'sex', 'niggar',
  'හුත්‍ත', 'පක', 'වේස', 'කැරි', 'බල්ල', 'පයිය', 'හුත්තිගෙ', 'වේසිගෙ', 'අවජාතක', 'පකයා', 'හුත්තා', 'හුත්ති', 'හුකලා', 'හුකනවා', 'හුකපන්', 'බහුකාපන්', 'වේසි', 'වේසාවො', 'පොන්නයා', 'බැල්ලි', 'බිජ්ජ', 'කැරියා', 'කැරියද', 'කැරියෙක්', 'හුත්තෙක්', 'වේසියක්', 'පකෙක්', 'පකයෙක්',
  'huththa', 'hukaganin', 'paka', 'wesa', 'vesa', 'kari', 'balla', 'paiya', 'payya', 'huththige', 'hutta', 'huttige', 'wesige', 'vesige', 'awajathaka', 'avajathaka', 'pakaya', 'hutti', 'huththi', 'hukapan', 'bahukapan', 'wesi', 'vesi', 'wesawo', 'vesavo', 'wesavo', 'vesawo', 'ponnaya', 'pnnya', 'balli', 'bijja', 'kariya', 'kariyek', 'kariyada', 'kariyekda', 'huttek', 'huththek', 'pakek', 'pakayek'
];

function filterBadWords(text) {
  let filtered = text;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '***');
  });
  return filtered;
}

// Random Names (for display only)
const adjectives = ["Silent","Wild","Phantom","Turbo","Mystic","Rogue","Blazing","Iron","Dark","Cosmic","Neon","Storm","Shadow","Atomic","Frozen","Crimson","Rapid","Vortex","Zen","Lunar"];
const nouns = ["Wolf","Eagle","Panda","Tiger","Falcon","Knight","Rider","Ghost","Drift","Beast","Hawk","Viper","Legend","Raven","Comet","Phoenix","Joker","Warden","Pilot","Nomad"];
function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random()*adjectives.length)];
  const noun = nouns[Math.floor(Math.random()*nouns.length)];
  const num = Math.floor(Math.random()*1000);
  return `${adj}${noun}${num}`;
}
function getAnonymousName() {
  let name = localStorage.getItem('anonName');
  if (!name) { name = generateRandomName(); localStorage.setItem('anonName', name); }
  return name;
}

// ----- Utility Functions -----
function getCurrentUid() {
  const user = firebase.auth().currentUser;
  return user ? user.uid : null;
}

function escapeHtml(text) {
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function uploadImage(file) {
  const fd = new FormData(); fd.append('image', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json();
  return data.data.url;
}

// ----- Make URLs clickable -----
function linkifyText(text) {
  const urlRegex = /https?:\/\/[^\s<]+/gi;
  return text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

// ---- Post Functions ----
async function createPost() {
  const btn = document.getElementById('postButton');
  
  if (isCooldownActive()) {
    showToast('Please wait 30 seconds between posts');
    return;
  }

  const nickname = getAnonymousName();
  const content = document.getElementById('postContent').value.trim();
  
  if (!content && selectedFiles.length === 0) {
    showToast('Text or image required');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Posting...';

  // Scan URLs for NSFW
  const urlsInText = extractUrls(content);
  for (let urlStr of urlsInText) {
    const isNsfwUrl = await checkUrlNSFW(urlStr);
    if (isNsfwUrl) {
      showToast('🔞 NSFW link detected! Post rejected.');
      btn.disabled = false;
      btn.textContent = 'Post';
      return;
    }
  }

  // NSFW image check
  if (selectedFiles.length > 0) {
    for (let file of selectedFiles) {
      const isNsfw = await checkImageNSFW(file);
      if (isNsfw) {
        showToast('🔞 NSFW image detected! Post rejected.');
        btn.disabled = false;
        btn.textContent = 'Post';
        return;
      }
    }
  }

  // Compress images
  if (selectedFiles.length > 0) {
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        selectedFiles[i] = await compressImage(selectedFiles[i]);
      }
      renderPreviews();
    } catch (e) { /* fallback */ }
  }

  // Upload images
  let imageUrls = [];
  if (selectedFiles.length > 0) {
    try {
      for (let file of selectedFiles) {
        const url = await uploadImage(file);
        imageUrls.push(url);
      }
    } catch (e) {
      showToast('Image upload fail');
      btn.disabled = false;
      btn.textContent = 'Post';
      return;
    }
  }

  // Save to Firestore with ownerUid
  try {
    await db.collection("posts").add({
      nickname,
      content,
      imageUrls,
      imageUrl: null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      reactions: { like:0, love:0, haha:0, wow:0, sad:0, angry:0 },
      ownerUid: getCurrentUid()
    });
    
    startCooldown(30000);
    
    document.getElementById('postContent').value = '';
    selectedFiles.length = 0;
    renderPreviews();
    
  } catch (e) {
    console.error('Post fail:', e);
    showToast('Posting failed');
    btn.disabled = false;
    btn.textContent = 'Post';
  }
}

// ---------- Post Cooldown (30s) ----------
function getCooldownExpireTime() {
  return parseInt(localStorage.getItem('postCooldown') || '0', 10);
}
function isCooldownActive() {
  return Date.now() < getCooldownExpireTime();
}
function startCooldown(durationMs) {
  const expireTime = Date.now() + durationMs;
  localStorage.setItem('postCooldown', expireTime);
  runCooldownTimer(expireTime);
}
function runCooldownTimer(expireTime) {
  const btn = document.getElementById('postButton');
  if (!btn) return;
  btn.disabled = true;
  const update = () => {
    const remaining = Math.max(0, expireTime - Date.now());
    if (remaining <= 0) {
      btn.disabled = false;
      btn.textContent = 'Post';
      localStorage.removeItem('postCooldown');
      return;
    }
    btn.textContent = `Wait ${Math.ceil(remaining / 1000)}s...`;
    setTimeout(update, 1000);
  };
  update();
}
(function() {
  const expire = getCooldownExpireTime();
  if (Date.now() < expire) runCooldownTimer(expire);
})();

function loadPosts() {
  let initialLoadDone = false;

  db.collection("posts").orderBy("timestamp","desc").onSnapshot(snapshot => {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';

    if (initialLoadDone) {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' && !change.doc.metadata.hasPendingWrites) {
          playNotificationSound();
        }
      });
    }

    snapshot.forEach(doc => {
      const post = doc.data();
      const postId = doc.id;
      let userReactions = JSON.parse(localStorage.getItem('postReactions') || '{}');
      const userReactType = userReactions[postId] || null;
      const reactionTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
      const totalReactions = reactionTypes.reduce((s, t) => s + (post.reactions?.[t] || 0), 0);
      let top = 'like', topCount = 0;
      reactionTypes.forEach(t => {
        const c = post.reactions?.[t] || 0;
        if (c > topCount) { topCount = c; top = t; }
      });
      const emojiMap = { like: '👍', love: '❤️', haha: '😆', wow: '😮', sad: '😢', angry: '😠' };
      const btnEmoji = userReactType ? emojiMap[userReactType] : (totalReactions > 0 ? emojiMap[top] : '👍');
      const countStr = totalReactions > 0 ? ' · ' + totalReactions : '';

      const div = document.createElement('div');
      div.className = 'post';
      div.id = 'post-' + postId;
      div.setAttribute('data-post-id', postId);
      div.innerHTML = `
        <div class="post-header">
          <div class="post-header-info">
            <strong>${escapeHtml(post.nickname)}</strong>
            <small>${timeAgo(post.timestamp)}</small>
          </div>
          <div class="post-actions">
            <button onclick="togglePostMenu('${postId}')" class="menu-btn">⋮</button>
            <div class="post-menu" id="menu-${postId}" style="display:none;">
              <button onclick="sharePost('${postId}', '${escapeHtml(post.content || '')}')">Share</button>
              ${post.ownerUid !== getCurrentUid() ? `<button onclick="reportPost('${postId}')">Report</button>` : ''}
              ${post.ownerUid === getCurrentUid() ? `
                <button onclick="editPost('${postId}')">Edit</button>
                <button onclick="deletePost('${postId}')">Delete</button>
              ` : ''}
              ${isAdmin() ? `<button onclick="adminDeletePost('${postId}')">🗑️ Delete (Admin)</button>` : ''}
            </div>
          </div>
        </div>
        <div class="post-content">${post.content ? linkifyText(filterBadWords(escapeHtml(post.content))) : ''}</div>
        <div class="edit-area" style="display:none;">
          <textarea></textarea>
          <div class="edit-actions">
            <button class="cancel-edit-btn">Cancel</button>
            <button class="save-edit-btn">Save</button>
          </div>
        </div>
        ${(post.imageUrls && post.imageUrls.length > 0) ? `
          <div class="image-collage ${post.imageUrls.length === 1 ? 'single' : ''}">
            ${post.imageUrls.map((url, index) => `<img src="${escapeHtml(url)}" alt="image" onclick="openLightbox('${postId}', ${index})">`).join('')}
          </div>
        ` : ''}
        ${(!post.imageUrls || post.imageUrls.length === 0) && post.imageUrl ? `
          <div class="image-collage single">
            <img src="${escapeHtml(post.imageUrl)}" alt="image" onclick="openLightbox('${postId}', 0)">
          </div>
        ` : ''}
        <div class="reaction-wrapper">
          <button class="like-btn ${userReactType ? 'reacted' : ''}" onclick="event.stopPropagation(); toggleReactionPicker(this, 'picker-${postId}')">
            <span class="reaction-icon">
              ${userReactType 
                ? emojiMap[userReactType] 
                : (totalReactions > 0 
                    ? emojiMap[top] 
                    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`)
              }
            </span>
            ${totalReactions > 0 ? `<span class="reaction-count">${totalReactions}</span>` : ''}
          </button>
          <div class="reaction-picker" id="picker-${postId}">
            ${reactionTypes.map(t => { 
              const count = post.reactions?.[t] || 0;
              return `<button class="reaction-option" onclick="event.stopPropagation(); reactPost('${postId}','${t}'); closeReactionPicker(document.getElementById('picker-${postId}'))">${emojiMap[t]}${count > 0 ? `<small>${count}</small>` : ''}</button>`;
            }).join('')}
          </div>
        </div>
        <button class="comment-toggle-btn" onclick="toggleCommentBox('${postId}')">💬 Comment</button>
        <div class="comments" id="comments-${postId}" style="display:none;">
          <div class="comments-list" id="commentsList-${postId}"></div>
          <div class="top-reply-box">
            <input type="text" id="commentInput-${postId}" placeholder="Write a comment...">
            <button class="cm-send-btn" onclick="addComment('${postId}')">Send</button>
          </div>
        </div>
      `;
      div.dataset.searchText = (post.content + ' ' + post.nickname).toLowerCase();
      container.appendChild(div);
      renderLinkPreviews(div, postId);
      loadComments(postId);
    });

    const hash = window.location.hash;
    if (hash && hash.startsWith('#post-')) {
      const targetId = hash.replace('#post-', '');
      setTimeout(() => {
        const targetPost = document.getElementById('post-' + targetId);
        if (targetPost) {
          targetPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetPost.classList.add('highlight');
          setTimeout(() => targetPost.classList.remove('highlight'), 2500);
        }
      }, 300);
    }

    initialLoadDone = true;
  });
}

// Toggle Reaction for Posts
async function reactPost(postId, type) {
  const ref = db.collection("posts").doc(postId);
  const userReactions = JSON.parse(localStorage.getItem('postReactions')||'{}');
  const currentType = userReactions[postId];
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) return;
      const data = doc.data();
      const reactions = { like:0, love:0, haha:0, wow:0, sad:0, angry:0, ...data.reactions };
      if (currentType === type) {
        reactions[type] = Math.max(0, (reactions[type] || 0) - 1);
        delete userReactions[postId];
      } else {
        if (currentType) reactions[currentType] = Math.max(0, (reactions[currentType] || 0) - 1);
        reactions[type] = (reactions[type] || 0) + 1;
        userReactions[postId] = type;
      }
      transaction.update(ref, { reactions });
    });
    localStorage.setItem('postReactions', JSON.stringify(userReactions));
  } catch (e) {
    console.error("Reaction toggle failed:", e);
  }
}

// Comment System
function loadComments(postId) {
  db.collection("posts").doc(postId).collection("comments").orderBy("timestamp","asc").onSnapshot(snapshot => {
    const comments = [];
    snapshot.forEach(doc => comments.push({id: doc.id, ...doc.data()}));
    const tree = buildCommentTree(comments);
    const list = document.getElementById('commentsList-'+postId);
    if(!list) return;
    list.innerHTML = '';
    tree.forEach(root => renderCommentNode(postId, root, 0, list));
  });
}

function buildCommentTree(comments) {
  const map = {}, roots = [];
  comments.forEach(c => map[c.id] = {...c, children:[]});
  comments.forEach(c => {
    if(c.parentId && map[c.parentId]) map[c.parentId].children.push(map[c.id]);
    else roots.push(map[c.id]);
  });
  return roots;
}

function renderCommentNode(postId, node, depth, container) {
  if(depth > 2) return;
  const commentId = node.id;
  let userReactions = JSON.parse(localStorage.getItem('commentReactions')||'{}');
  const userReactType = userReactions[`${postId}_${commentId}`] || null;
  const reactionTypes = ['like','love','haha','wow','sad','angry'];
  const totalReactions = reactionTypes.reduce((s,t)=>s+(node.reactions?.[t]||0),0);
  const emojiMap = {like:'👍',love:'❤️',haha:'😆',wow:'😮',sad:'😢',angry:'😠'};
  let top='like', topCount=0;
  reactionTypes.forEach(t=>{const c=node.reactions?.[t]||0; if(c>topCount){topCount=c;top=t;}});
  const btnEmoji = userReactType ? emojiMap[userReactType] : (totalReactions>0?emojiMap[top]:'👍');
  const countStr = totalReactions>0?' · '+totalReactions:'';

  const div = document.createElement('div');
  div.className = 'comment-thread' + (depth>0?' indented':'');
  div.style.marginLeft = depth>0 ? '20px' : '0';
  div.setAttribute('data-comment-id', `${postId}_${commentId}`);
  div.innerHTML = `
    <div class="comment-body">
      <strong>${escapeHtml(node.nickname||'Anon')}:</strong> <span class="comment-text">${linkifyText(filterBadWords(escapeHtml(node.text)))}</span>
      <div class="cm-reaction-wrapper">
        <button class="cm-like-btn ${userReactType ? 'reacted' : ''}" onclick="event.stopPropagation(); toggleReactionPicker(this, 'cpicker-${commentId}')">
          <span class="reaction-icon">
            ${userReactType 
              ? emojiMap[userReactType] 
              : (totalReactions > 0 
                  ? emojiMap[top] 
                  : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`)
            }
          </span>
          ${totalReactions > 0 ? `<span class="reaction-count">${totalReactions}</span>` : ''}
        </button>
        <div class="cm-reaction-picker" id="cpicker-${commentId}">
          ${reactionTypes.map(t => { 
            const count = node.reactions?.[t] || 0;
            return `<button class="reaction-option" onclick="event.stopPropagation(); reactComment('${postId}','${commentId}','${t}'); closeReactionPicker(document.getElementById('cpicker-${commentId}'))">${emojiMap[t]}${count > 0 ? `<small>${count}</small>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <button class="reply-toggle" onclick="toggleReplyBox('${postId}','${commentId}')">Reply</button>
      
      <!-- Comment Dropdown Menu -->
      <div class="comment-actions">
        <button onclick="toggleCommentMenu('${postId}','${commentId}')" class="cm-menu-btn">⋮</button>
        <div class="cm-menu" id="cmenu-${commentId}" style="display:none;">
          ${node.ownerUid === getCurrentUid() ? `
            <button onclick="editComment('${postId}','${commentId}')">Edit</button>
            <button onclick="deleteComment('${postId}','${commentId}')">Delete</button>
          ` : `<button onclick="reportComment('${postId}','${commentId}')">Report</button>`}
        </div>
      </div>
      
      ${isAdmin() ? `<button onclick="adminDeleteComment('${postId}','${commentId}')" style="background:none;border:none;color:#e94560;font-size:10px;padding:0 4px;">🗑️</button>` : ''}
    </div>
    <div class="reply-box" id="replyBox-${postId}-${commentId}" style="display:none;">
      <input type="text" id="replyInput-${postId}-${commentId}" placeholder="Reply...">
      <button class="cm-send-btn" onclick="addReply('${postId}','${commentId}')">Send</button>
    </div>
    <div class="children-comments" id="children-${postId}-${commentId}"></div>
  `;
  container.appendChild(div);
  if(node.children && node.children.length) {
    const childContainer = document.getElementById(`children-${postId}-${commentId}`);
    node.children.forEach(child => renderCommentNode(postId, child, depth+1, childContainer));
  }
}

async function addComment(postId) {
  const input = document.getElementById('commentInput-'+postId);
  const text = input.value.trim();
  const urlsInComment = extractUrls(text);
  for (let urlStr of urlsInComment) {
    const isNsfw = await checkUrlNSFW(urlStr);
    if (isNsfw) {
      showToast('🔞 NSFW link detected! Comment rejected.');
      return;
    }
  }
  if(!text) return;
  const nickname = getAnonymousName();
  const uid = getCurrentUid();
  db.collection("posts").doc(postId).collection("comments").add({
    nickname,
    ownerUid: uid,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    parentId: null,
    reactions: {like:0,love:0,haha:0,wow:0,sad:0,angry:0}
  }).then(() => input.value = '');
}

async function addReply(postId, parentCommentId) {
  const input = document.getElementById(`replyInput-${postId}-${parentCommentId}`);
  const text = input.value.trim();
  const urlsInReply = extractUrls(text);
  for (let urlStr of urlsInReply) {
    const isNsfw = await checkUrlNSFW(urlStr);
    if (isNsfw) {
      showToast('🔞 NSFW link detected! Reply rejected.');
      return;
    }
  }
  if(!text) return;
  const nickname = getAnonymousName();
  const uid = getCurrentUid();
  db.collection("posts").doc(postId).collection("comments").add({
    nickname,
    ownerUid: uid,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    parentId: parentCommentId,
    reactions: {like:0,love:0,haha:0,wow:0,sad:0,angry:0}
  }).then(() => {
    input.value = '';
    document.getElementById(`replyBox-${postId}-${parentCommentId}`).style.display = 'none';
  });
}

// Toggle Reaction for Comments
async function reactComment(postId, commentId, type) {
  const ref = db.collection("posts").doc(postId).collection("comments").doc(commentId);
  const userReactions = JSON.parse(localStorage.getItem('commentReactions')||'{}');
  const key = `${postId}_${commentId}`;
  const currentType = userReactions[key];
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) return;
      const data = doc.data();
      const reactions = { like:0, love:0, haha:0, wow:0, sad:0, angry:0, ...data.reactions };
      if (currentType === type) {
        reactions[type] = Math.max(0, (reactions[type] || 0) - 1);
        delete userReactions[key];
      } else {
        if (currentType) reactions[currentType] = Math.max(0, (reactions[currentType] || 0) - 1);
        reactions[type] = (reactions[type] || 0) + 1;
        userReactions[key] = type;
      }
      transaction.update(ref, { reactions });
    });
    localStorage.setItem('commentReactions', JSON.stringify(userReactions));
  } catch (e) {
    console.error("Comment reaction toggle failed:", e);
  }
}

function toggleCommentBox(postId) {
  const div = document.getElementById('comments-'+postId);
  div.style.display = div.style.display === 'none' ? 'block' : 'none';
}
function toggleReplyBox(postId, commentId) {
  const div = document.getElementById(`replyBox-${postId}-${commentId}`);
  div.style.display = div.style.display === 'none' ? 'flex' : 'none';
}

// File handling
const selectedFiles = [];
function handleFileSelect(fileList) {
  const maxSize = 10 * 1024 * 1024;
  const newFiles = Array.from(fileList);
  const oversized = newFiles.filter(f => f.size > maxSize);
  if (oversized.length > 0) {
    showToast(`File(s) too large! Maximum 10MB each.`);
    const validFiles = newFiles.filter(f => f.size <= maxSize);
    document.getElementById('imageInput').value = '';
    addFiles(validFiles);
  } else {
    addFiles(newFiles);
  }
  document.getElementById('imageInput').value = '';
}
function addFiles(files) {
  if (selectedFiles.length + files.length > 3) {
    showToast('Maximum 3 images allowed!');
    return;
  }
  selectedFiles.push(...files);
  renderPreviews();
}
function renderPreviews() {
  const container = document.getElementById('previewContainer');
  container.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `<img src="${e.target.result}" alt="preview"><button class="remove-preview" onclick="removeFile(${index})">&times;</button>`;
      container.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}
function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderPreviews();
}

// Post Actions Menu
function togglePostMenu(postId) {
  const menu = document.getElementById('menu-'+postId);
  if (!menu) return;
  const isVisible = menu.style.display === 'block';
  document.querySelectorAll('.post-menu').forEach(m => m.style.display = 'none');
  menu.style.display = isVisible ? 'none' : 'block';
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.post-actions')) {
    document.querySelectorAll('.post-menu').forEach(m => m.style.display = 'none');
  }
});

function showToast(msg) {
  const old = document.querySelector('.toast');
  if(old) old.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function sharePost(postId, text) {
  const postUrl = window.location.href.split('#')[0] + '#post-' + postId;
  document.getElementById('shareLinkInput').value = postUrl;
  document.getElementById('shareModal').style.display = 'flex';
}

function closeShareModal() {
  document.getElementById('shareModal').style.display = 'none';
}

function copyShareLink() {
  const input = document.getElementById('shareLinkInput');
  input.select();
  document.execCommand('copy');
  showToast('📋 Link copied!');
  closeShareModal();
}

async function editPost(postId) {
  const docRef = db.collection("posts").doc(postId);
  try {
    const doc = await docRef.get();
    if (!doc.exists) return;
    const post = doc.data();
    const currentContent = post.content || '';
    const postDiv = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postDiv) return;
    const contentDiv = postDiv.querySelector('.post-content');
    const editArea = postDiv.querySelector('.edit-area');
    const editTextarea = editArea.querySelector('textarea');
    contentDiv.style.display = 'none';
    editArea.style.display = 'flex';
    editTextarea.value = currentContent;
    editTextarea.focus();
    editArea.querySelector('.save-edit-btn').onclick = async () => {
      const newContent = editTextarea.value.trim();
      if (newContent === '' || newContent === currentContent) {
        contentDiv.style.display = 'block';
        editArea.style.display = 'none';
        showToast('Post updated');
        return;
      }
      try {
        await docRef.update({ content: newContent });
      } catch(e) { console.error(e); showToast('Edit failed'); }
    };
    editArea.querySelector('.cancel-edit-btn').onclick = () => {
      contentDiv.style.display = 'block';
      editArea.style.display = 'none';
    };
  } catch(e) { console.error(e); showToast('Edit not available'); }
}

async function deletePost(postId) {
  showConfirm('Delete this post? It will be permanently removed.', async () => {
    try {
      const commentsRef = db.collection("posts").doc(postId).collection("comments");
      const commentSnap = await commentsRef.get();
      const batch = db.batch();
      commentSnap.forEach(doc => batch.delete(doc.ref));
      const reportsRef = db.collection("posts").doc(postId).collection("reports");
      const reportSnap = await reportsRef.get();
      reportSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      await db.collection("posts").doc(postId).delete();
    } catch(e) { console.error(e); showToast('❌ Delete failed'); }
  });
}

function showConfirm(message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmMessage').textContent = message;
  modal.style.display = 'flex';
  const okBtn = document.getElementById('confirmOk');
  const cancelBtn = document.getElementById('confirmCancel');
  const closeModal = () => { modal.style.display = 'none'; };
  const cleanup = () => {
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
  };
  const handleOk = () => { cleanup(); closeModal(); onConfirm(); };
  const handleCancel = () => { cleanup(); closeModal(); };
  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
}

// Lightbox
let currentLightboxPostId = null;
let currentLightboxIndex = 0;
let lightboxImages = [];
function openLightbox(postId, index) {
  const postDiv = document.getElementById('post-' + postId);
  if (!postDiv) return;
  const images = [];
  postDiv.querySelectorAll('.image-collage img').forEach(img => images.push(img.src));
  if (images.length === 0) return;
  lightboxImages = images;
  currentLightboxPostId = postId;
  currentLightboxIndex = index;
  showLightboxImage();
  document.getElementById('lightbox').style.display = 'flex';
}
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; }
function changeLightboxImage(direction) {
  const newIndex = currentLightboxIndex + direction;
  if (newIndex >= 0 && newIndex < lightboxImages.length) {
    currentLightboxIndex = newIndex;
    showLightboxImage();
  }
}
function showLightboxImage() {
  document.getElementById('lightboxImg').src = lightboxImages[currentLightboxIndex];
  document.getElementById('lightboxCounter').textContent = (currentLightboxIndex + 1) + ' / ' + lightboxImages.length;
}

// Search
function filterPosts() {
  const term = document.getElementById('searchInput').value.trim().toLowerCase();
  document.querySelectorAll('.post').forEach(post => {
    post.style.display = (term === '' || (post.dataset.searchText||'').includes(term)) ? '' : 'none';
  });
}

// Report System (with menu close)
async function reportPost(postId) {
  const uid = getCurrentUid();
  const reportsRef = db.collection("posts").doc(postId).collection("reports");
  // Close the menu immediately
  const menu = document.getElementById('menu-' + postId);
  if (menu) menu.style.display = 'none';
  
  // Check if already reported by this user
  try {
    const existing = await reportsRef.where("reporterUid", "==", uid).get();
    if (!existing.empty) {
      showToast('⚠️ You already reported this post');
      return;
    }
  } catch(e) {
    console.error(e);
    showToast('Report check failed');
    return;
  }

  // Add the report
  try {
    await reportsRef.add({
      reporterUid: uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('🚩 Post reported');
    
    // Check total distinct reporters
    const allReports = await reportsRef.get();
    const distinctIds = new Set();
    allReports.forEach(doc => distinctIds.add(doc.data().reporterUid));
    
    if (distinctIds.size >= 3) {
      // Trigger secure auto‑delete via Worker endpoint
      const formData = new FormData();
      formData.append('secret', 'etshub_auto_del_2026!');   // Must match Worker env AUTO_DELETE_SECRET
      formData.append('postId', postId);
      try {
        const res = await fetch('/api/auto-delete', { method:'POST', body: formData });
        if (res.ok) {
          showToast('🗑️ Post removed due to reports');
        } else {
          const data = await res.json();
          console.error('Auto‑delete failed:', data);
          showToast('Auto‑delete failed – admins notified');
        }
      } catch(e) {
        console.error('Auto‑delete network error:', e);
      }
    }
  } catch(e) {
    console.error(e);
    showToast('Report failed');
  }
}

async function deletePostInternal(postId) {
  try {
    const commentsRef = db.collection("posts").doc(postId).collection("comments");
    const commentSnap = await commentsRef.get();
    const batch = db.batch();
    commentSnap.forEach(doc => batch.delete(doc.ref));
    const reportsRef = db.collection("posts").doc(postId).collection("reports");
    const reportSnap = await reportsRef.get();
    reportSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    await db.collection("posts").doc(postId).delete();
  } catch(e) { console.error("Auto delete failed:", e); }
}

// ----- Sightengine NSFW Moderation -----
async function checkImageNSFW(file) {
  const formData = new FormData();
  formData.append('models', 'nudity-2.0');
  formData.append('media', file);
  
  try {
    const res = await fetch('/api/nsfw-check', { method: 'POST', body: formData });
    const result = await res.json();
    if (result.status === 'success' && result.nudity) {
      const { sexual_activity, sexual_display, erotica } = result.nudity;
      if (sexual_activity > 0.3 || sexual_display > 0.3 || erotica > 0.3) return true;
    }
    return false;
  } catch(e) { console.error('NSFW check fail:', e); return false; }
}

// ---- Relative Time Helper ----
function timeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const now = new Date();
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return date.toLocaleDateString();
}

// ----- Image Compression -----
function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
          resolve(compressedFile);
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      }, 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('Image load error'));
    img.src = URL.createObjectURL(file);
  });
}

// ----- Notification Sound (Inline Beep) -----
let audioCtx = null;
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    audioUnlocked = true;
    console.log('Audio unlocked');
  } catch (e) {
    console.warn('AudioContext not available:', e);
  }
}

function playNotificationSound() {
  if (!audioUnlocked || !audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (e) { /* ignore */ }
}

document.addEventListener('click', unlockAudio, { once: true });

// ----- Link Preview -----
const linkPreviewCache = {};

function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s<]+/gi;
  const matches = text.match(urlRegex);
  return matches ? Array.from(new Set(matches)) : [];
}

async function fetchLinkPreview(url) {
  if (linkPreviewCache[url]) return linkPreviewCache[url];
  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.error) return null;
    linkPreviewCache[url] = data;
    return data;
  } catch (e) {
    console.warn('Link preview fetch failed:', e);
    return null;
  }
}

async function renderLinkPreviews(postDiv, postId) {
  const contentDiv = postDiv.querySelector('.post-content');
  if (!contentDiv) return;
  const text = contentDiv.textContent || '';
  const urls = extractUrls(text);
  if (urls.length === 0) return;

  let previewContainer = postDiv.querySelector('.link-previews');
  if (!previewContainer) {
    previewContainer = document.createElement('div');
    previewContainer.className = 'link-previews';
    contentDiv.after(previewContainer);
  }

  for (const url of urls) {
    if (previewContainer.querySelector(`[data-url="${encodeURIComponent(url)}"]`)) continue;
    const preview = await fetchLinkPreview(url);
    if (!preview) continue;

    const card = document.createElement('div');
    card.className = 'link-card';
    card.setAttribute('data-url', url);
    card.innerHTML = `
      <a href="${url}" target="_blank" rel="noopener noreferrer">
        ${preview.image ? `<div class="link-card-img"><img src="${escapeHtml(preview.image)}" alt="" onerror="this.style.display='none'"></div>` : ''}
        <div class="link-card-body">
          <div class="link-card-title">${escapeHtml(preview.title || url)}</div>
          ${preview.description ? `<div class="link-card-desc">${escapeHtml(preview.description)}</div>` : ''}
          <div class="link-card-url">${new URL(url).hostname}</div>
        </div>
      </a>
    `;
    previewContainer.appendChild(card);
  }
}

async function checkUrlNSFW(urlStr) {
  try {
    const formData = new FormData();
    formData.append('url', urlStr);
    const res = await fetch('/api/blocklist-check', { method:'POST', body: formData });
    if (!res.ok) throw new Error('Blocklist service failed');
    const data = await res.json();
    return data.blocked === true;
  } catch (e) {
    console.error('Blocklist check error:', e);
    showToast('⚠️ Link safety check failed. Post blocked.');
    return true;
  }
}

// ========== Advanced Convoy Planner ==========
let allConvoysData = [];

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    if (b.textContent.includes(tabName === 'wall' ? 'Wall' : 'Convoys')) {
      b.classList.add('active');
    }
  });
  document.getElementById('wallContainer').style.display = tabName === 'wall' ? 'block' : 'none';
  document.getElementById('convoysContainer').style.display = tabName === 'convoys' ? 'block' : 'none';
  if (tabName === 'convoys') loadConvoys();
}

async function createConvoy() {
  const title = document.getElementById('convoyTitle').value.trim();
  const server = document.getElementById('convoyServer').value;
  const meeting = document.getElementById('convoyMeeting').value.trim();
  const dateTimeStr = document.getElementById('convoyDateTime').value;
  const maxSlots = parseInt(document.getElementById('convoyMaxSlots').value) || 0;
  const desc = document.getElementById('convoyDesc').value.trim();
  const type = document.getElementById('convoyType').value;
  
  const dlcCheckboxes = document.querySelectorAll('.dlc-checkboxes input:checked');
  const dlcs = Array.from(dlcCheckboxes).map(cb => cb.value);
  
  const tagsStr = document.getElementById('convoyTags').value.trim();
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
  
  const fileInput = document.getElementById('convoyImageInput');
  let routeImageUrl = null;
  if (fileInput.files[0]) {
    try {
      const compressedFile = await compressImage(fileInput.files[0]);
      routeImageUrl = await uploadImage(compressedFile);
    } catch (e) {
      return showToast('Route image upload failed');
    }
  }
  
  if (!title || !dateTimeStr) return showToast('Title and date are required!');
  if (!server) return showToast('Please select a server');
  
  const datetime = new Date(dateTimeStr);
  if (isNaN(datetime.getTime())) return showToast('Invalid date/time');

  try {
    await db.collection("convoys").add({
      title,
      server,
      meetingLocation: meeting,
      datetime: firebase.firestore.Timestamp.fromDate(datetime),
      maxSlots,
      description: desc,
      dlcs,
      tags,
      routeImage: routeImageUrl,
      type,
      creatorName: getAnonymousName(),
      participants: {},
      recurring: document.getElementById('convoyRecurring').value
    });
    document.getElementById('convoyTitle').value = '';
    document.getElementById('convoyServer').value = '';
    document.getElementById('convoyMeeting').value = '';
    document.getElementById('convoyDateTime').value = '';
    document.getElementById('convoyMaxSlots').value = '';
    document.getElementById('convoyDesc').value = '';
    document.getElementById('convoyTags').value = '';
    document.getElementById('convoyImageInput').value = '';
    showToast('🚀 Convoy scheduled!');
    loadConvoys();
  } catch (e) {
    console.error(e);
    showToast('Failed to create convoy');
  }
}

function loadConvoys() {
  db.collection("convoys").orderBy("datetime", "asc").onSnapshot(snapshot => {
    allConvoysData = [];
    const container = document.getElementById('convoysList');
    container.innerHTML = '';
    if (snapshot.empty) {
      container.innerHTML = '<p style="color:#aaa; text-align:center;">No convoys planned yet.</p>';
      return;
    }
    snapshot.forEach(doc => {
      const convoy = doc.data();
      const convoyId = doc.id;
      allConvoysData.push({ id: convoyId, ...convoy });
    });
    renderConvoyCards(allConvoysData);
    handleRecurring();
  });
}

function renderConvoyCards(convoys) {
  const container = document.getElementById('convoysList');
  container.innerHTML = '';
  if (convoys.length === 0) {
    container.innerHTML = '<p style="color:#aaa; text-align:center;">No matching convoys.</p>';
    return;
  }
  convoys.forEach(convoy => {
    const convoyId = convoy.id;
    const uid = getCurrentUid();
    const participants = convoy.participants || {};
    const isJoined = !!participants[uid];
    const count = Object.keys(participants).length;
    const maxSlots = convoy.maxSlots || 0;
    const slotsText = maxSlots > 0 ? `${count}/${maxSlots}` : `${count}`;

    const card = document.createElement('div');
    card.className = 'convoy-card';
    card.innerHTML = `
      <div class="convoy-title">${escapeHtml(convoy.title)}</div>
      <div class="convoy-meta">
        <span>🖥️ ${escapeHtml(convoy.server || 'N/A')}</span>
        ${convoy.meetingLocation ? `<span>📍 ${escapeHtml(convoy.meetingLocation)}</span>` : ''}
        <span>🕒 ${convoy.datetime.toDate().toLocaleString()}</span>
        ${convoy.dlcs && convoy.dlcs.length > 0 ? `<span>📦 ${convoy.dlcs.join(', ')}</span>` : ''}
        ${convoy.tags && convoy.tags.length > 0 ? `<span>🏷️ ${convoy.tags.join(', ')}</span>` : ''}
        <span>👥 ${slotsText} trucks</span>
        ${convoy.type ? `<span>🔒 ${convoy.type.toUpperCase()}</span>` : ''}
        <button onclick="toggleConvoyChat('${convoyId}')" style="background: none; border: 1px solid #333; color: #ccc; padding: 4px 10px; border-radius: 6px; font-size: 12px; margin-left: 8px;">💬 Chat</button>
        <div class="convoy-chat" id="chat-${convoyId}" style="display:none;">
          <div class="chat-messages" id="chatMessages-${convoyId}"></div>
          <div style="display:flex; gap:4px;">
            <input type="text" id="chatInput-${convoyId}" placeholder="Type..." style="flex:1;">
            <button onclick="sendChatMessage('${convoyId}')" class="cm-send-btn">Send</button>
          </div>
        </div>
      </div>
      ${convoy.description ? `<div class="convoy-desc">${escapeHtml(convoy.description)}</div>` : ''}
      ${convoy.routeImage ? `<img src="${escapeHtml(convoy.routeImage)}" class="convoy-route-img" alt="Route Map" onclick="window.open(this.src)">` : ''}
      <button class="convoy-join-btn ${isJoined ? 'joined' : ''}" onclick="toggleJoinConvoy('${convoyId}')">${isJoined ? '✔ Joined' : 'Join Convoy'}</button>
      <div class="convoy-participants">${slotsText} participant${count !== 1 ? 's' : ''}</div>
    `;
    container.appendChild(card);
  });
}

async function toggleJoinConvoy(convoyId) {
  const ref = db.collection("convoys").doc(convoyId);
  const uid = getCurrentUid();
  const anonName = getAnonymousName();
  
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) return;
      const data = doc.data();
      const participants = { ...data.participants };
      if (participants[uid]) {
        delete participants[uid];
      } else {
        participants[uid] = anonName;
      }
      transaction.update(ref, { participants });
    });
  } catch (e) {
    console.error(e);
    showToast('Failed to update participation');
  }
}

function filterConvoys() {
  const term = document.getElementById('convoySearch').value.trim().toLowerCase();
  if (!term) { renderConvoyCards(allConvoysData); return; }
  const filtered = allConvoysData.filter(c => {
    return (c.title && c.title.toLowerCase().includes(term)) ||
           (c.server && c.server.toLowerCase().includes(term)) ||
           (c.meetingLocation && c.meetingLocation.toLowerCase().includes(term)) ||
           (c.tags && c.tags.some(t => t.toLowerCase().includes(term)));
  });
  renderConvoyCards(filtered);
}

let showCalendar = false;
function toggleConvoyView() {
  showCalendar = !showCalendar;
  document.getElementById('calendarToggle').textContent = showCalendar ? '📋 List View' : '📅 Calendar View';
  document.getElementById('convoysList').style.display = showCalendar ? 'none' : 'block';
  document.getElementById('convoysCalendar').style.display = showCalendar ? 'grid' : 'none';
  if (showCalendar) renderCalendar();
}

function renderCalendar() {
  const calDiv = document.getElementById('convoysCalendar');
  calDiv.className = 'convoy-calendar';
  const now = new Date(), year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysWithConvoys = new Set(allConvoysData.map(c => c.datetime.toDate().toDateString()));
  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateStr = date.toDateString();
    const hasConvoy = daysWithConvoys.has(dateStr);
    const today = dateStr === new Date().toDateString() ? ' today' : '';
    html += `<div class="calendar-day${today}${hasConvoy?' has-convoy':''}" onclick="${hasConvoy ? `filterByDate('${date.toISOString().slice(0,10)}')` : ''}">${d}</div>`;
  }
  calDiv.innerHTML = html;
}

function filterByDate(dateStr) {
  const filtered = allConvoysData.filter(c => c.datetime.toDate().toISOString().slice(0,10) === dateStr);
  if (filtered.length > 0) {
    showToast(`Showing convoys on ${dateStr}`);
    showCalendar = true; toggleConvoyView();
    renderConvoyCards(filtered);
  } else {
    showToast('No convoys on this day');
  }
}

function toggleConvoyChat(id) {
  const d = document.getElementById('chat-'+id);
  d.style.display = d.style.display === 'none' ? 'block' : 'none';
  if (d.style.display !== 'none') loadChatMessages(id);
}

function loadChatMessages(id) {
  db.collection("convoys").doc(id).collection("messages").orderBy("timestamp","asc")
    .onSnapshot(snap => {
      const c = document.getElementById('chatMessages-'+id);
      if (!c) return;
      c.innerHTML = '';
      snap.forEach(doc => {
        const m = doc.data();
        c.innerHTML += `<div class="chat-msg"><strong>${escapeHtml(m.nickname)}:</strong> ${escapeHtml(m.text)}</div>`;
      });
    });
}

async function sendChatMessage(id) {
  const input = document.getElementById('chatInput-'+id);
  const text = input.value.trim();
  if (!text) return;
  await db.collection("convoys").doc(id).collection("messages").add({
    nickname: getAnonymousName(),
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  input.value = '';
}

setInterval(() => {
  const now = Date.now();
  allConvoysData.forEach(c => {
    const start = c.datetime.toDate().getTime();
    const diff = start - now;
    if (diff > 0 && diff < 5 * 60 * 1000 && !c._toastShown) {
      showToast(`⏰ ${c.title} starts in ${Math.ceil(diff/60000)} min!`);
      c._toastShown = true;
    }
  });
}, 30000);

function handleRecurring() {
  allConvoysData.forEach(async c => {
    if (c.recurring === 'weekly' && c.datetime.toDate().getTime() < Date.now() && !c.recurrenceCreated) {
      const existing = allConvoysData.find(ec => 
        ec.title === c.title && 
        ec.datetime.toDate().getTime() > Date.now() &&
        ec.recurring === 'weekly'
      );
      if (!existing) {
        const newDate = new Date(c.datetime.toDate().getTime() + 7 * 24 * 60 * 60 * 1000);
        await db.collection("convoys").add({
          ...c,
          datetime: firebase.firestore.Timestamp.fromDate(newDate),
          participants: {},
          recurrenceCreated: true
        });
        showToast(`📅 Next week's convoy "${c.title}" created automatically`);
      }
    }
  });
}

// ========== Admin Mode ==========
const ADMIN_SESSION_KEY = 'etshub_admin_session';

function isAdmin() {
  return localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

function logoutAdmin() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  location.reload();
}

function checkAdminPanel() {
  if (isAdmin()) {
    const panel = document.getElementById('adminPanel');
    if (panel) panel.style.display = 'block';
  }
}

async function promptAdminPassword() {
  const password = prompt('Enter admin password:');
  if (!password) return;
  const formData = new FormData();
  formData.append('password', password);
  try {
    const res = await fetch('/api/admin', { method:'POST', body:formData });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem(ADMIN_SESSION_KEY, 'true');
      showToast('🔓 Admin mode activated');
      location.reload();
    } else {
      alert('❌ Wrong password!');
    }
  } catch(e) {
    alert('Network error');
  }
}

async function adminDeletePost(postId) {
  if (!confirm('Admin: permanently delete this post?')) return;
  await deletePostInternal(postId);
}

async function adminDeleteComment(postId, commentId) {
  if (!confirm('Admin: delete this comment?')) return;
  await db.collection("posts").doc(postId).collection("comments").doc(commentId).delete();
}

async function loadReportedPosts() {
  const container = document.getElementById('reportedPostsList');
  container.innerHTML = 'Loading...';
  const postsSnap = await db.collection("posts").orderBy("timestamp","desc").get();
  container.innerHTML = '';
  for (let postDoc of postsSnap.docs) {
    const reportsSnap = await postDoc.ref.collection("reports").get();
    if (!reportsSnap.empty) {
      const postData = postDoc.data();
      const div = document.createElement('div');
      div.className = 'post';
      div.style.cssText = 'padding:10px; font-size:13px;';
      div.innerHTML = `
        <strong>${escapeHtml(postData.nickname)}</strong>: ${escapeHtml(postData.content?.substring(0,100) || '')}
        <button onclick="adminDeletePost('${postDoc.id}')" class="admin-btn" style="background:#e94560; color:#fff; padding:2px 8px; margin-left:8px;">🗑️</button>
      `;
      container.appendChild(div);
    }
  }
  if (container.innerHTML === '') container.innerHTML = '<p style="color:#aaa;">No reported posts.</p>';
}

// ========== Comment Dropdown Actions ==========
function toggleCommentMenu(postId, commentId) {
  const menu = document.getElementById('cmenu-' + commentId);
  if (!menu) return;
  const isVisible = menu.style.display === 'block';
  document.querySelectorAll('.cm-menu').forEach(m => m.style.display = 'none');
  menu.style.display = isVisible ? 'none' : 'block';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.comment-actions')) {
    document.querySelectorAll('.cm-menu').forEach(m => m.style.display = 'none');
  }
});

async function editComment(postId, commentId) {
  const ref = db.collection("posts").doc(postId).collection("comments").doc(commentId);
  
  const commentDiv = document.querySelector(`[data-comment-id="${postId}_${commentId}"]`);
  if (!commentDiv) return;
  
  const textSpan = commentDiv.querySelector('.comment-text');
  if (!textSpan) return;
  
  const editArea = document.createElement('div');
  editArea.className = 'comment-edit-area';
  editArea.innerHTML = `
    <textarea class="comment-edit-textarea">${escapeHtml(textSpan.textContent.trim())}</textarea>
    <div class="edit-actions" style="display:flex; gap:6px; justify-content:flex-end; margin-top:4px;">
      <button class="cancel-comment-edit-btn">Cancel</button>
      <button class="save-comment-edit-btn">Save</button>
    </div>
  `;
  
  textSpan.style.display = 'none';
  textSpan.parentNode.insertBefore(editArea, textSpan.nextSibling);
  
  const textarea = editArea.querySelector('.comment-edit-textarea');
  textarea.focus();
  
  editArea.querySelector('.save-comment-edit-btn').onclick = async () => {
    const newText = textarea.value.trim();
    if (newText === '' || newText === textSpan.textContent.trim()) {
      textSpan.style.display = '';
      editArea.remove();
      return;
    }
    try {
      await ref.update({ text: newText });
      showToast('Comment updated');
    } catch(e) {
      console.error(e);
      showToast('Edit failed');
    }
  };
  
  editArea.querySelector('.cancel-comment-edit-btn').onclick = () => {
    textSpan.style.display = '';
    editArea.remove();
  };
}

async function deleteComment(postId, commentId) {
  showConfirm('Delete this comment?', async () => {
    try {
      await db.collection("posts").doc(postId).collection("comments").doc(commentId).delete();
    } catch(e) { console.error(e); showToast('Delete failed'); }
  });
}

async function reportComment(postId, commentId) {
  showToast('🚩 Comment reported. Moderators will review.');
}

// ========== Online Presence (Firestore, 30s) ==========
const presenceRef = db.collection("presence");

function updatePresence() {
  const uid = getCurrentUid();
  if (!uid) return;
  presenceRef.doc(uid).set({
    lastActive: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});
}

setInterval(updatePresence, 30000);
updatePresence();

function listenOnlineCount() {
  presenceRef.where("lastActive", ">", new Date(Date.now() - 40000))
    .onSnapshot(snap => {
      const count = snap.size;
      const el = document.getElementById('onlineCount');
      if (el) el.textContent = count;
    });
}
listenOnlineCount();

// ========== Reaction Picker Toggle (Mobile + Desktop) ==========
function toggleReactionPicker(btn, pickerId) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  const isOpen = picker.classList.contains('show');
  document.querySelectorAll('.reaction-picker.show, .cm-reaction-picker.show').forEach(p => p.classList.remove('show'));
  if (!isOpen) picker.classList.add('show');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.reaction-wrapper') && !e.target.closest('.cm-reaction-wrapper')) {
    document.querySelectorAll('.reaction-picker.show, .cm-reaction-picker.show').forEach(p => p.classList.remove('show'));
  }
});

function closeReactionPicker(picker) {
  if (picker) picker.classList.remove('show');
}

// ========== Rules Modal ==========
function openRules() {
  document.getElementById('rulesModal').style.display = 'flex';
}

function closeRules() {
  document.getElementById('rulesModal').style.display = 'none';
}

document.addEventListener('click', (e) => {
  const modal = document.getElementById('rulesModal');
  if (modal && modal.style.display === 'flex' && e.target === modal) {
    closeRules();
  }
});

document.querySelector('.rules-modal-box')?.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Init
loadPosts();
checkAdminPanel();

// Developer only: access convoy tab via ?tab=convoys
(function() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'convoys') {
    document.getElementById('wallContainer').style.display = 'none';
    const convoyContainer = document.getElementById('convoysContainer');
    if (convoyContainer) convoyContainer.style.display = 'block';
    loadConvoys();
  }
})();
