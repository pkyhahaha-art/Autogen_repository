# CLAUDE.md — SunoGen Chrome Extension

## Project Summary

**SunoGen** is a Chrome Extension (Manifest V3) that automates music generation on Suno AI.
Users pick Genre + Mood + parameters in the popup → the extension auto-fills Suno's form,
waits for generation, pulls the audio, applies EQ/clarity processing via Web Audio API,
and downloads the result as an MP3.

Full spec: `PRD.md`

---

## Architecture (3-Component Model)

```
Popup (popup.html + popup.js)
  ↕ chrome.runtime.sendMessage
Background Service Worker (background/background.js)
  ↕ chrome.scripting.executeScript
Content Script (content/content.js) — injected into suno.com
```

- **Popup** — all UI: genre/mood picker, prompt preview, progress steps, audio player, download
- **Background** — orchestration: opens Suno tab, manages state, stores history in chrome.storage
- **Content Script** — DOM automation on suno.com: fill prompt, click submit, observe audio elements

---

## File Structure

```
sunogen-extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── background/
│   └── background.js
├── content/
│   └── content.js
├── audio/
│   ├── audioProcessor.js      # Web Audio API EQ chain (OfflineAudioContext)
│   └── mp3Exporter.js         # lamejs MP3 encoding wrapper
├── lib/
│   └── lame.min.js            # bundled lamejs (must be local — no CDN in CSP)
├── utils/
│   ├── promptBuilder.js       # builds Suno prompt string from user params
│   ├── sunoSelectors.js       # DOM selectors for suno.com (prioritized list)
│   └── storage.js             # chrome.storage.local helpers
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Key Technical Rules

### Manifest V3 Constraints
- **No CDN scripts at runtime** — all JS must be bundled locally (CSP: `script-src 'self'`)
- **No `eval()`**, no `innerHTML = userInput`
- **Service Worker (background.js)** expires after 5 min — popup must send keepalive ping every 20s during generation
- **Content scripts cannot use ES Modules** — use IIFE or global scope pattern in `content.js`
- Popup and background CAN use ES Modules (`"type": "module"` in script tag / SW)

### Message Protocol
All messages: `{ type: 'ACTION_NAME', payload: { ... } }`

**Popup → Background:** `START_GENERATION`, `CANCEL_GENERATION`, `GET_HISTORY`, `CLEAR_HISTORY`, `SAVE_SETTINGS`
**Background → Popup:** `GENERATION_PROGRESS`, `GENERATION_COMPLETE`, `GENERATION_ERROR`, `HISTORY_DATA`
**Background → Content:** `FILL_AND_SUBMIT`, `EXTRACT_AUDIO`
**Content → Background:** `FORM_SUBMITTED`, `AUDIO_FOUND`, `SUNO_ERROR`, `LOGIN_REQUIRED`

### Suno DOM Selectors (`sunoSelectors.js`)
Suno is a Next.js app — class names change on every deploy.
Always use prioritized selector lists in this order:
1. `aria-label` attribute
2. `data-testid` attribute
3. `placeholder` text
4. CSS class (last resort fallback)

### Audio Processing Chain (OfflineAudioContext)
```
AudioBuffer → HP Filter (80Hz) → Presence EQ (3kHz) → Air EQ (10kHz) → Compressor → Gain → render
```
Export: lamejs stereo 192kbps (default) / 320kbps (option), 44100Hz sample rate.

### CORS for Audio Fetch
Try in order:
1. Fetch from **content script** (treated as suno.com origin — most likely to work)
2. Background fetch with `mode: 'no-cors'`
3. Fallback: `MediaRecorder` on `<audio>` element in content script

---

## UI Design Tokens

| Token | Value |
|---|---|
| Popup width | 400px fixed |
| Popup max-height | 600px (700px when results shown) |
| Background | `#0D0D0F` |
| Surface | `#1A1A1F` |
| Card | `#242429` |
| Accent purple | `#7C3AED` |
| Accent success | `#10B981` |
| Accent warning | `#F59E0B` |
| Text primary | `#F1F1F3` |
| Text muted | `#6B7280` |
| Font | Inter |
| Border radius (card) | 12px |
| Border radius (button) | 8px |
| Transition | 200ms ease |

---

## Error Codes (User-Facing Thai Messages)

| Code | Cause | Message |
|---|---|---|
| E001 | Not logged in | "กรุณา Login Suno.com ก่อนใช้งาน" |
| E002 | DOM changed | "ไม่พบฟอร์มใน Suno — อาจมีการอัปเดต UI กรุณาลองใหม่หรือกด Copy Prompt" |
| E003 | Generation timeout (>3min) | "Suno ใช้เวลานานเกินไป กรุณาตรวจสอบที่ Suno.com โดยตรง" |
| E004 | Audio URL not found | "ไม่พบไฟล์เสียง กรุณา download จาก Suno.com โดยตรง" |
| E005 | Rate limit | "Suno แจ้งว่าใช้งานถึงขีดจำกัดแล้ว กรุณารอสักครู่" |
| E006 | Audio fetch failed (CORS) | "โหลดไฟล์เสียงไม่ได้ (อาจเกิดจาก CORS) กรุณาลองใหม่" |
| E007 | MP3 encoding failed | "เกิดข้อผิดพลาดในการแปลงไฟล์ กรุณาลองใหม่" |
| E008 | Download failed | "ดาวน์โหลดไม่สำเร็จ กรุณาตรวจสอบ Chrome download settings" |

---

## Development Phases

See phased plan below — implement in order, each phase must be loadable in Chrome before moving to the next.

### Phase 1 — Foundation (Skeleton)
Files: `manifest.json`, `popup/popup.html`, `popup/popup.css`, `popup/popup.js` (stub), `background/background.js` (stub), `content/content.js` (stub), placeholder icons
Goal: Extension loads in Chrome without errors. Popup opens with basic shell.

### Phase 2 — UI: Configuration Panel
Files: `popup/popup.js`, `popup/popup.css`, `utils/promptBuilder.js`
Goal: Genre/Mood/BPM/Vocal/Count selectors fully working. Prompt preview generates correctly. No backend yet.

### Phase 3 — Suno Automation
Files: `background/background.js`, `content/content.js`, `utils/sunoSelectors.js`, `utils/storage.js`
Goal: Click Generate → Suno tab opens → prompt auto-filled → submitted → audio URLs returned to popup. Progress steps update in real-time.

### Phase 4 — Audio Processing & Export
Files: `audio/audioProcessor.js`, `audio/mp3Exporter.js`, `lib/lame.min.js`
Goal: Audio playback in popup. EQ presets + manual controls work. MP3 download via chrome.downloads.

### Phase 5 — Settings & History
Files: `utils/storage.js` (extend), settings panel in popup
Goal: Settings persist across sessions. Last 20 generations saved and re-loadable.

### Phase 6 — Polish & Error Handling
Goal: All E001–E008 error paths tested. Keepalive ping implemented. Memory cleanup after download. Batch download works.

---

## Loading the Extension for Testing

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `sunogen-extension/` folder
4. Reload extension after each code change (or use a file-watcher script)

## Out of Scope (v1.0)

Suno login, cloud sync, social sharing, advanced effects (reverb/delay/pitch), stem separation, Firefox/Edge support, mobile.
