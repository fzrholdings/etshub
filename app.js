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

// Random Names
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
function getAnonymousId() {
  let id = localStorage.getItem('anonId');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('anonId', id);
  }
  return id;
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

// ---- Post Functions ----
async function createPost() {
  const btn = document.getElementById('postButton');
  
  // Cooldown check (if cooldown active, ignore and don't mess with button state)
  if (isCooldownActive()) {
    showToast('Please wait 30 seconds between posts');
    return;
  }

  const nickname = getAnonymousName();
  const content = document.getElementById('postContent').value.trim();
  
  // Validate
  if (!content && selectedFiles.length === 0) {
    showToast('Text or image required');
    return;
  }

  // --- Start loading state ---
  btn.disabled = true;
  btn.textContent = 'Posting...';

  // 🔞 NSFW Check (Sightengine)
  if (selectedFiles.length > 0) {
    for (let file of selectedFiles) {
      const isNsfw = await checkImageNSFW(file);
      if (isNsfw) {
        showToast('🔞 NSFW image detected! Post rejected.');
        btn.disabled = false;
        btn.textContent = 'Post කරන්න';
        return;
      }
    }
  }

    // 🗜️ Compress images before upload
  if (selectedFiles.length > 0) {
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        selectedFiles[i] = await compressImage(selectedFiles[i]);
      }
      // Update previews with compressed thumbnails
      renderPreviews();
    } catch (e) {
      console.warn('Image compression failed, using originals:', e);
      // fallback to original files (already in selectedFiles)
    }
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
      btn.textContent = 'Post කරන්න';
      return;
    }
  }

  // Save to Firestore
  try {
    await db.collection("posts").add({
      nickname,
      content,
      imageUrls,
      imageUrl: null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      reactions: { like:0, love:0, haha:0, wow:0, sad:0, angry:0 }
    });
    
    // Success – start cooldown (will disable button with countdown)
    startCooldown(30000);
    
    // Reset form
    document.getElementById('postContent').value = '';
    selectedFiles.length = 0;
    renderPreviews();
    
  } catch (e) {
    console.error('Post fail:', e);
    showToast('Posting failed');
    btn.disabled = false;
    btn.textContent = 'Post කරන්න';
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
      btn.textContent = 'Post කරන්න';
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
  db.collection("posts").orderBy("timestamp","desc").onSnapshot(snapshot => {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';
    snapshot.forEach(doc => {
      const post = doc.data();
      const postId = doc.id;
      let userReactions = JSON.parse(localStorage.getItem('postReactions')||'{}');
      const userReactType = userReactions[postId]||null;
      const reactionTypes = ['like','love','haha','wow','sad','angry'];
      const totalReactions = reactionTypes.reduce((s,t)=>s+(post.reactions?.[t]||0),0);
      let top = 'like', topCount=0;
      reactionTypes.forEach(t=>{ const c=post.reactions?.[t]||0; if(c>topCount){topCount=c;top=t;} });
      const emojiMap = {like:'👍',love:'❤️',haha:'😆',wow:'😮',sad:'😢',angry:'😠'};
      const btnEmoji = userReactType ? emojiMap[userReactType] : (totalReactions>0?emojiMap[top]:'👍');
      const btnText = userReactType ? userReactType.charAt(0).toUpperCase()+userReactType.slice(1) : (totalReactions>0?top.charAt(0).toUpperCase()+top.slice(1):'Like');
      const countStr = totalReactions>0?' · '+totalReactions:'';

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
              ${post.nickname !== getAnonymousName() ? `<button onclick="reportPost('${postId}')">Report</button>` : ''}
              ${post.nickname === getAnonymousName() ? `
                <button onclick="editPost('${postId}')">Edit</button>
                <button onclick="deletePost('${postId}')">Delete</button>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="post-content">${post.content ? filterBadWords(escapeHtml(post.content)) : ''}</div>
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
          <button class="like-btn">${btnEmoji} <span>${btnText}</span>${countStr}</button>
          <div class="reaction-picker">
            ${reactionTypes.map(t=>`<button class="reaction-option" onclick="event.stopPropagation(); reactPost('${postId}','${t}')">${emojiMap[t]}</button>`).join('')}
          </div>
        </div>
        <button class="comment-toggle-btn" onclick="toggleCommentBox('${postId}')">💬 Comment</button>
        <div class="comments" id="comments-${postId}" style="display:none;">
          <div class="comments-list" id="commentsList-${postId}"></div>
          <div class="top-reply-box">
            <input type="text" id="commentInput-${postId}" placeholder="Comment එකක්...">
            <button class="cm-send-btn" onclick="addComment('${postId}')">Send</button>
          </div>
        </div>
      `;
      div.dataset.searchText = (post.content + ' ' + post.nickname).toLowerCase();
      container.appendChild(div);
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
  const btnText = userReactType ? userReactType.charAt(0).toUpperCase()+userReactType.slice(1) : (totalReactions>0?top.charAt(0).toUpperCase()+top.slice(1):'Like');
  const countStr = totalReactions>0?' · '+totalReactions:'';

  const div = document.createElement('div');
  div.className = 'comment-thread' + (depth>0?' indented':'');
  div.style.marginLeft = depth>0 ? '20px' : '0';
  div.innerHTML = `
    <div class="comment-body">
      <strong>${escapeHtml(node.nickname||'Anon')}:</strong> <span class="comment-text">${filterBadWords(escapeHtml(node.text))}</span>
      <div class="cm-reaction-wrapper">
        <button class="cm-like-btn">${btnEmoji}<span>${btnText}</span>${countStr}</button>
        <div class="cm-reaction-picker">
          ${reactionTypes.map(t=>`<button class="reaction-option" onclick="event.stopPropagation(); reactComment('${postId}','${commentId}','${t}')">${emojiMap[t]}</button>`).join('')}
        </div>
      </div>
      <button class="reply-toggle" onclick="toggleReplyBox('${postId}','${commentId}')">Reply</button>
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

function addComment(postId) {
  const input = document.getElementById('commentInput-'+postId);
  const text = input.value.trim();
  if(!text) return;
  const nickname = getAnonymousName();
  db.collection("posts").doc(postId).collection("comments").add({
    nickname, text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    parentId: null,
    reactions: {like:0,love:0,haha:0,wow:0,sad:0,angry:0}
  }).then(() => input.value = '');
}

function addReply(postId, parentCommentId) {
  const input = document.getElementById(`replyInput-${postId}-${parentCommentId}`);
  const text = input.value.trim();
  if(!text) return;
  const nickname = getAnonymousName();
  db.collection("posts").doc(postId).collection("comments").add({
    nickname, text,
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
  if (navigator.share) {
    navigator.share({ title:'ETS Ceylon FM Hub', text: text||'Check this post!', url: postUrl }).catch(()=>{});
  } else {
    navigator.clipboard.writeText(postUrl).then(() => showToast('📋 Post link copied!')).catch(() => showToast('Copy failed'));
  }
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

// Report System
async function reportPost(postId) {
  const anonId = getAnonymousId();
  const reportsRef = db.collection("posts").doc(postId).collection("reports");
  try {
    const existing = await reportsRef.where("anonId", "==", anonId).get();
    if (!existing.empty) { showToast('⚠️ You already reported this post'); return; }
  } catch(e) { console.error(e); showToast('Report check failed'); return; }

  try {
    await reportsRef.add({ anonId, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('🚩 Post reported');
    const allReports = await reportsRef.get();
    const distinctIds = new Set();
    allReports.forEach(doc => distinctIds.add(doc.data().anonId));
    if (distinctIds.size >= 3) {
      await deletePostInternal(postId);
      showToast('🗑️ Post removed due to reports');
    }
  } catch(e) { console.error(e); showToast('Report failed'); }
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
  return date.toLocaleDateString(); // fallback
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


// Init
loadPosts();
