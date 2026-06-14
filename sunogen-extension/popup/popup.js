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
      { id: 'epic_orch',   label: 'Epic Orchestra',   icon: '🎼' },
      { id: 'cinematic',   label: 'Cinematic Score',  icon: '🎬' },
      { id: 'dark_ambient', label: 'Dark Ambient',    icon: '🌑' },
      { id: 'documentary', label: 'Documentary',      icon: '📽️' },
    ],
  },
  {
    id: 'custom', label: 'Custom ✏️',
    genres: [],
  },
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
  promptEdited:       false,  // true if user manually edited prompt
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
    btn.setAttribute('aria-selected', cat.id === uiState.selectedCategory);
    btn.addEventListener('click', () => {
      uiState.selectedCategory = cat.id;
      uiState.selectedGenreId = null;
      $('genre-search').value = '';
      uiState.searchQuery = '';
      renderGenreTabs();
      renderGenreGrid();
      updatePromptPreview();
    });
    container.appendChild(btn);
  });
}

function renderGenreGrid() {
  const grid = $('genre-grid');
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
  if (genres.length === 0) {
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
      uiState.promptEdited = false;
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
    const chip = document.createElement('button');
    const isSelected = uiState.selectedMoods.includes(m.id);
    const isDisabled = !isSelected && uiState.selectedMoods.length >= 3;
    chip.className = 'mood-chip' +
      (isSelected ? ' selected' : '') +
      (isDisabled ? ' disabled'  : '');
    chip.style.setProperty('--chip-color', m.color);
    chip.textContent = m.label;
    chip.dataset.moodId = m.id;
    if (!isDisabled) {
      chip.addEventListener('click', () => {
        if (isSelected) {
          uiState.selectedMoods = uiState.selectedMoods.filter(id => id !== m.id);
        } else if (uiState.selectedMoods.length < 3) {
          uiState.selectedMoods.push(m.id);
        }
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

// ── Prompt Preview ─────────────────────────────────────────────────
function buildCurrentPrompt() {
  const genreLabel = resolveGenreLabel();
  const moodLabels = uiState.selectedMoods.map(id => MOODS.find(m => m.id === id)?.label ?? id);
  return buildPrompt({
    genre:         genreLabel,
    moods:         moodLabels,
    bpm:           uiState.bpm,
    vocalType:     uiState.vocalType,
    language:      uiState.language,
    duration:      uiState.duration,
    custom:        uiState.customAdditions,
  });
}

function resolveGenreLabel() {
  if (uiState.selectedCategory === 'custom') return uiState.customGenreText;
  const allGenres = GENRE_CATEGORIES.flatMap(c => c.genres);
  return allGenres.find(g => g.id === uiState.selectedGenreId)?.label ?? '';
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

// ── Pill Group Helper ──────────────────────────────────────────────
function setupPillGroup(groupId, onSelect) {
  const group = $(groupId);
  if (!group) return;
  group.querySelectorAll('.btn-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.btn-pill').forEach(b => b.classList.remove('btn-pill-active'));
      btn.classList.add('btn-pill-active');
      onSelect(btn.dataset.value);
    });
  });
}

// ── Step Progress ──────────────────────────────────────────────────
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
function stopElapsedTimer() {
  clearInterval(uiState.elapsedTimer);
}

// ── Keepalive ─────────────────────────────────────────────────────
let keepaliveTimer = null;
function startKeepalive() {
  stopKeepalive();
  keepaliveTimer = setInterval(() => {
    chrome.runtime.sendMessage({ type: 'KEEPALIVE', payload: {} }).catch(() => {});
  }, 20000);
}
function stopKeepalive() {
  clearInterval(keepaliveTimer);
}

// ── Background Message Listener ────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg?.type) return;
  switch (msg.type) {
    case 'GENERATION_PROGRESS': {
      const { step } = msg.payload ?? {};
      if (step) setStep(step, 'active');
      break;
    }
    case 'GENERATION_COMPLETE': {
      stopElapsedTimer();
      stopKeepalive();
      uiState.generating = false;
      uiState.currentTracks = msg.payload?.tracks ?? [];
      renderResults(uiState.currentTracks);
      showView('view-results');
      break;
    }
    case 'GENERATION_ERROR': {
      stopElapsedTimer();
      stopKeepalive();
      uiState.generating = false;
      showError(msg.payload?.userMessage ?? 'เกิดข้อผิดพลาด');
      showView('view-config');
      break;
    }
  }
});

// ── Results Rendering ──────────────────────────────────────────────
function renderResults(tracks) {
  const list = $('track-list');
  list.innerHTML = '';
  const dl = $('btn-download-all');
  if (dl) dl.style.display = tracks.length > 1 ? 'block' : 'none';

  tracks.forEach((track, i) => {
    const card = document.createElement('div');
    card.className = 'track-card';
    card.innerHTML = `
      <span class="track-name">${track.name ?? `Track ${i + 1}`}</span>
      <div class="track-actions">
        <button class="btn-secondary btn-play" data-index="${i}">▶ Preview</button>
        <button class="btn-primary btn-dl" data-index="${i}" style="font-size:12px;padding:6px 14px">⬇ Download MP3</button>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('.btn-dl').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      triggerDownload(uiState.currentTracks[idx], idx);
    });
  });
}

async function triggerDownload(track, idx) {
  // Phase 4 will add full EQ processing — direct download for now
  const genre  = resolveGenreLabel();
  const moods  = uiState.selectedMoods.map(id => MOODS.find(m => m.id === id)?.label ?? id);
  const filename = buildFilename(genre, moods);
  await chrome.downloads.download({ url: track.url, filename });
}

// ── Generate ───────────────────────────────────────────────────────
async function handleGenerate() {
  const prompt = $('prompt-preview')?.value?.trim();
  if (!prompt) {
    showError('กรุณาเลือก Genre และ Mood ก่อน Generate');
    return;
  }
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
    stopElapsedTimer();
    stopKeepalive();
    uiState.generating = false;
    showError('ไม่สามารถเชื่อมต่อ background service ได้');
    showView('view-config');
  });
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

// ── Init ───────────────────────────────────────────────────────────
async function init() {
  const settings = await getSettings();
  uiState.songCount = settings.defaultSongCount ?? 2;

  // Sync song count pill
  $('count-group')?.querySelectorAll('.btn-pill').forEach(btn => {
    btn.classList.toggle('btn-pill-active', Number(btn.dataset.value) === uiState.songCount);
  });

  // Render dynamic sections
  renderGenreTabs();
  renderGenreGrid();
  renderMoodChips();
  updatePromptPreview();

  // Genre search
  $('genre-search')?.addEventListener('input', e => {
    uiState.searchQuery = e.target.value.trim();
    renderGenreGrid();
  });

  // Custom genre input
  $('custom-genre-input')?.addEventListener('input', e => {
    uiState.customGenreText = e.target.value;
    uiState.promptEdited = false;
    updatePromptPreview();
  });

  // Parameter pill groups
  setupPillGroup('bpm-group',      v => { uiState.bpm       = v; uiState.promptEdited = false; updatePromptPreview(); });
  setupPillGroup('vocal-group',    v => { uiState.vocalType = v; uiState.promptEdited = false; updatePromptPreview(); });
  setupPillGroup('language-group', v => { uiState.language  = v; uiState.promptEdited = false; updatePromptPreview(); });
  setupPillGroup('duration-group', v => { uiState.duration  = v; uiState.promptEdited = false; updatePromptPreview(); });
  setupPillGroup('count-group',    v => { uiState.songCount = Number(v); });

  // Custom keywords
  $('custom-additions')?.addEventListener('input', e => {
    uiState.customAdditions = e.target.value;
    uiState.promptEdited = false;
    updatePromptPreview();
  });

  // Prompt manual edit
  $('prompt-preview')?.addEventListener('input', e => {
    uiState.promptEdited = true;
    updateCharCount(e.target.value.length);
  });

  // Regenerate prompt
  $('btn-regen-prompt')?.addEventListener('click', () => {
    uiState.promptEdited = false;
    updatePromptPreview();
  });

  // Copy prompt
  $('btn-copy-prompt')?.addEventListener('click', copyPrompt);
  $('btn-copy-prompt-progress')?.addEventListener('click', copyPrompt);

  // Generate
  $('btn-generate')?.addEventListener('click', handleGenerate);

  // Cancel
  $('btn-cancel')?.addEventListener('click', () => {
    stopElapsedTimer();
    stopKeepalive();
    uiState.generating = false;
    chrome.runtime.sendMessage({ type: 'CANCEL_GENERATION', payload: {} }).catch(() => {});
    showView('view-config');
  });

  // Back to config
  $('btn-back-to-config')?.addEventListener('click', () => showView('view-config'));

  // Error dismiss
  $('btn-error-dismiss')?.addEventListener('click', hideError);

  // Settings (Phase 5)
  $('btn-settings')?.addEventListener('click', () => {});

  showView('view-config');
}

document.addEventListener('DOMContentLoaded', init);
