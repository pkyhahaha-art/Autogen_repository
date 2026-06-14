import { saveSession, getSettings } from '../utils/storage.js';

// ── State ────────────────────────────────────────────────────────
let state = {
  generating: false,
  sunoTabId: null,
  currentPrompt: null,
  songCount: 2,
  collectedUrls: [],
};

// ── Keepalive (MV3 SW expires after 5 min) ────────────────────────
// Popup sends KEEPALIVE every 20s during generation; no action needed here
// beyond staying awake (receiving a message resets the SW timer).

// ── Message Router ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg?.type) return false;

  switch (msg.type) {
    case 'START_GENERATION':
      handleStartGeneration(msg.payload).then(sendResponse);
      return true; // async

    case 'CANCEL_GENERATION':
      state.generating = false;
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

    // Messages from content script
    case 'FORM_SUBMITTED':
      notifyPopup('GENERATION_PROGRESS', { step: 'step-wait', message: 'รอ Suno สร้างเพลง...' });
      break;

    case 'AUDIO_FOUND':
      handleAudioFound(msg.payload?.urls ?? []);
      break;

    case 'SUNO_ERROR':
      notifyPopup('GENERATION_ERROR', {
        error: msg.payload?.message,
        userMessage: msg.payload?.message ?? 'Suno แจ้ง error',
      });
      state.generating = false;
      break;

    case 'LOGIN_REQUIRED':
      notifyPopup('GENERATION_ERROR', {
        error: 'LOGIN_REQUIRED',
        code: 'E001',
        userMessage: 'กรุณา Login Suno.com ก่อนใช้งาน',
      });
      state.generating = false;
      break;
  }

  return false;
});

// ── Handlers ─────────────────────────────────────────────────────
async function handleStartGeneration({ prompt, songCount, settings } = {}) {
  if (state.generating) return { ok: false, error: 'Already generating' };

  state.generating = true;
  state.currentPrompt = prompt;
  state.songCount = songCount ?? 2;
  state.collectedUrls = [];

  notifyPopup('GENERATION_PROGRESS', { step: 'step-open-suno', message: 'เปิดหน้า Suno' });

  try {
    const tabId = await ensureSunoTab();
    state.sunoTabId = tabId;

    notifyPopup('GENERATION_PROGRESS', { step: 'step-fill-prompt', message: 'กรอก Prompt' });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content.js'],
    });

    await sendToContent(tabId, { type: 'FILL_AND_SUBMIT', payload: { prompt, songCount } });

    notifyPopup('GENERATION_PROGRESS', { step: 'step-submit', message: 'เริ่ม Generate' });

    return { ok: true };
  } catch (err) {
    state.generating = false;
    notifyPopup('GENERATION_ERROR', {
      error: err.message,
      code: 'E002',
      userMessage: 'ไม่พบฟอร์มใน Suno — อาจมีการอัปเดต UI กรุณาลองใหม่หรือกด Copy Prompt',
    });
    return { ok: false, error: err.message };
  }
}

function handleAudioFound(urls) {
  state.collectedUrls.push(...urls);
  notifyPopup('GENERATION_PROGRESS', { step: 'step-download-audio', message: 'ดาวน์โหลด Audio' });

  const requestsNeeded = Math.ceil(state.songCount / 2);
  if (state.collectedUrls.length >= requestsNeeded * 2 || state.collectedUrls.length >= state.songCount) {
    const tracks = state.collectedUrls.slice(0, state.songCount).map((url, i) => ({
      url,
      name: `Track ${i + 1}`,
      duration: null,
    }));
    notifyPopup('GENERATION_COMPLETE', { tracks });
    state.generating = false;

    // Phase 5: save to history
    saveSession({ prompt: state.currentPrompt, tracks }).catch(() => {});
  }
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

// ── Tab Management ────────────────────────────────────────────────
async function ensureSunoTab() {
  const tabs = await chrome.tabs.query({ url: 'https://suno.com/*' });

  if (tabs.length > 0) {
    const tab = tabs[0];
    if (!tab.url.includes('/create')) {
      await chrome.tabs.update(tab.id, { url: 'https://suno.com/create', active: true });
    } else {
      await chrome.tabs.update(tab.id, { active: true });
    }
    await waitForTabLoad(tab.id);
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

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ── Helpers ───────────────────────────────────────────────────────
function notifyPopup(type, payload) {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {
    // Popup may be closed — ignore
  });
}

function sendToContent(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}
