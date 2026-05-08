// Firebase Config - ඔබේ config values paste කරන්න
const firebaseConfig = {
  apiKey: "AIzaSyDXQesoe9GP_QcC2YjpzMiYuanueagFMlk",
  authDomain: "etshub-26725.firebaseapp.com",
  projectId: "etshub-26725",
  storageBucket: "etshub-26725.firebasestorage.app",
  messagingSenderId: "626690152384",
  appId: "1:626690152384:web:c04d1306735fd846445a25",
  measurementId: "G-BVW8VV1CK8"   // මේක optional, තියාගන්න පුළුවන්
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Sign in anonymously
auth.signInAnonymously().catch(error => console.error("Auth error:", error));

// ImgBB API Key - ඔබ දුන්න key එක paste කරන්න (YOUR_KEY වෙනුවට)
const IMGBB_API_KEY = "2e6555f84f2cba4982c98e35ff987554";

// Helper: escape HTML
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Helper: upload image to ImgBB
async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  return data.data.url;
}

// Create post
async function createPost() {
  const nickname = getAnonymousName();
  const content = document.getElementById('postContent').value.trim();
  const fileInput = document.getElementById('imageInput');
  if (!content && !fileInput.files[0]) return alert('Text එකක් හෝ image එකක් දාන්න!');

  let imageUrl = null;
  if (fileInput.files[0]) {
    imageUrl = await uploadImage(fileInput.files[0]);
  }

  await db.collection("posts").add({
    nickname,
    content,
    imageUrl,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    reactions: { like: 0, love: 0, horn: 0 }
  });

  // Reset form
  document.getElementById('nickname').value = '';
  document.getElementById('postContent').value = '';
  fileInput.value = '';
}

// Load posts realtime
function loadPosts() {
  db.collection("posts")
    .orderBy("timestamp", "desc")
    .onSnapshot(snapshot => {
      const container = document.getElementById('postsContainer');
      container.innerHTML = '';
      snapshot.forEach(doc => {
        const post = doc.data();
        const postId = doc.id;
        const div = document.createElement('div');
        div.className = 'post';
        div.innerHTML = `
          <div class="post-header">
            <strong>${escapeHtml(post.nickname)}</strong>
            <small>${post.timestamp?.toDate().toLocaleString() || 'Just now'}</small>
          </div>
          ${post.content ? `<div class="post-content">${escapeHtml(post.content)}</div>` : ''}
          ${post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" alt="post image">` : ''}
          <div class="reactions">
  <button onclick="react('${postId}', 'like')">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22V11M2 13v7a2 2 0 002 2h12l4-10h-5.2a2 2 0 01-2-2V6a4 4 0 00-4-4h-.6a2 2 0 00-1.9 1.4L7 9"/><path d="M7 9h9.2a2 2 0 011.8 1.2L22 18"/></svg>
    <span>${post.reactions.like}</span>
  </button>
  <button onclick="react('${postId}', 'love')">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    <span>${post.reactions.love}</span>
  </button>
  <button onclick="react('${postId}', 'horn')">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a3 3 0 010 6M5 8h2l4-5v18l-4-5H5a2 2 0 01-2-2v-6a2 2 0 012-2z"/></svg>
    <span>${post.reactions.horn}</span>
  </button>
</div>
          <button onclick="toggleCommentBox('${postId}')">💬 Comment</button>
          <div class="comments" id="comments-${postId}" style="display:none;">
            <div class="comments-list" id="commentsList-${postId}"></div>
            <input type="text" id="commentInput-${postId}" placeholder="Comment එකක්...">
            <button onclick="addComment('${postId}')">Send</button>
          </div>
        `;
        container.appendChild(div);
        loadComments(postId);
      });
    });
}

// Reaction function
function react(postId, type) {
  const ref = db.collection("posts").doc(postId);
  db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists) return;
    const data = doc.data();
    const reactions = { ...data.reactions };
    reactions[type] = (reactions[type] || 0) + 1;
    transaction.update(ref, { reactions });
  }).catch(console.error);
}

// Load comments
function loadComments(postId) {
  db.collection("posts").doc(postId).collection("comments")
    .orderBy("timestamp")
    .onSnapshot(snapshot => {
      const list = document.getElementById('commentsList-' + postId);
      if (!list) return;
      list.innerHTML = '';
      snapshot.forEach(doc => {
        const c = doc.data();
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment';
        commentDiv.innerHTML = `<strong>${escapeHtml(c.nickname || 'Anon')}:</strong> ${escapeHtml(c.text)}`;
        list.appendChild(commentDiv);
      });
    });
}

// Add comment
function addComment(postId) {
  const input = document.getElementById('commentInput-' + postId);
  const text = input.value.trim();
  if (!text) return;
  const nickname = getAnonymousName();
  db.collection("posts").doc(postId).collection("comments").add({
    nickname,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => input.value = '');
}

// Toggle comment box
function toggleCommentBox(postId) {
  const div = document.getElementById('comments-' + postId);
  div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

// ---------- Random Anonymous Name Generator ----------
const adjectives = [
  "Silent", "Wild", "Phantom", "Turbo", "Mystic", "Rogue", "Blazing", "Iron", "Dark", "Cosmic",
  "Neon", "Storm", "Shadow", "Atomic", "Frozen", "Crimson", "Rapid", "Vortex", "Zen", "Lunar"
];

const nouns = [
  "Wolf", "Eagle", "Panda", "Tiger", "Falcon", "Knight", "Rider", "Ghost", "Drift", "Beast",
  "Hawk", "Viper", "Legend", "Raven", "Comet", "Phoenix", "Joker", "Warden", "Pilot", "Nomad"
];

function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

function getAnonymousName() {
  let name = localStorage.getItem('anonName');
  if (!name) {
    name = generateRandomName();
    localStorage.setItem('anonName', name);
  }
  return name;
}
// ----------------------------------------------------

// Start
loadPosts();
