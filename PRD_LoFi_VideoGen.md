# PRD: LoFi Auto Video Generator
**สำหรับ Claude Code — อ่านเอกสารนี้แล้วลงมือทำได้เลย**

Version: 2.0  
Date: 2025-06-14  
Platform: **Windows Desktop App → บรรจุเป็น .exe ไฟล์เดียว**  
ภาษา: ไทย / อังกฤษ (UI ภาษาไทยเป็นหลัก)

---

## 1. ภาพรวมสินค้า (ขายใน Facebook)

โปรแกรม Windows Desktop App สำหรับสร้าง **LoFi Music Video อัตโนมัติ**  
ผู้ซื้อโหลดไฟล์ `.exe` ไปแล้ว double-click รันได้เลย **ไม่ต้องติดตั้งอะไรเพิ่ม**

### สิ่งที่โปรแกรมทำ (ครบในไฟล์เดียว)
1. **สร้างภาพ AI** → ผู้ใช้เลือก style → ส่ง prompt → Google Imagen API → ได้ภาพ 1–6 รูป
2. **สร้างเพลง AI** → ผู้ใช้เลือก style → ส่ง prompt → Suno AI → ได้ไฟล์ MP3
3. **รวมเป็น Video** → ภาพ + เพลง → FFmpeg → ได้ MP4 (max 4 นาที) → Auto download
4. **รวม Video ยาว** → นำ MP4 หลายไฟล์มา loop รวมกัน → Long MV 1–3 ชั่วโมง

### ข้อสำคัญ: ผู้ใช้ไม่ต้องจ่าย API
- Google Imagen → ใช้ Google Account ฟรี (OAuth2 login)
- Suno → ใช้ Suno Account ฟรี หรือ Pro (login ด้วย session token)
- ทุก AI ทำงานบนบัญชีของผู้ใช้เอง

---

## 2. Tech Stack (เลือกแล้ว — ห้ามเปลี่ยน)

| ส่วน | เทคโนโลยี | เหตุผล |
|------|-----------|--------|
| ภาษา | **Python 3.12** | มาตรฐาน, library ครบ, community ใหญ่ |
| UI Framework | **CustomTkinter** | หน้าตาสวย, ใช้ง่าย, ไม่ต้องลง dependencies เพิ่ม |
| Video Processing | **FFmpeg** (subprocess call) | มาตรฐานโลก, เสถียร, ฟรี |
| Image Gen API | **Google Generative AI SDK** (`google-generativeai`) | Official SDK, ฟรี quota |
| Music Gen | **Suno Unofficial API** (HTTP requests) | Cookie-based session |
| HTTP Client | **requests** + **httpx** | มาตรฐาน Python |
| Auth Storage | **keyring** (encrypted OS storage) | เก็บ token ปลอดภัย |
| Pack เป็น .exe | **PyInstaller** | มาตรฐานที่สุดสำหรับ Python → exe |
| Font Thai | **Sarabun** (embed ใน app) | อ่านภาษาไทยชัดเจน |

### ไม่ใช้ (เพื่อความเรียบง่าย)
- ❌ Node.js / React (ซับซ้อนเกินไปสำหรับ desktop)
- ❌ Docker / Server (ผู้ใช้รันบนเครื่องตัวเอง)
- ❌ Database (ใช้ JSON file แทน)
- ❌ Electron (หนัก, บั๊กเยอะ)

---

## 3. โครงสร้างไฟล์โปรเจกต์

```
lofi_video_gen/
│
├── main.py                    # Entry point — เปิดโปรแกรม
├── requirements.txt           # Python packages ทั้งหมด
├── build.bat                  # Script สำหรับ pack เป็น .exe
│
├── app/
│   ├── __init__.py
│   ├── app.py                 # Main App class (CustomTkinter root)
│   ├── theme.py               # สี, font, ขนาด UI ทั้งหมด
│   │
│   ├── pages/
│   │   ├── __init__.py
│   │   ├── page_connect.py    # หน้า 0: เชื่อมต่อ Google + Suno
│   │   ├── page_image.py      # หน้า 1: Image Studio
│   │   ├── page_music.py      # หน้า 2: Music Studio
│   │   ├── page_video.py      # หน้า 3: Video Assembly
│   │   └── page_longmv.py     # หน้า 4: Long MV Combiner
│   │
│   ├── components/
│   │   ├── __init__.py
│   │   ├── sidebar.py         # แถบด้านซ้าย: navigation
│   │   ├── style_card.py      # Card เลือก style (ใช้ซ้ำหลายหน้า)
│   │   ├── image_slot.py      # ช่องแสดงรูปภาพแต่ละรูป
│   │   ├── audio_player.py    # Audio player widget
│   │   ├── progress_bar.py    # Progress bar สำหรับ render
│   │   └── account_badge.py   # แสดงสถานะ account
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── google_auth.py     # Google OAuth2 flow
│   │   ├── google_imagen.py   # เรียก Imagen API สร้างรูป
│   │   ├── suno_auth.py       # Suno session token management
│   │   ├── suno_api.py        # เรียก Suno API สร้างเพลง
│   │   ├── ffmpeg_runner.py   # เรียก FFmpeg สร้าง video
│   │   └── prompt_builder.py  # สร้าง prompt สำหรับ Image + Music
│   │
│   └── utils/
│       ├── __init__.py
│       ├── config.py          # โหลด/บันทึก config (JSON)
│       ├── file_manager.py    # จัดการไฟล์ temp และ output
│       └── i18n.py            # ภาษาไทย/อังกฤษ
│
├── assets/
│   ├── fonts/
│   │   └── Sarabun-Regular.ttf
│   ├── icons/
│   │   ├── app_icon.ico       # Icon โปรแกรม
│   │   ├── google.png
│   │   └── suno.png
│   └── images/
│       └── logo.png
│
├── locales/
│   ├── th.json                # ข้อความภาษาไทยทั้งหมด
│   └── en.json                # ข้อความภาษาอังกฤษทั้งหมด
│
└── output/                    # โฟลเดอร์ output (สร้างอัตโนมัติ)
    ├── images/
    ├── music/
    └── videos/
```

---

## 4. UI Layout (CustomTkinter)

### หน้าต่างหลัก
```
┌─────────────────────────────────────────────────────────────────┐
│  [🎵 LoFi Video Gen]              [TH|EN]  [Google: ✅] [Suno: ✅] │  ← Header bar
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                        │
│ [🔗] เชื่อม│                                                        │
│ [🖼️] รูป  │         CONTENT AREA (เปลี่ยนตามหน้าที่เลือก)           │
│ [🎵] เพลง │                                                        │
│ [🎬] Video│                                                        │
│ [📽️] Long │                                                        │
│    MV    │                                                        │
│          │                                                        │
└──────────┴──────────────────────────────────────────────────────┘
```

- Window size: **1100 x 750 px** (resizable)
- Sidebar: **200 px** กว้าง, dark navy background
- Content: ขยายเต็มพื้นที่ที่เหลือ
- Dark theme เป็นค่าเริ่มต้น (มี toggle light/dark)

---

## 5. หน้า 0: เชื่อมต่อบัญชี (page_connect.py)

### 5.1 Google Account (Imagen API)
```
ขั้นตอน:
1. ผู้ใช้กดปุ่ม "เชื่อมต่อ Google"
2. เปิด browser ไปที่ Google OAuth consent screen
3. ผู้ใช้ login และ allow permission
4. รับ token กลับมา เก็บใน keyring
5. แสดง email + สถานะ "เชื่อมต่อแล้ว ✅"

OAuth Scope ที่ต้องการ:
- https://www.googleapis.com/auth/generative-language

API Endpoint:
- https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict
```

**หมายเหตุสำหรับ Claude Code:**  
ใช้ `google-auth-oauthlib` สำหรับ OAuth flow  
Client ID/Secret → ให้ผู้ใช้กรอกเอง หรือ bundle มาใน app (แนะนำ bundle)  
Token refresh อัตโนมัติเมื่อหมดอายุ

### 5.2 Suno Account
```
ขั้นตอน:
1. แสดง step-by-step วิธีหา session token:
   - ไปที่ suno.com แล้ว login
   - กด F12 → Application → Cookies → copy ค่า __session
2. ผู้ใช้วาง token ในช่อง input
3. กด "ตรวจสอบ" → ระบบเรียก API ดู account info
4. แสดง: Plan (Free/Pro), Credits เหลือ, Username

Session Token Storage:
- เก็บใน keyring (ปลอดภัย, ไม่ตกใน plain text)

Suno Plan Detection:
GET https://studio-api.suno.ai/api/billing/info/
Header: Cookie: __session=<token>
→ parse plan: free | pro | premier
```

---

## 6. หน้า 1: Image Studio (page_image.py)

### 6.1 Layout
```
┌────────────────────────────────────────────────────────────┐
│  🖼️ Image Studio                                            │
├──────────────────────────┬─────────────────────────────────┤
│  STYLE SELECTOR (ซ้าย)    │  PREVIEW + OUTPUT (ขวา)          │
│                           │                                  │
│  [Scene Type]  ▼          │  ┌──────┐ ┌──────┐ ┌──────┐   │
│  [Art Style]   ▼          │  │  1   │ │  2   │ │  3   │   │
│  [Time of Day] ▼          │  └──────┘ └──────┘ └──────┘   │
│  [Weather]     ▼          │  ┌──────┐ ┌──────┐ ┌──────┐   │
│  [Color Tone]  ▼          │  │  4   │ │  5   │ │  6   │   │
│  [Character]   ▼          │  └──────┘ └──────┘ └──────┘   │
│  [Special FX] ☑☑☑         │                                  │
│                           │  จำนวนรูป: [1][2][3][4][5][6]   │
│  📋 Prompt Preview:       │                                  │
│  [lofi, anime, room...]   │  [🔄 สร้างภาพใหม่]               │
│                           │  [⬇️ บันทึกรูปทั้งหมด]            │
└──────────────────────────┴─────────────────────────────────┘
```

### 6.2 ตัวเลือก Style (Dropdown / Card)

**Scene Type** (เลือก 1):
- ห้องโลไฟ / คาเฟ่อบอุ่น / ห้องสมุด / วิวจากหน้าต่าง
- ดาดฟ้าเมือง / ห้องนอนกลางคืน / ทางเดินป่า
- ถนนฝนตก / นั่งรถไฟ / ชายหาดพระอาทิตย์ตก

**Art Style** (เลือก 1):
- Anime/Ghibli / Pixel Art / Watercolor
- Oil Painting / Pencil Sketch / Flat Illustration
- Cinematic Photo / Vintage Film

**Time of Day** (เลือก 1):
- เช้าตรู่ / เช้า / บ่าย / Golden Hour / เย็น / กลางคืน / ดึก

**Weather** (เลือก 1):
- แดดจ้า / มีเมฆ / ฝนตก / หมอก / หิมะ / ดาวเต็มฟ้า

**Color Tone** (เลือก 1):
- โทนอุ่น / โทนเย็น / Pastel / Monochrome / Neon / Earth Tone / Sepia

**Character** (เลือก 1, optional):
- ไม่มี / สาวกำลังอ่านหนังสือ / หนุ่มกำลังเรียน / แมวนอนหลับ / หลายคน

**Special FX** (เลือกได้หลายอย่าง, max 3):
- หยดฝนบนกระจก / ไอน้ำร้อนจากแก้วกาแฟ / โคมไฟนิ้วหิ่งห้อย / ดอกซากุระร่วง
- แสงไฟเมือง / หิมะตก / แสงเทียน / ดาวบนท้องฟ้า

**Aspect Ratio**:
- 16:9 (YouTube) / 9:16 (Shorts/TikTok) / 1:1 (Square)

**จำนวนภาพ**: 1 / 2 / 3 / 4 / 5 / 6

### 6.3 Prompt Builder Logic (prompt_builder.py)

```python
def build_image_prompt(options: dict) -> str:
    """สร้าง English prompt สำหรับส่งไป Google Imagen"""
    
    scene_map = {
        "ห้องโลไฟ": "cozy lofi room with desk and warm lamp",
        "คาเฟ่อบอุ่น": "cozy café interior with wooden furniture",
        # ... (map ทุก option)
    }
    
    art_map = {
        "Anime/Ghibli": "studio ghibli anime style, hand drawn",
        "Pixel Art": "pixel art style, 16-bit retro",
        # ...
    }
    
    base = f"{scene_map[options['scene']]}, {art_map[options['art_style']]}"
    atmosphere = f"{options['time_of_day']} lighting, {options['weather']} weather, {options['color_tone']} color palette"
    fx = ", ".join(options['special_fx'][:3]) if options['special_fx'] else ""
    char = options['character'] if options['character'] != "ไม่มี" else ""
    quality = "masterpiece, high quality, detailed, cozy lofi aesthetic, peaceful atmosphere, 4k"
    
    parts = [p for p in [base, atmosphere, fx, char, quality] if p]
    return ", ".join(parts)
```

### 6.4 Google Imagen API Call (google_imagen.py)

```python
import google.generativeai as genai

def generate_images(prompt: str, count: int, aspect_ratio: str, token: str) -> list[bytes]:
    """
    Returns: list of image bytes
    """
    # ใช้ token จาก OAuth
    # Model: imagen-3.0-generate-002
    # count: 1-6
    # aspect_ratio: "16:9" | "9:16" | "1:1"
    
    # Error handling:
    # - QuotaExceededError → แจ้ง "Quota Google หมดแล้ว รอพรุ่งนี้"
    # - AuthError → แจ้ง "กรุณา Login Google ใหม่"
    # - NetworkError → แจ้ง "ไม่มีอินเทอร์เน็ต"
```

### 6.5 Per-Image Actions (แต่ละช่องรูป)
- คลิกขวา → [สร้างใหม่รูปนี้] [บันทึกรูปนี้] [ลบรูปนี้]
- แสดง loading spinner ระหว่างรอ (generation ~10-30 วินาที/รูป)

---

## 7. หน้า 2: Music Studio (page_music.py)

### 7.1 Layout
```
┌──────────────────────────────────────────────────────────────┐
│  🎵 Music Studio                          [Suno: Pro ✅]      │
├─────────────────────────┬────────────────────────────────────┤
│  STYLE SELECTOR (ซ้าย)   │  RESULT (ขวา)                      │
│                          │                                     │
│  [Genre]       ▼         │  ┌───────────────────────────────┐ │
│  [Mood]        ▼         │  │  🎵 LoFi Jazz - Melancholic   │ │
│  [Instruments] ☑☑☑       │  │  ▶  ━━━━━━━━━━●━━━  2:34     │ │
│  [BPM]         ▼         │  │  [⬇️ บันทึกเพลง] [🔄 สร้างใหม่] │ │
│  [Vocal]       ▼         │  └───────────────────────────────┘ │
│  [Duration]*             │                                     │
│  (* Pro only)            │  📋 Prompt ที่ส่งไป:               │
│                          │  [lofi jazz, melancholic...]        │
│                          │                                     │
│  [🎵 สร้างเพลง]           │  ⏱️ กำลังสร้าง... 45 วินาที        │
└─────────────────────────┴────────────────────────────────────┘
```

### 7.2 ตัวเลือก Music Style

**Genre** (เลือก 1):
- LoFi Hip-Hop / LoFi Jazz / LoFi Bossa Nova / LoFi Ambient
- Chill Beats / Study Beats / Sleep Music / Café Music / Nature + LoFi

**Mood** (เลือก 1):
- เศร้าอมหวาน / คิดถึงอดีต / มีความสุข / ฝันกลางวัน
- โฟกัสทำงาน / โรแมนติก / สงบผ่อนคลาย

**Instruments** (เลือกได้หลายอย่าง, max 4):
- เปียโน / กีตาร์อะคูสติก / กีตาร์ไฟฟ้า / เบส
- กลอง (lo-fi) / เสียงแผ่นเสียง (vinyl crackle)
- เสียงฝน / เสียงธรรมชาติ / ทรัมเป็ต / แซกโซโฟน
- ฟลุต / เครื่องสาย / Synth

**BPM** (เลือก 1):
- ช้า (60–75) / กลาง (75–90) / กลาง-เร็ว (90–100) / ลอยตัว

**Vocal** (เลือก 1):
- บรรเลงอย่างเดียว / Vocal chops / Humming
- เสียงร้องภาษาญี่ปุ่น / เสียงร้องภาษาไทย

**Duration** (Pro เท่านั้น):
- 30 วิ / 1 นาที / 2 นาที / 3 นาที
- Free account: ใช้ความยาว default ของ Suno (~2 นาที)

### 7.3 Suno Prompt Builder (prompt_builder.py)

```python
def build_suno_prompt(options: dict) -> dict:
    """สร้าง payload สำหรับส่งไป Suno"""
    
    genre_map = {
        "LoFi Hip-Hop": "lofi hip hop",
        "LoFi Jazz": "lofi jazz",
        # ...
    }
    
    mood_map = {
        "เศร้าอมหวาน": "melancholic",
        "คิดถึงอดีต": "nostalgic",
        # ...
    }
    
    instruments_en = [instrument_map[i] for i in options['instruments']]
    
    return {
        "prompt": f"[{genre_map[options['genre']]}] [{mood_map[options['mood']]}] "
                  f"featuring {', '.join(instruments_en)}. "
                  f"BPM around {options['bpm']}. "
                  f"{vocal_map[options['vocal']]}. "
                  f"Cozy, relaxing, perfect for studying.",
        "tags": f"lofi, {genre_map[options['genre']]}, {mood_map[options['mood']]}, chill, relaxing",
        "title": f"LoFi {options['genre']} - {options['mood']}",
        "make_instrumental": options['vocal'] == "บรรเลงอย่างเดียว"
    }
```

### 7.4 Suno API Flow (suno_api.py)

```python
"""
Step 1: POST สร้างเพลง
URL: https://studio-api.suno.ai/api/generate/v2/
Header: Cookie: __session=<token>
Body: {prompt, tags, title, make_instrumental}
Response: {id: "song_id_xxx"}

Step 2: Polling รอจนเสร็จ (ทุก 5 วินาที)
URL: https://studio-api.suno.ai/api/feed/?ids=<song_id>
Response: [{status: "complete", audio_url: "https://...mp3"}]
Status: "submitted" → "queued" → "streaming" → "complete"

Step 3: Download MP3
GET audio_url → save ไป output/music/

UI แสดง: "กำลังสร้างเพลง..." + spinner + เวลาที่ผ่านไป
โดยปกติ Suno ใช้เวลา 30–90 วินาที
"""

# Error handling:
# - status == "error" → แจ้ง "Suno สร้างไม่สำเร็จ ลองใหม่"
# - 401 Unauthorized → แจ้ง "Session Token หมดอายุ กรุณาอัพเดท"
# - Free quota หมด → แจ้ง "Credits หมดแล้ว รอพรุ่งนี้ หรืออัพเกรด Pro"
```

---

## 8. หน้า 3: Video Assembly (page_video.py)

### 8.1 Layout
```
┌──────────────────────────────────────────────────────────────┐
│  🎬 สร้าง Video                                               │
├────────────────────────┬─────────────────────────────────────┤
│  SETTINGS (ซ้าย)        │  PREVIEW + RENDER (ขวา)             │
│                         │                                      │
│  📸 ภาพที่เลือก:          │  ┌────────────────────────────┐    │
│  [img1][img2][img3]     │  │   PREVIEW (thumbnail)        │    │
│                         │  │   Image 1/3 — 0:00          │    │
│  🎵 เพลงที่เลือก:         │  └────────────────────────────┘    │
│  [🎵 LoFi Jazz 2:34]    │                                      │
│                         │  ▶ ━━━━━━━━━━━━━━━  0:00 / 4:00   │
│  🔄 Transition:         │                                      │
│  [Crossfade ▼]          │  ████████████░░░░  75%              │
│                         │  "กำลัง Render... 1:23 เหลือ"       │
│  ⏱️ ระยะเวลาต่อรูป:       │                                      │
│  [Auto / กำหนดเอง]      │  [🎬 Render Video]                  │
│                         │  [📥 โหลด MP4]  (ปรากฏเมื่อเสร็จ)  │
│  🎨 Visual Effects:     │                                      │
│  ☑ Grain Effect         │  [➕ เพิ่มใน Long MV Queue]          │
│  ☑ Vignette             │                                      │
│  ☑ Ken Burns (Pan/Zoom) │                                      │
│  [Warm/Cool/Vintage▼]   │                                      │
│                         │                                      │
│  🔊 Audio:              │                                      │
│  Fade in: [2s ▼]        │                                      │
│  Fade out: [3s ▼]       │                                      │
└────────────────────────┴─────────────────────────────────────┘
```

### 8.2 Video Assembly Logic (ffmpeg_runner.py)

```python
"""
Input:
  - images: list[str]  → path ของรูปภาพ (1–6 รูป)
  - audio: str         → path ของไฟล์ MP3
  - options: dict      → transition, effects, duration_per_image

Process:
  1. คำนวณ duration_per_image:
     - Auto = audio_duration / len(images)
     - Manual = ผู้ใช้กำหนด
  
  2. สร้าง FFmpeg command:
     - แต่ละรูป loop ตาม duration
     - ใช้ filter_complex สำหรับ transition
     - Overlay audio
     - ตัดที่ max 240 วินาที (4 นาที)
  
  3. Effects:
     - Grain: overlay noise filter
     - Vignette: vignette filter
     - Ken Burns: zoompan filter
     - Color grading: curves filter
  
  4. Output: H.264 video + AAC audio → .mp4

Output specs:
  - Codec video: libx264
  - Codec audio: aac
  - Resolution: ตาม aspect ratio ที่เลือกตอนสร้างรูป
  - FPS: 24
  - Max duration: 240 วินาที
  - Audio fade in/out: ตามที่กำหนด
"""

def build_ffmpeg_command(images, audio, options) -> list[str]:
    """Returns FFmpeg args as list for subprocess.run()"""
    pass

def render_video(images, audio, options, output_path, progress_callback):
    """
    progress_callback(percent: float, eta_seconds: int)
    ใช้ ffmpeg -progress pipe:1 เพื่ออ่าน progress แบบ real-time
    """
    pass
```

### 8.3 Transition Options
| ค่า | ชื่อ | FFmpeg Filter |
|-----|------|--------------|
| `none` | ตัดตรง | ไม่มี filter |
| `crossfade` | Crossfade | `xfade=fade` |
| `fadeblack` | Fade to Black | `xfade=fadeblack` |
| `zoom_in` | Zoom In | `zoompan` |
| `slide_left` | Slide ซ้าย | `xfade=slideleft` |

### 8.4 ลำดับ UI Flow
1. ระบบ auto-populate ภาพจากหน้า Image Studio
2. ระบบ auto-populate เพลงจากหน้า Music Studio
3. ผู้ใช้ปรับ settings
4. กด "Render Video"
5. แสดง progress bar real-time + ETA
6. เสร็จ → ปุ่ม "โหลด MP4" ปรากฏ + dialog save file
7. ปุ่ม "เพิ่มใน Long MV Queue" ปรากฏ

---

## 9. หน้า 4: Long MV Combiner (page_longmv.py)

### 9.1 Layout
```
┌──────────────────────────────────────────────────────────────┐
│  📽️ Long MV Combiner                                          │
├─────────────────────────┬────────────────────────────────────┤
│  QUEUE (ซ้าย)            │  EXPORT SETTINGS (ขวา)             │
│                          │                                     │
│  [+ เพิ่มไฟล์ MP4]       │  ⏱️ ความยาวรวมที่ต้องการ:           │
│                          │  [30 นาที][1 ชม][2 ชม][3 ชม][Custom] │
│  ≡ video_001.mp4  3:45  │                                     │
│  ≡ video_002.mp4  4:00  │  🔄 วิธีเล่น:                       │
│  ≡ video_003.mp4  2:30  │  ○ เล่นตามลำดับ แล้ว loop          │
│                          │  ○ สุ่มลำดับทุกรอบ                  │
│  รวมทั้งหมด: 10:15       │                                     │
│  Loop ประมาณ: 6 รอบ     │  📁 บันทึกที่:                      │
│                          │  [C:\Users\...\output\] [เลือก]    │
│  [↑][↓] เรียงลำดับ        │                                     │
│  [🗑️] ลบออก             │  ⚠️ ขนาดไฟล์โดยประมาณ: 2.3 GB     │
│                          │                                     │
│                          │  [📽️ Export Long MV]               │
│                          │  ████░░░░░░  23%  ETA: 45 นาที    │
└─────────────────────────┴────────────────────────────────────┘
```

### 9.2 Long MV Logic

```python
"""
Input:
  - video_queue: list[str]   → paths ของ MP4 ในลำดับที่ต้องการ
  - target_duration: int     → วินาที (1800=30นาที, 3600=1ชม, ...)
  - mode: str               → "sequential_loop" | "shuffle_loop"
  - output_path: str

Algorithm:
  1. คำนวณว่าต้อง loop กี่รอบ:
     total_input = sum(duration ของแต่ละไฟล์)
     loops_needed = ceil(target_duration / total_input)
  
  2. สร้าง playlist:
     playlist = []
     for i in range(loops_needed):
         if mode == "shuffle":
             playlist += shuffle(video_queue)
         else:
             playlist += video_queue
  
  3. Trim ไฟล์สุดท้ายให้พอดี target_duration
  
  4. ใช้ FFmpeg concat demuxer:
     ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4
  
  Note: ใช้ -c copy เพื่อความเร็ว (ไม่ re-encode)
        ทำให้ render เร็วมาก แม้จะเป็น 3 ชั่วโมง

Output:
  - long_mv_YYYYMMDD_HHMMSS.mp4
  - แจ้งขนาดไฟล์โดยประมาณก่อน export
"""
```

---

## 10. Config System (config.py)

```python
"""
เก็บใน: %APPDATA%/LofiVideoGen/config.json

{
  "language": "th",
  "theme": "dark",
  "output_dir": "C:\\Users\\...\\output",
  "last_image_settings": {...},
  "last_music_settings": {...},
  "video_defaults": {
    "transition": "crossfade",
    "grain": true,
    "vignette": true,
    "ken_burns": true,
    "color_grade": "warm",
    "fade_in": 2,
    "fade_out": 3
  }
}

Google Token → keyring (ไม่เก็บใน config.json)
Suno Token → keyring (ไม่เก็บใน config.json)
"""
```

---

## 11. i18n System (i18n.py)

```python
"""
ทุกข้อความใน UI ดึงจาก locales/th.json และ locales/en.json
ห้าม hardcode ข้อความภาษาไทยหรืออังกฤษใน UI code

ตัวอย่าง locales/th.json:
{
  "connect_google": "เชื่อมต่อ Google",
  "connect_suno": "เชื่อมต่อ Suno",
  "generate_image": "สร้างภาพ",
  "generating": "กำลังสร้าง...",
  "quota_error": "Quota Google หมดแล้ว กรุณารอพรุ่งนี้",
  "suno_expired": "Session Token หมดอายุ กรุณาอัพเดทใหม่",
  ...
}

ตัวอย่าง locales/en.json:
{
  "connect_google": "Connect Google",
  "connect_suno": "Connect Suno",
  ...
}

การใช้งาน:
from app.utils.i18n import t
label = t("connect_google")  # → "เชื่อมต่อ Google" หรือ "Connect Google"
"""
```

---

## 12. Error Handling (ทุกหน้า)

| สถานการณ์ | UI แสดง | Action |
|-----------|---------|--------|
| ไม่มี Internet | ❌ "ไม่มีอินเทอร์เน็ต กรุณาตรวจสอบ" | Retry button |
| Google Quota หมด | ⚠️ "Quota หมด รอพรุ่งนี้ (รีเซ็ตตี 9 โมงเช้า)" | ปิด dialog |
| Google Token หมดอายุ | ⚠️ "กรุณา Login Google ใหม่" | ปุ่ม Login |
| Suno Token หมดอายุ | ⚠️ "Session หมดอายุ คัดลอก token ใหม่จาก suno.com" | เปิดหน้า guide |
| Suno Credits หมด | ⚠️ "Credits หมดแล้ว รอพรุ่งนี้ หรืออัพเกรด Pro" | ปิด dialog |
| Suno สร้างไม่สำเร็จ | ❌ "สร้างเพลงไม่สำเร็จ ลองใหม่" | Retry button |
| FFmpeg ไม่พบ | ❌ "ไม่พบ FFmpeg กรุณาติดต่อผู้ขาย" | ปิด dialog |
| ไฟล์ใหญ่เกิน 3 GB | ⚠️ Dialog แจ้งขนาด ถามยืนยัน | Yes/No |
| Render ล้มเหลว | ❌ "Render ไม่สำเร็จ" + log detail | Retry button |

---

## 13. FFmpeg Bundling

```
FFmpeg ต้อง bundle ไปกับ .exe ด้วย ห้ามให้ user ติดตั้งเอง

วิธีทำ:
1. Download ffmpeg-release-essentials.zip จาก ffmpeg.org
2. extract → เอา ffmpeg.exe ใส่ใน assets/ffmpeg/
3. PyInstaller จะ bundle ไปด้วย
4. ในโค้ด detect path ของ ffmpeg:
   
   import sys, os
   if getattr(sys, 'frozen', False):
       # Running as .exe
       base_path = sys._MEIPASS
   else:
       base_path = os.path.dirname(__file__)
   
   FFMPEG_PATH = os.path.join(base_path, 'assets', 'ffmpeg', 'ffmpeg.exe')
```

---

## 14. Build & Pack เป็น .exe (build.bat)

```bat
@echo off
echo Building LoFi Video Generator...

REM Install dependencies
pip install -r requirements.txt

REM Run PyInstaller
pyinstaller ^
  --onefile ^
  --windowed ^
  --icon=assets/icons/app_icon.ico ^
  --name="LoFiVideoGen" ^
  --add-data="assets;assets" ^
  --add-data="locales;locales" ^
  --hidden-import=customtkinter ^
  --hidden-import=PIL ^
  --hidden-import=google.generativeai ^
  main.py

echo Done! ไฟล์อยู่ที่ dist/LoFiVideoGen.exe
pause
```

---

## 15. requirements.txt

```
customtkinter==5.2.2
Pillow==10.3.0
google-generativeai==0.7.2
google-auth-oauthlib==1.2.0
requests==2.32.3
httpx==0.27.0
keyring==25.2.1
mutagen==1.47.0
pyinstaller==6.8.0
```

---

## 16. MVP Build Order (ทำตามลำดับนี้)

```
Phase 1 — โครงสร้างและ UI:
  ✅ 1. สร้าง project structure ทั้งหมด
  ✅ 2. ติดตั้ง dependencies
  ✅ 3. สร้าง main window + sidebar navigation
  ✅ 4. สร้าง theme system (dark/light)
  ✅ 5. สร้าง i18n system (TH/EN)

Phase 2 — Account Connection:
  ✅ 6. Google OAuth2 flow (หน้า Connect)
  ✅ 7. Suno session token input + validate
  ✅ 8. Account status display

Phase 3 — Image Generation:
  ✅ 9.  UI หน้า Image Studio (selector + preview)
  ✅ 10. Prompt Builder (image)
  ✅ 11. Google Imagen API call
  ✅ 12. แสดงผลรูป + per-image actions

Phase 4 — Music Generation:
  ✅ 13. UI หน้า Music Studio
  ✅ 14. Prompt Builder (music)
  ✅ 15. Suno API call + polling
  ✅ 16. Audio player widget

Phase 5 — Video Assembly:
  ✅ 17. UI หน้า Video Studio
  ✅ 18. FFmpeg runner (basic: ภาพ + เพลง → mp4)
  ✅ 19. Progress bar real-time
  ✅ 20. Download MP4

Phase 6 — Long MV:
  ✅ 21. UI หน้า Long MV
  ✅ 22. Concat logic
  ✅ 23. Export with progress

Phase 7 — Polish & Pack:
  ✅ 24. Error handling ทุกจุด
  ✅ 25. config save/load
  ✅ 26. build.bat → .exe
  ✅ 27. Test บน Windows เครื่องใหม่ (ไม่มี Python)
```

---

## 17. ข้อควรระวัง (Critical Notes for Claude Code)

1. **Suno API ไม่ใช่ Official** → ใช้ `requests` + Cookie header ปกติ อาจเปลี่ยนได้ตลอด ทำ error handling ให้ดี

2. **FFmpeg ต้อง bundle** → อย่าให้ user ติดตั้งเอง จะมีปัญหาแน่นอน

3. **CustomTkinter + Thai Font** → ต้องโหลด Sarabun font และตั้งค่า `ctk.set_default_font()` ก่อนสร้าง widget ใดๆ

4. **PyInstaller + google-generativeai** → ต้องเพิ่ม `--collect-all google.generativeai` ใน build command

5. **Suno Polling** → ต้องทำใน Thread แยก ห้าม block UI thread

6. **FFmpeg Render** → ต้องทำใน Thread แยก + ใช้ queue ส่ง progress กลับ main thread

7. **Long MV ใช้ `-c copy`** → เร็วมาก ไม่ต้อง re-encode แต่ต้องการให้ source videos มี codec เดียวกัน (H.264)

8. **Output folder** → สร้างอัตโนมัติถ้ายังไม่มี, default คือ `Documents/LoFiVideoGen/output/`

---

## 18. Deliverable สุดท้ายสำหรับขายใน Facebook

```
📦 LoFiVideoGen_v1.0.zip
├── LoFiVideoGen.exe          ← ไฟล์หลัก (double-click รันได้เลย)
├── README_TH.pdf             ← คู่มือการใช้งานภาษาไทย
└── HOW_TO_GET_TOKEN.pdf      ← วิธี copy Suno session token (step-by-step)
```

ขนาดไฟล์ .exe โดยประมาณ: **80–150 MB** (รวม FFmpeg + Python runtime)

---

*PRD Version 2.0 — Windows Desktop App (.exe) Edition*  
*อัพเดทล่าสุด: 2025-06-14*  
*ส่งให้ Claude Code: อ่านจบแล้วเริ่ม Phase 1 ได้เลย*
