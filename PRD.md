# PRD: Suno Music Auto-Gen — Chrome Extension

**Version:** 1.0  
**Date:** 2026-06-14  
**Author:** Product Team  
**Target:** Claude Code (Full Implementation)

---

## 1. Project Overview

### 1.1 Product Name
**SunoGen** — Chrome Extension for Automated Music Generation via Suno AI

### 1.2 Product Summary
SunoGen เป็น Chrome Extension ที่ช่วยให้ผู้ใช้สร้างเพลงผ่าน Suno AI ได้อย่างรวดเร็ว โดยมี UI ให้เลือก Genre, Mood, จำนวนเพลง และ Auto-generate prompt ที่เหมาะสม จากนั้นส่ง prompt ไปยัง suno.com โดยอัตโนมัติผ่าน Browser Automation เมื่อ Suno สร้างเพลงเสร็จ Extension จะดึงไฟล์เสียงมาทำ Audio Processing (EQ + Clarity Boost) ใน browser แล้ว export เป็น MP3 และ download อัตโนมัติ

### 1.3 Core User Flow (High-Level)
```
[Open Extension Popup]
       ↓
[เลือก Genre + Mood + จำนวนเพลง (1-4)]
       ↓
[กด "Generate"] → Extension สร้าง Suno Prompt
       ↓
[Extension เปิด/focus tab suno.com]
       ↓
[Auto-fill prompt + Submit ใน Suno]
       ↓
[Extension รอและตรวจจับเมื่อเพลงสร้างเสร็จ]
       ↓
[ดึง Audio URL → โหลดใน Web Audio API]
       ↓
[UI แสดงผล: Player + Audio Controls (EQ/Clarity)]
       ↓
[ผู้ใช้ปรับแต่งเสียง → กด "Download MP3"]
       ↓
[Export MP3 + Auto-download]
```

---

## 2. Platform & Technical Constraints

### 2.1 Platform
- **Type:** Chrome Extension (Manifest V3)
- **Minimum Chrome Version:** 120+
- **Permissions Required:**
  - `tabs` — เปิดและ control tab ของ suno.com
  - `scripting` — inject content script ลงใน suno.com
  - `activeTab` — access tab ที่ active อยู่
  - `storage` — บันทึก settings และ history
  - `downloads` — trigger download MP3
  - `host_permissions`: `https://suno.com/*`, `https://cdn1.suno.ai/*` (audio CDN)

### 2.2 Architecture — 3 Components
```
┌─────────────────────────────────────────────────────┐
│  Popup (popup.html + popup.js)                      │
│  — UI: Genre/Mood picker, Generate button, Player   │
│  — สื่อสารกับ background ผ่าน chrome.runtime.sendMessage │
└──────────────────┬──────────────────────────────────┘
                   │ messages
┌──────────────────▼──────────────────────────────────┐
│  Background Service Worker (background.js)          │
│  — จัดการ state, Suno tab, orchestration flow       │
│  — เก็บ audio URLs หลังจาก content script ส่งมา    │
└──────────────────┬──────────────────────────────────┘
                   │ chrome.scripting.executeScript
┌──────────────────▼──────────────────────────────────┐
│  Content Script (content.js) — inject ใน suno.com  │
│  — Auto-fill prompt ใน Suno UI                     │
│  — กด submit button                                │
│  — Poll/observe เมื่อเพลงสร้างเสร็จ               │
│  — ส่ง audio URLs กลับไปยัง background             │
└─────────────────────────────────────────────────────┘
```

### 2.3 Suno Integration Strategy
- **วิธี:** Browser Automation ผ่าน Content Script (ไม่ใช้ unofficial API)
- ผู้ใช้ต้อง **login Suno ก่อนใช้งาน** (Extension จะตรวจสอบ)
- Extension เปิด tab `https://suno.com/create` (ถ้ายังไม่มี) หรือ navigate tab ที่มีอยู่แล้ว
- Content script inject ลงใน suno.com เพื่อ:
  1. ค้นหา prompt input field (selector อาจต้องอัปเดตหาก Suno เปลี่ยน UI)
  2. Set value + trigger React synthetic event
  3. คลิกปุ่ม Generate/Create
  4. MutationObserver คอย observe DOM เมื่อ audio element ปรากฏ
  5. Extract `<audio>` src URLs และส่งกลับ background

### 2.4 Audio Processing — Web Audio API (In Browser)
ใช้ **Web Audio API** ใน popup context (OfflineAudioContext สำหรับ export)

Processing Chain:
```
AudioBuffer (fetch from Suno CDN)
       ↓
BiquadFilterNode [High-Pass 80Hz — cut mud]
       ↓
BiquadFilterNode [Presence boost 3kHz +2dB — clarity]
       ↓
BiquadFilterNode [Air boost 10kHz +3dB — brightness]
       ↓
DynamicsCompressorNode [Light compression — glue]
       ↓
GainNode [Output level control]
       ↓
OfflineAudioContext → render → AudioBuffer → MP3
```

MP3 Encoding: ใช้ **lamejs** (pure JS MP3 encoder, no server needed)
- CDN: `https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js`

---

## 3. Feature Requirements

### 3.1 Feature: Music Configuration Panel (Popup UI)

#### 3.1.1 Genre Selector
ผู้ใช้เลือก **1 genre หลัก** และ **optional sub-genre** ได้

| Category | Genres |
|---|---|
| Electronic | Lo-fi Hip Hop, EDM, Ambient, Synthwave, Chillwave, Drum & Bass, House, Techno |
| Acoustic | Acoustic Pop, Folk, Classical, Jazz, Blues, Bossa Nova |
| Rock/Metal | Indie Rock, Alternative, Pop Rock, Metal, Punk |
| World | Thai Pop, K-Pop, J-Pop, Latin, Reggae, Afrobeats |
| Cinematic | Epic Orchestra, Cinematic Score, Dark Ambient, Documentary |
| Custom | [Text input — ผู้ใช้พิมพ์ genre เอง] |

**UI:** Grid of cards with icon + label, single select, มี search filter

#### 3.1.2 Mood Selector
เลือกได้ **1-3 mood** พร้อมกัน (multi-select)

| Mood Tags |
|---|
| Happy, Sad, Energetic, Calm, Dark, Uplifting, Romantic, Mysterious, Aggressive, Dreamy, Nostalgic, Focused, Playful, Epic, Melancholic |

**UI:** Pill/tag chips, multi-select ได้สูงสุด 3 รายการ, มี color coding ตาม emotional tone

#### 3.1.3 Additional Parameters
- **BPM Range:** Slider (60–180 BPM) หรือเลือก preset (Slow / Mid / Fast / Very Fast)
- **Vocal Type:** No Vocals / Male Vocal / Female Vocal / Choir / Rap
- **Language/Lyrics:** Instrumental / English / Thai / Auto
- **Duration Hint:** Short (~1 min) / Medium (~2 min) / Long (~3 min) — ใส่ใน prompt เป็น hint เท่านั้น
- **Custom Prompt Additions:** Text area เพิ่มเติม — ผู้ใช้พิมพ์ custom keywords เพิ่ม (optional)

#### 3.1.4 Song Count Selector
- ตัวเลือก: **1, 2, 3, 4** เพลง
- Default: 2
- หมายเหตุ: Suno สร้าง 2 variations ต่อ 1 request — ถ้าผู้ใช้เลือก 3 หรือ 4 เพลง Extension จะส่ง 2 requests

---

### 3.2 Feature: Prompt Auto-Generation Engine

#### 3.2.1 Prompt Builder Logic
Extension สร้าง Suno prompt จาก parameters ที่ผู้ใช้เลือก:

```
Template:
"[Genre] [Sub-genre] music, [Mood1], [Mood2], [BPM] BPM,
[Vocal Type], [Duration Hint], [Custom Additions].
[Quality Keywords]"

Quality Keywords (always appended):
"high quality, professionally mixed, clear audio, studio quality"
```

**Example Output:**
```
"Lo-fi Hip Hop music, calm, nostalgic, 85 BPM, no vocals,
around 2 minutes, smooth jazzy chords.
high quality, professionally mixed, clear audio, studio quality"
```

#### 3.2.2 Prompt Preview
- แสดง generated prompt ใน collapsible text box ก่อน submit
- ผู้ใช้แก้ไข prompt ได้โดยตรงก่อนกด Generate
- ปุ่ม "Regenerate Prompt" สร้างใหม่ได้โดยไม่ต้องเปลี่ยน settings

---

### 3.3 Feature: Suno Browser Automation

#### 3.3.1 Tab Management
1. Extension ตรวจสอบว่ามี tab `suno.com/*` อยู่แล้วหรือไม่
2. ถ้ามี: navigate tab นั้นไปที่ `/create`
3. ถ้าไม่มี: เปิด tab ใหม่ `https://suno.com/create`
4. Focus tab และรอ page load (timeout: 15 วินาที)

#### 3.3.2 Login Check
- Content script ตรวจ DOM ว่า login แล้วหรือไม่
- ถ้ายังไม่ login: popup แสดง error banner "กรุณา Login Suno ก่อนใช้งาน" พร้อมปุ่ม "เปิด Suno"
- ไม่เก็บ credentials ใดๆ ทั้งสิ้น

#### 3.3.3 Auto-Fill & Submit Flow
Content script ทำตามขั้นตอน:
1. รอ prompt textarea ปรากฏ (MutationObserver + timeout 10s)
2. Clear existing text
3. Set value ด้วย native input event (เพื่อให้ React detect ได้)
4. ถ้า Song Count > 2: ค้นหาและ adjust "Number of songs" UI (ถ้า Suno มี)
5. คลิก Generate button
6. รอ generation complete โดย observe:
   - Audio `<audio>` element ปรากฏใน DOM
   - หรือ network response จาก Suno's internal API (ถ้าตรวจจับได้)
7. Extract audio URLs (อาจมี 2 URLs ต่อ request)
8. ส่งกลับ popup ผ่าน `chrome.runtime.sendMessage`

#### 3.3.4 Error Handling — Automation
| Error | Handling |
|---|---|
| Suno DOM เปลี่ยน (selector ไม่เจอ) | แสดง error + "Manual Mode" fallback: copy prompt ไป clipboard แทน |
| Generation timeout (>3 นาที) | แสดง timeout warning + ให้ผู้ใช้ retry |
| ไม่พบ audio URL | แสดง error + ให้ผู้ใช้ download manual จาก suno.com แทน |
| Rate limit / quota หมด | ตรวจจับ error message จาก Suno DOM และแจ้งผู้ใช้ |

#### 3.3.5 Progress Indicator
- Popup แสดง progress steps แบบ real-time:
  ```
  [✓] เปิดหน้า Suno
  [✓] กรอก Prompt
  [✓] เริ่ม Generate
  [⟳] รอ Suno สร้างเพลง... (spinner + elapsed time)
  [ ] ดาวน์โหลด Audio
  ```

---

### 3.4 Feature: Audio Player & Results Panel

#### 3.4.1 Songs List
หลังจาก Suno สร้างเสร็จ ผลลัพธ์แสดงใน popup:
- Card ต่อ 1 เพลง แสดง:
  - ชื่อเพลง (จาก Suno หรือ auto-generated เช่น "Lo-fi Track #1")
  - Waveform visualizer (canvas-based, ไม่ต้องแม่นยำ — แสดงเป็น decorative waveform)
  - Duration
  - Play/Pause button
  - ปุ่ม "Process & Download"

#### 3.4.2 Audio Playback
- ใช้ Web Audio API เล่นเสียงผ่าน popup
- ปุ่ม Play/Pause, seek bar, volume control
- เล่นได้ **ก่อน** process (preview original)
- เล่นได้ **หลัง** process (preview processed)

---

### 3.5 Feature: Audio Processing (EQ + Clarity Boost)

#### 3.5.1 Processing Controls
แสดงเป็น UI ใน popup มีสองโหมด:

**Mode A — Quick Presets (Default)**
| Preset | Description |
|---|---|
| Original | ไม่ process ใดๆ |
| Clear | Clarity boost เบาๆ (+1 presence, +2 air) |
| Crispy | Full clarity stack (สูตรจาก chain ใน section 2.4) |
| Warm | Cut high freq เล็กน้อย + bass boost เบาๆ |
| Punchy | Mid-cut + compressor aggressive |

**Mode B — Manual Controls (Advanced)**
ผู้ใช้กด "Advanced" เพื่อเปิด:
- **High-Pass Filter:** slider 40–200 Hz (กัน mud)
- **Presence (3kHz):** -6 ถึง +6 dB
- **Air (10kHz):** -6 ถึง +6 dB
- **Compression:** None / Light / Medium / Heavy
- **Output Gain:** -6 ถึง +6 dB

#### 3.5.2 Processing Pipeline (Technical)
```javascript
// OfflineAudioContext สำหรับ export (non-realtime rendering)
const offlineCtx = new OfflineAudioContext(2, buffer.length, buffer.sampleRate);

// Chain: Source → HP Filter → Presence EQ → Air EQ → Compressor → Gain → Destination
const source = offlineCtx.createBufferSource();
source.buffer = audioBuffer;

const hpFilter = offlineCtx.createBiquadFilter();
hpFilter.type = 'highpass';
hpFilter.frequency.value = hpHz; // user setting

const presenceEQ = offlineCtx.createBiquadFilter();
presenceEQ.type = 'peaking';
presenceEQ.frequency.value = 3000;
presenceEQ.gain.value = presenceDb;

const airEQ = offlineCtx.createBiquadFilter();
airEQ.type = 'peaking';  
airEQ.frequency.value = 10000;
airEQ.gain.value = airDb;

const compressor = offlineCtx.createDynamicsCompressor();
// settings based on preset

const gain = offlineCtx.createGain();
gain.gain.value = outputGain;

source.connect(hpFilter)
      .connect(presenceEQ)
      .connect(airEQ)
      .connect(compressor)
      .connect(gain)
      .connect(offlineCtx.destination);

source.start();
const renderedBuffer = await offlineCtx.startRendering();
```

#### 3.5.3 MP3 Export
```javascript
// ใช้ lamejs สำหรับ encode MP3
import { Mp3Encoder } from 'lamejs';

const encoder = new Mp3Encoder(2, sampleRate, 192); // stereo, 192kbps
// encode in chunks...
const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
```

**Output Quality:**
- Bitrate: 192 kbps (default) / 320 kbps (option)
- Sample Rate: match original (44100 Hz)
- Channels: Stereo

---

### 3.6 Feature: Download

#### 3.6.1 Auto-Download Flow
1. ผู้ใช้กด "Process & Download" บน track card
2. Progress bar แสดงขณะ processing (OfflineAudioContext render)
3. encode เป็น MP3
4. `chrome.downloads.download()` trigger download อัตโนมัติ
5. Filename: `sunogen-[genre]-[mood]-[timestamp].mp3`
   - Example: `sunogen-lofi-calm-20260614-143022.mp3`

#### 3.6.2 Batch Download
- ถ้า generate หลายเพลง: ปุ่ม "Download All" process และ download ทุก track ทีเดียว
- Download เป็น sequential (ไม่พร้อมกัน) เพื่อไม่ให้ browser freeze

---

### 3.7 Feature: Settings & History

#### 3.7.1 Settings Panel
เข้าถึงผ่านไอคอน gear ใน popup header:
- **Default Song Count:** 1-4 (default: 2)
- **Default MP3 Quality:** 192 / 320 kbps
- **Auto-open Suno Tab:** toggle (default: ON)
- **Show Advanced Audio Controls:** toggle (default: OFF)
- **Download Folder:** แสดงข้อมูล (control ได้จาก Chrome download settings เท่านั้น)
- **Theme:** Light / Dark / System

#### 3.7.2 Generation History
- บันทึก generation sessions ล่าสุด 20 รายการใน `chrome.storage.local`
- แต่ละ session เก็บ: timestamp, genre, mood, prompt, จำนวนเพลง, track names
- ผู้ใช้สามารถ "Re-use" session เพื่อ load settings กลับมา
- ผู้ใช้ลบ history ได้

---

## 4. UI/UX Requirements

### 4.1 Popup Dimensions
- Width: **400px** (fixed)
- Height: **auto**, max **600px** (scrollable)
- ถ้า result panel แสดงอยู่: popup ขยายได้ถึง **700px**

### 4.2 Visual Design
- **Style:** Dark theme เป็น default (เหมาะกับบรรยากาศ music production)
- **Color Palette:**
  - Background: `#0D0D0F`
  - Surface: `#1A1A1F`
  - Card: `#242429`
  - Accent (Primary): `#7C3AED` (purple — music/creative vibe)
  - Accent (Success): `#10B981`
  - Accent (Warning): `#F59E0B`
  - Text Primary: `#F1F1F3`
  - Text Muted: `#6B7280`
- **Font:** Inter (Google Fonts หรือ bundled)
- **Border Radius:** 12px (cards), 8px (buttons), 4px (inputs)
- **Icons:** Lucide Icons (bundled SVG)

### 4.3 States & Transitions
- **Loading states:** Skeleton screens ขณะรอข้อมูล
- **Processing state:** Progress bar animated
- **Success state:** ✓ animation + เพลงปรากฏ
- **Error state:** Red banner พร้อม error message ที่อ่านเข้าใจ (ไม่ใช่ technical error)
- Transitions: 200ms ease — ไม่ใช้ animation หนักๆ (popup ต้องเร็ว)

### 4.4 Responsive Behavior
- Popup ไม่ต้อง responsive (fixed width)
- แต่ text ต้องไม่ overflow และ scroll ใน container ที่เหมาะสม

---

## 5. File Structure

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
│   ├── audioProcessor.js     # Web Audio API processing chain
│   └── mp3Exporter.js        # lamejs MP3 encoding
├── lib/
│   └── lame.min.js           # lamejs bundled
├── utils/
│   ├── promptBuilder.js      # Prompt generation logic
│   ├── sunoSelectors.js      # DOM selectors for suno.com (updateable)
│   └── storage.js            # chrome.storage helpers
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── assets/
    └── fonts/
        └── inter.woff2
```

---

## 6. manifest.json Specification

```json
{
  "manifest_version": 3,
  "name": "SunoGen — AI Music Generator",
  "version": "1.0.0",
  "description": "Generate, process, and download AI music from Suno with one click",
  "permissions": [
    "tabs",
    "scripting",
    "activeTab",
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "https://suno.com/*",
    "https://*.suno.ai/*"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background/background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://suno.com/*"],
      "js": ["content/content.js"],
      "run_at": "document_idle"
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },
  "web_accessible_resources": [
    {
      "resources": ["lib/*", "assets/*"],
      "matches": ["https://suno.com/*"]
    }
  ]
}
```

---

## 7. Message Protocol (Extension Internal)

ทุก message ใช้ format:
```javascript
{ type: 'ACTION_NAME', payload: { ... } }
```

### 7.1 Popup → Background
| Message Type | Payload | Description |
|---|---|---|
| `START_GENERATION` | `{ prompt, songCount, settings }` | เริ่ม generate |
| `CANCEL_GENERATION` | `{}` | ยกเลิก |
| `GET_HISTORY` | `{}` | ดึง history |
| `CLEAR_HISTORY` | `{}` | ล้าง history |
| `SAVE_SETTINGS` | `{ settings }` | บันทึก settings |

### 7.2 Background → Popup
| Message Type | Payload | Description |
|---|---|---|
| `GENERATION_PROGRESS` | `{ step, message, elapsed }` | อัปเดต progress |
| `GENERATION_COMPLETE` | `{ tracks: [{url, name, duration}] }` | เพลงพร้อมแล้ว |
| `GENERATION_ERROR` | `{ error, code, userMessage }` | เกิด error |
| `HISTORY_DATA` | `{ sessions: [...] }` | ส่ง history กลับ |

### 7.3 Background → Content Script
| Message Type | Payload | Description |
|---|---|---|
| `FILL_AND_SUBMIT` | `{ prompt, songCount }` | สั่ง fill form |
| `EXTRACT_AUDIO` | `{}` | ดึง audio URLs |

### 7.4 Content Script → Background
| Message Type | Payload | Description |
|---|---|---|
| `FORM_SUBMITTED` | `{}` | submit เสร็จแล้ว |
| `AUDIO_FOUND` | `{ urls: [string] }` | พบ audio URLs |
| `SUNO_ERROR` | `{ message }` | Suno แสดง error |
| `LOGIN_REQUIRED` | `{}` | ต้อง login ก่อน |

---

## 8. Error Codes & User Messages

| Code | Technical Cause | User-Facing Message (TH) |
|---|---|---|
| `E001` | Suno not logged in | "กรุณา Login Suno.com ก่อนใช้งาน" |
| `E002` | Suno DOM changed | "ไม่พบฟอร์มใน Suno — อาจมีการอัปเดต UI กรุณาลองใหม่หรือกด Copy Prompt" |
| `E003` | Generation timeout | "Suno ใช้เวลานานเกินไป กรุณาตรวจสอบที่ Suno.com โดยตรง" |
| `E004` | Audio URL not found | "ไม่พบไฟล์เสียง กรุณา download จาก Suno.com โดยตรง" |
| `E005` | Suno rate limit | "Suno แจ้งว่าใช้งานถึงขีดจำกัดแล้ว กรุณารอสักครู่" |
| `E006` | Audio fetch failed | "โหลดไฟล์เสียงไม่ได้ (อาจเกิดจาก CORS) กรุณาลองใหม่" |
| `E007` | MP3 encoding failed | "เกิดข้อผิดพลาดในการแปลงไฟล์ กรุณาลองใหม่" |
| `E008` | Download failed | "ดาวน์โหลดไม่สำเร็จ กรุณาตรวจสอบ Chrome download settings" |

---

## 9. Known Technical Challenges & Mitigations

### 9.1 CORS — Fetching Suno Audio
**ปัญหา:** Suno audio CDN (`cdn1.suno.ai`) อาจไม่อนุญาต fetch จาก extension origin  
**แก้ไข:**
- Option A: Fetch audio จาก **content script context** (same-origin จาก suno.com perspective)
- Option B: ใช้ `fetch` ใน background service worker กับ `mode: 'no-cors'` และ cache response
- Option C: ถ้าทั้งสองไม่ได้ผล — ให้ content script สร้าง temporary `<audio>` element, `MediaRecorder` บันทึก audio stream, ส่งกลับ arraybuffer (ช้ากว่าแต่ทำงานได้แน่นอน)

### 9.2 Suno DOM Selectors อาจเปลี่ยน
**ปัญหา:** Suno เป็น Next.js app ที่ class names อาจ change ทุก deploy  
**แก้ไข:**
- `sunoSelectors.js` เก็บ selectors แบบ prioritized list (ใช้ semantic selectors ก่อน)
- เรียงลำดับ: `aria-label` → `data-testid` → `placeholder` → CSS class (สุดท้าย)
- ตัวอย่าง:
  ```javascript
  export const SELECTORS = {
    promptInput: [
      'textarea[placeholder*="Describe"]',
      'textarea[aria-label*="prompt"]',
      '[data-testid="prompt-input"]',
      'textarea.sc-prompt' // fallback class
    ],
    generateButton: [
      'button[aria-label*="Create"]',
      'button[data-testid="generate-btn"]',
      'button:has(span:contains("Create"))'
    ]
  };
  ```

### 9.3 Service Worker Lifecycle
**ปัญหา:** MV3 Service Worker หมดอายุใน 5 นาที  
**แก้ไข:**
- ส่ง keepalive ping จาก popup ทุก 20 วินาทีขณะ generation กำลังทำงาน
- บันทึก generation state ลง `chrome.storage.session` เผื่อ SW restart

### 9.4 Audio Processing Memory
**ปัญหา:** ไฟล์เสียง 2-3 นาที × 4 tracks อาจใช้ RAM มาก  
**แก้ไข:**
- Process ทีละ track เท่านั้น (ไม่ process พร้อมกันหลาย tracks)
- หลัง download เสร็จ: ล้าง AudioBuffer จาก memory

---

## 10. Out of Scope (Version 1.0)

สิ่งต่อไปนี้ **ไม่อยู่ใน scope** ของ v1.0:
- Suno account management / login ผ่าน extension
- Cloud storage หรือ sync ระหว่างอุปกรณ์
- Social sharing (ไม่ upload ไฟล์ไปที่ใดทั้งสิ้น)
- Advanced audio effects (reverb, delay, pitch shift)
- Stem separation (vocal isolation)
- Custom Suno model selection
- Firefox / Edge support
- Mobile (Extension เป็น desktop Chrome only)

---

## 11. Development & Testing Notes สำหรับ Claude Code

### 11.1 Setup
```bash
# Clone / create project
mkdir sunogen-extension && cd sunogen-extension

# Install dependencies (สำหรับ build tools ถ้าใช้)
npm init -y
npm install --save-dev webpack webpack-cli

# หรือถ้าไม่ใช้ bundler — เขียน vanilla JS ตรงๆ ได้เลย
# lamejs ให้ bundle ไว้ใน /lib/lame.min.js โดยตรง
```

### 11.2 Load Extension ใน Chrome
1. เปิด `chrome://extensions/`
2. Enable "Developer mode"
3. คลิก "Load unpacked"
4. เลือก folder `sunogen-extension/`

### 11.3 Testing Checklist
- [ ] Popup load โดยไม่มี error ใน console
- [ ] Genre/Mood selection ทำงานถูกต้อง
- [ ] Prompt Builder สร้าง prompt ที่ถูกต้อง
- [ ] เปิด Suno tab และ navigate ไปที่ /create ได้
- [ ] Content script inject สำเร็จ (ตรวจจาก DevTools > Sources)
- [ ] Form fill และ submit ทำงาน (ต้อง login Suno จริงๆ)
- [ ] Audio URL extraction ทำงาน
- [ ] Web Audio API processing chain ไม่มี error
- [ ] MP3 export ผ่าน lamejs สำเร็จ
- [ ] Download ไฟล์ได้จริง
- [ ] History บันทึกและแสดงผลถูกต้อง
- [ ] Error cases แสดง user message ที่เข้าใจได้

### 11.4 Important Implementation Notes
- ใช้ **ES Modules** ใน popup/background ถ้า Chrome version รองรับ (ถ้าไม่แน่ใจ ใช้ IIFE หรือ bundle แทน)
- `content.js` ต้อง **ไม่ใช้ ES Modules** (content scripts ไม่รองรับ `type="module"`)
- Background service worker: ใช้ `importScripts()` สำหรับ third-party libs
- ทุก `chrome.runtime.sendMessage` ต้องมี error handling (`chrome.runtime.lastError`)
- ห้าม `eval()` และ `innerHTML = userInput` (CSP ใน MV3 เข้มงวดมาก)

---

## 12. Success Metrics (Definition of Done)

Extension ถือว่า "Done" เมื่อ:

1. ผู้ใช้เลือก Genre + Mood + จำนวนเพลง → กด Generate → เพลงถูกสร้างใน Suno โดยอัตโนมัติ โดยผู้ใช้ไม่ต้องพิมพ์อะไรใน Suno เอง
2. เพลงที่ได้สามารถ Preview ได้ใน popup
3. กด "Process & Download" → ไฟล์ MP3 ถูก download ลงเครื่องโดยอัตโนมัติ
4. ไม่มี crash หรือ unhandled error ใน normal flow
5. Error cases ทุกกรณีแสดง user-friendly message (ไม่ใช่ JS stack trace)
6. Extension ผ่าน Chrome Extension review checklist (ไม่ใช้ remote code, ไม่ eval)

---

*END OF PRD v1.0*
