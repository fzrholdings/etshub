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
function escapeHtml(text) {
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
async function uploadImage(file) {
  const fd = new FormData(); fd.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {method:'POST', body:fd});
  const data = await res.json();
  return data.data.url;
}

// ---- Post functions ----
async function createPost() {
  const nickname = getAnonymousName();
  const content = document.getElementById('postContent').value.trim();
  const fileInput = document.getElementById('imageInput');
  if (!content && !fileInput.files[0]) return alert('Text හෝ image දාන්න!');
  let imageUrl = null;
  if (fileInput.files[0]) {
    try { imageUrl = await uploadImage(fileInput.files[0]); } catch { alert('Upload fail'); return; }
  }
  try {
    await db.collection("posts").add({
      nickname, content, imageUrl,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      reactions: { like:0, love:0, haha:0, wow:0, sad:0, angry:0 }
    });
    document.getElementById('postContent').value = '';
    fileInput.value = '';
  } catch (e) { console.error(e); alert('Post fail'); }
}

function loadPosts() {
  db.collection("posts").orderBy("timestamp","desc").onSnapshot(snapshot => {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';
    snapshot.forEach(doc => {
      const post = doc.data();
      const postId = doc.id;
      // Reaction state
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
      div.innerHTML = `
        <div class="post-header"><strong>${escapeHtml(post.nickname)}</strong><small>${post.timestamp?.toDate().toLocaleString()||'Just now'}</small></div>
        ${post.content?`<div class="post-content">${escapeHtml(post.content)}</div>`:''}
        ${post.imageUrl?`<img src="${escapeHtml(post.imageUrl)}">`:''}
        <div class="reaction-wrapper">
          <button class="like-btn">${btnEmoji} <span>${btnText}</span>${countStr}</button>
          <div class="reaction-picker">
            ${reactionTypes.map(t=>`<button class="reaction-option" onclick="event.stopPropagation(); reactPost('${postId}','${t}')">${emojiMap[t]}</button>`).join('')}
          </div>
        </div>
        <button onclick="toggleCommentBox('${postId}')">💬 Comment</button>
        <div class="comments" id="comments-${postId}" style="display:none;">
          <div class="comments-list" id="commentsList-${postId}"></div>
          <div class="top-reply-box">
            <input type="text" id="commentInput-${postId}" placeholder="Comment එකක්...">
            <button onclick="addComment('${postId}')">Send</button>
          </div>
        </div>
      `;
      container.appendChild(div);
      loadComments(postId);
    });
  });
}

async function reactPost(postId, type) {
  const ref = db.collection("posts").doc(postId);
  try {
    await db.runTransaction(async t=>{
      const doc = await t.get(ref);
      if(!doc.exists) return;
      const data = doc.data();
      const reactions = {like:0,love:0,haha:0,wow:0,sad:0,angry:0, ...data.reactions};
      reactions[type]++;
      t.update(ref,{reactions});
    });
    let userReactions = JSON.parse(localStorage.getItem('postReactions')||'{}');
    userReactions[postId] = type;
    localStorage.setItem('postReactions', JSON.stringify(userReactions));
  } catch(e){console.error(e);}
}

// ---- Real‑time Comment System with Threads ----
function loadComments(postId) {
  // Listen to all comments for this post and rebuild tree
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
  div.style.marginLeft = `${depth*20}px`;
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
      <button onclick="addReply('${postId}','${commentId}')">Send</button>
    </div>
    <div class="children-comments" id="children-${postId}-${commentId}"></div>
  `;
  container.appendChild(div);
  // Render children recursively
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
    // Hide reply box after sending
    document.getElementById(`replyBox-${postId}-${parentCommentId}`).style.display = 'none';
  });
}

async function reactComment(postId, commentId, type) {
  const ref = db.collection("posts").doc(postId).collection("comments").doc(commentId);
  try {
    await db.runTransaction(async t=>{
      const doc = await t.get(ref);
      if(!doc.exists) return;
      const data = doc.data();
      const reactions = {like:0,love:0,haha:0,wow:0,sad:0,angry:0, ...data.reactions};
      reactions[type]++;
      t.update(ref,{reactions});
    });
    let userReactions = JSON.parse(localStorage.getItem('commentReactions')||'{}');
    userReactions[`${postId}_${commentId}`] = type;
    localStorage.setItem('commentReactions', JSON.stringify(userReactions));
  } catch(e){console.error(e);}
}

function toggleCommentBox(postId) {
  const div = document.getElementById('comments-'+postId);
  div.style.display = div.style.display === 'none' ? 'block' : 'none';
}
function toggleReplyBox(postId, commentId) {
  const div = document.getElementById(`replyBox-${postId}-${commentId}`);
  div.style.display = div.style.display === 'none' ? 'flex' : 'none';
}

// Start
loadPosts();
