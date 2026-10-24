// Web MIDI Manager for Shift Live Coding Engine

let midiAccess = null;
let selectedOutput = null;
let midisync = parseInt(localStorage.getItem('shift_midisync') || '375', 10);
if (isNaN(midisync)) midisync = 375;

let onOutputsChangedCallback = null;

export function setOutputsChangedCallback(fn) {
  onOutputsChangedCallback = fn;
}

export function getMidiSync() {
  return midisync;
}

export function setMidiSync(ms) {
  const val = parseInt(ms, 10);
  if (!isNaN(val)) {
    midisync = val;
    localStorage.setItem('shift_midisync', String(val));
    console.log('[Shift MIDI] Sync delay set to', midisync, 'ms');
  }
  return midisync;
}

export function getSelectedOutput() {
  return selectedOutput;
}

export function selectOutputById(id) {
  if (!midiAccess) return null;
  const output = midiAccess.outputs.get(id);
  if (output) {
    selectedOutput = output;
    localStorage.setItem('shift_selected_midi_id', id);
    console.log('[Shift MIDI] Selected output:', output.name);
    return output;
  }
  return null;
}

export async function populateMidiOutputDropdown() {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
    const msg = 'Web MIDI API is not supported in this browser.';
    console.warn('[Shift MIDI]', msg);
    return { success: false, error: msg, outputs: [] };
  }

  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    
    // Auto-update when devices are plugged/unplugged
    midiAccess.onstatechange = (e) => {
      console.log('[Shift MIDI] Device state changed:', e.port.name, e.port.state);
      refreshOutputs();
      if (onOutputsChangedCallback) {
        onOutputsChangedCallback(getOutputsList(), selectedOutput ? selectedOutput.id : null);
      }
    };

    const outputs = refreshOutputs();
    return {
      success: true,
      outputs,
      selectedId: selectedOutput ? selectedOutput.id : null
    };
  } catch (err) {
    const msg = 'Error accessing MIDI devices: ' + (err.message || err);
    console.error('[Shift MIDI]', msg);
    return { success: false, error: msg, outputs: [] };
  }
}

function refreshOutputs() {
  if (!midiAccess) return [];
  const outputs = [];
  const savedId = localStorage.getItem('shift_selected_midi_id');
  let matchedSaved = false;

  midiAccess.outputs.forEach((output) => {
    outputs.push({
      id: output.id,
      name: output.name || `MIDI Output (${output.id})`
    });
    if (savedId && output.id === savedId) {
      selectedOutput = output;
      matchedSaved = true;
    }
  });

  // Default to first output if none currently selected or saved
  if (!matchedSaved && outputs.length > 0) {
    if (!selectedOutput || !midiAccess.outputs.has(selectedOutput.id)) {
      selectedOutput = midiAccess.outputs.values().next().value;
    }
  } else if (outputs.length === 0) {
    selectedOutput = null;
  }

  return outputs;
}

export function getOutputsList() {
  if (!midiAccess) return [];
  const list = [];
  midiAccess.outputs.forEach((output) => {
    list.push({
      id: output.id,
      name: output.name || `MIDI Output (${output.id})`
    });
  });
  return list;
}

export function testMidiOutput(note = 60, velocity = 80, duration = 300, channel = 0) {
  if (!selectedOutput) {
    console.warn('[Shift MIDI] No MIDI output selected. Call populateMidiOutputDropdown() first.');
    return { success: false, error: 'No MIDI output selected. Please click "Populate MIDI Output" first.' };
  }

  const ch = Math.min(15, Math.max(0, channel));
  const n = Math.min(127, Math.max(0, note));
  const vel = Math.min(127, Math.max(0, velocity));

  try {
    selectedOutput.send([0x90 + ch, n, vel]);
    setTimeout(() => {
      try {
        selectedOutput.send([0x80 + ch, n, 0]);
      } catch (e) {
        console.error('[Shift MIDI] Note off failed:', e);
      }
    }, duration);

    return { 
      success: true, 
      message: `Sent test note (Note ${n}, Ch ${ch + 1}) to ${selectedOutput.name}` 
    };
  } catch (e) {
    return { success: false, error: 'Failed to send MIDI message: ' + e.message };
  }
}

// Function to play MIDI events from the PureScript engine render loop
export function playMidiEvents(EngineRecord) {
  if (!selectedOutput) {
    return;
  }

  const midiEventsString = String(EngineRecord);
  if (!midiEventsString || midiEventsString === 'Nil' || midiEventsString === '"sleepy time"') {
    return;
  }

  // PureScript lists are formatted like: ({ ... } : { ... } : Nil)
  const messages = midiEventsString.slice(1, -1).split(' : ');
  messages.forEach((message) => {
    if (message !== 'Nil' && message !== 'sleepy time' && message !== 'i') {
      playMidiEvent(message);
    }
  });
}

function playMidiEvent(message) {
  // Ensure that 'Nil' is replaced with null and clean brackets
  const fixedMessage = message.replace(/Nil/g, 'null').replace(/[() ]/g, '');
  
  let parsedMessage;
  try {
    // Convert unquoted keys and values to valid JSON
    parsedMessage = JSON.parse(fixedMessage.replace(/([\w-]+):/g, '"$1":'));
  } catch (error) {
    return;
  }

  const { channel, duration, note, velocity, whenPosix, s } = parsedMessage;

  // Only handle MIDI events (marked by s === 'midimidmidi' or defined channel/note)
  if (s !== 'midimidmidi' && channel === undefined) {
    return;
  }

  const ch = Math.min(15, Math.max(0, Math.floor(Math.abs(channel || 0))));
  const n = Math.min(127, Math.max(0, Math.floor(Math.abs(note !== undefined ? note : 60))));
  const vel = Math.min(127, Math.max(0, Math.floor(Math.abs(velocity !== undefined ? velocity : 64))));
  const dur = Math.max(10, Math.floor(Math.abs(duration || 200)));

  // Calculate delay in milliseconds until the specified POSIX time + midisync offset
  const nowMs = Date.now();
  const targetMs = (whenPosix ? whenPosix * 1000 : nowMs) + midisync;
  const delay = Math.max(0, targetMs - nowMs);

  setTimeout(() => {
    if (!selectedOutput) return;
    try {
      // MIDI Note On
      selectedOutput.send([0x90 + ch, n, vel]);

      // MIDI Note Off after duration
      setTimeout(() => {
        if (!selectedOutput) return;
        try {
          selectedOutput.send([0x80 + ch, n, 0x00]);
        } catch (e) {
          // ignore error if device was disconnected
        }
      }, dur);
    } catch (e) {
      console.error('[Shift MIDI] Send error:', e);
    }
  }, delay);
}

// Global browser window attachment for compatibility with console and legacy scripts
if (typeof window !== 'undefined') {
  window.populateMidiOutputDropdown = populateMidiOutputDropdown;
  window.playMidiEvents = playMidiEvents;
  window.testMidiOutput = testMidiOutput;
  window.updateSync = () => {
    const input = document.getElementById('syncInput');
    if (input) setMidiSync(input.value);
  };
}
