import React, { useEffect, useRef } from 'react';
import { launch, launchDirt, renderStandalone, parse } from './index.js';

const AudioEngine = () => {
  const engineRecordRef = useRef(null);
  const webDirtRef = useRef(null);

  useEffect(() => {
    window.launchNow = launchNow;
    window.doEvaluate = doEvaluate;
    window.render = render;
    window.stop = stop;

    launchNow();

    return () => {
      stop();
    };
  }, []);

  const unlockAudioContext = (audioCtx) => {
    if (audioCtx.state !== 'suspended') return;
    const b = document.body;
    const events = ['touchstart', 'touchend', 'mousedown', 'keydown'];
    events.forEach(e => b.addEventListener(e, unlock, false));
    function unlock() { audioCtx.resume().then(clean); }
    function clean() { events.forEach(e => b.removeEventListener(e, unlock)); }
  };

  const launchNow = () => {
    engineRecordRef.current = launch();
    webDirtRef.current = launchDirt();
    unlockAudioContext(webDirtRef.current);
    // populateMidiOutputDropdown(); // Define this function if needed
    render();
  };

  const doEvaluate = () => {
    const t = document.getElementById("code").value;
    const x = parse(engineRecordRef.current)(t)();
    document.getElementById('status').textContent = x;
  };

  const stop = () => {
    const x = parse(engineRecordRef.current)("")();
    document.getElementById('status').textContent = x;
  };

  const render = () => {
    const disp = renderStandalone(engineRecordRef.current)(webDirtRef.current)();
    //document.getElementById('dog').textContent = disp;
    playMidiEvents(disp); // Define this function if needed
    console.log(disp);
    setTimeout(render, 300);
  };

  return (
    <div>
      <textarea id="code"></textarea>
      <button onClick={doEvaluate}>Evaluate</button>
      <button onClick={stop}>Stop</button>
      <div id="status"></div>
      {/* Add other necessary elements here */}
    </div>
  );
};

export default AudioEngine;
