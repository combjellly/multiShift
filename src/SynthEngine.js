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
      synth.posixOffset = (Date.now() / 1000) - synth.audioContext.currentTime;
    }
  };
};

export const playSynth = function(synth) {
  return function(msg) {
    return function() {
      if (synth.onPlay) {
        try { synth.onPlay(msg); } catch (e) { console.error(e); }
      }
      if (!synth.audioContext) return;
      
      let playTime = msg.whenPosix - synth.posixOffset;
      if (playTime < synth.audioContext.currentTime) {
        playTime = synth.audioContext.currentTime;
      }

      // Initialize master bus with DynamicsCompressor (limiter) for anti-clipping headroom
      if (!synth.masterGain) {
        const comp = synth.audioContext.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-1.0, synth.audioContext.currentTime);
        comp.knee.setValueAtTime(3.0, synth.audioContext.currentTime);
        comp.ratio.setValueAtTime(20.0, synth.audioContext.currentTime);
        comp.attack.setValueAtTime(0.001, synth.audioContext.currentTime);
        comp.release.setValueAtTime(0.05, synth.audioContext.currentTime);

        const masterGain = synth.audioContext.createGain();
        masterGain.gain.setValueAtTime(0.35, synth.audioContext.currentTime);

        masterGain.connect(comp);
        comp.connect(synth.audioContext.destination);

        synth.masterGain = masterGain;
        synth.masterCompressor = comp;
        synth.voices = new Map();
      }

      // Voice allocation by loopId: each play.synth is an independent voice
      const voiceId = msg.loopId !== undefined ? msg.loopId : 0;
      if (synth.voices) {
        const prevVoice = synth.voices.get(voiceId);
        if (prevVoice && prevVoice.gainNode) {
          try {
            // Smoothly release the previous note on this specific voice to prevent phasing / constructive clipping
            const fadeTime = Math.min(0.015, (msg.duration || 0.4) * 0.1);
            prevVoice.gainNode.gain.cancelScheduledValues(playTime);
            prevVoice.gainNode.gain.setValueAtTime(prevVoice.gainNode.gain.value, playTime);
            prevVoice.gainNode.gain.linearRampToValueAtTime(0.0001, playTime + fadeTime);
            prevVoice.osc.stop(playTime + fadeTime + 0.005);
          } catch (e) {}
        }
      }

      const osc = synth.audioContext.createOscillator();
      const gainNode = synth.audioContext.createGain();

      // Convert MIDI note to frequency: 69 is A4 (440 Hz)
      const noteNum = (typeof msg.note === 'number' && !isNaN(msg.note)) ? msg.note : 60;
      const freq = 440 * Math.pow(2, (noteNum - 69) / 12);
      osc.frequency.setValueAtTime(freq, playTime);
      osc.type = msg.type || 'sine';

      // Gain envelope with headroom
      const rawGain = (typeof msg.gain === 'number' && !isNaN(msg.gain)) ? msg.gain : 0.8;
      const maxGain = Math.min(1.2, Math.max(0.0, rawGain));
      const duration = msg.duration || 0.45;
      const attack = 0.008;
      const release = Math.min(0.06, duration * 0.25);

      gainNode.gain.setValueAtTime(0.0001, playTime);
      gainNode.gain.linearRampToValueAtTime(maxGain, playTime + attack);
      
      const releaseStartTime = Math.max(playTime + attack, playTime + duration - release);
      gainNode.gain.setValueAtTime(maxGain, releaseStartTime);
      gainNode.gain.linearRampToValueAtTime(0.0001, playTime + duration);

      osc.connect(gainNode);
      gainNode.connect(synth.masterGain);

      osc.start(playTime);
      osc.stop(playTime + duration + 0.01);

      if (synth.voices) {
        synth.voices.set(voiceId, { osc, gainNode, stopTime: playTime + duration });
      }
    };
  };
};
