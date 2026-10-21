import React from 'react';

export function Controls({ 
  isPlaying, 
  onTogglePlay, 
  onEvaluate, 
  onNextPreset, 
  status,
  isControllerMode,
  onToggleControllerMode
}) {
  return (
    <div className="controls-container">
      <div className="status-display">
        {status || "Ready"}
      </div>
      <div className="buttons-group">
        <button className="control-btn" onClick={onEvaluate} title="Evaluate (Shift + Space)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-5.67"/></svg>
        </button>
        <button className={`control-btn ${isPlaying ? 'active' : ''}`} onClick={onTogglePlay}>
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>
        <button className="control-btn" onClick={onNextPreset} title="Next Preset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  );
}
