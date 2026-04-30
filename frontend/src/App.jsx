import React, { useState, useEffect } from 'react';
import { Editor } from './Editor';
import { Controls } from './Controls';
import { Sidebar } from './Sidebar';
import { useEngine } from './useEngine';
import { presets } from './presets';
import './index.css';

function App() {
  const { evaluateCode, stop, isPlaying, status } = useEngine();
  const [code, setCode] = useState(presets.script0);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [presetIndex, setPresetIndex] = useState(0);

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

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      applyTheme(savedTheme);
    }
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
    // Simple lightness check for contrast (rudimentary)
    const r = parseInt(bgHex.slice(1, 3), 16);
    const g = parseInt(bgHex.slice(3, 5), 16);
    const b = parseInt(bgHex.slice(5, 7), 16);
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

  return (
    <div className="app-container">
      <button className="menu-btn floating-top-right" onClick={() => setSidebarOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>

      <main className="main-content">
        <Editor code={code} onChange={handleCodeChange} onEvaluate={handleEvaluate} />
      </main>

      <Controls 
        isPlaying={isPlaying} 
        onTogglePlay={handleTogglePlay} 
        onEvaluate={() => handleEvaluate(code)}
        onNextPreset={handleNextPreset}
        status={status}
      />

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onThemeChange={applyTheme}
      />
    </div>
  );
}

export default App;
