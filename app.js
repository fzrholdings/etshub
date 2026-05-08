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
function getAnonymousName() { let name = localStorage.getItem('anonName'); if (!name) { name = generateRandomName(); localStorage.setItem('anonName', name); } return name; }
function getAnonymousId() { let id = localStorage.getItem('anonId'); if (!id) { id = 'anon_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36); localStorage.setItem('anonId', id); } return id; }
function escapeHtml(text) { return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
async function uploadImage(file) { const fd = new FormData(); fd.append('image', file); const res = await fetch('/api/upload', { method:'POST', body:fd }); const data = await res.json(); return data.data.url; }

// ----- Make URLs clickable -----
function linkifyText(text) { const urlRegex = /https?:\/\/[^\s<]+/gi; return text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`); }

// ---- Post Functions ----
async function createPost() {
  const btn = document.getElementById('postButton');
  if (isCooldownActive()) { showToast('Please wait 30 seconds between posts'); return; }
  const nickname = getAnonymousName();
  const content = document.getElementById('postContent').value.trim();
  if (!content && selectedFiles.length === 0) { showToast('Text or image required'); return; }
  btn.disabled = true; btn.textContent = 'Posting...';
  const urlsInText = extractUrls(content);
  for (let urlStr of urlsInText) { if (await checkUrlNSFW(urlStr)) { showToast('🔞 NSFW link detected! Post rejected.'); btn.disabled = false; btn.textContent = 'Post කරන්න'; return; } }
  if (selectedFiles.length > 0) { for (let file of selectedFiles) { if (await checkImageNSFW(file)) { showToast('🔞 NSFW image detected! Post rejected.'); btn.disabled = false; btn.textContent = 'Post කරන්න'; return; } } }
  if (selectedFiles.length > 0) { try { for (let i=0; i<selectedFiles.length; i++) selectedFiles[i] = await compressImage(selectedFiles[i]); renderPreviews(); } catch(e) {} }
  let imageUrls = [];
  if (selectedFiles.length > 0) { try { for (let file of selectedFiles) imageUrls.push(await uploadImage(file)); } catch(e) { showToast('Image upload fail'); btn.disabled = false; btn.textContent = 'Post කරන්න'; return; } }
  try {
    await db.collection("posts").add({ nickname, content, imageUrls, imageUrl:null, timestamp: firebase.firestore.FieldValue.serverTimestamp(), reactions: { like:0, love:0, haha:0, wow:0, sad:0, angry:0 } });
    startCooldown(30000);
    document.getElementById('postContent').value = ''; selectedFiles.length = 0; renderPreviews();
  } catch(e) { console.error('Post fail:',e); showToast('Posting failed'); btn.disabled = false; btn.textContent = 'Post කරන්න'; }
}

// Cooldown
function getCooldownExpireTime() { return parseInt(localStorage.getItem('postCooldown')||'0',10); }
function isCooldownActive() { return Date.now() < getCooldownExpireTime(); }
function startCooldown(ms) { const exp = Date.now()+ms; localStorage.setItem('postCooldown',exp); runCooldownTimer(exp); }
function runCooldownTimer(exp) { const btn = document.getElementById('postButton'); if(!btn) return; btn.disabled = true; const upd = ()=>{ const r = Math.max(0,exp-Date.now()); if(r<=0){ btn.disabled=false; btn.textContent='Post කරන්න'; localStorage.removeItem('postCooldown'); return; } btn.textContent=`Wait ${Math.ceil(r/1000)}s...`; setTimeout(upd,1000); }; upd(); }
(function(){ const e=getCooldownExpireTime(); if(Date.now()<e) runCooldownTimer(e); })();

// Wall & Posts
function loadPosts() {
  let initialLoadDone = false;
  db.collection("posts").orderBy("timestamp","desc").onSnapshot(snapshot => {
    const container = document.getElementById('postsContainer'); container.innerHTML = '';
    if (initialLoadDone) { snapshot.docChanges().forEach(c => { if (c.type==='added' && !c.doc.metadata.hasPendingWrites) playNotificationSound(); }); }
    snapshot.forEach(doc => {
      const post = doc.data(); const postId = doc.id;
      let userReactions = JSON.parse(localStorage.getItem('postReactions')||'{}'); const userReactType = userReactions[postId]||null;
      const reactionTypes = ['like','love','haha','wow','sad','angry'];
      const totalReactions = reactionTypes.reduce((s,t)=>s+(post.reactions?.[t]||0),0);
      let top='like', topCount=0; reactionTypes.forEach(t=>{ const c=post.reactions?.[t]||0; if(c>topCount){topCount=c;top=t;} });
      const emojiMap = {like:'👍',love:'❤️',haha:'😆',wow:'😮',sad:'😢',angry:'😠'};
      const btnEmoji = userReactType?emojiMap[userReactType]:(totalReactions>0?emojiMap[top]:'👍');
      const btnText = userReactType?userReactType.charAt(0).toUpperCase()+userReactType.slice(1):(totalReactions>0?top.charAt(0).toUpperCase()+top.slice(1):'Like');
      const countStr = totalReactions>0?' · '+totalReactions:'';
      const div = document.createElement('div'); div.className='post'; div.id='post-'+postId; div.setAttribute('data-post-id',postId);
      div.innerHTML = `
        <div class="post-header"><div class="post-header-info"><strong>${escapeHtml(post.nickname)}</strong><small>${timeAgo(post.timestamp)}</small></div>
          <div class="post-actions"><button onclick="togglePostMenu('${postId}')" class="menu-btn">⋮</button><div class="post-menu" id="menu-${postId}" style="display:none;">
            <button onclick="sharePost('${postId}','${escapeHtml(post.content||'')}')">Share</button>
            ${post.nickname!==getAnonymousName()?`<button onclick="reportPost('${postId}')">Report</button>`:''}
            ${post.nickname===getAnonymousName()?`<button onclick="editPost('${postId}')">Edit</button><button onclick="deletePost('${postId}')">Delete</button>`:''}
          </div></div></div>
        <div class="post-content">${post.content?linkifyText(filterBadWords(escapeHtml(post.content))):''}</div>
        <div class="edit-area" style="display:none;"><textarea></textarea><div class="edit-actions"><button class="cancel-edit-btn">Cancel</button><button class="save-edit-btn">Save</button></div></div>
        ${(post.imageUrls&&post.imageUrls.length>0)?`<div class="image-collage ${post.imageUrls.length===1?'single':''}">${post.imageUrls.map((url,i)=>`<img src="${escapeHtml(url)}" alt="image" onclick="openLightbox('${postId}',${i})">`).join('')}</div>`:''}
        ${(!post.imageUrls||post.imageUrls.length===0)&&post.imageUrl?`<div class="image-collage single"><img src="${escapeHtml(post.imageUrl)}" onclick="openLightbox('${postId}',0)"></div>`:''}
        <div class="reaction-wrapper"><button class="like-btn">${btnEmoji} <span>${btnText}</span>${countStr}</button><div class="reaction-picker">${reactionTypes.map(t=>`<button class="reaction-option" onclick="event.stopPropagation();reactPost('${postId}','${t}')">${emojiMap[t]}</button>`).join('')}</div></div>
        <button class="comment-toggle-btn" onclick="toggleCommentBox('${postId}')">💬 Comment</button>
        <div class="comments" id="comments-${postId}" style="display:none;"><div class="comments-list" id="commentsList-${postId}"></div><div class="top-reply-box"><input type="text" id="commentInput-${postId}" placeholder="Comment එකක්..."><button class="cm-send-btn" onclick="addComment('${postId}')">Send</button></div></div>
      `;
      div.dataset.searchText = (post.content+' '+post.nickname).toLowerCase();
      container.appendChild(div);
      renderLinkPreviews(div, postId);
      loadComments(postId);
    });
    const hash = window.location.hash; if (hash&&hash.startsWith('#post-')) { const targetId = hash.replace('#post-',''); setTimeout(()=>{ const tp = document.getElementById('post-'+targetId); if(tp){ tp.scrollIntoView({behavior:'smooth',block:'center'}); tp.classList.add('highlight'); setTimeout(()=>tp.classList.remove('highlight'),2500); } },300); }
    initialLoadDone = true;
  });
}

async function reactPost(postId, type) {
  const ref = db.collection("posts").doc(postId);
  const userReactions = JSON.parse(localStorage.getItem('postReactions')||'{}'); const currentType = userReactions[postId];
  try {
    await db.runTransaction(async t => {
      const doc = await t.get(ref); if(!doc.exists) return; const data = doc.data();
      const reactions = { like:0, love:0, haha:0, wow:0, sad:0, angry:0, ...data.reactions };
      if (currentType === type) { reactions[type] = Math.max(0, (reactions[type]||0)-1); delete userReactions[postId]; }
      else { if(currentType) reactions[currentType] = Math.max(0, (reactions[currentType]||0)-1); reactions[type] = (reactions[type]||0)+1; userReactions[postId] = type; }
      t.update(ref, { reactions });
    });
    localStorage.setItem('postReactions', JSON.stringify(userReactions));
  } catch(e) { console.error("Reaction toggle failed:",e); }
}

// Comments
function loadComments(postId) {
  db.collection("posts").doc(postId).collection("comments").orderBy("timestamp","asc").onSnapshot(snapshot => {
    const comments = []; snapshot.forEach(doc => comments.push({id:doc.id, ...doc.data()}));
    const tree = buildCommentTree(comments); const list = document.getElementById('commentsList-'+postId); if(!list) return; list.innerHTML = '';
    tree.forEach(root => renderCommentNode(postId, root, 0, list));
  });
}
function buildCommentTree(comments) { const map={}, roots=[]; comments.forEach(c=>map[c.id]={...c, children:[]}); comments.forEach(c=>{ if(c.parentId&&map[c.parentId]) map[c.parentId].children.push(map[c.id]); else roots.push(map[c.id]); }); return roots; }
function renderCommentNode(postId, node, depth, container) {
  if(depth>2) return; const commentId = node.id;
  let userReactions = JSON.parse(localStorage.getItem('commentReactions')||'{}'); const userReactType = userReactions[`${postId}_${commentId}`]||null;
  const reactionTypes = ['like','love','haha','wow','sad','angry']; const totalReactions = reactionTypes.reduce((s,t)=>s+(node.reactions?.[t]||0),0);
  const emojiMap = {like:'👍',love:'❤️',haha:'😆',wow:'😮',sad:'😢',angry:'😠'};
  let top='like', topCount=0; reactionTypes.forEach(t=>{const c=node.reactions?.[t]||0; if(c>topCount){topCount=c;top=t;}});
  const btnEmoji = userReactType?emojiMap[userReactType]:(totalReactions>0?emojiMap[top]:'👍');
  const btnText = userReactType?userReactType.charAt(0).toUpperCase()+userReactType.slice(1):(totalReactions>0?top.charAt(0).toUpperCase()+top.slice(1):'Like');
  const countStr = totalReactions>0?' · '+totalReactions:'';
  const div = document.createElement('div'); div.className='comment-thread'+(depth>0?' indented':''); div.style.marginLeft = depth>0?'20px':'0';
  div.innerHTML = `
    <div class="comment-body"><strong>${escapeHtml(node.nickname||'Anon')}:</strong> <span class="comment-text">${linkifyText(filterBadWords(escapeHtml(node.text)))}</span>
      <div class="cm-reaction-wrapper"><button class="cm-like-btn">${btnEmoji}<span>${btnText}</span>${countStr}</button><div class="cm-reaction-picker">${reactionTypes.map(t=>`<button class="reaction-option" onclick="event.stopPropagation();reactComment('${postId}','${commentId}','${t}')">${emojiMap[t]}</button>`).join('')}</div></div>
      <button class="reply-toggle" onclick="toggleReplyBox('${postId}','${commentId}')">Reply</button>
    </div>
    <div class="reply-box" id="replyBox-${postId}-${commentId}" style="display:none;"><input type="text" id="replyInput-${postId}-${commentId}" placeholder="Reply..."><button class="cm-send-btn" onclick="addReply('${postId}','${commentId}')">Send</button></div>
    <div class="children-comments" id="children-${postId}-${commentId}"></div>
  `;
  container.appendChild(div);
  if(node.children&&node.children.length) { const cc = document.getElementById(`children-${postId}-${commentId}`); node.children.forEach(c=>renderCommentNode(postId,c,depth+1,cc)); }
}
async function addComment(postId) { const input = document.getElementById('commentInput-'+postId); const text = input.value.trim(); if(!text) return; const urls = extractUrls(text); for(let u of urls) if(await checkUrlNSFW(u)) { showToast('🔞 NSFW link detected! Comment rejected.'); return; } const nickname=getAnonymousName(); db.collection("posts").doc(postId).collection("comments").add({ nickname,text,timestamp:firebase.firestore.FieldValue.serverTimestamp(),parentId:null,reactions:{like:0,love:0,haha:0,wow:0,sad:0,angry:0} }).then(()=>input.value=''); }
async function addReply(postId, parentCommentId) { const input = document.getElementById(`replyInput-${postId}-${parentCommentId}`); const text = input.value.trim(); if(!text) return; const urls = extractUrls(text); for(let u of urls) if(await checkUrlNSFW(u)) { showToast('🔞 NSFW link detected! Reply rejected.'); return; } const nickname=getAnonymousName(); db.collection("posts").doc(postId).collection("comments").add({ nickname,text,timestamp:firebase.firestore.FieldValue.serverTimestamp(),parentId:parentCommentId,reactions:{like:0,love:0,haha:0,wow:0,sad:0,angry:0} }).then(()=>{ input.value=''; document.getElementById(`replyBox-${postId}-${parentCommentId}`).style.display='none'; }); }
async function reactComment(postId, commentId, type) { /* similar toggle as posts */ }

function toggleCommentBox(postId) { const d=document.getElementById('comments-'+postId); d.style.display = d.style.display==='none'?'block':'none'; }
function toggleReplyBox(postId, commentId) { const d=document.getElementById(`replyBox-${postId}-${commentId}`); d.style.display = d.style.display==='none'?'flex':'none'; }

// Files & Attachments
const selectedFiles = [];
function handleFileSelect(fileList) { /* ... existing code ... */ }
function addFiles(files) { /* ... */ }
function renderPreviews() { /* ... */ }
function removeFile(index) { /* ... */ }

// Post Actions (menu, share, edit, delete, report)
function togglePostMenu(postId) { /* ... */ }
function showToast(msg) { /* ... */ }
function sharePost(postId, text) { const postUrl = window.location.href.split('#')[0] + '#post-'+postId; if(navigator.share) { navigator.share({title:'ETS Ceylon FM Hub', text:text||'Check this post!', url:postUrl}).catch(()=>{}); } else { navigator.clipboard.writeText(postUrl).then(()=>showToast('📋 Post link copied!')).catch(()=>showToast('Copy failed')); } }
async function editPost(postId) { /* ... */ }
async function deletePost(postId) { /* ... */ }
function showConfirm(msg, onConfirm) { /* ... */ }
async function reportPost(postId) { /* ... */ }
async function deletePostInternal(postId) { /* ... */ }

// NSFW Checks
async function checkImageNSFW(file) { const fd = new FormData(); fd.append('media',file); const res = await fetch('/api/nsfw-check',{method:'POST',body:fd}); const result = await res.json(); if(result.status==='success'&&result.nudity){ if(result.nudity.sexual_activity>0.3||result.nudity.sexual_display>0.3||result.nudity.erotica>0.3) return true; } return false; }

async function checkUrlNSFW(urlStr) { try { const fd = new FormData(); fd.append('url',urlStr); const res = await fetch('/api/blocklist-check',{method:'POST',body:fd}); if(!res.ok) throw new Error('blocklist fail'); const data = await res.json(); return data.blocked===true; } catch(e) { console.error(e); showToast('⚠️ Link safety check failed. Post blocked.'); return true; } }

// Time ago, compression, sound, link preview, etc.
function timeAgo(ts) { /* ... */ }
function compressImage(file, maxW=1200, maxH=1200, q=0.8) { /* ... */ }
let audioCtx=null, audioUnlocked=false;
function unlockAudio() { /* ... */ }
function playNotificationSound() { /* ... */ }
document.addEventListener('click', unlockAudio, {once:true});

function extractUrls(text) { /* ... */ }
async function fetchLinkPreview(url) { /* ... */ }
async function renderLinkPreviews(postDiv, postId) { /* ... */ }

// Convoy Planner
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); if (b.textContent.includes(tabName==='wall'?'Wall':'Convoys')) b.classList.add('active'); });
  document.getElementById('wallContainer').style.display = tabName==='wall'?'block':'none';
  document.getElementById('convoysContainer').style.display = tabName==='convoys'?'block':'none';
  if (tabName==='convoys') loadConvoys();
}

let allConvoysData = [];

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
  const tags = tagsStr ? tagsStr.split(',').map(t=>t.trim()).filter(t=>t) : [];
  const fileInput = document.getElementById('convoyImageInput');
  let routeImageUrl = null;
  if (fileInput.files[0]) { try { const comp = await compressImage(fileInput.files[0]); routeImageUrl = await uploadImage(comp); } catch(e) { return showToast('Route image upload failed'); } }
  if (!title || !dateTimeStr) return showToast('Title and date are required!');
  if (!server) return showToast('Please select a server');
  const datetime = new Date(dateTimeStr);
  if (isNaN(datetime.getTime())) return showToast('Invalid date/time');
  try {
    await db.collection("convoys").add({ title, server, meetingLocation:meeting, datetime:firebase.firestore.Timestamp.fromDate(datetime), maxSlots, description:desc, dlcs, tags, routeImage:routeImageUrl, type, creatorName:getAnonymousName(), participants:{} });
    ['convoyTitle','convoyServer','convoyMeeting','convoyDateTime','convoyMaxSlots','convoyDesc','convoyTags','convoyImageInput'].forEach(id=>document.getElementById(id).value='');
    showToast('🚀 Convoy scheduled!'); loadConvoys();
  } catch(e) { console.error(e); showToast('Failed to create convoy'); }
}

function loadConvoys() {
  db.collection("convoys").orderBy("datetime","asc").onSnapshot(snapshot => {
    allConvoysData = []; const container = document.getElementById('convoysList'); container.innerHTML = '';
    if (snapshot.empty) { container.innerHTML = '<p style="color:#aaa; text-align:center;">No convoys planned yet.</p>'; return; }
    snapshot.forEach(doc => { allConvoysData.push({ id:doc.id, ...doc.data() }); });
    renderConvoyCards(allConvoysData);
  });
}

function renderConvoyCards(convoys) {
  const container = document.getElementById('convoysList'); container.innerHTML = '';
  if (convoys.length === 0) { container.innerHTML = '<p style="color:#aaa; text-align:center;">No matching convoys.</p>'; return; }
  convoys.forEach(convoy => {
    const anonId = getAnonymousId(); const participants = convoy.participants||{}; const isJoined = !!participants[anonId]; const count = Object.keys(participants).length;
    const maxSlots = convoy.maxSlots||0; const slotsText = maxSlots>0?`${count}/${maxSlots}`:`${count}`;
    const card = document.createElement('div'); card.className='convoy-card';
    card.innerHTML = `
      <div class="convoy-title">${escapeHtml(convoy.title)}</div>
      <div class="convoy-meta">
        <span>🖥️ ${escapeHtml(convoy.server||'N/A')}</span>
        ${convoy.meetingLocation?`<span>📍 ${escapeHtml(convoy.meetingLocation)}</span>`:''}
        <span>🕒 ${convoy.datetime.toDate().toLocaleString()}</span>
        ${convoy.dlcs&&convoy.dlcs.length>0?`<span>📦 ${convoy.dlcs.join(', ')}</span>`:''}
        ${convoy.tags&&convoy.tags.length>0?`<span>🏷️ ${convoy.tags.join(', ')}</span>`:''}
        <span>👥 ${slotsText} trucks</span>
        ${convoy.type?`<span>🔒 ${convoy.type.toUpperCase()}</span>`:''}
      </div>
      ${convoy.description?`<div class="convoy-desc">${escapeHtml(convoy.description)}</div>`:''}
      ${convoy.routeImage?`<img src="${escapeHtml(convoy.routeImage)}" class="convoy-route-img" onclick="window.open(this.src)">`:''}
      <button class="convoy-join-btn ${isJoined?'joined':''}" onclick="toggleJoinConvoy('${convoy.id}')">${isJoined?'✔ Joined':'Join Convoy'}</button>
      <div class="convoy-participants">${slotsText} participant${count!==1?'s':''}</div>
    `;
    container.appendChild(card);
  });
}

async function toggleJoinConvoy(convoyId) {
  const ref = db.collection("convoys").doc(convoyId); const anonId = getAnonymousId(); const anonName = getAnonymousName();
  try {
    await db.runTransaction(async t => {
      const doc = await t.get(ref); if(!doc.exists) return; const data = doc.data(); const participants = { ...data.participants };
      if (participants[anonId]) delete participants[anonId]; else participants[anonId] = anonName;
      t.update(ref, { participants });
    });
  } catch(e) { console.error(e); showToast('Failed to update participation'); }
}

function filterConvoys() {
  const term = document.getElementById('convoySearch').value.trim().toLowerCase();
  if (!term) { renderConvoyCards(allConvoysData); return; }
  const filtered = allConvoysData.filter(c => (c.title&&c.title.toLowerCase().includes(term))||(c.server&&c.server.toLowerCase().includes(term))||(c.meetingLocation&&c.meetingLocation.toLowerCase().includes(term))||(c.tags&&c.tags.some(t=>t.toLowerCase().includes(term))));
  renderConvoyCards(filtered);
}

// Init
loadPosts();
