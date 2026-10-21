import React, { useState, useEffect } from 'react';
import { Editor } from './Editor';
import { Controls } from './Controls';
import { Sidebar } from './Sidebar';
import { useEngine } from './useEngine';
import { Visualizer } from './Visualizer';
import { presets } from './presets';
import './index.css';

function App() {
  const { evaluateCode, stop, isPlaying, status, subscribeToEvents } = useEngine();
  const [code, setCode] = useState(presets.script0);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [presetIndex, setPresetIndex] = useState(0);
  const [isControllerMode, setIsControllerMode] = useState(false);

  // Visualizer settings state (persisted in localStorage)
  const [vizMode, setVizMode] = useState(() => localStorage.getItem('shift_viz_mode') || 'circle');
  const [vizOpacity, setVizOpacity] = useState(() => {
    const saved = localStorage.getItem('shift_viz_opacity');
    return saved !== null ? parseFloat(saved) : 0.65;
  });
  const [vizSpeed, setVizSpeed] = useState(380);

  const handleVizModeChange = (newMode) => {
    setVizMode(newMode);
    localStorage.setItem('shift_viz_mode', newMode);
  };

  const handleVizOpacityChange = (newOpacity) => {
    setVizOpacity(newOpacity);
    localStorage.setItem('shift_viz_opacity', newOpacity);
  };

  useEffect(() => {
    // Load from hash or local storage
    if (window.location.hash) {
      try {
        const hashedCode = window.location.hash.substring(1);
        const decodedCode = atob(hashedCode.replace(/-/g, '+').replace(/_/g, '/'));
        setCode(decodedCode);
      } catch (e) {
        console.error("Invalid hash");
      }
    } else {
      const savedCode = localStorage.getItem("program");
      if (savedCode) {
        setCode(savedCode);
      }
    }

    const savedTheme = localStorage.getItem("theme") || "#434153";
    applyTheme(savedTheme);
  }, []);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    localStorage.setItem("program", newCode);
  };

  const handleEvaluate = (codeToRun = code) => {
    evaluateCode(codeToRun);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      stop();
    } else {
      handleEvaluate();
    }
  };

  const handleNextPreset = () => {
    const presetKeys = Object.keys(presets);
    const nextIndex = (presetIndex + 1) % presetKeys.length;
    setPresetIndex(nextIndex);
    const newCode = presets[presetKeys[nextIndex]];
    setCode(newCode);
    localStorage.setItem("program", newCode);
  };

  const applyTheme = (bgHex) => {
    document.body.style.backgroundColor = bgHex;
    document.documentElement.style.setProperty('--bg-color', bgHex);
    // Simple lightness check for contrast
    const r = parseInt(bgHex.slice(1, 3), 16) || 0;
    const g = parseInt(bgHex.slice(3, 5), 16) || 0;
    const b = parseInt(bgHex.slice(5, 7), 16) || 0;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    
    if (luma < 128) {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    }
    localStorage.setItem("theme", bgHex);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt + C toggles controller mode
      if (e.altKey && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
        e.preventDefault();
        setIsControllerMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-container">
      {/* Background Generative Sequencer Visualizer */}
      <Visualizer 
        subscribeToEvents={subscribeToEvents} 
        isPlaying={isPlaying} 
        mode={vizMode}
        opacity={vizOpacity}
        speed={vizSpeed}
      />

      <button className="menu-btn floating-top-right" onClick={() => setSidebarOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>

      <main className="main-content">
        <Editor 
          code={code} 
          onChange={handleCodeChange} 
          onEvaluate={handleEvaluate} 
          isControllerMode={isControllerMode}
          onToggleControllerMode={() => setIsControllerMode(prev => !prev)}
        />
      </main>

      <Controls 
        isPlaying={isPlaying} 
        onTogglePlay={handleTogglePlay} 
        onEvaluate={() => handleEvaluate(code)}
        onNextPreset={handleNextPreset}
        status={status}
        isControllerMode={isControllerMode}
        onToggleControllerMode={() => setIsControllerMode(prev => !prev)}
      />

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onThemeChange={applyTheme}
        vizMode={vizMode}
        onVizModeChange={handleVizModeChange}
        vizOpacity={vizOpacity}
        onVizOpacityChange={handleVizOpacityChange}
        vizSpeed={vizSpeed}
        onVizSpeedChange={setVizSpeed}
        isControllerMode={isControllerMode}
        onToggleControllerMode={() => setIsControllerMode(prev => !prev)}
      />
    </div>
  );
}

export default App;
