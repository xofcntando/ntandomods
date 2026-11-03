/* ============================================================
   Ntandomods — background soundtrack
   Resolves the track live from the Ladybug API, falls back to a
   bundled copy so the page always has music.
   ============================================================ */

const CONFIG = {
  API: 'https://ladybug-api-e8q8.onrender.com',
  KEY: 'nzN64y+bq1bd/QwnMLOxxQDgG5AL78ul82qg4tPI1lk=',
  QUERY: 'why me',
  FALLBACK: 'assets/why-me.mp3',
  DEFAULT_TITLE: 'Why Me?',
  DEFAULT_ARTIST: 'Mai Mai',
};

const $ = s => document.querySelector(s);
const audio = $('#audio');
const player = $('#player');
const playBtn = $('#playBtn');
const playIcon = $('#playIcon');
const prompt = $('#prompt');

const PLAY_PATH = 'M8 5v14l11-7z';
const PAUSE_PATH = 'M7 5h4v14H7zM13 5h4v14h-4z';

let resolved = false;   // true once a playable src is set
let userPaused = false; // user explicitly paused -> don't auto-resume
let autoMuted = false;  // we muted ourselves to slip past the autoplay block

/* ---------- preferences ---------- */
const pref = {
  get volume() {
    const v = parseFloat(localStorage.getItem('ntm_vol'));
    return Number.isFinite(v) ? v : 0.45;
  },
  set volume(v) { try { localStorage.setItem('ntm_vol', String(v)); } catch {} },
  get muted() { return localStorage.getItem('ntm_muted') === '1'; },
  set muted(m) { try { localStorage.setItem('ntm_muted', m ? '1' : '0'); } catch {} },
};

/* ---------- helpers ---------- */
function toast(msg, bad) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

function fmt(s) {
  if (!s || !Number.isFinite(s)) return '';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function setArt(url) {
  if (!url) return;
  const img = $('#trackArt');
  img.src = url;
  img.onerror = () => { img.src = 'assets/logo.png'; };
}

/* ---------- resolve the track ---------- */
async function resolveTrack() {
  const url = `${CONFIG.API}/v1/yt/play?query=${encodeURIComponent(CONFIG.QUERY)}` +
              `&type=audio&quality=480&apikey=${encodeURIComponent(CONFIG.KEY)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const data = await res.json();
  const file = data && data.file;
  if (!file || !file.download_url) throw new Error('API response had no file');

  // download_url is relative and needs the key
  const base = file.download_url.startsWith('http') ? file.download_url : CONFIG.API + file.download_url;
  const src = `${base}${base.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(CONFIG.KEY)}`;

  const title = (data.title || CONFIG.DEFAULT_TITLE).replace(/\s*\(Official.*?\)\s*/i, '').trim();
  const artist = CONFIG.DEFAULT_ARTIST;

  $('#trackTitle').textContent = title;
  $('#trackArtist').textContent = artist;
  $('#trackSrc').textContent = 'live · ladybug api';
  $('#pTitle').textContent = title;
  $('#pArtist').textContent = `${artist} · Ntandomods`;
  setArt(data.thumbnail);

  return src;
}

async function loadAudio() {
  if (resolved) return;
  try {
    audio.src = await resolveTrack();
    resolved = true;
  } catch (err) {
    // API down, expired, or blocked -> bundled copy
    console.warn('[Ntandomods] API resolve failed, using bundled audio:', err.message);
    audio.src = CONFIG.FALLBACK;
    resolved = true;
    $('#trackSrc').textContent = 'bundled fallback';
  }
}

/* ---------- playback ---------- */
function paint() {
  const playing = !audio.paused && !audio.ended;
  playIcon.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  player.classList.toggle('playing', playing);
  $('#heroPlayIcon').textContent = playing ? '❚❚' : '▶';
  $('#heroPlayLabel').textContent = playing ? 'Pause the soundtrack' : 'Play the soundtrack';
  $('#stripPlay').textContent = playing ? '❚❚ Pause' : '▶ Play';
  $('#muteIcon').style.opacity = audio.muted || audio.volume === 0 ? '.4' : '1';
}

async function play() {
  await loadAudio();
  audio.volume = pref.volume;
  audio.muted = pref.muted || autoMuted;
  try {
    await audio.play();
    userPaused = false;
    prompt.hidden = true;
    player.classList.remove('hidden');
  } catch (err) {
    // autoplay blocked -> ask for one click
    player.classList.remove('hidden');
    if (!userPaused) showPrompt('play');
  }
  paint();
}

/* The prompt doubles as an "unmute" nudge when we had to start silent. */
function showPrompt(mode) {
  const p = prompt.querySelector('p');
  const btn = $('#promptPlay');
  if (mode === 'unmute') {
    p.innerHTML = '<b>Sound is on mute</b><br>Tap anywhere to turn the music up.';
    btn.textContent = 'Unmute';
  } else {
    p.innerHTML = '<b>Turn on the soundtrack?</b><br>Background music, one click.';
    btn.textContent = 'Play';
  }
  prompt.dataset.mode = mode;
  prompt.hidden = false;
}

/* Called on the first real gesture. Restores audio after a muted autoplay. */
function unlock() {
  if (!autoMuted) return false;
  autoMuted = false;
  audio.muted = pref.muted;
  if (!pref.muted && audio.volume === 0) audio.volume = pref.volume || 0.45;
  if (audio.paused && !userPaused) audio.play().catch(() => {});
  prompt.hidden = true;
  paint();
  return true;
}

function pause() {
  audio.pause();
  userPaused = true;
  paint();
}

function toggle() {
  if (audio.paused) play(); else pause();
}

/* ---------- wiring ---------- */
playBtn.addEventListener('click', toggle);
$('#heroPlay').addEventListener('click', toggle);
$('#stripPlay').addEventListener('click', toggle);
$('#promptPlay').addEventListener('click', () => {
  if (prompt.dataset.mode === 'unmute') { unlock(); return; }
  prompt.hidden = true;
  play();
});
$('#promptClose').addEventListener('click', () => {
  prompt.hidden = true;
  if (prompt.dataset.mode === 'unmute') {
    // keep the music running, just silent for this session
    autoMuted = false;
    audio.muted = true;
  } else {
    userPaused = true;
  }
  paint();
});

/* First gesture anywhere restores sound after a muted autoplay. */
['pointerdown', 'touchstart', 'scroll'].forEach(evt => {
  window.addEventListener(evt, e => {
    if (!autoMuted) return;
    if (e.target.closest && e.target.closest('#muteBtn, #vol')) return; // those handle themselves
    unlock();
  }, { passive: true, capture: true });
});

audio.addEventListener('play', paint);
audio.addEventListener('pause', paint);
audio.addEventListener('ended', paint);
audio.addEventListener('error', () => {
  // a live link can expire mid-session; swap to the bundled copy once
  if (audio.src && !audio.src.includes(CONFIG.FALLBACK) && audio.error) {
    console.warn('[Ntandomods] stream failed, switching to bundled audio');
    audio.src = CONFIG.FALLBACK;
    $('#trackSrc').textContent = 'bundled fallback';
    if (!userPaused) audio.play().catch(() => {});
  }
});

const vol = $('#vol');
vol.value = pref.volume;
vol.addEventListener('input', () => {
  pref.volume = parseFloat(vol.value);
  audio.volume = pref.volume;
  if (pref.volume > 0 && audio.muted) { audio.muted = false; pref.muted = false; }
  paint();
});

$('#muteBtn').addEventListener('click', () => {
  audio.muted = !audio.muted;
  autoMuted = false;          // an explicit click wins over the autoplay workaround
  pref.muted = audio.muted;
  if (!audio.muted && audio.paused && !userPaused) audio.play().catch(() => {});
  paint();
});

/* keyboard: space toggles when not typing */
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(document.activeElement?.tagName || '')) {
    e.preventDefault();
    if (unlock()) return;     // this keypress just turned the sound on
    toggle();
  }
});

/* card glow follows the pointer */
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

$('#year').textContent = new Date().getFullYear();

/* ---------- boot ---------- */
// Autoplay strategy:
//   1. try unmuted play (allowed on repeat visits / some browsers)
//   2. if blocked, play MUTED — always permitted — then unmute on first gesture
async function boot() {
  player.classList.remove('hidden');
  await loadAudio();
  audio.volume = pref.volume;
  audio.muted = pref.muted;

  try {
    await audio.play();
    userPaused = false;
    paint();
    return;
  } catch { /* blocked — fall through to muted autoplay */ }

  if (!pref.muted) {
    autoMuted = true;
    audio.muted = true;
    try {
      await audio.play();
      userPaused = false;
    } catch {
      autoMuted = false;
      audio.muted = pref.muted;
    }
  }
  paint();

  if (autoMuted) showPrompt('unmute');
  else if (audio.paused && !userPaused) showPrompt('play');
}

boot();
