# แผนการทำงาน — LoFi Auto Video Generator

## Phase 1: โครงสร้างและ UI พื้นฐาน

**เป้าหมาย:** โปรแกรมเปิดได้ นำทางระหว่างหน้าได้ ธีมทำงาน

**งานที่ต้องทำ:**
- [ ] สร้าง project structure ทั้งหมด (โฟลเดอร์ + `__init__.py`)
- [ ] `requirements.txt`
- [ ] `app/theme.py` — สี, font (Sarabun), ขนาด dark/light
- [ ] `app/utils/i18n.py` + `locales/th.json` + `locales/en.json` (key ทั้งหมด)
- [ ] `app/utils/config.py` — โหลด/บันทึก config.json ที่ `%APPDATA%`
- [ ] `app/utils/file_manager.py` — สร้าง output folders
- [ ] `app/components/sidebar.py` — navigation 5 หน้า
- [ ] `app/app.py` — Main CTk window 1100×750, header bar (TH/EN toggle, account badges)
- [ ] `main.py` — entry point
- [ ] หน้า placeholder ทั้ง 5 หน้า (แค่ label ชื่อหน้า)

**Definition of Done:** รันได้, กด sidebar ได้ทุกหน้า, toggle ภาษาได้, toggle dark/light ได้

---

## Phase 2: Account Connection (page_connect.py)

**เป้าหมาย:** login Google และ Suno ได้จริง token เก็บปลอดภัย

**งานที่ต้องทำ:**
- [ ] `app/services/google_auth.py` — OAuth2 flow ด้วย `google-auth-oauthlib`
  - เปิด browser → รับ callback → เก็บ token ใน keyring
  - Auto-refresh token เมื่อหมดอายุ
- [ ] `app/services/suno_auth.py` — รับ session token, validate, เก็บใน keyring
  - เรียก billing/info/ ดู plan + credits
- [ ] `app/components/account_badge.py` — แสดง Google email / Suno plan
- [ ] `app/pages/page_connect.py` — UI ครบ: ปุ่ม login Google, guide Suno token, status
- [ ] Error handling: token หมดอายุ, ไม่มี internet

**Definition of Done:** login Google ได้จริง, วาง Suno token แล้วเห็น plan + credits

---

## Phase 3: Image Studio (page_image.py)

**เป้าหมาย:** เลือก style → สร้างภาพจาก Google Imagen → แสดงผล → บันทึก

**งานที่ต้องทำ:**
- [ ] `app/services/prompt_builder.py` — `build_image_prompt()` ครบทุก option
  - mapping ไทย → English prompt
  - Scene, Art Style, Time, Weather, Color, Character, FX
- [ ] `app/services/google_imagen.py` — เรียก Imagen API
  - count 1–6, aspect ratio, return list[bytes]
  - Error: quota, auth, network
- [ ] `app/components/style_card.py` — dropdown/card เลือก style (reusable)
- [ ] `app/components/image_slot.py` — ช่องรูป, loading spinner, right-click menu
- [ ] `app/pages/page_image.py` — layout ครบ: selector ซ้าย + grid รูปขวา
  - Prompt preview แบบ real-time
  - ปุ่ม สร้างใหม่ / บันทึกทั้งหมด
  - Per-image: สร้างใหม่, บันทึก, ลบ
- [ ] รันใน Thread แยก (ห้าม freeze UI)

**Definition of Done:** เลือก style ได้ทุกตัว, สร้างภาพจริงจาก API ได้, บันทึกได้

---

## Phase 4: Music Studio (page_music.py)

**เป้าหมาย:** เลือก style → สร้างเพลงจาก Suno → เล่นได้ → บันทึก

**งานที่ต้องทำ:**
- [ ] `app/services/prompt_builder.py` — เพิ่ม `build_suno_prompt()` ครบทุก option
  - mapping ไทย → English, สร้าง payload (prompt, tags, title, make_instrumental)
- [ ] `app/services/suno_api.py` — ครบทั้ง flow:
  - POST สร้างเพลง → GET polling ทุก 5 วิ → download MP3
  - Status: submitted → queued → streaming → complete
  - Error: 401, quota หมด, status=error
  - รันใน Thread แยก
- [ ] `app/components/audio_player.py` — play/pause, seek bar, เวลา
- [ ] `app/pages/page_music.py` — layout ครบ: selector ซ้าย + player ขวา
  - แสดง "กำลังสร้าง..." + เวลาที่ผ่านไป
  - Duration selector (Pro only — ซ่อนถ้า Free)
  - Prompt preview

**Definition of Done:** สร้างเพลงได้จริง, เล่นใน app ได้, บันทึก MP3 ได้

---

## Phase 5: Video Assembly (page_video.py)

**เป้าหมาย:** เอาภาพ + เพลงมารวมเป็น MP4 พร้อม effects

**งานที่ต้องทำ:**
- [ ] `app/services/ffmpeg_runner.py` — สร้าง video
  - `build_ffmpeg_command()`: ภาพ loop + transition + effects + audio
  - Effects: grain, vignette, Ken Burns (zoompan), color grade (curves)
  - `render_video()`: subprocess + `-progress pipe:1` → parse → callback(percent, eta)
  - detect ffmpeg path (frozen vs dev)
- [ ] `app/components/progress_bar.py` — แสดง % + ETA real-time
- [ ] `app/pages/page_video.py` — layout ครบ
  - Auto-populate ภาพจาก Image Studio
  - Auto-populate เพลงจาก Music Studio
  - Transition selector (crossfade, fadeblack, zoom_in, slide_left, none)
  - Visual effects checkboxes
  - Audio fade in/out
  - Render → progress → โหลด MP4 → เพิ่มใน Long MV Queue
- [ ] รันใน Thread แยก

**Transition FFmpeg filters:**
- crossfade: `xfade=fade`
- fadeblack: `xfade=fadeblack`
- zoom_in: `zoompan`
- slide_left: `xfade=slideleft`

**Definition of Done:** render MP4 จริงได้, progress bar ทำงาน, บันทึกได้

---

## Phase 6: Long MV Combiner (page_longmv.py)

**เป้าหมาย:** รวม MP4 หลายไฟล์ → loop → ได้ video ยาว 1–3 ชั่วโมง

**งานที่ต้องทำ:**
- [ ] Long MV logic ใน `ffmpeg_runner.py`
  - คำนวณจำนวน loop = ceil(target / total_input_duration)
  - สร้าง filelist.txt → FFmpeg concat demuxer
  - ใช้ `-c copy` (ห้าม re-encode)
  - Trim ไฟล์สุดท้ายให้พอดี target
  - Shuffle mode: สับลำดับทุกรอบ
- [ ] `app/pages/page_longmv.py` — layout ครบ
  - Queue list (drag to reorder, ลบ)
  - เพิ่มไฟล์จาก folder หรือจาก Video Studio queue
  - Target duration: 30 นาที / 1h / 2h / 3h / Custom
  - Sequential loop vs Shuffle
  - แสดงขนาดไฟล์โดยประมาณก่อน export
  - Progress bar + ETA

**Definition of Done:** สร้างวิดีโอยาวได้จริง, loop ถูกต้อง, ขนาดไฟล์ไม่เกิน limit

---

## Phase 7: Polish, Error Handling, Build .exe

**เป้าหมาย:** พร้อมขาย — เสถียร, error ทุกจุดจัดการแล้ว, pack เป็น .exe ได้

**งานที่ต้องทำ:**
- [ ] Error handling ครบทุกจุดตาม CLAUDE.md (แสดง dialog ที่ถูกต้อง)
- [ ] ตรวจสอบว่า `output/` สร้างอัตโนมัติถ้ายังไม่มี
- [ ] บันทึก last_image_settings + last_music_settings ใน config
- [ ] ตรวจสอบ FFmpeg bundle path ทั้ง dev และ .exe mode
- [ ] `build.bat` — PyInstaller command ครบ
  - `--collect-all google.generativeai`
  - `--add-data assets;assets`
  - `--add-data locales;locales`
  - `--windowed --onefile --icon`
- [ ] ทดสอบ .exe บน Windows เครื่องใหม่ (ไม่มี Python)
- [ ] ตรวจสอบ startup time (ควร < 5 วินาที)

**Definition of Done:** .exe ทำงานได้บนเครื่อง Windows ที่ไม่มี Python, ทุก feature ผ่าน

---

## ลำดับการ implement (แนะนำ)

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

แต่ละ Phase ทำ commit แยก ไม่ข้าม Phase จนกว่า Definition of Done จะผ่าน

---

## คำถามที่รอคำตอบจากเจ้าของโปรเจกต์

1. **Google OAuth Client ID/Secret** — จะ bundle มาใน app เลย หรือให้ผู้ใช้กรอกเอง?
2. **Suno API** — ปัจจุบัน endpoint ยังใช้งานได้อยู่ไหม? (Unofficial API อาจเปลี่ยน)
3. **FFmpeg** — จะ download และ bundle ไว้เองในโปรเจกต์นี้ หรือให้ script ดึงตอน build?
4. **Google Client credentials** — มีไฟล์ `credentials.json` จาก Google Cloud Console แล้วหรือยัง?
