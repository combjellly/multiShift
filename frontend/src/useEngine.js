import { useState, useEffect, useRef } from 'react';
import { launch, launchDirt, launchSynthEngine, renderStandalone, parse } from './shift.js';

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

  const launchNow = (sampleMap = "test") => {
    if (engineState.hasLaunched) return;
    
    // Unlock Audio Context on first gesture
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const audioCtx = new AudioContext();
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    }

    const er = launch();
    const wd = launchDirt(sampleMap);
    const se = launchSynthEngine();

    setEngineState({
      engineRecord: er,
      webDirt: wd,
      synthEngine: se,
      hasLaunched: true,
      isPlaying: false
    });
    
    engineRef.current = { er, wd, se };
    
    // Start render loop
    const renderLoop = () => {
      if (engineRef.current) {
        const { er, wd, se } = engineRef.current;
        const disp = renderStandalone(er)(wd)(se)();
        // MIDI handling can be hooked in here if needed:
        // if (typeof navigator.requestMIDIAccess === "function") {
        //   playMidiEvents(disp);
        // }
      }
      loopRef.current = setTimeout(renderLoop, 16);
    };
    
    renderLoop();
  };

  const evaluateCode = (code) => {
    launchNow();
    if (!engineRef.current) return;
    const { er } = engineRef.current;
    const res = parse(er)(code)();
    setStatus(res);
    setEngineState(prev => ({ ...prev, isPlaying: true }));
  };

  const stop = () => {
    if (!engineRef.current) return;
    const { er } = engineRef.current;
    const res = parse(er)("")();
    setStatus(res);
    setEngineState(prev => ({ ...prev, isPlaying: false }));
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
    hasLaunched: engineState.hasLaunched
  };
}
