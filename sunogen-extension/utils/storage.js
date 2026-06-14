const KEYS = {
  settings: 'sg_settings',
  history:  'sg_history',
};

const DEFAULT_SETTINGS = {
  defaultSongCount:    2,
  mp3Quality:          192,
  autoOpenSunoTab:     true,
  showAdvancedAudio:   false,
  theme:               'dark',
};

// ── Settings ──────────────────────────────────────────────────────
export async function getSettings() {
  const result = await chrome.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result[KEYS.settings] ?? {}) };
}

export async function saveSettings(partial) {
  const current = await getSettings();
  await chrome.storage.local.set({ [KEYS.settings]: { ...current, ...partial } });
}

// ── History (max 20 sessions) ─────────────────────────────────────
export async function getHistory() {
  const result = await chrome.storage.local.get(KEYS.history);
  return result[KEYS.history] ?? [];
}

export async function saveSession(session) {
  const history = await getHistory();
  const entry = {
    id:        Date.now(),
    timestamp: new Date().toISOString(),
    ...session,
  };
  const updated = [entry, ...history].slice(0, 20);
  await chrome.storage.local.set({ [KEYS.history]: updated });
  return entry;
}

export async function clearHistory() {
  await chrome.storage.local.remove(KEYS.history);
}
