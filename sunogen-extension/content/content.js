/* Content script — runs on https://suno.com/*
   Must NOT use ES Modules (content scripts don't support type="module").
   Uses IIFE to avoid polluting global scope. */

(function () {
  'use strict';

  // ── DOM Selectors (prioritized: aria > data-testid > placeholder > class) ──
  const SELECTORS = {
    promptInput: [
      'textarea[placeholder*="Describe"]',
      'textarea[placeholder*="describe"]',
      'textarea[aria-label*="prompt"]',
      'textarea[aria-label*="Prompt"]',
      '[data-testid="prompt-input"]',
      'textarea.sc-prompt',
    ],
    generateBtn: [
      'button[aria-label*="Create"]',
      'button[aria-label*="Generate"]',
      '[data-testid="generate-btn"]',
      '[data-testid="create-btn"]',
      'button:has(svg + span)',
    ],
    loginIndicator: [
      '[data-testid="user-avatar"]',
      'img[alt*="avatar"]',
      'button[aria-label*="Account"]',
    ],
    audioElements: [
      'audio[src]',
      'audio source[src]',
    ],
    errorMsg: [
      '[data-testid="error-message"]',
      '.error-message',
      '[role="alert"]',
    ],
  };

  // ── Selector Helpers ──────────────────────────────────────────────
  function querySelector(selectorList) {
    for (const sel of selectorList) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (_) { /* invalid selector — skip */ }
    }
    return null;
  }

  function querySelectorAll(selectorList) {
    for (const sel of selectorList) {
      try {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) return Array.from(els);
      } catch (_) { /* skip */ }
    }
    return [];
  }

  function waitForElement(selectorList, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const el = querySelector(selectorList);
      if (el) { resolve(el); return; }

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error('Element not found: ' + selectorList[0]));
      }, timeoutMs);

      const observer = new MutationObserver(() => {
        const found = querySelector(selectorList);
        if (found) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // ── React-aware Input Setter ──────────────────────────────────────
  function setNativeValue(el, value) {
    const nativeInputValue = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    );
    nativeInputValue?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── Login Check ──────────────────────────────────────────────────
  function isLoggedIn() {
    return querySelector(SELECTORS.loginIndicator) !== null;
  }

  // ── Audio URL Extraction ──────────────────────────────────────────
  function extractAudioUrls() {
    const urls = new Set();

    querySelectorAll(SELECTORS.audioElements).forEach(el => {
      const src = el.tagName === 'SOURCE' ? el.src : el.getAttribute('src');
      if (src && src.startsWith('http')) urls.add(src);
    });

    // Also check elements that may load lazily
    document.querySelectorAll('[data-src]').forEach(el => {
      const src = el.getAttribute('data-src');
      if (src?.includes('suno') && src.endsWith('.mp3')) urls.add(src);
    });

    return [...urls];
  }

  // ── Audio Observer ────────────────────────────────────────────────
  function watchForAudio(timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
      // Check if already present
      const existing = extractAudioUrls();
      if (existing.length > 0) { resolve(existing); return; }

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error('Audio generation timeout'));
      }, timeoutMs);

      const observer = new MutationObserver(() => {
        const urls = extractAudioUrls();
        if (urls.length > 0) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(urls);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    });
  }

  // ── Main Flow ─────────────────────────────────────────────────────
  async function fillAndSubmit(prompt, songCount) {
    // 1. Login check
    if (!isLoggedIn()) {
      chrome.runtime.sendMessage({ type: 'LOGIN_REQUIRED', payload: {} });
      return;
    }

    // 2. Wait for prompt textarea
    let textarea;
    try {
      textarea = await waitForElement(SELECTORS.promptInput, 10000);
    } catch (_) {
      chrome.runtime.sendMessage({
        type: 'SUNO_ERROR',
        payload: { message: 'ไม่พบฟอร์มใน Suno — อาจมีการอัปเดต UI กรุณาลองใหม่หรือกด Copy Prompt' },
      });
      return;
    }

    // 3. Fill prompt
    textarea.focus();
    setNativeValue(textarea, '');
    await sleep(100);
    setNativeValue(textarea, prompt);
    await sleep(200);

    // 4. Click generate button
    let btn;
    try {
      btn = await waitForElement(SELECTORS.generateBtn, 5000);
    } catch (_) {
      chrome.runtime.sendMessage({
        type: 'SUNO_ERROR',
        payload: { message: 'ไม่พบปุ่ม Generate ใน Suno' },
      });
      return;
    }

    btn.click();
    chrome.runtime.sendMessage({ type: 'FORM_SUBMITTED', payload: {} });

    // 5. Watch for audio
    try {
      const urls = await watchForAudio(180000);
      chrome.runtime.sendMessage({ type: 'AUDIO_FOUND', payload: { urls } });
    } catch (_) {
      chrome.runtime.sendMessage({
        type: 'SUNO_ERROR',
        payload: { message: 'Suno ใช้เวลานานเกินไป กรุณาตรวจสอบที่ Suno.com โดยตรง' },
      });
    }
  }

  // ── Message Handler ───────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg?.type) return false;

    switch (msg.type) {
      case 'FILL_AND_SUBMIT':
        fillAndSubmit(msg.payload?.prompt ?? '', msg.payload?.songCount ?? 2);
        sendResponse({ ok: true });
        break;

      case 'EXTRACT_AUDIO':
        sendResponse({ urls: extractAudioUrls() });
        break;
    }

    return false;
  });

  // ── Utils ─────────────────────────────────────────────────────────
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();
