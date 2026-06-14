/**
 * DOM selectors for suno.com — ordered by stability:
 * aria-label → data-testid → placeholder/text → CSS class (last resort)
 *
 * Update this file when Suno changes their UI without touching any other code.
 */
export const SELECTORS = {
  promptInput: [
    'textarea[aria-label*="prompt" i]',
    'textarea[aria-label*="describe" i]',
    'textarea[placeholder*="Describe"]',
    'textarea[placeholder*="describe"]',
    '[data-testid="prompt-input"]',
    'textarea.sc-prompt',
    'form textarea',
  ],

  generateBtn: [
    'button[aria-label*="Create" i]',
    'button[aria-label*="Generate" i]',
    '[data-testid="generate-btn"]',
    '[data-testid="create-btn"]',
    'button[type="submit"]',
  ],

  loginIndicator: [
    '[data-testid="user-avatar"]',
    '[data-testid="account-btn"]',
    'img[alt*="avatar" i]',
    'button[aria-label*="Account" i]',
    'button[aria-label*="Profile" i]',
  ],

  audioElement: [
    'audio[src]',
    'audio > source[src]',
  ],

  songCard: [
    '[data-testid="song-card"]',
    '[data-testid="clip-card"]',
    '.song-card',
  ],

  errorAlert: [
    '[data-testid="error-message"]',
    '[role="alert"]',
    '.error-message',
    '.toast-error',
  ],

  rateLimitMsg: [
    '[data-testid="rate-limit-message"]',
    '*:contains("daily limit")',
    '*:contains("credits")',
  ],
};
