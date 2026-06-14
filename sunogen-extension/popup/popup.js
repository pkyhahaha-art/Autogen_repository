import { getSettings } from '../utils/storage.js';

const $ = id => document.getElementById(id);

// ── View Management ──────────────────────────────────────────────
const VIEWS = ['view-config', 'view-progress', 'view-results'];

function showView(viewId) {
  VIEWS.forEach(id => $(`${id}`)?.classList.toggle('hidden', id !== viewId));
}

// ── Error Banner ─────────────────────────────────────────────────
function showError(message) {
  $('error-msg').textContent = message;
  $('error-banner').classList.remove('hidden');
}

function hideError() {
  $('error-banner').classList.add('hidden');
}

// ── Progress Steps ────────────────────────────────────────────────
const STEP_IDS = [
  'step-open-suno',
  'step-fill-prompt',
  'step-submit',
  'step-wait',
  'step-download-audio',
];

function setStep(stepId, state) {
  // state: 'pending' | 'active' | 'done'
  const el = $(stepId);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (state === 'active') el.classList.add('active');
  if (state === 'done')   el.classList.add('done');
}

function resetSteps() {
  STEP_IDS.forEach(id => setStep(id, 'pending'));
}

// ── Background Message Listener ──────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg?.type) return;

  switch (msg.type) {
    case 'GENERATION_PROGRESS': {
      const { step } = msg.payload ?? {};
      if (step) setStep(step, 'active');
      break;
    }
    case 'GENERATION_COMPLETE': {
      // Phase 4 will handle this
      showView('view-results');
      break;
    }
    case 'GENERATION_ERROR': {
      const { userMessage } = msg.payload ?? {};
      showError(userMessage ?? 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
      showView('view-config');
      break;
    }
  }
});

// ── Init ─────────────────────────────────────────────────────────
async function init() {
  // Load persisted settings (Phase 5 will populate these)
  await getSettings();

  $('btn-error-dismiss')?.addEventListener('click', hideError);

  $('btn-settings')?.addEventListener('click', () => {
    // Phase 5: open settings panel
  });

  showView('view-config');
}

document.addEventListener('DOMContentLoaded', init);
