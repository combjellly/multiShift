import { useState, useEffect, useRef } from 'react';
import { launch, launchDirt, launchSynthEngine, renderStandalone, parse, clearLoopPhases } from './shift.js';
import { playMidiEvents } from './midi.js';
import { 
  setActiveWebDirt, 
  loadCustomSampleFile, 
  removeCustomSample, 
  reloadSampleMap, 
  previewCustomSample, 
  stopPreview,
  getCustomSamples,
  subscribeCustomSamples
} from './sampleManager.js';

export function useEngine() {
  const [engineState, setEngineState] = useState({
    engineRecord: null,
    webDirt: null,
    synthEngine: null,
    hasLaunched: false,
    isPlaying: false
  });
  
  const [status, setStatus] = useState("");
  const loopRef = useRef(null);

  // Expose these refs for MIDI processing if necessary, or keep them local
  const engineRef = useRef(null);
  const hasLaunchedRef = useRef(false);
  const eventListeners = useRef(new Set());

  const subscribeToEvents = (fn) => {
    eventListeners.current.add(fn);
    return () => eventListeners.current.delete(fn);
  };

  const dispatchVisualEvent = (event) => {
    eventListeners.current.forEach(listener => {
      try { listener(event); } catch (e) { console.error(e); }
    });
  };

  const launchNow = (sampleMap = "https://raw.githubusercontent.com/combjellly/shift/main/samples") => {
    if (hasLaunchedRef.current || engineRef.current) {
      // Resume existing audio context if suspended
      if (engineRef.current?.wd?.ac && engineRef.current.wd.ac.state === "suspended") {
        engineRef.current.wd.ac.resume();
      }
      if (engineRef.current?.se?.audioContext && engineRef.current.se.audioContext.state === "suspended") {
        engineRef.current.se.audioContext.resume();
      }
      return;
    }
    hasLaunchedRef.current = true;

    const er = launch();
    const wd = launchDirt(sampleMap)();
    const se = launchSynthEngine();

    // Connect WebDirt to session sample manager
    setActiveWebDirt(wd);

    // Hook WebDirt sample playback
    if (wd && typeof wd.playSample === 'function') {
      const origPlaySample = wd.playSample.bind(wd);
      wd.playSample = function(msg, latency) {
        dispatchVisualEvent({
          s: msg.s || "sample",
          n: msg.n || 0,
          note: msg.note !== undefined ? msg.note : 0,
          gain: msg.gain !== undefined ? msg.gain : 1,
          pan: msg.pan !== undefined ? msg.pan : 0.5,
          begin: msg.begin !== undefined ? msg.begin : 0,
          end: msg.end !== undefined ? msg.end : 1,
          whenPosix: msg.whenPosix,
          latency: latency !== undefined ? latency : (wd.latency || 0.4),
          ac: wd.ac,
          type: 'sample',
          loopId: msg.loopId !== undefined ? msg.loopId : 0
        });
        return origPlaySample(msg, latency);
      };
    }

    // Hook Synth playback
    if (se) {
      se.onPlay = function(msg) {
        dispatchVisualEvent({
          s: "synth",
          n: 0,
          note: msg.note !== undefined ? msg.note : 60,
          gain: msg.gain !== undefined ? msg.gain : 1,
          pan: 0.5,
          whenPosix: msg.whenPosix,
          latency: 0.4,
          ac: se.audioContext,
          type: 'synth',
          loopId: msg.loopId !== undefined ? msg.loopId : 0
        });
      };
    }

    setEngineState({
      engineRecord: er,
      webDirt: wd,
      synthEngine: se,
      hasLaunched: true,
      isPlaying: false
    });
    
    engineRef.current = { er, wd, se };
    
    // Start render loop once
    if (!loopRef.current) {
      const renderLoop = () => {
        if (engineRef.current) {
          const { er, wd, se } = engineRef.current;
          const disp = renderStandalone(er)(wd)(se)();
          if (disp && disp !== 'sleepy time' && disp !== 'Nil') {
            playMidiEvents(disp);
          }
        }
        loopRef.current = setTimeout(renderLoop, 16);
      };
      renderLoop();
    }
  };

  const evaluateCode = (code) => {
    launchNow();
    if (!engineRef.current) return;
    const { er } = engineRef.current;
    const res = parse(er)(code)();
    setStatus(res);
    dispatchVisualEvent({ type: 'compile', code });
    setEngineState(prev => ({ ...prev, isPlaying: true }));
  };

  const stop = () => {
    if (!engineRef.current) return;
    const { er } = engineRef.current;
    if (typeof clearLoopPhases === 'function') {
      try { clearLoopPhases(er)(); } catch (e) { console.error(e); }
    }
    const res = parse(er)("")();
    setStatus(res);
    dispatchVisualEvent({ type: 'stop' });
    setEngineState(prev => ({ ...prev, isPlaying: false }));
  };

  const loadCustomSample = async (file, name) => {
    launchNow();
    const currentWd = engineRef.current?.wd;
    const currentAc = currentWd?.ac || engineRef.current?.se?.audioContext;
    return await loadCustomSampleFile(file, name, currentAc, currentWd);
  };

  const handleReloadSampleMap = async () => {
    return await reloadSampleMap(engineRef.current?.wd);
  };

  const handleRemoveCustomSample = (name) => {
    removeCustomSample(name, engineRef.current?.wd);
  };

  useEffect(() => {
    return () => {
      if (loopRef.current) clearTimeout(loopRef.current);
    };
  }, []);

  return {
    launchNow,
    evaluateCode,
    stop,
    status,
    isPlaying: engineState.isPlaying,
    hasLaunched: engineState.hasLaunched,
    subscribeToEvents,
    loadCustomSample,
    reloadSampleMap: handleReloadSampleMap,
    removeCustomSample: handleRemoveCustomSample,
    previewCustomSample,
    stopPreview,
    getCustomSamples,
    subscribeCustomSamples,
    audioContext: engineState.webDirt?.ac || engineState.synthEngine?.audioContext
  };
}

