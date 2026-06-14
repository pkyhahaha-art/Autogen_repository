import { buildPrompt, buildFilename } from '../utils/promptBuilder.js';
import { getSettings } from '../utils/storage.js';

// ── Genre Data ─────────────────────────────────────────────────────
const GENRE_CATEGORIES = [
  {
    id: 'electronic', label: 'Electronic',
    genres: [
      { id: 'lofi',      label: 'Lo-fi Hip Hop', icon: '🎵' },
      { id: 'edm',       label: 'EDM',            icon: '🔊' },
      { id: 'ambient',   label: 'Ambient',        icon: '🌊' },
      { id: 'synthwave', label: 'Synthwave',      icon: '🌆' },
      { id: 'chillwave', label: 'Chillwave',      icon: '🌸' },
      { id: 'dnb',       label: 'Drum & Bass',    icon: '🥁' },
      { id: 'house',     label: 'House',          icon: '🎛️' },
      { id: 'techno',    label: 'Techno',         icon: '🤖' },
    ],
  },
  {
    id: 'acoustic', label: 'Acoustic',
    genres: [
      { id: 'acoustic_pop', label: 'Acoustic Pop', icon: '🎸' },
      { id: 'folk',         label: 'Folk',          icon: '🪕' },
      { id: 'classical',    label: 'Classical',     icon: '🎻' },
      { id: 'jazz',         label: 'Jazz',          icon: '🎷' },
      { id: 'blues',        label: 'Blues',         icon: '🎺' },
      { id: 'bossa_nova',   label: 'Bossa Nova',    icon: '🌴' },
    ],
  },
  {
    id: 'rock', label: 'Rock/Metal',
    genres: [
      { id: 'indie_rock',  label: 'Indie Rock',  icon: '🎸' },
      { id: 'alternative', label: 'Alternative', icon: '💿' },
      { id: 'pop_rock',    label: 'Pop Rock',    icon: '🎤' },
      { id: 'metal',       label: 'Metal',       icon: '🤘' },
      { id: 'punk',        label: 'Punk',        icon: '⚡' },
    ],
  },
  {
    id: 'world', label: 'World',
    genres: [
      { id: 'thai_pop',  label: 'Thai Pop',  icon: '🇹🇭' },
      { id: 'kpop',      label: 'K-Pop',     icon: '🇰🇷' },
      { id: 'jpop',      label: 'J-Pop',     icon: '🎌' },
      { id: 'latin',     label: 'Latin',     icon: '💃' },
      { id: 'reggae',    label: 'Reggae',    icon: '☀️' },
      { id: 'afrobeats', label: 'Afrobeats', icon: '🥁' },
    ],
  },
  {
    id: 'cinematic', label: 'Cinematic',
    genres: [
      { id: 'epic_orch',    label: 'Epic Orchestra',  icon: '🎼' },
      { id: 'cinematic',    label: 'Cinematic Score', icon: '🎬' },
      { id: 'dark_ambient', label: 'Dark Ambient',    icon: '🌑' },
      { id: 'documentary',  label: 'Documentary',     icon: '📽️' },
    ],
  },
  { id: 'custom', label: 'Custom ✏️', genres: [] },
];

// ── Mood Data ──────────────────────────────────────────────────────
const MOODS = [
  { id: 'happy',       label: 'Happy',       color: '#10B981' },
  { id: 'sad',         label: 'Sad',         color: '#3B82F6' },
  { id: 'energetic',   label: 'Energetic',   color: '#F59E0B' },
  { id: 'calm',        label: 'Calm',        color: '#8B5CF6' },
  { id: 'dark',        label: 'Dark',        color: '#6B7280' },
  { id: 'uplifting',   label: 'Uplifting',   color: '#10B981' },
  { id: 'romantic',    label: 'Romantic',    color: '#EC4899' },
  { id: 'mysterious',  label: 'Mysterious',  color: '#6366F1' },
  { id: 'aggressive',  label: 'Aggressive',  color: '#EF4444' },
  { id: 'dreamy',      label: 'Dreamy',      color: '#8B5CF6' },
  { id: 'nostalgic',   label: 'Nostalgic',   color: '#F59E0B' },
  { id: 'focused',     label: 'Focused',     color: '#3B82F6' },
  { id: 'playful',     label: 'Playful',     color: '#10B981' },
  { id: 'epic',        label: 'Epic',        color: '#F59E0B' },
  { id: 'melancholic', label: 'Melancholic', color: '#3B82F6' },
];

// ── UI State ──────────────────────────────────────────────────────
const uiState = {
  selectedGenreId:    null,
  selectedCategory:   'electronic',
  searchQuery:        '',
  customGenreText:    '',
  selectedMoods:      [],
  bpm:                'mid',
  vocalType:          'no_vocals',
  language:           'instrumental',
  duration:           'medium',
  songCount:          2,
  customAdditions:    '',
  promptEdited:       false,
  currentTracks:      [],
  generating:         false,
  elapsedTimer:       null,
};

// ── DOM Helpers ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const VIEWS = ['view-config', 'view-progress', 'view-results'];

function showView(id) {
  VIEWS.forEach(v => $(v)?.classList.toggle('hidden', v !== id));
}

function showError(msg) {
  $('error-msg').textContent = msg;
  $('error-banner').classList.remove('hidden');
}

function hideError() {
  $('error-banner').classList.add('hidden');
}

// ── Genre Rendering ────────────────────────────────────────────────
function renderGenreTabs() {
  const container = $('genre-tabs');
  container.innerHTML = '';
  GENRE_CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'genre-tab' + (cat.id === uiState.selectedCategory ? ' tab-active' : '');
    btn.textContent = cat.label;
    btn.dataset.catId = cat.id;
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => {
      uiState.selectedCategory = cat.id;
      uiState.selectedGenreId  = null;
      $('genre-search').value  = '';
      uiState.searchQuery      = '';
      renderGenreTabs();
      renderGenreGrid();
      updatePromptPreview();
    });
    container.appendChild(btn);
  });
}

function renderGenreGrid() {
  const grid       = $('genre-grid');
  const customWrap = $('custom-genre-wrap');

  if (uiState.selectedCategory === 'custom' && !uiState.searchQuery) {
    grid.innerHTML = '';
    customWrap.classList.remove('hidden');
    return;
  }
  customWrap.classList.add('hidden');

  let genres;
  if (uiState.searchQuery) {
    const q = uiState.searchQuery.toLowerCase();
    genres = GENRE_CATEGORIES.flatMap(c => c.genres).filter(g =>
      g.label.toLowerCase().includes(q)
    );
  } else {
    const cat = GENRE_CATEGORIES.find(c => c.id === uiState.selectedCategory);
    genres = cat?.genres ?? [];
  }

  grid.innerHTML = '';
  if (!genres.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:16px;font-size:12px;">ไม่พบ genre</p>';
    return;
  }

  genres.forEach(g => {
    const card = document.createElement('div');
    card.className = 'genre-card' + (g.id === uiState.selectedGenreId ? ' selected' : '');
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', g.id === uiState.selectedGenreId);
    card.innerHTML = `<span class="genre-card-icon">${g.icon}</span><span class="genre-card-label">${g.label}</span>`;
    card.addEventListener('click', () => {
      uiState.selectedGenreId = g.id;
      uiState.promptEdited    = false;
      renderGenreGrid();
      updatePromptPreview();
    });
    grid.appendChild(card);
  });
}

// ── Mood Rendering ─────────────────────────────────────────────────
function renderMoodChips() {
  const container = $('mood-chips');
  container.innerHTML = '';
  MOODS.forEach(m => {
    const isSelected = uiState.selectedMoods.includes(m.id);
    const isDisabled = !isSelected && uiState.selectedMoods.length >= 3;
    const chip = document.createElement('button');
    chip.className = 'mood-chip' +
      (isSelected ? ' selected' : '') +
      (isDisabled ? ' disabled'  : '');
    chip.style.setProperty('--chip-color', m.color);
    chip.textContent = m.label;
    if (!isDisabled) {
      chip.addEventListener('click', () => {
        if (isSelected) uiState.selectedMoods = uiState.selectedMoods.filter(id => id !== m.id);
        else if (uiState.selectedMoods.length < 3) uiState.selectedMoods.push(m.id);
        uiState.promptEdited = false;
        renderMoodChips();
        updateMoodCount();
        updatePromptPreview();
      });
    }
    container.appendChild(chip);
  });
}

function updateMoodCount() {
  const el = $('mood-count');
  if (el) el.textContent = `${uiState.selectedMoods.length} / 3`;
}

// ── Prompt ────────────────────────────────────────────────────────
function resolveGenreLabel() {
  if (uiState.selectedCategory === 'custom') return uiState.customGenreText;
  return GENRE_CATEGORIES.flatMap(c => c.genres)
    .find(g => g.id === uiState.selectedGenreId)?.label ?? '';
}

function buildCurrentPrompt() {
  return buildPrompt({
    genre:      resolveGenreLabel(),
    moods:      uiState.selectedMoods.map(id => MOODS.find(m => m.id === id)?.label ?? id),
    bpm:        uiState.bpm,
    vocalType:  uiState.vocalType,
    language:   uiState.language,
    duration:   uiState.duration,
    custom:     uiState.customAdditions,
  });
}

function updatePromptPreview() {
  if (uiState.promptEdited) return;
  const ta = $('prompt-preview');
  if (!ta) return;
  const prompt = buildCurrentPrompt();
  ta.value = prompt;
  updateCharCount(prompt.length);
}

function updateCharCount(len) {
  const el = $('prompt-char-count');
  if (el) el.textContent = `${len} chars`;
}

// ── Pill Groups ────────────────────────────────────────────────────
function setupPillGroup(groupId, onSelect) {
  $(groupId)?.querySelectorAll('.btn-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      $(groupId).querySelectorAll('.btn-pill').forEach(b => b.classList.remove('btn-pill-active'));
      btn.classList.add('btn-pill-active');
      onSelect(btn.dataset.value);
    });
  });
}

// ── Progress Steps ─────────────────────────────────────────────────
function setStep(stepId, state) {
  const el = $(stepId);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (state === 'active') el.classList.add('active');
  if (state === 'done')   el.classList.add('done');
}

function resetSteps() {
  ['step-open-suno','step-fill-prompt','step-submit','step-wait','step-download-audio']
    .forEach(id => setStep(id, 'pending'));
}

// ── Elapsed Timer ─────────────────────────────────────────────────
let elapsedSec = 0;
function startElapsedTimer() {
  elapsedSec = 0;
  clearInterval(uiState.elapsedTimer);
  uiState.elapsedTimer = setInterval(() => {
    elapsedSec++;
    const m = Math.floor(elapsedSec / 60);
    const s = String(elapsedSec % 60).padStart(2, '0');
    const el = $('progress-elapsed');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
}
function stopElapsedTimer() { clearInterval(uiState.elapsedTimer); }

// ── Keepalive ─────────────────────────────────────────────────────
let keepaliveTimer = null;
function startKeepalive() {
  stopKeepalive();
  keepaliveTimer = setInterval(() => {
    chrome.runtime.sendMessage({ type: 'KEEPALIVE', payload: {} }).catch(() => {});
  }, 20000);
}
function stopKeepalive() { clearInterval(keepaliveTimer); }

// ── Background Messages ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg?.type) return;
  switch (msg.type) {
    case 'GENERATION_PROGRESS':
      if (msg.payload?.step) setStep(msg.payload.step, 'active');
      break;
    case 'GENERATION_COMPLETE':
      stopElapsedTimer(); stopKeepalive();
      uiState.generating    = false;
      uiState.currentTracks = msg.payload?.tracks ?? [];
      renderResults(uiState.currentTracks);
      showView('view-results');
      break;
    case 'GENERATION_ERROR':
      stopElapsedTimer(); stopKeepalive();
      uiState.generating = false;
      showError(msg.payload?.userMessage ?? 'เกิดข้อผิดพลาด');
      showView('view-config');
      break;
  }
});

// ── Results & Track Cards ──────────────────────────────────────────
function renderResults(tracks) {
  const list = $('track-list');
  list.innerHTML = '';

  tracks.forEach((track, i) => {
    track.selectedPreset = 'original';
    track.cachedBuffer   = null;

    const card = document.createElement('div');
    card.className = 'track-card';
    card.dataset.index = i;
    card.innerHTML = `
      <div class="track-header">
        <span class="track-name">${escHtml(track.name ?? `Track ${i + 1}`)}</span>
        <span class="track-time" id="track-time-${i}">0:00</span>
      </div>
      <audio id="track-audio-${i}" preload="metadata">
        <source src="${escHtml(track.url)}">
      </audio>
      <div class="player">
        <button class="btn-play" id="btn-play-${i}" aria-label="Play / Pause">▶</button>
        <input type="range" class="seek-bar" id="seek-${i}" value="0" min="0" max="100" step="0.1" aria-label="Seek">
      </div>
      <div class="eq-row">
        <span class="eq-label">EQ Preset</span>
        <div class="eq-presets" id="eq-presets-${i}">
          ${['original','clear','crispy','warm','punchy'].map(p =>
            `<button class="btn-eq${p === 'original' ? ' eq-active' : ''}" data-preset="${p}">${capitalize(p)}</button>`
          ).join('')}
        </div>
      </div>
      <div class="track-progress hidden" id="track-progress-${i}">
        <div class="track-progress-bar">
          <div class="track-progress-fill" id="track-progress-fill-${i}"></div>
        </div>
        <span class="track-progress-label" id="track-progress-label-${i}">กำลัง Process...</span>
      </div>
      <button class="btn-primary btn-process-dl" id="btn-dl-${i}">⬇ Process &amp; Download</button>
    `;
    list.appendChild(card);
    wireTrackCard(i, track);
  });

  const dlAll = $('btn-download-all');
  if (dlAll) dlAll.style.display = tracks.length > 1 ? 'block' : 'none';
}

function wireTrackCard(idx, track) {
  const audio   = $(`track-audio-${idx}`);
  const playBtn = $(`btn-play-${idx}`);
  const seekBar = $(`seek-${idx}`);
  const timeEl  = $(`track-time-${idx}`);

  // Playback controls
  playBtn?.addEventListener('click', () => {
    if (audio.paused) { audio.play(); playBtn.textContent = '⏸'; }
    else              { audio.pause(); playBtn.textContent = '▶'; }
  });

  audio?.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    if (seekBar) seekBar.value = (audio.currentTime / audio.duration) * 100;
    if (timeEl)  timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
  });

  audio?.addEventListener('loadedmetadata', () => {
    if (timeEl) timeEl.textContent = `0:00 / ${fmt(audio.duration)}`;
  });

  audio?.addEventListener('ended', () => {
    if (playBtn) playBtn.textContent = '▶';
    if (seekBar) seekBar.value = 0;
  });

  seekBar?.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (seekBar.value / 100) * audio.duration;
  });

  // EQ preset selection
  document.querySelectorAll(`#eq-presets-${idx} .btn-eq`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#eq-presets-${idx} .btn-eq`).forEach(b => b.classList.remove('eq-active'));
      btn.classList.add('eq-active');
      track.selectedPreset = btn.dataset.preset;
    });
  });

  // Process & Download
  $(`btn-dl-${idx}`)?.addEventListener('click', () => processAndDownload(idx));
}

// ── Audio Processing & Download ────────────────────────────────────
async function processAndDownload(idx) {
  const track   = uiState.currentTracks[idx];
  const preset  = track.selectedPreset ?? 'original';
  const progEl  = $(`track-progress-${idx}`);
  const fillEl  = $(`track-progress-fill-${idx}`);
  const labelEl = $(`track-progress-label-${idx}`);
  const dlBtn   = $(`btn-dl-${idx}`);

  const setProgress = (pct, label) => {
    if (fillEl)  fillEl.style.width   = pct + '%';
    if (labelEl) labelEl.textContent  = label;
  };

  progEl?.classList.remove('hidden');
  if (dlBtn) dlBtn.disabled = true;

  try {
    // 1. Fetch & decode
    setProgress(5, 'กำลังโหลดเสียง...');
    const { fetchAndDecode, processAudio, PRESETS } = await import('../audio/audioProcessor.js');

    if (!track.cachedBuffer) {
      track.cachedBuffer = await fetchAndDecode(track.url);
    }

    // 2. EQ processing
    setProgress(30, 'กำลัง Process EQ...');
    const processed = await processAudio(track.cachedBuffer, PRESETS[preset]);

    // 3. MP3 encoding
    const { encodeMp3 } = await import('../audio/mp3Exporter.js');
    const mp3Blob = await encodeMp3(processed, 192, pct => {
      setProgress(30 + pct * 0.65, `Encoding MP3... ${pct}%`);
    });

    // 4. Download
    setProgress(98, 'กำลัง Download...');
    const blobUrl  = URL.createObjectURL(mp3Blob);
    const genre    = resolveGenreLabel();
    const moods    = uiState.selectedMoods.map(id => MOODS.find(m => m.id === id)?.label ?? id);
    const filename = buildFilename(genre, moods);
    await chrome.downloads.download({ url: blobUrl, filename });
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    setProgress(100, 'Download สำเร็จ ✓');
    setTimeout(() => progEl?.classList.add('hidden'), 2000);

  } catch (err) {
    progEl?.classList.add('hidden');
    if (err.message === 'CORS_ERROR') {
      // Fallback: download original audio without processing
      showError('โหลดไฟล์ไม่ได้ (CORS) — download ต้นฉบับแทน');
      chrome.downloads.download({ url: track.url }).catch(() =>
        showError('ดาวน์โหลดไม่สำเร็จ (E008) กรุณาตรวจสอบ Chrome download settings')
      );
    } else if (err.message?.startsWith('HTTP_')) {
      showError(`โหลดไฟล์ไม่ได้ (${err.message}) — ลองใหม่หรือ download จาก Suno.com`);
    } else {
      showError('เกิดข้อผิดพลาดในการแปลงไฟล์ (E007) — กรุณาลองใหม่');
      console.error('[SunoGen] processAndDownload error:', err);
    }
  } finally {
    if (dlBtn) dlBtn.disabled = false;
  }
}

// ── Batch Download ─────────────────────────────────────────────────
async function downloadAll() {
  for (let i = 0; i < uiState.currentTracks.length; i++) {
    await processAndDownload(i);
  }
}

// ── Copy Prompt ────────────────────────────────────────────────────
function copyPrompt() {
  const text = $('prompt-preview')?.value ?? '';
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('btn-copy-prompt');
    if (!btn) return;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
  });
}

// ── Generate ───────────────────────────────────────────────────────
async function handleGenerate() {
  const prompt = $('prompt-preview')?.value?.trim();
  if (!prompt) { showError('กรุณาเลือก Genre และ Mood ก่อน Generate'); return; }
  hideError();
  uiState.generating = true;
  resetSteps();
  showView('view-progress');
  startElapsedTimer();
  startKeepalive();

  chrome.runtime.sendMessage({
    type: 'START_GENERATION',
    payload: { prompt, songCount: uiState.songCount, settings: {} },
  }).catch(() => {
    stopElapsedTimer(); stopKeepalive();
    uiState.generating = false;
    showError('ไม่สามารถเชื่อมต่อ background service ได้');
    showView('view-config');
  });
}

// ── Utils ──────────────────────────────────────────────────────────
function fmt(sec) {
  if (!isFinite(sec)) return '-:--';
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────────────
async function init() {
  const settings = await getSettings();
  uiState.songCount = settings.defaultSongCount ?? 2;

  $('count-group')?.querySelectorAll('.btn-pill').forEach(btn => {
    btn.classList.toggle('btn-pill-active', Number(btn.dataset.value) === uiState.songCount);
  });

  // Restore state if generation was running while popup was closed
  try {
    const res = await chrome.runtime.sendMessage({ type: 'POPUP_OPENED', payload: {} });
    if (res?.restore === 'results' && res.tracks) {
      uiState.currentTracks = res.tracks;
      renderResults(res.tracks);
      showView('view-results');
    } else if (res?.restore === 'progress') {
      resetSteps();
      if (res.step) setStep(res.step, 'active');
      showView('view-progress');
      startElapsedTimer();
      startKeepalive();
      uiState.generating = true;
    }
  } catch (_) {}

  // Genre
  renderGenreTabs();
  renderGenreGrid();
  $('genre-search')?.addEventListener('input', e => {
    uiState.searchQuery = e.target.value.trim();
    renderGenreGrid();
  });
  $('custom-genre-input')?.addEventListener('input', e => {
    uiState.customGenreText = e.target.value;
    uiState.promptEdited    = false;
    updatePromptPreview();
  });

  // Mood
  renderMoodChips();
  updateMoodCount();

  // Parameters
  setupPillGroup('bpm-group',      v => { uiState.bpm       = v; uiState.promptEdited = false; updatePromptPreview(); });
  setupPillGroup('vocal-group',    v => { uiState.vocalType = v; uiState.promptEdited = false; updatePromptPreview(); });
  setupPillGroup('language-group', v => { uiState.language  = v; uiState.promptEdited = false; updatePromptPreview(); });
  setupPillGroup('duration-group', v => { uiState.duration  = v; uiState.promptEdited = false; updatePromptPreview(); });
  setupPillGroup('count-group',    v => { uiState.songCount = Number(v); });

  $('custom-additions')?.addEventListener('input', e => {
    uiState.customAdditions = e.target.value;
    uiState.promptEdited    = false;
    updatePromptPreview();
  });

  // Prompt
  $('prompt-preview')?.addEventListener('input', e => {
    uiState.promptEdited = true;
    updateCharCount(e.target.value.length);
  });
  $('btn-regen-prompt')?.addEventListener('click', () => {
    uiState.promptEdited = false;
    updatePromptPreview();
  });
  $('btn-copy-prompt')?.addEventListener('click', copyPrompt);
  $('btn-copy-prompt-progress')?.addEventListener('click', copyPrompt);

  // Actions
  $('btn-generate')?.addEventListener('click', handleGenerate);
  $('btn-cancel')?.addEventListener('click', () => {
    stopElapsedTimer(); stopKeepalive();
    uiState.generating = false;
    chrome.runtime.sendMessage({ type: 'CANCEL_GENERATION', payload: {} }).catch(() => {});
    showView('view-config');
  });
  $('btn-back-to-config')?.addEventListener('click', () => showView('view-config'));
  $('btn-download-all')?.addEventListener('click', downloadAll);
  $('btn-error-dismiss')?.addEventListener('click', hideError);
  $('btn-settings')?.addEventListener('click', () => {});

  updatePromptPreview();
}

document.addEventListener('DOMContentLoaded', init);
