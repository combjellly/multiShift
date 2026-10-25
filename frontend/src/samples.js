// Default list of 188 samples in Shift
export const DEFAULT_SAMPLES = [
  "909set", "HARDBASS", "String", "accordion", "among", "animalcrossing", "awooga",
  "bap", "bassdrum", "ben", "bird", "block", "bomb", "breaks", "cave", "cello",
  "chrono", "claps", "clarinet", "commodore", "cool", "cow", "crash", "crash-cymbals",
  "crossing", "ctf230", "ctk533", "d55", "deepbass", "desk", "discord", "dkc", "dkc2",
  "dream", "drum", "drum1", "drumkit", "dummmmmy", "earth", "eevee", "egg", "ensoniq",
  "famicom", "ff4", "ff5", "ff6", "ff7", "ff7demo", "fox", "fzero", "gamecube",
  "gamegear", "gator", "gba", "genesis", "ginger", "golden", "guitar", "harpsichord",
  "hats", "hh", "hi", "homestuck", "hoop", "ht700", "infinity", "jddrums", "juno",
  "junoceleste", "junoflute", "junoguitar", "junoorgan", "k1", "k2", "k3", "kick",
  "kickz", "kirby", "kirbyss", "kirbyssu", "labo", "lego", "livealive", "lozmm",
  "lozoot", "lttp", "m1", "magiccastle", "mariovs", "megalo", "minecraft", "mk64",
  "mkds", "mm", "mm2", "mm7", "mm8", "mm8b", "mmbn5", "mml", "mms", "mmsf3", "mmx",
  "mmx2", "mmx3", "mmx6", "mmxu", "mmzx", "mmzxa", "mother", "mother3", "mother3drum",
  "myst", "n64", "nes", "nsmb", "oboe", "oof", "organ", "organ1", "paint", "party",
  "partyds", "perc", "piano", "pika", "pingu", "plok", "pokbw", "poke", "pokhs",
  "pokmyst", "pokp", "ps", "r8d", "rare", "ray", "ride", "roblo", "rpg", "rug",
  "saa", "sampsynth", "sc55", "sc88", "scratch", "seinfeld", "sgm", "sim", "slay",
  "sm64", "smb", "smba4", "smg", "smk", "smo", "smrpg", "sms", "smsun", "smw",
  "smw1", "snare", "snes", "som", "sonic", "soniccd", "speed", "splash", "squid",
  "steinway", "stick", "sunsoft", "supbomb", "supboy", "supcastle", "supmet",
  "teringherrie", "terra", "tetris", "tmnt", "trumpet", "upright", "valiant", "vib",
  "vibraphone", "vl1", "waffles", "windows"
];

// Active sample list (can be augmented dynamically from sampleMap.json and custom session samples)
let baseSampleList = [...DEFAULT_SAMPLES];
let customSampleNames = [];

export let sampleList = [...DEFAULT_SAMPLES];

function rebuildSampleList() {
  const set = new Set([...baseSampleList, ...customSampleNames]);
  sampleList = Array.from(set).sort();
}

export function registerCustomSampleName(name) {
  if (!customSampleNames.includes(name)) {
    customSampleNames.push(name);
    rebuildSampleList();
  }
}

export function removeCustomSampleName(name) {
  customSampleNames = customSampleNames.filter(n => n !== name);
  rebuildSampleList();
}

export function getCustomSampleNames() {
  return [...customSampleNames];
}

// Load sample map dynamically on startup
const SAMPLE_MAP_URL = "https://raw.githubusercontent.com/combjellly/shift/main/samples/sampleMap.json";

export async function initSampleMap() {
  try {
    const res = await fetch(`${SAMPLE_MAP_URL}?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      const keys = Object.keys(data).sort();
      if (keys.length > 0) {
        baseSampleList = keys;
        rebuildSampleList();
      }
    }
  } catch (err) {
    console.warn("Could not fetch remote sampleMap.json, using default sample list:", err);
  }
}

// Automatically start fetching at module load
initSampleMap();

// CodeMirror completion source for "play.<sample>"
export function sampleCompletionSource(context) {
  const match = context.matchBefore(/play\.([\w-]*)/);
  if (!match) return null;

  return {
    from: match.from + 5, // Immediately after "play."
    options: sampleList.map((name) => ({
      label: name,
      type: "variable",
      detail: customSampleNames.includes(name) ? "custom sample" : "sample"
    })),
    validFor: /^[\w-]*$/
  };
}

