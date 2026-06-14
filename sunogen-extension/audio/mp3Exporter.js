/**
 * MP3 encoding via lamejs.
 * lame.min.js is pre-loaded via <script> tag in popup.html,
 * so `lamejs` is already defined as a global when this module runs.
 */

/**
 * Encode an AudioBuffer to an MP3 Blob.
 * @param {AudioBuffer} audioBuffer
 * @param {number} [bitrate=192]   — 192 or 320 kbps
 * @param {function} [onProgress]  — called with 0–100
 * @returns {Promise<Blob>}
 */
export async function encodeMp3(audioBuffer, bitrate = 192, onProgress = null) {
  if (typeof lamejs === 'undefined') {
    throw new Error('lamejs not loaded — check lib/lame.min.js');
  }

  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate  = audioBuffer.sampleRate;
  // eslint-disable-next-line no-undef
  const encoder     = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);

  const leftData  = audioBuffer.getChannelData(0);
  const rightData = numChannels === 2 ? audioBuffer.getChannelData(1) : leftData;

  const CHUNK    = 1152;
  const mp3Parts = [];
  const total    = Math.ceil(leftData.length / CHUNK);

  for (let i = 0; i < leftData.length; i += CHUNK) {
    const left  = floatTo16Bit(leftData.subarray(i, i + CHUNK));
    const right = floatTo16Bit(rightData.subarray(i, i + CHUNK));

    const encoded = numChannels === 2
      ? encoder.encodeBuffer(left, right)
      : encoder.encodeBuffer(left);

    if (encoded.length > 0) mp3Parts.push(encoded);

    if (onProgress) {
      onProgress(Math.min(99, Math.round(((i / CHUNK) / total) * 100)));
    }

    // Yield to keep popup responsive on long tracks
    if (i % (CHUNK * 100) === 0) await yieldFrame();
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) mp3Parts.push(flushed);
  if (onProgress) onProgress(100);

  return new Blob(mp3Parts, { type: 'audio/mpeg' });
}

function floatTo16Bit(floatArray) {
  const out = new Int16Array(floatArray.length);
  for (let i = 0; i < floatArray.length; i++) {
    const v = Math.max(-1, Math.min(1, floatArray[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

function yieldFrame() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
