# CLAUDE.md — LoFi Auto Video Generator

## ภาพรวมโปรเจกต์

Windows Desktop App (.exe) สำหรับสร้าง LoFi Music Video แบบอัตโนมัติ
ผู้ใช้ double-click ไฟล์เดียว ทำงานได้เลยโดยไม่ต้องติดตั้งอะไรเพิ่ม

**4 ฟีเจอร์หลัก:**
1. สร้างภาพ AI ด้วย Google Imagen API (OAuth2, ฟรี quota)
2. สร้างเพลง AI ด้วย Suno (session cookie, ฟรีหรือ Pro)
3. รวมภาพ + เพลง → MP4 (สูงสุด 4 นาที) ด้วย FFmpeg
4. รวม MP4 หลายไฟล์ → Long MV 1–3 ชั่วโมง

**กลุ่มเป้าหมาย:** คนทั่วไปที่ซื้อจาก Facebook — ไม่มีความรู้ด้านเทคนิค

---

## Tech Stack (ห้ามเปลี่ยน)

| ส่วน | เทคโนโลยี |
|------|-----------|
| ภาษา | Python 3.12 |
| UI | CustomTkinter 5.2.2 |
| Video | FFmpeg (bundle ใน .exe) |
| Image API | `google-generativeai` 0.7.2 + `google-auth-oauthlib` |
| Music API | Suno unofficial API (HTTP + Cookie) |
| HTTP | `requests` + `httpx` |
| Auth storage | `keyring` (ไม่เก็บ token ใน plain text) |
| Font | Sarabun (embed ใน app) |
| Pack | PyInstaller → .exe ไฟล์เดียว |

**ไม่ใช้:** Node.js, Docker, Electron, Database (ใช้ JSON แทน)

---

## โครงสร้างไฟล์

```
lofi_video_gen/
├── main.py
├── requirements.txt
├── build.bat
├── app/
│   ├── app.py                 # Main App class (CTk root)
│   ├── theme.py               # สี, font, ขนาด UI
│   ├── pages/
│   │   ├── page_connect.py    # หน้า 0: เชื่อมต่อ Google + Suno
│   │   ├── page_image.py      # หน้า 1: Image Studio
│   │   ├── page_music.py      # หน้า 2: Music Studio
│   │   ├── page_video.py      # หน้า 3: Video Assembly
│   │   └── page_longmv.py     # หน้า 4: Long MV Combiner
│   ├── components/
│   │   ├── sidebar.py         # navigation ด้านซ้าย
│   │   ├── style_card.py      # card เลือก style (ใช้ซ้ำหลายหน้า)
│   │   ├── image_slot.py      # ช่องแสดงรูปแต่ละรูป
│   │   ├── audio_player.py    # audio player widget
│   │   ├── progress_bar.py    # progress bar render
│   │   └── account_badge.py   # แสดงสถานะ account
│   ├── services/
│   │   ├── google_auth.py     # Google OAuth2 flow
│   │   ├── google_imagen.py   # เรียก Imagen API
│   │   ├── suno_auth.py       # Suno session token
│   │   ├── suno_api.py        # เรียก Suno API + polling
│   │   ├── ffmpeg_runner.py   # สร้าง video ด้วย FFmpeg
│   │   └── prompt_builder.py  # สร้าง prompt (Image + Music)
│   └── utils/
│       ├── config.py          # โหลด/บันทึก config.json
│       ├── file_manager.py    # จัดการไฟล์ temp + output
│       └── i18n.py            # ภาษาไทย/อังกฤษ
├── assets/
│   ├── fonts/Sarabun-Regular.ttf
│   ├── icons/ (app_icon.ico, google.png, suno.png)
│   ├── images/logo.png
│   └── ffmpeg/ffmpeg.exe      # bundle FFmpeg
├── locales/
│   ├── th.json
│   └── en.json
└── output/                    # สร้างอัตโนมัติ
    ├── images/
    ├── music/
    └── videos/
```

---

## กฎสำคัญในการเขียนโค้ด

### Threading
- Suno API polling → ต้องรันใน Thread แยก (ห้าม block UI)
- FFmpeg render → ต้องรันใน Thread แยก + ส่ง progress ผ่าน queue กลับ main thread
- ใช้ `threading.Thread` + `queue.Queue` เสมอ

### UI
- Window size: 1100 × 750 px (resizable)
- โหลด Sarabun font ก่อนสร้าง widget ใดๆ (`ctk.set_default_font()`)
- ทุกข้อความ UI ต้องผ่าน `t("key")` จาก i18n — ห้าม hardcode ภาษาไทยหรืออังกฤษใน UI code

### Auth & Security
- Google token → เก็บใน `keyring` เท่านั้น
- Suno session → เก็บใน `keyring` เท่านั้น
- ห้ามเก็บ token ใน config.json

### FFmpeg
- Path detection: ตรวจว่า `sys.frozen` เพื่อหา `sys._MEIPASS` (กรณีรันเป็น .exe)
- Video output: H.264 + AAC, 24 FPS, max 240 วินาที
- Long MV: ใช้ `-c copy` (ไม่ re-encode = เร็วมาก)
- Progress: ใช้ `ffmpeg -progress pipe:1` อ่าน real-time

### Config
- เก็บที่: `%APPDATA%/LofiVideoGen/config.json`
- Default output: `Documents/LofiVideoGen/output/`
- สร้างโฟลเดอร์ output อัตโนมัติถ้ายังไม่มี

### PyInstaller Build
- ต้องเพิ่ม `--collect-all google.generativeai` ใน build command
- FFmpeg.exe ต้อง bundle ไปด้วยใน `assets/ffmpeg/`

---

## API Reference

### Google Imagen
```
Endpoint: https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict
OAuth Scope: https://www.googleapis.com/auth/generative-language
จำนวนภาพ: 1–6
Aspect ratio: "16:9" | "9:16" | "1:1"
```

### Suno (Unofficial)
```
สร้างเพลง:  POST https://studio-api.suno.ai/api/generate/v2/
Polling:    GET  https://studio-api.suno.ai/api/feed/?ids=<id>
Account:    GET  https://studio-api.suno.ai/api/billing/info/
Auth:       Header Cookie: __session=<token>
Status flow: submitted → queued → streaming → complete
เวลาโดยปกติ: 30–90 วินาที
```

---

## Error Handling (ทุกหน้า)

| ข้อผิดพลาด | ข้อความแสดง (key ใน i18n) |
|-----------|--------------------------|
| ไม่มี Internet | `no_internet` |
| Google Quota หมด | `google_quota_exceeded` |
| Google Token หมดอายุ | `google_token_expired` |
| Suno Token หมดอายุ | `suno_token_expired` |
| Suno Credits หมด | `suno_credits_empty` |
| FFmpeg ไม่พบ | `ffmpeg_not_found` |
| Render ล้มเหลว | `render_failed` |

---

## แผนการ Build

```
Phase 1 — โครงสร้างและ UI พื้นฐาน
Phase 2 — ระบบ Account Connection
Phase 3 — Image Studio
Phase 4 — Music Studio
Phase 5 — Video Assembly
Phase 6 — Long MV Combiner
Phase 7 — Polish, Error Handling, Build .exe
```

ดูรายละเอียดแต่ละ Phase ใน PHASES.md

---

## Deliverable สุดท้าย

```
LoFiVideoGen_v1.0.zip
├── LoFiVideoGen.exe     ← double-click รันได้เลย (~80–150 MB)
├── README_TH.pdf
└── HOW_TO_GET_TOKEN.pdf
```

---

*อ้างอิง PRD: PRD_LoFi_VideoGen.md v2.0 (2025-06-14)*
