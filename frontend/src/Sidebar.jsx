import React, { useState, useEffect } from 'react';
import logoImg from './assets/logo.png';
import { 
  populateMidiOutputDropdown, 
  selectOutputById, 
  testMidiOutput, 
  setMidiSync, 
  getMidiSync, 
  setOutputsChangedCallback 
} from './midi';

export function Sidebar({ 
  isOpen, 
  onClose, 
  onThemeChange,
  vizMode,
  onVizModeChange,
  vizOpacity,
  onVizOpacityChange,
  vizSpeed,
  onVizSpeedChange,
  isControllerMode,
  onToggleControllerMode
}) {
  const [syncDelay, setSyncDelay] = useState(() => getMidiSync());
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem("theme") || "#434153");
  const [midiOutputs, setMidiOutputs] = useState([]);
  const [selectedMidiId, setSelectedMidiId] = useState('');
  const [midiStatus, setMidiStatus] = useState('');
  const [isPopulating, setIsPopulating] = useState(false);

  useEffect(() => {
    setOutputsChangedCallback((outputs, activeId) => {
      setMidiOutputs(outputs);
      if (activeId) setSelectedMidiId(activeId);
    });

    // Check if MIDI permission was already granted previously
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'midi', sysex: false }).then((perm) => {
        if (perm.state === 'granted') {
          populateMidiOutputDropdown().then((res) => {
            if (res.success) {
              setMidiOutputs(res.outputs);
              if (res.selectedId) setSelectedMidiId(res.selectedId);
            }
          });
        }
      }).catch(() => {});
    }
  }, []);

  const handlePopulateMidi = async () => {
    setIsPopulating(true);
    setMidiStatus('Scanning for MIDI devices...');
    const res = await populateMidiOutputDropdown();
    setIsPopulating(false);
    if (res.success) {
      setMidiOutputs(res.outputs);
      if (res.selectedId) {
        setSelectedMidiId(res.selectedId);
      }
      if (res.outputs.length === 0) {
        setMidiStatus('No MIDI devices found. Please connect your hardware or virtual MIDI port.');
      } else {
        setMidiStatus(`Found ${res.outputs.length} MIDI output${res.outputs.length > 1 ? 's' : ''}`);
      }
    } else {
      setMidiStatus(res.error || 'Failed to access MIDI');
    }
  };

  const handleSelectMidi = (e) => {
    const id = e.target.value;
    setSelectedMidiId(id);
    const chosen = selectOutputById(id);
    if (chosen) {
      setMidiStatus(`Selected: ${chosen.name}`);
    }
  };

  const handleTestMidi = () => {
    const res = testMidiOutput();
    if (res.success) {
      setMidiStatus(res.message);
    } else {
      setMidiStatus(res.error);
    }
  };

  const handleApplySync = () => {
    const applied = setMidiSync(syncDelay);
    setMidiStatus(`MIDI sync delay set to ${applied} ms`);
  };

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setThemeColor(newColor);
    if (onThemeChange) onThemeChange(newColor);
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        <div className="sidebar-content">
          <img src={logoImg} alt="Shift Logo" className="logo" />
          
          <div className="nav-links">
            <a href="https://shift.nickhernandez.ca/tutorial/intro" target="_blank" rel="noreferrer">About</a>
            <a href="https://shift.nickhernandez.ca/tutorial/category/tutorial---basics" target="_blank" rel="noreferrer">Tutorials</a>
            <a href="http://hdl.handle.net/11375/28305" target="_blank" rel="noreferrer">Thesis</a>
          </div>

          <div className="settings-section">
            <h3>Visualizer</h3>
            <div className="setting-item">
              <div className="viz-toggle-pills">
                <button 
                  className={`viz-pill-btn ${vizMode === 'circle' ? 'active' : ''}`}
                  onClick={() => onVizModeChange('circle')}
                >
                  Orbit Circle
                </button>
                <button 
                  className={`viz-pill-btn ${vizMode === 'grid' ? 'active' : ''}`}
                  onClick={() => onVizModeChange('grid')}
                >
                  Moving Grid
                </button>
              </div>
            </div>

            <div className="setting-item" style={{ marginTop: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.35rem', opacity: 0.8 }}>
                Opacity ({Math.round(vizOpacity * 100)}%)
              </label>
              <div className="viz-toggle-pills">
                {[0.25, 0.5, 0.75, 1.0].map((val) => (
                  <button
                    key={val}
                    className={`viz-pill-btn mini ${Math.abs(vizOpacity - val) < 0.05 ? 'active' : ''}`}
                    onClick={() => onVizOpacityChange(val)}
                  >
                    {Math.round(val * 100)}%
                  </button>
                ))}
                <button
                  className={`viz-pill-btn mini ${vizOpacity === 0 ? 'active' : ''}`}
                  onClick={() => onVizOpacityChange(0)}
                >
                  Off
                </button>
              </div>
            </div>

            {vizMode === 'grid' && (
              <div className="setting-item" style={{ marginTop: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.35rem', opacity: 0.8 }}>
                  Scroll Speed
                </label>
                <input 
                  type="range"
                  min="200"
                  max="600"
                  step="20"
                  value={vizSpeed}
                  onChange={(e) => onVizSpeedChange(parseInt(e.target.value))}
                  className="viz-slider"
                />
              </div>
            )}

            <h3 style={{ marginTop: '1.5rem' }}>Controller Mode</h3>
            <div className="setting-item">
              <div className="viz-toggle-pills">
                <button 
                  className={`viz-pill-btn ${isControllerMode ? 'active' : ''}`}
                  onClick={() => onToggleControllerMode && onToggleControllerMode()}
                >
                  {isControllerMode ? '🎮 Active' : '🎮 Disabled'}
                </button>
              </div>
            </div>

            <h3 style={{ marginTop: '1.5rem' }}>MIDI Output</h3>
            <select 
              id="midiOutputDropdown" 
              className="dropdown"
              value={selectedMidiId}
              onChange={handleSelectMidi}
            >
              {midiOutputs.length === 0 ? (
                <option value="">No MIDI Outputs (Click Populate)</option>
              ) : (
                midiOutputs.map((out) => (
                  <option key={out.id} value={out.id}>
                    {out.name}
                  </option>
                ))
              )}
            </select>

            <div className="midi-actions">
              <button 
                type="button"
                className="btn midi-btn" 
                onClick={handlePopulateMidi}
                disabled={isPopulating}
              >
                {isPopulating ? 'Scanning...' : 'Populate MIDI Output'}
              </button>
              <button 
                type="button"
                className="btn midi-btn test-btn" 
                onClick={handleTestMidi}
              >
                Test MIDI Output
              </button>
            </div>

            {midiStatus && (
              <div className="midi-status">
                {midiStatus}
              </div>
            )}

            <h3 style={{ marginTop: '1.2rem' }}>MIDI Sync</h3>
            <div className="input-group">
              <input 
                id="syncInput"
                type="number" 
                value={syncDelay} 
                onChange={e => setSyncDelay(e.target.value)} 
                placeholder="MIDI delay (ms)" 
              />
              <button type="button" className="btn" onClick={handleApplySync}>Sync</button>
            </div>

            <h3 style={{ marginTop: '1.5rem' }}>Theme</h3>
            <input 
              type="color" 
              value={themeColor} 
              onChange={handleColorChange} 
              className="color-picker" 
            />
          </div>

          <p className="description">
            Shift is a beginner friendly live coding language designed to help introduce people to computer music!
          </p>
        </div>
      </div>
    </>
  );
}
