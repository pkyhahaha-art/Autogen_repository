/**
 * DOM selectors for suno.com — ordered by stability.
 * Updated from live DOM inspection 2026-06-14.
 * Update this file only when Suno changes their UI.
 */
export const SELECTORS = {
  promptInput: [
    'textarea[maxlength="1000"]',         // most stable — specific to prompt box
    'textarea.resize-none',               // Tailwind class (stable)
    'textarea[class*="bg-transparent"]',  // transparent bg textarea
    'form textarea',                      // generic fallback
    'textarea',                           // last resort
  ],

  generateBtn: [
    'button:has(span.hxc-btn-content)',   // confirmed class from live DOM
    'button:has(svg.h-5.w-5)',            // SVG icon size class
    'button[type="submit"]',              // submit button
    // JS text-based fallback handled in content.js findCreateButton()
  ],

  loginIndicator: [
    // Present when logged in
    'img[alt*="avatar" i]',
    'img[alt*="profile" i]',
    '[data-testid="user-avatar"]',
    '[data-testid="account-btn"]',
    'button[aria-label*="Account" i]',
    'button[aria-label*="Profile" i]',
  ],

  notLoggedIn: [
    // Present when NOT logged in
    'button:has(span:contains("Sign in"))',
    'a[href*="sign-in"]',
    'a[href*="login"]',
  ],

  audioElement: [
    'audio[src*="suno"]',
    'audio[src*="cdn"]',
    'audio[src]',
    'audio > source[src]',
  ],

  songCard: [
    '[data-testid="song-card"]',
    '[data-testid="clip-card"]',
    '.clip-card',
    '.song-card',
  ],

  errorAlert: [
    '[data-testid="error-message"]',
    '[role="alert"]',
    '.toast-error',
  ],

  rateLimitMsg: [
    '[data-testid="rate-limit-message"]',
  ],
};
