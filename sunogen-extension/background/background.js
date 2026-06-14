// No static imports — dynamic imports only (avoids SW boot failures in MV3)

// ── State ──────────────────────────────────────────────────────────
// Persisted to chrome.storage.local (session key cleared on complete/cancel)
// so generation survives popup close (Option A).
const STATE_KEY = 'sg_active_gen';

const DEFAULT_STATE = {
  generating:      false,
  sunoTabId:       null,
  currentPrompt:   null,
  songCount:       2,
  collectedUrls:   [],
  completedTracks: null,
  lastStep:        null,
};

let mem = { ...DEFAULT_STATE };

function persistState() {
  return chrome.storage.local.set({ [STATE_KEY]: mem }).catch(() => {});
}

async function loadState() {
  try {
    const res = await chrome.storage.local.get(STATE_KEY);
    if (res[STATE_KEY]) mem = { ...DEFAULT_STATE, ...res[STATE_KEY] };
  } catch (_) {}
}

function clearActiveState() {
  return chrome.storage.local.remove(STATE_KEY).catch(() => {});
}

// ── Message Router ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg?.type) return false;

  switch (msg.type) {

    case 'POPUP_OPENED':
      handlePopupOpened(sendResponse);
      return true;

    case 'START_GENERATION':
      handleStartGeneration(msg.payload).then(sendResponse);
      return true;

    case 'CANCEL_GENERATION':
      mem.generating      = false;
      mem.completedTracks = null;
      clearActiveState();
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

    case 'FORM_SUBMITTED':
      mem.lastStep = 'step-wait';
      persistState();
      notifyPopup('GENERATION_PROGRESS', { step: 'step-wait' });
      break;

    case 'AUDIO_FOUND':
      handleAudioFound(msg.payload?.urls ?? []);
      break;

    case 'SUNO_ERROR':
      handleSunoError(msg.payload);
      break;

    case 'LOGIN_REQUIRED':
      mem.generating = false;
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

  if (mem.completedTracks) {
    const tracks = mem.completedTracks;
    mem.completedTracks = null;
    clearActiveState();
    sendResponse({ restore: 'results', tracks });
    return;
  }

  if (mem.generating) {
    sendResponse({ restore: 'progress', step: mem.lastStep });
    return;
  }

  sendResponse({ restore: null });
}

async function handleStartGeneration({ prompt, songCount, meta } = {}) {
  if (mem.generating) return { ok: false, error: 'Already generating' };

  mem = {
    ...DEFAULT_STATE,
    generating:    true,
    currentPrompt: prompt,
    songCount:     Math.min(songCount ?? 2, 2),
    meta:          meta ?? null,
  };
  await persistState();

  notifyPopup('GENERATION_PROGRESS', { step: 'step-open-suno' });

  try {
    const tabId = await ensureSunoTab();
    mem.sunoTabId = tabId;
    mem.lastStep  = 'step-fill-prompt';
    await persistState();

    notifyPopup('GENERATION_PROGRESS', { step: 'step-fill-prompt' });

    await sendToContentWithRetry(tabId, {
      type:    'FILL_AND_SUBMIT',
      payload: { prompt, songCount: mem.songCount },
    });

    mem.lastStep = 'step-submit';
    await persistState();
    notifyPopup('GENERATION_PROGRESS', { step: 'step-submit' });

    return { ok: true };

  } catch (err) {
    mem.generating = false;
    await persistState();
    notifyPopup('GENERATION_ERROR', {
      error: err.message, code: 'E002',
      userMessage: 'ไม่พบฟอร์มใน Suno — อาจมีการอัปเดต UI กรุณาลองใหม่หรือกด Copy Prompt',
    });
    return { ok: false, error: err.message };
  }
}

async function handleAudioFound(urls) {
  mem.collectedUrls.push(...urls);
  notifyPopup('GENERATION_PROGRESS', { step: 'step-download-audio' });

  if (mem.collectedUrls.length >= mem.songCount || mem.collectedUrls.length >= 2) {
    const tracks = mem.collectedUrls.slice(0, mem.songCount).map((url, i) => ({
      url, name: `Track ${i + 1}`, duration: null,
    }));

    mem.generating      = false;
    mem.completedTracks = tracks;
    await persistState();

    notifyPopup('GENERATION_COMPLETE', { tracks });

    try {
      const { saveSession } = await import('../utils/storage.js');
      await saveSession({
        prompt:    mem.currentPrompt,
        tracks,
        songCount: mem.songCount,
        genre:     mem.meta?.genre  ?? null,
        moods:     mem.meta?.moods  ?? [],
      });
    } catch (_) {}
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
  mem.generating = false;
  persistState();
  notifyPopup('GENERATION_ERROR', {
    error:       message,
    code:        code ?? 'UNKNOWN',
    userMessage: userMessages[code] ?? message ?? 'Suno แจ้ง error',
  });
}

async function handleGetHistory() {
  try {
    const { getHistory } = await import('../utils/storage.js');
    return { sessions: await getHistory() };
  } catch (_) { return { sessions: [] }; }
}

async function handleClearHistory() {
  try {
    const { clearHistory } = await import('../utils/storage.js');
    await clearHistory();
  } catch (_) {}
  return { ok: true };
}

async function handleSaveSettings(settings) {
  if (!settings) return { ok: false };
  try {
    const { saveSettings } = await import('../utils/storage.js');
    await saveSettings(settings);
  } catch (_) {}
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
    else await sleep(600);
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

async function sendToContentWithRetry(tabId, message, maxRetries = 6) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await sleep(600 * (i + 1));
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function notifyPopup(type, payload) {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {});
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Boot ───────────────────────────────────────────────────────────
loadState();
