import { registerCustomSampleName, removeCustomSampleName, initSampleMap } from './samples.js';

// Holds in-memory session custom samples
// Map<sampleName, { name: string, variations: [{ fileName, buffer, duration, sampleRate, numberOfChannels, size }], dateAdded: number }>
const customSamples = new Map();
const listeners = new Set();

function notifyListeners() {
  const list = getCustomSamples();
  listeners.forEach((fn) => {
    try { fn(list); } catch (e) { console.error(e); }
  });
}

export function subscribeCustomSamples(fn) {
  listeners.add(fn);
  fn(getCustomSamples());
  return () => listeners.delete(fn);
}

export function getCustomSamples() {
  return Array.from(customSamples.values());
}

let activeWebDirt = null;
let activeAudioContext = null;
let currentPreviewSource = null;

export function setActiveWebDirt(wd) {
  activeWebDirt = wd;
  if (wd) {
    if (wd.ac) activeAudioContext = wd.ac;
    injectAllCustomSamples(wd);
  }
}

export function getSessionAudioContext() {
  if (activeAudioContext && activeAudioContext.state !== 'closed') {
    return activeAudioContext;
  }
  if (activeWebDirt && activeWebDirt.ac && activeWebDirt.ac.state !== 'closed') {
    activeAudioContext = activeWebDirt.ac;
    return activeAudioContext;
  }
  if (typeof window !== 'undefined') {
    if (!window._shiftAudioContext || window._shiftAudioContext.state === 'closed') {
      window._shiftAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    activeAudioContext = window._shiftAudioContext;
    return activeAudioContext;
  }
  return null;
}

export function sanitizeSampleName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'custom_sample';
  let cleaned = rawName.trim().toLowerCase()
    .replace(/\.[^/.]+$/, "")         // strip extension e.g. .wav
    .replace(/[^a-z0-9_]/g, "_")      // replace non-alphanumeric/underscore with _
    .replace(/^_+|_+$/g, "");         // strip leading/trailing underscores
  if (!cleaned) cleaned = 'custom_sample';
  if (/^[0-9]/.test(cleaned)) {
    cleaned = 's_' + cleaned;
  }
  return cleaned;
}

function hookSampleBank(sampleBank) {
  if (!sampleBank || sampleBank._customHooked) return;
  sampleBank._customHooked = true;

  let _map = sampleBank.sampleMap || {};
  Object.defineProperty(sampleBank, 'sampleMap', {
    get() {
      return _map;
    },
    set(newMap) {
      _map = newMap || {};
      // Re-inject all custom samples whenever sampleMap is replaced or loaded
      for (const [name, sampleData] of customSamples.entries()) {
        sampleData.variations.forEach((v, idx) => {
          injectSampleIntoBank(sampleBank, name, v.buffer, idx);
        });
      }
    },
    configurable: true,
    enumerable: true
  });
}

function injectSampleIntoBank(sampleBank, name, audioBuffer, variationIndex = 0) {
  if (!sampleBank) return;
  const virtualKey = `custom/${name}/${variationIndex}.wav`;

  if (!sampleBank.sampleMap) {
    sampleBank.sampleMap = {};
  }
  if (!sampleBank.sampleMap[name]) {
    sampleBank.sampleMap[name] = [virtualKey];
  } else if (!sampleBank.sampleMap[name].includes(virtualKey)) {
    sampleBank.sampleMap[name].push(virtualKey);
  }

  if (!sampleBank.samples) {
    sampleBank.samples = {};
  }
  sampleBank.samples[virtualKey] = {
    status: 2, // STATUS_READY in WebDirt
    buffer: audioBuffer,
    reverseBuffer: null
  };

  if (activeAudioContext && !sampleBank.ac) {
    sampleBank.ac = activeAudioContext;
  }
}

export function injectAllCustomSamples(wd) {
  if (!wd || !wd.sampleBank) return;
  hookSampleBank(wd.sampleBank);

  for (const [name, sampleData] of customSamples.entries()) {
    sampleData.variations.forEach((v, idx) => {
      injectSampleIntoBank(wd.sampleBank, name, v.buffer, idx);
    });
  }
}

export async function loadCustomSampleFile(file, requestedName, audioCtx = null, wd = null) {
  if (!file) {
    throw new Error("No audio file provided");
  }

  const ctx = audioCtx || getSessionAudioContext();
  if (!ctx) {
    throw new Error("AudioContext not available in this environment");
  }
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const cleanName = sanitizeSampleName(requestedName || file.name);
  const arrayBuf = await file.arrayBuffer();
  
  // decodeAudioData can detach the ArrayBuffer, so use slice
  let audioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
  } catch (decodeErr) {
    throw new Error(`Failed to decode audio file (${file.name}): ${decodeErr?.message || 'Unsupported format or corrupted file'}`);
  }

  const targetWd = wd || activeWebDirt;

  const variation = {
    fileName: file.name,
    buffer: audioBuffer,
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
    size: file.size
  };

  if (!customSamples.has(cleanName)) {
    customSamples.set(cleanName, {
      name: cleanName,
      variations: [variation],
      dateAdded: Date.now()
    });
  } else {
    const existing = customSamples.get(cleanName);
    existing.variations.push(variation);
  }

  // Register with samples.js list for autocomplete and token cycling
  registerCustomSampleName(cleanName);

  // Inject into WebDirt's active sample bank
  if (targetWd && targetWd.sampleBank) {
    hookSampleBank(targetWd.sampleBank);
    const existing = customSamples.get(cleanName);
    existing.variations.forEach((v, idx) => {
      injectSampleIntoBank(targetWd.sampleBank, cleanName, v.buffer, idx);
    });
  }

  notifyListeners();

  return {
    success: true,
    name: cleanName,
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
    variationsCount: customSamples.get(cleanName).variations.length
  };
}

export function removeCustomSample(name, wd = null) {
  if (!customSamples.has(name)) return;
  const targetWd = wd || activeWebDirt;
  const existing = customSamples.get(name);

  if (targetWd && targetWd.sampleBank) {
    if (targetWd.sampleBank.sampleMap) {
      delete targetWd.sampleBank.sampleMap[name];
    }
    if (targetWd.sampleBank.samples && existing.variations) {
      existing.variations.forEach((_, idx) => {
        delete targetWd.sampleBank.samples[`custom/${name}/${idx}.wav`];
      });
    }
  }

  customSamples.delete(name);
  removeCustomSampleName(name);
  notifyListeners();
}

export async function reloadSampleMap(wd = null) {
  const targetWd = wd || activeWebDirt;
  const SAMPLE_MAP_URL = "https://raw.githubusercontent.com/combjellly/shift/main/samples/sampleMap.json";
  let defaultCount = 188;

  try {
    const res = await fetch(`${SAMPLE_MAP_URL}?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      defaultCount = Object.keys(data).length;
      if (targetWd && targetWd.sampleBank) {
        hookSampleBank(targetWd.sampleBank);
        targetWd.sampleBank.sampleMap = data; // Setter will automatically re-inject all custom samples
      }
    }
  } catch (err) {
    console.warn("Failed to fetch remote sampleMap.json:", err);
  }

  // Also update samples.js
  await initSampleMap();

  // Ensure all custom samples re-injected
  if (targetWd && targetWd.sampleBank) {
    injectAllCustomSamples(targetWd);
  }

  notifyListeners();

  return {
    success: true,
    defaultCount,
    customCount: customSamples.size
  };
}

export function stopPreview() {
  if (currentPreviewSource) {
    try {
      currentPreviewSource.stop();
      currentPreviewSource.disconnect();
    } catch (e) {}
    currentPreviewSource = null;
  }
}

export function previewCustomSample(buffer, audioCtx = null, onEnded = null) {
  stopPreview();
  const ctx = audioCtx || getSessionAudioContext();
  if (!ctx || !buffer) return false;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gainNode = ctx.createGain();
  gainNode.gain.value = 0.85;

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  currentPreviewSource = source;

  source.onended = () => {
    if (currentPreviewSource === source) {
      currentPreviewSource = null;
    }
    if (typeof onEnded === 'function') onEnded();
  };

  source.start(0);
  return true;
}
