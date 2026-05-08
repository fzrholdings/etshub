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

const IMGBB_API_KEY = "2e6555f84f2cba4982c98e35ff987554";

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
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {method:'POST', body:fd});
  const data = await res.json();
  return data.data.url;
}

// ---- Post Functions ----
async function createPost() {
    // Spam prevention: 30s cooldown
  if (isCooldownActive()) {
    showToast('Please wait 30 seconds between posts');
    return;
  }
  const nickname = getAnonymousName();
  const content = document.getElementById('postContent').value.trim();
  
  // Check if there's text or selected images
  if (!content && selectedFiles.length === 0) {
    return showToast('Text or image required');
  }

  let imageUrls = [];
  
  // Upload each selected file
  if (selectedFiles.length > 0) {
    try {
      for (let file of selectedFiles) {
        const url = await uploadImage(file);
        imageUrls.push(url);
      }
    } catch (e) {
      showToast('Image upload fail');
      console.error(e);
      return;
    }
  }

  try {
    await db.collection("posts").add({
      nickname,
      content,
      imageUrls,      // array of URLs (new)
      imageUrl: null, // keep for backward compat (optional)
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      reactions: { like:0, love:0, haha:0, wow:0, sad:0, angry:0 }
    });
        startCooldown(30000);
    // Reset form
    document.getElementById('postContent').value = '';
    selectedFiles.length = 0; // clear array
    renderPreviews(); // update previews (empty)
  } catch (e) {
    console.error('Post fail:', e);
    showToast('Posting failed');
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
    const secs = Math.ceil(remaining / 1000);
    btn.textContent = `Wait ${secs}s...`;
    setTimeout(update, 1000);
  };
  update();
}

// Check on page load if cooldown still active
(function() {
  const expire = getCooldownExpireTime();
  if (Date.now() < expire) {
    runCooldownTimer(expire);
  }
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

      // Create post div
      const div = document.createElement('div');
      div.className = 'post';
      div.id = 'post-' + postId;
      div.setAttribute('data-post-id', postId);
      div.innerHTML = `
        <div class="post-header">
          <div class="post-header-info">
            <strong>${escapeHtml(post.nickname)}</strong>
            <small>${post.timestamp?.toDate().toLocaleString()||'Just now'}</small>
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
        <div class="post-content">${post.content ? escapeHtml(post.content) : ''}</div>
        <div class="edit-area" style="display:none;">
          <textarea></textarea>
          <div class="edit-actions">
            <button class="cancel-edit-btn">Cancel</button>
            <button class="save-edit-btn">Save</button>
          </div>
        </div>
       ${(post.imageUrls && post.imageUrls.length > 0) ? `
  <div class="image-collage ${post.imageUrls.length === 1 ? 'single' : ''}">
    ${post.imageUrls.map((url, index) => `
      <img src="${escapeHtml(url)}" alt="image" onclick="openLightbox('${postId}', ${index})">
    `).join('')}
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
    }); // End of forEach

    // === Deep Link Highlight & Scroll (ONE TIME, after all posts rendered) ===
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

// ---- Toggle Reaction for Posts ----
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
        // Same reaction clicked → remove
        reactions[type] = Math.max(0, (reactions[type] || 0) - 1);
        delete userReactions[postId];
      } else {
        // Different or no reaction → add new, remove old if any
        if (currentType) {
          reactions[currentType] = Math.max(0, (reactions[currentType] || 0) - 1);
        }
        reactions[type] = (reactions[type] || 0) + 1;
        userReactions[postId] = type;
      }
      
      transaction.update(ref, { reactions });
    });
    
    localStorage.setItem('postReactions', JSON.stringify(userReactions));
    // onSnapshot will automatically re-render UI
  } catch (e) {
    console.error("Reaction toggle failed:", e);
  }
}

// ---- Real‑time Comment System with toggle reactions ----
function loadComments(postId) {
  db.collection("posts").doc(postId).collection("comments")
    .orderBy("timestamp","asc")
    .onSnapshot(snapshot => {
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
      <strong>${escapeHtml(node.nickname||'Anon')}:</strong> <span class="comment-text">${escapeHtml(node.text)}</span>
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

// ---- Toggle Reaction for Comments ----
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
        // Remove reaction
        reactions[type] = Math.max(0, (reactions[type] || 0) - 1);
        delete userReactions[key];
      } else {
        // Add new, remove old if exists
        if (currentType) {
          reactions[currentType] = Math.max(0, (reactions[currentType] || 0) - 1);
        }
        reactions[type] = (reactions[type] || 0) + 1;
        userReactions[key] = type;
      }
      
      transaction.update(ref, { reactions });
    });
    
    localStorage.setItem('commentReactions', JSON.stringify(userReactions));
    // UI re-renders via onSnapshot
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

// File selection handler
const selectedFiles = []; // store File objects

function handleFileSelect(fileList) {
    // Filter by size & limit
    const maxSize = 10 * 1024 * 1024; // 10MB
    const newFiles = Array.from(fileList);
    
    // Check size limit and show errors
    const oversized = newFiles.filter(f => f.size > maxSize);
    if (oversized.length > 0) {
        showToast(`File(s) too large! Maximum 10MB each.\n${oversized.map(f=>f.name).join(', ')}`);
        // Remove oversized
        const validFiles = newFiles.filter(f => f.size <= maxSize);
        // Clear the file input so user can reselect (we'll reconstruct DataTransfer)
        document.getElementById('imageInput').value = ''; 
        // We'll just add valid ones, but we can also let them reselect
        // For simplicity, we'll only process valid files from this batch
        addFiles(validFiles);
    } else {
        addFiles(newFiles);
    }
    // Clear the file input to allow re-selecting same file later
    document.getElementById('imageInput').value = '';
}

function addFiles(files) {
    // Enforce total max 3 images
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
            div.innerHTML = `
                <img src="${e.target.result}" alt="preview">
                <button class="remove-preview" onclick="removeFile(${index})">&times;</button>
            `;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderPreviews();
}

// ----- Post Actions Menu -----
function togglePostMenu(postId) {
    const menu = document.getElementById('menu-'+postId);
    if (!menu) return;
    const isVisible = menu.style.display === 'block';
    // Hide all menus first
    document.querySelectorAll('.post-menu').forEach(m => m.style.display = 'none');
    menu.style.display = isVisible ? 'none' : 'block';
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.post-actions')) {
        document.querySelectorAll('.post-menu').forEach(m => m.style.display = 'none');
    }
});

function showToast(msg) {
  // Remove existing toast if any
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
    const shareData = {
        title: 'ETS Ceylon FM Hub',
        text: text ? text : 'Check this post!',
        url: postUrl
    };
    if (navigator.share) {
        navigator.share(shareData).catch(() => {});
    } else {
        navigator.clipboard.writeText(postUrl).then(() => {
            showToast('📋 Post link copied!');
        }).catch(() => showToast('Copy failed'));
    }
}

async function editPost(postId) {
  const docRef = db.collection("posts").doc(postId);
  try {
    const doc = await docRef.get();
    if (!doc.exists) return;
    const post = doc.data();
    const currentContent = post.content || '';
    
    // Find post container and show edit area
    const postDiv = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postDiv) return;
    const contentDiv = postDiv.querySelector('.post-content');
    const editArea = postDiv.querySelector('.edit-area');
    const editTextarea = editArea.querySelector('textarea');
    
    // Hide static content, show edit
    contentDiv.style.display = 'none';
    editArea.style.display = 'flex';
    editTextarea.value = currentContent;
    editTextarea.focus();
    
    // Save action
    editArea.querySelector('.save-edit-btn').onclick = async () => {
      const newContent = editTextarea.value.trim();
      if (newContent === '' || newContent === currentContent) {
        // Cancel editing
        contentDiv.style.display = 'block';
        editArea.style.display = 'none';
        showToast('Post updated')
        return;
      }
      try {
        await docRef.update({ content: newContent });
        // onSnapshot will update UI automatically
      } catch(e) {
        console.error(e);
        showToast('Edit failed');
      }
    };
    
    // Cancel action
    editArea.querySelector('.cancel-edit-btn').onclick = () => {
      contentDiv.style.display = 'block';
      editArea.style.display = 'none';
    };
    
  } catch(e) {
    console.error(e);
    showToast('Edit not available');
  }
}

async function deletePost(postId) {
    showConfirm('Delete this post? It will be permanently removed.', async () => {
        try {
            const commentsRef = db.collection("posts").doc(postId).collection("comments");
            const commentSnap = await commentsRef.get();
            const batch = db.batch();
            commentSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            await db.collection("posts").doc(postId).delete();
        } catch(e) {
            console.error(e);
            showToast('❌ Delete failed');
        }
    });
}

// ----- Custom Confirm Modal -----
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

// ----- Custom Toast Message -----
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

// ---- Image Lightbox ----
let currentLightboxPostId = null;
let currentLightboxIndex = 0;
let lightboxImages = [];

function openLightbox(postId, index) {
    // Get the post's images
    const postDiv = document.getElementById('post-' + postId);
    if (!postDiv) return;
    const images = [];
    // collect all image URLs from the collage
    postDiv.querySelectorAll('.image-collage img').forEach(img => {
        images.push(img.src);
    });
    if (images.length === 0) return;
    lightboxImages = images;
    currentLightboxPostId = postId;
    currentLightboxIndex = index;
    showLightboxImage();
    document.getElementById('lightbox').style.display = 'flex';
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
}

function changeLightboxImage(direction) {
    const newIndex = currentLightboxIndex + direction;
    if (newIndex >= 0 && newIndex < lightboxImages.length) {
        currentLightboxIndex = newIndex;
        showLightboxImage();
    }
}

function showLightboxImage() {
    const img = document.getElementById('lightboxImg');
    const counter = document.getElementById('lightboxCounter');
    img.src = lightboxImages[currentLightboxIndex];
    counter.textContent = (currentLightboxIndex + 1) + ' / ' + lightboxImages.length;
}

// ----- Search Filter -----
function filterPosts() {
    const term = document.getElementById('searchInput').value.trim().toLowerCase();
    const posts = document.querySelectorAll('.post');
    posts.forEach(post => {
        const text = post.dataset.searchText || '';
        post.style.display = (term === '' || text.includes(term)) ? '' : 'none';
    });
}

async function reportPost(postId) {
  const anonId = getAnonymousId();
  const reportsRef = db.collection("posts").doc(postId).collection("reports");
  
  // 1️⃣ Check already reported by this user (Firestore)
  try {
    const existing = await reportsRef.where("anonId", "==", anonId).get();
    if (!existing.empty) {
      showToast('⚠️ You already reported this post');
      return;
    }
  } catch(e) { console.error(e); return; }

  // 2️⃣ Add report
  try {
    await reportsRef.add({
      anonId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('🚩 Post reported');

    // 3️⃣ Check total distinct reports
    const allReports = await reportsRef.get();
    const distinctIds = new Set();
    allReports.forEach(doc => distinctIds.add(doc.data().anonId));
    
    if (distinctIds.size >= 3) {
      // Delete the post automatically
      await deletePostInternal(postId);
      showToast('🗑️ Post removed due to reports');
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
    // Delete reports subcollection as well
    const reportsRef = db.collection("posts").doc(postId).collection("reports");
    const reportSnap = await reportsRef.get();
    reportSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    await db.collection("posts").doc(postId).delete();
  } catch(e) {
    console.error("Auto delete failed:", e);
  }
}

loadPosts();
