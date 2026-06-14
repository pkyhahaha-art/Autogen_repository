/**
 * MP3 encoding via lamejs (loaded via importScripts or script tag).
 * lamejs must be available at chrome.runtime.getURL('lib/lame.min.js').
 */

let lameLoaded = false;

async function ensureLame() {
  if (lameLoaded || typeof lamejs !== 'undefined') {
    lameLoaded = true;
    return;
  }
  await loadScript(chrome.runtime.getURL('lib/lame.min.js'));
  lameLoaded = true;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Encode an AudioBuffer to MP3 Blob.
 * @param {AudioBuffer} audioBuffer
 * @param {number} [bitrate=192]  — 192 or 320 kbps
 * @param {function} [onProgress] — called with 0–100
 * @returns {Promise<Blob>}
 */
export async function encodeMp3(audioBuffer, bitrate = 192, onProgress = null) {
  await ensureLame();

  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate  = audioBuffer.sampleRate;
  const encoder     = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);

  const leftChannel  = audioBuffer.getChannelData(0);
  const rightChannel = numChannels === 2
    ? audioBuffer.getChannelData(1)
    : leftChannel;

  const CHUNK = 1152; // lamejs chunk size
  const mp3Parts = [];
  const total = Math.ceil(leftChannel.length / CHUNK);

  for (let i = 0; i < leftChannel.length; i += CHUNK) {
    const leftPCM  = floatTo16BitPCM(leftChannel.subarray(i, i + CHUNK));
    const rightPCM = floatTo16BitPCM(rightChannel.subarray(i, i + CHUNK));

    const encoded = numChannels === 2
      ? encoder.encodeBuffer(leftPCM, rightPCM)
      : encoder.encodeBuffer(leftPCM);

    if (encoded.length > 0) mp3Parts.push(encoded);

    if (onProgress) {
      onProgress(Math.round(((i / CHUNK) / total) * 100));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) mp3Parts.push(flushed);
  if (onProgress) onProgress(100);

  return new Blob(mp3Parts, { type: 'audio/mp3' });
}

function floatTo16BitPCM(floatArray) {
  const pcm = new Int16Array(floatArray.length);
  for (let i = 0; i < floatArray.length; i++) {
    const clamped = Math.max(-1, Math.min(1, floatArray[i]));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm;
}
