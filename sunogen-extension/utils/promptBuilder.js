const QUALITY_SUFFIX = 'high quality, professionally mixed, clear audio, studio quality';

const BPM_PRESETS = {
  slow:      '70 BPM',
  mid:       '100 BPM',
  fast:      '130 BPM',
  very_fast: '160 BPM',
};

const DURATION_LABELS = {
  short:  'around 1 minute',
  medium: 'around 2 minutes',
  long:   'around 3 minutes',
};

/**
 * @param {object} params
 * @param {string}   params.genre        e.g. "Lo-fi Hip Hop"
 * @param {string}   [params.subGenre]   e.g. "with jazz chords"
 * @param {string[]} params.moods        e.g. ["calm", "nostalgic"]
 * @param {string}   [params.bpm]        numeric string or preset key
 * @param {string}   [params.vocalType]  "no vocals" | "male vocal" | etc.
 * @param {string}   [params.language]   "instrumental" | "english" | "thai" | "auto"
 * @param {string}   [params.duration]   "short" | "medium" | "long"
 * @param {string}   [params.custom]     free-form additions
 * @returns {string}
 */
export function buildPrompt(params) {
  const {
    genre = '',
    subGenre = '',
    moods = [],
    bpm,
    vocalType,
    language,
    duration,
    custom,
  } = params;

  const parts = [];

  // Genre
  const genreStr = [genre, subGenre].filter(Boolean).join(' ');
  if (genreStr) parts.push(`${genreStr} music`);

  // Mood (max 3)
  const moodStr = moods.slice(0, 3).join(', ');
  if (moodStr) parts.push(moodStr);

  // BPM
  if (bpm) {
    const bpmStr = BPM_PRESETS[bpm] ?? (Number(bpm) ? `${bpm} BPM` : null);
    if (bpmStr) parts.push(bpmStr);
  }

  // Vocal / Language
  if (vocalType && vocalType !== 'auto') {
    parts.push(vocalType === 'no_vocals' ? 'no vocals, instrumental' : vocalType);
  }
  if (language && language !== 'auto' && language !== 'instrumental') {
    parts.push(`${language} lyrics`);
  }

  // Duration
  if (duration && DURATION_LABELS[duration]) {
    parts.push(DURATION_LABELS[duration]);
  }

  // Custom additions
  if (custom?.trim()) parts.push(custom.trim());

  const main = parts.join(', ');
  return main ? `${main}. ${QUALITY_SUFFIX}` : QUALITY_SUFFIX;
}

/** Generates filename for downloaded MP3 */
export function buildFilename(genre, moods) {
  const g = (genre || 'music').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const m = (moods[0] || 'track').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `sunogen-${g}-${m}-${ts}.mp3`;
}
