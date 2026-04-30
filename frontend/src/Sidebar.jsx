import React, { useState } from 'react';

export function Sidebar({ isOpen, onClose, onThemeChange }) {
  const [syncDelay, setSyncDelay] = useState(375);
  const [themeColor, setThemeColor] = useState("#434153");

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setThemeColor(newColor);
    onThemeChange(newColor);
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        <div className="sidebar-content">
          <img src="/static/img/logo.png" alt="Shift Logo" className="logo" />
          
          <div className="nav-links">
            <a href="https://shift.nickhernandez.ca/tutorial/intro" target="_blank" rel="noreferrer">About</a>
            <a href="https://shift.nickhernandez.ca/tutorial/category/tutorial---basics" target="_blank" rel="noreferrer">Tutorials</a>
            <a href="http://hdl.handle.net/11375/28305" target="_blank" rel="noreferrer">Thesis</a>
          </div>

          <div className="settings-section">
            <h3>MIDI Sync</h3>
            <div className="input-group">
              <input 
                type="number" 
                value={syncDelay} 
                onChange={e => setSyncDelay(Number(e.target.value))} 
                placeholder="MIDI delay (ms)" 
              />
              <button className="btn">Sync</button>
            </div>
            
            <h3>MIDI Output</h3>
            <select id="midiOutputDropdown" className="dropdown">
              <option>Browser Default</option>
            </select>

            <h3>Theme</h3>
            <input type="color" value={themeColor} onChange={handleColorChange} className="color-picker" />
          </div>

          <p className="description">
            Shift is a beginner friendly live coding language designed to help introduce people to computer music!
          </p>
        </div>
      </div>
    </>
  );
}
