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

auth.signInAnonymously().catch(error => console.error("Auth error:", error));

const IMGBB_API_KEY = "2e6555f84f2cba4982c98e35ff987554";

// Random Anonymous Name Generator
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  if (!content && !fileInput.files[0]) {
    alert('Text එකක් හෝ image එකක් දාන්න!');
    return;
  }
  let imageUrl = null;
  if (fileInput.files[0]) {
    try {
      imageUrl = await uploadImage(fileInput.files[0]);
    } catch (e) {
      alert('Image upload failed!');
      return;
    }
  }
  try {
    await db.collection("posts").add({
      nickname,
      content,
      imageUrl,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      reactions: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 }
    });
    document.getElementById('postContent').value = '';
    fileInput.value = '';
  } catch (e) {
    console.error('Post failed:', e);
    alert('Post කිරීම අසාර්ථකයි.');
  }
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

        // User reaction from localStorage
        let userReactions = {};
        try { userReactions = JSON.parse(localStorage.getItem('userReactions') || '{}'); } catch(e) {}
        const userReactType = userReactions[postId] || null;

        // Total reactions & top reaction
        const reactionTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
        const totalReactions = reactionTypes.reduce((sum, t) => sum + (post.reactions?.[t] || 0), 0);
        let topReaction = 'like';
        let topCount = 0;
        reactionTypes.forEach(t => {
          const count = post.reactions?.[t] || 0;
          if (count > topCount) {
            topCount = count;
            topReaction = t;
          }
        });

        const emojiMap = {
          like: '👍', love: '❤️', haha: '😆', wow: '😮', sad: '😢', angry: '😠'
        };

        const buttonEmoji = userReactType ? emojiMap[userReactType] : (totalReactions > 0 ? emojiMap[topReaction] : '👍');
        const buttonText = userReactType ? (userReactType.charAt(0).toUpperCase() + userReactType.slice(1)) : 
                           (totalReactions > 0 ? (topReaction.charAt(0).toUpperCase() + topReaction.slice(1)) : 'Like');
        const reactionCountStr = totalReactions > 0 ? ' · '+totalReactions : '';

        const div = document.createElement('div');
        div.className = 'post';
        div.innerHTML = `
          <div class="post-header">
            <strong>${escapeHtml(post.nickname)}</strong>
            <small>${post.timestamp?.toDate().toLocaleString() || 'Just now'}</small>
          </div>
          ${post.content ? `<div class="post-content">${escapeHtml(post.content)}</div>` : ''}
          ${post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" alt="post image">` : ''}
          <div class="reaction-wrapper">
            <button class="like-btn">${buttonEmoji} <span>${buttonText}</span>${reactionCountStr}</button>
            <div class="reaction-picker">
              <button class="reaction-option" onclick="event.stopPropagation(); react('${postId}', 'like')" title="Like">👍</button>
              <button class="reaction-option" onclick="event.stopPropagation(); react('${postId}', 'love')" title="Love">❤️</button>
              <button class="reaction-option" onclick="event.stopPropagation(); react('${postId}', 'haha')" title="Haha">😆</button>
              <button class="reaction-option" onclick="event.stopPropagation(); react('${postId}', 'wow')" title="Wow">😮</button>
              <button class="reaction-option" onclick="event.stopPropagation(); react('${postId}', 'sad')" title="Sad">😢</button>
              <button class="reaction-option" onclick="event.stopPropagation(); react('${postId}', 'angry')" title="Angry">😠</button>
            </div>
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
async function react(postId, type) {
  const ref = db.collection("posts").doc(postId);
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) return;
      const data = doc.data();
      const reactions = { like:0, love:0, haha:0, wow:0, sad:0, angry:0, ...data.reactions };
      reactions[type] = (reactions[type] || 0) + 1;
      transaction.update(ref, { reactions });
    });
    let userReactions = JSON.parse(localStorage.getItem('userReactions') || '{}');
    userReactions[postId] = type;
    localStorage.setItem('userReactions', JSON.stringify(userReactions));
  } catch (error) {
    console.error("Reaction failed:", error);
  }
}

// Comments
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

function toggleCommentBox(postId) {
  const div = document.getElementById('comments-' + postId);
  div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

loadPosts();
