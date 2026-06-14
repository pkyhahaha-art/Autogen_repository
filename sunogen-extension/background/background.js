import { saveSession } from '../utils/storage.js';

// ── Generation State ───────────────────────────────────────────────
// Persisted to chrome.storage.session so it survives popup close (Option A).
const DEFAULT_STATE = {
  generating:     false,
  sunoTabId:      null,
  currentPrompt:  null,
  songCount:      2,
  collectedUrls:  [],
  completedTracks: null,  // set when generation finishes
  lastStep:       null,
};

let state = { ...DEFAULT_STATE };

async function persistState() {
  await chrome.storage.session.set({ sg_gen_state: state }).catch(() => {});
}

async function loadState() {
  const res = await chrome.storage.session.get('sg_gen_state').catch(() => ({}));
  if (res.sg_gen_state) state = { ...DEFAULT_STATE, ...res.sg_gen_state };
}

// ── Keepalive ping receiver ────────────────────────────────────────
// (Receiving any message resets the SW timer — no explicit action needed.)

// ── Message Router ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg?.type) return false;

  switch (msg.type) {

    case 'POPUP_OPENED':
      handlePopupOpened(sendResponse);
      return true; // async

    case 'START_GENERATION':
      handleStartGeneration(msg.payload).then(sendResponse);
      return true;

    case 'CANCEL_GENERATION':
      state.generating   = false;
      state.completedTracks = null;
      persistState();
      sendResponse({ ok: true });
      break;

    case 'GET_HISTORY':
      handleGetHistory().then(sendResponse);
      return true;

    case 'CLEAR_HISTORY':
      handleClearHistory().then(sendResponse);
      return true;

    case 'SAVE_SETTINGS':
      handleSaveSettings(msg.payload?.settings).then(sendResponse);
      return true;

    case 'KEEPALIVE':
      sendResponse({ alive: true });
      break;

    // ── From content script ──
    case 'FORM_SUBMITTED':
      state.lastStep = 'step-wait';
      persistState();
      notifyPopup('GENERATION_PROGRESS', { step: 'step-wait', message: 'รอ Suno สร้างเพลง...' });
      break;

    case 'AUDIO_FOUND':
      handleAudioFound(msg.payload?.urls ?? []);
      break;

    case 'SUNO_ERROR':
      handleSunoError(msg.payload);
      break;

    case 'LOGIN_REQUIRED':
      state.generating = false;
      persistState();
      notifyPopup('GENERATION_ERROR', {
        error: 'LOGIN_REQUIRED', code: 'E001',
        userMessage: 'กรุณา Login Suno.com ก่อนใช้งาน',
      });
      break;
  }

  return false;
});

// ── Handlers ───────────────────────────────────────────────────────
async function handlePopupOpened(sendResponse) {
  await loadState();

  if (state.completedTracks) {
    // Generation finished while popup was closed
    sendResponse({ restore: 'results', tracks: state.completedTracks });
    state.completedTracks = null;
    persistState();
    return;
  }

  if (state.generating) {
    sendResponse({ restore: 'progress', step: state.lastStep });
    return;
  }

  sendResponse({ restore: null });
}

async function handleStartGeneration({ prompt, songCount } = {}) {
  if (state.generating) return { ok: false, error: 'Already generating' };

  state = {
    ...DEFAULT_STATE,
    generating:    true,
    currentPrompt: prompt,
    songCount:     Math.min(songCount ?? 2, 2), // Phase 3: cap at 2
  };
  await persistState();

  notifyPopup('GENERATION_PROGRESS', { step: 'step-open-suno' });

  try {
    const tabId = await ensureSunoTab();
    state.sunoTabId = tabId;
    state.lastStep  = 'step-fill-prompt';
    await persistState();

    notifyPopup('GENERATION_PROGRESS', { step: 'step-fill-prompt' });

    // Content script is auto-injected via manifest — send message with retry
    await sendToContentWithRetry(tabId, {
      type:    'FILL_AND_SUBMIT',
      payload: { prompt, songCount: state.songCount },
    });

    state.lastStep = 'step-submit';
    await persistState();
    notifyPopup('GENERATION_PROGRESS', { step: 'step-submit' });

    return { ok: true };

  } catch (err) {
    state.generating = false;
    await persistState();
    notifyPopup('GENERATION_ERROR', {
      error: err.message, code: 'E002',
      userMessage: 'ไม่พบฟอร์มใน Suno — อาจมีการอัปเดต UI กรุณาลองใหม่หรือกด Copy Prompt',
    });
    return { ok: false, error: err.message };
  }
}

function handleAudioFound(urls) {
  state.collectedUrls.push(...urls);
  notifyPopup('GENERATION_PROGRESS', { step: 'step-download-audio' });

  if (state.collectedUrls.length >= state.songCount || state.collectedUrls.length >= 2) {
    const tracks = state.collectedUrls.slice(0, state.songCount).map((url, i) => ({
      url,
      name:     `Track ${i + 1}`,
      duration: null,
    }));

    state.generating      = false;
    state.completedTracks = tracks;
    persistState();

    notifyPopup('GENERATION_COMPLETE', { tracks });

    // Save to history
    saveSession({
      prompt: state.currentPrompt,
      tracks,
      songCount: state.songCount,
    }).catch(() => {});
  }
}

function handleSunoError({ code, message } = {}) {
  const userMessages = {
    E001: 'กรุณา Login Suno.com ก่อนใช้งาน',
    E002: 'ไม่พบฟอร์มใน Suno — อาจมีการอัปเดต UI กรุณาลองใหม่หรือกด Copy Prompt',
    E003: 'Suno ใช้เวลานานเกินไป กรุณาตรวจสอบที่ Suno.com โดยตรง',
    E004: 'ไม่พบไฟล์เสียง กรุณา download จาก Suno.com โดยตรง',
    E005: 'Suno แจ้งว่าใช้งานถึงขีดจำกัดแล้ว กรุณารอสักครู่',
  };
  state.generating = false;
  persistState();
  notifyPopup('GENERATION_ERROR', {
    error:       message,
    code:        code ?? 'UNKNOWN',
    userMessage: userMessages[code] ?? message ?? 'Suno แจ้ง error',
  });
}

async function handleGetHistory() {
  const { getHistory } = await import('../utils/storage.js');
  return { sessions: await getHistory() };
}

async function handleClearHistory() {
  const { clearHistory } = await import('../utils/storage.js');
  await clearHistory();
  return { ok: true };
}

async function handleSaveSettings(settings) {
  if (!settings) return { ok: false };
  const { saveSettings } = await import('../utils/storage.js');
  await saveSettings(settings);
  return { ok: true };
}

// ── Tab Management ─────────────────────────────────────────────────
async function ensureSunoTab() {
  const tabs = await chrome.tabs.query({ url: 'https://suno.com/*' });

  if (tabs.length > 0) {
    const tab = tabs[0];
    const needsNav = !tab.url?.includes('/create');
    await chrome.tabs.update(tab.id, {
      url:    needsNav ? 'https://suno.com/create' : undefined,
      active: true,
    });
    if (needsNav) await waitForTabLoad(tab.id);
    else await sleep(500); // small grace period for SPA re-render
    return tab.id;
  }

  const newTab = await chrome.tabs.create({ url: 'https://suno.com/create', active: true });
  await waitForTabLoad(newTab.id);
  return newTab.id;
}

function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeoutMs);

    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ── Send to Content with Retry ─────────────────────────────────────
async function sendToContentWithRetry(tabId, message, maxRetries = 6) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await sleep(600 * (i + 1)); // 600ms, 1.2s, 1.8s …
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function notifyPopup(type, payload) {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {
    // Popup may be closed — fine, state is persisted
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Boot ───────────────────────────────────────────────────────────
loadState();
