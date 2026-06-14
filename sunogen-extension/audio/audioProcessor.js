/**
 * Audio processing chain using OfflineAudioContext:
 * Source → HP Filter → Presence EQ → Air EQ → Compressor → Gain → Destination
 */

export const PRESETS = {
  original: null,
  clear: {
    hp: 80,
    presence: 1,
    air: 2,
    compression: 'light',
    gain: 0,
  },
  crispy: {
    hp: 80,
    presence: 2,
    air: 3,
    compression: 'light',
    gain: 0,
  },
  warm: {
    hp: 60,
    presence: -1,
    air: -2,
    compression: 'light',
    gain: 1,
  },
  punchy: {
    hp: 100,
    presence: -2,
    air: 0,
    compression: 'heavy',
    gain: 0,
  },
};

const COMPRESSOR_SETTINGS = {
  none:   { threshold: 0,   knee: 0,  ratio: 1,   attack: 0.003, release: 0.25 },
  light:  { threshold: -18, knee: 10, ratio: 2,   attack: 0.003, release: 0.25 },
  medium: { threshold: -24, knee: 8,  ratio: 4,   attack: 0.003, release: 0.25 },
  heavy:  { threshold: -28, knee: 6,  ratio: 8,   attack: 0.001, release: 0.15 },
};

/**
 * @param {AudioBuffer} audioBuffer
 * @param {object} settings  { hp, presence, air, compression, gain }
 * @returns {Promise<AudioBuffer>}
 */
export async function processAudio(audioBuffer, settings) {
  if (!settings) return audioBuffer; // "original" preset

  const { hp = 80, presence = 0, air = 0, compression = 'none', gain = 0 } = settings;

  const ctx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate,
  );

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  // High-pass filter
  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = hp;
  hpFilter.Q.value = 0.707;

  // Presence boost (3kHz)
  const presenceEQ = ctx.createBiquadFilter();
  presenceEQ.type = 'peaking';
  presenceEQ.frequency.value = 3000;
  presenceEQ.Q.value = 1.5;
  presenceEQ.gain.value = presence;

  // Air boost (10kHz)
  const airEQ = ctx.createBiquadFilter();
  airEQ.type = 'peaking';
  airEQ.frequency.value = 10000;
  airEQ.Q.value = 1.0;
  airEQ.gain.value = air;

  // Compressor
  const comp = ctx.createDynamicsCompressor();
  const cs = COMPRESSOR_SETTINGS[compression] ?? COMPRESSOR_SETTINGS.none;
  comp.threshold.value = cs.threshold;
  comp.knee.value      = cs.knee;
  comp.ratio.value     = cs.ratio;
  comp.attack.value    = cs.attack;
  comp.release.value   = cs.release;

  // Output gain
  const gainNode = ctx.createGain();
  gainNode.gain.value = dbToLinear(gain);

  // Chain
  source.connect(hpFilter)
        .connect(presenceEQ)
        .connect(airEQ)
        .connect(comp)
        .connect(gainNode)
        .connect(ctx.destination);

  source.start();
  return ctx.startRendering();
}

/** Fetch audio from URL and decode to AudioBuffer */
export async function fetchAndDecode(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();

  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  ctx.close();
  return decoded;
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}
