"use strict";

export const newSynthEngine = function(args) {
  return function() {
    return {
      audioContext: args.audioContext || null,
      posixOffset: 0
    };
  };
};

export const initializeWebAudio = function(synth) {
  return function() {
    if (!synth.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        synth.audioContext = new AudioContext();
      }
    }
    if (synth.audioContext) {
      // AudioContext.currentTime is in seconds.
      // Date.now() is in ms. posix time is in seconds.
      synth.posixOffset = (Date.now() / 1000) - synth.audioContext.currentTime;
    }
  };
};

export const playSynth = function(synth) {
  return function(msg) {
    return function() {
      if (!synth.audioContext) return;
      
      let playTime = msg.whenPosix - synth.posixOffset;
      if (playTime < synth.audioContext.currentTime) {
        playTime = synth.audioContext.currentTime;
      }

      const osc = synth.audioContext.createOscillator();
      const gainNode = synth.audioContext.createGain();

      // Convert MIDI note to frequency: 69 is A4 (440 Hz)
      const freq = 440 * Math.pow(2, (msg.note - 69) / 12);
      osc.frequency.value = freq;
      
      // Default type to 'sine' if not provided (though msg.type will likely be passed if we add it)
      osc.type = msg.type || 'sine';

      // Gain envelope to avoid clicks
      const maxGain = msg.gain || 1.0;
      const duration = msg.duration || 0.5;
      const attack = 0.01;
      const release = 0.05;

      gainNode.gain.setValueAtTime(0, playTime);
      gainNode.gain.linearRampToValueAtTime(maxGain, playTime + attack);
      
      const releaseStartTime = Math.max(playTime + attack, playTime + duration - release);
      gainNode.gain.setValueAtTime(maxGain, releaseStartTime);
      gainNode.gain.linearRampToValueAtTime(0, playTime + duration);

      osc.connect(gainNode);
      gainNode.connect(synth.audioContext.destination);

      osc.start(playTime);
      osc.stop(playTime + duration);
    };
  };
};
