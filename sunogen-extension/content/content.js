/* Content script — injected into https://suno.com/*
   Must NOT use ES Modules. Uses IIFE + init guard. */

(function () {
  'use strict';

  // Prevent double-init if script injected more than once
  if (window.__sunoGenReady) return;
  window.__sunoGenReady = true;

  // ── Selectors (mirrors sunoSelectors.js — no import in content scripts) ──
  const SEL = {
    promptInput: [
      'textarea[maxlength="1000"]',
      'textarea[maxlength="2000"]',
      'textarea[maxlength="3000"]',
      'textarea.resize-none',
      'textarea[class*="bg-transparent"]',
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="describe" i]',
      'textarea[placeholder*="Enter" i]',
      '[contenteditable="true"][class*="prompt" i]',
      '[contenteditable="true"][data-placeholder]',
      'form textarea',
      'main textarea',
      'textarea',
    ],
    generateBtn: [
      'button:has(span.hxc-btn-content)',
      'button:has(svg.h-5)',
      'button[type="submit"]',
      'button[aria-label*="create" i]',
      'button[aria-label*="generate" i]',
      'button[data-testid*="create" i]',
      'button[data-testid*="generate" i]',
    ],
    loginIndicator: [
      'img[alt*="avatar" i]',
      'img[alt*="profile" i]',
      '[data-testid="user-avatar"]',
      '[data-testid="account-btn"]',
      'button[aria-label*="Account" i]',
      'a[href*="/account"]',
      'a[href*="/profile"]',
      '[data-testid*="user" i]',
    ],
    notLoggedIn: [
      'a[href*="sign-in"]',
      'a[href*="login"]',
      'button[data-testid*="signin" i]',
      'button[data-testid*="login" i]',
    ],
    audioElement: [
      'audio[src*="suno"]',
      'audio[src*="cdn"]',
      'audio[src*=".mp3"]',
      'audio[src*=".wav"]',
      'audio[src]',
    ],
  };

  // ── Selector Helpers ───────────────────────────────────────────
  function qs(list) {
    for (const sel of list) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (_) {}
    }
    return null;
  }

  function qsAll(list) {
    for (const sel of list) {
      try {
        const els = [...document.querySelectorAll(sel)];
        if (els.length) return els;
      } catch (_) {}
    }
    return [];
  }

  function waitFor(list, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const found = qs(list);
      if (found) { resolve(found); return; }

      const deadline = setTimeout(() => {
        obs.disconnect();
        reject(new Error('waitFor timeout: ' + list[0]));
      }, timeoutMs);

      const obs = new MutationObserver(() => {
        const el = qs(list);
        if (el) { clearTimeout(deadline); obs.disconnect(); resolve(el); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  // ── Login Check ────────────────────────────────────────────────
  function isLoggedIn() {
    // If a sign-in link is clearly visible → definitely not logged in
    const notLogged = qs(SEL.notLoggedIn);
    if (notLogged) return false;
    // If we can't determine either way → assume logged in and let Suno handle it
    return true;
  }

  // ── React-aware Value Setter ───────────────────────────────────
  function setReactValue(el, value) {
    if (el.contentEditable === 'true') {
      // contenteditable div
      el.textContent = value;
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Standard textarea — use React's native setter to bypass synthetic value
      const proto = Object.getPrototypeOf(el);
      const desc  = Object.getOwnPropertyDescriptor(proto, 'value');
      desc?.set?.call(el, value);
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ── Find Create Button (CSS + text fallback) ───────────────────
  function findCreateButton() {
    const byCss = qs(SEL.generateBtn);
    if (byCss) return byCss;
    // JS text-content fallback — look for visible enabled buttons with Create/Generate/Make text
    return [...document.querySelectorAll('button')].find(btn => {
      if (btn.disabled) return false;
      const text = btn.textContent.trim().toLowerCase();
      return (text.includes('create') || text.includes('generate') || text.includes('make')) && btn.querySelector('svg');
    }) ?? null;
  }

  // ── Extract Audio URLs ─────────────────────────────────────────
  function extractAudioUrls() {
    const urls = new Set();

    // 1. <audio src="...">
    qsAll(SEL.audioElement).forEach(el => {
      const src = el.getAttribute('src') || el.src;
      if (src?.startsWith('http')) urls.add(src);
    });

    // 2. <source src="..."> inside <audio>
    [...document.querySelectorAll('audio > source[src]')].forEach(el => {
      if (el.src?.startsWith('http')) urls.add(el.src);
    });

    // 3. Any element with data-src pointing to known CDN
    [...document.querySelectorAll('[data-src]')].forEach(el => {
      const s = el.getAttribute('data-src');
      if (s && (s.includes('suno.ai') || s.includes('cdn')) && s.includes('.mp3')) urls.add(s);
    });

    return [...urls];
  }

  // ── Watch for Audio (MutationObserver + timeout) ───────────────
  function watchForAudio(timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
      // Already present?
      const existing = extractAudioUrls();
      if (existing.length) { resolve(existing); return; }

      const deadline = setTimeout(() => {
        obs.disconnect();
        reject(new Error('audio_timeout'));
      }, timeoutMs);

      const obs = new MutationObserver(() => {
        const urls = extractAudioUrls();
        if (urls.length) {
          clearTimeout(deadline);
          obs.disconnect();
          resolve(urls);
        }
      });
      obs.observe(document.documentElement, {
        childList:   true,
        subtree:     true,
        attributes:  true,
        attributeFilter: ['src', 'data-src'],
      });
    });
  }

  // ── Main Automation Flow ───────────────────────────────────────
  async function fillAndSubmit(prompt) {
    // 1. Login check
    if (!isLoggedIn()) {
      chrome.runtime.sendMessage({ type: 'LOGIN_REQUIRED', payload: {} });
      return;
    }

    // 2. Find prompt textarea (up to 20s — Suno SPA may not have rendered yet)
    let textarea;
    try {
      textarea = await waitFor(SEL.promptInput, 20000);
    } catch (_) {
      chrome.runtime.sendMessage({
        type: 'SUNO_ERROR',
        payload: { code: 'E002', message: 'ไม่พบฟอร์มใน Suno — อาจมีการอัปเดต UI กรุณาลองใหม่หรือกด Copy Prompt' },
      });
      return;
    }

    // 3. Fill prompt with React-aware setter
    textarea.focus();
    setReactValue(textarea, '');
    await sleep(150);
    setReactValue(textarea, prompt);
    await sleep(300);

    // 4. Find and click Create button
    let createBtn = findCreateButton();
    if (!createBtn) {
      // Wait up to 5s for it to appear
      try { createBtn = await waitFor(SEL.generateBtn, 5000); } catch (_) {}
    }
    if (!createBtn) {
      chrome.runtime.sendMessage({
        type: 'SUNO_ERROR',
        payload: { code: 'E002', message: 'ไม่พบปุ่ม Create ใน Suno' },
      });
      return;
    }

    createBtn.click();
    chrome.runtime.sendMessage({ type: 'FORM_SUBMITTED', payload: {} });

    // 5. Wait for audio (3 min max)
    try {
      const urls = await watchForAudio(180000);
      chrome.runtime.sendMessage({ type: 'AUDIO_FOUND', payload: { urls } });
    } catch (err) {
      const isTimeout = err.message === 'audio_timeout';
      chrome.runtime.sendMessage({
        type: 'SUNO_ERROR',
        payload: {
          code:    isTimeout ? 'E003' : 'E004',
          message: isTimeout
            ? 'Suno ใช้เวลานานเกินไป กรุณาตรวจสอบที่ Suno.com โดยตรง'
            : 'ไม่พบไฟล์เสียง กรุณา download จาก Suno.com โดยตรง',
        },
      });
    }
  }

  // ── Message Listener ───────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg?.type) return false;

    switch (msg.type) {
      case 'FILL_AND_SUBMIT':
        fillAndSubmit(msg.payload?.prompt ?? '');
        sendResponse({ ok: true });
        break;

      case 'EXTRACT_AUDIO':
        sendResponse({ urls: extractAudioUrls() });
        break;

      case 'PING':
        sendResponse({ pong: true });
        break;
    }
    return false;
  });

  // ── Utility ────────────────────────────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

})();
