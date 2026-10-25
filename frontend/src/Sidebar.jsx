import React, { useState, useEffect, useRef } from 'react';
import logoImg from './assets/logo.png';
import { 
  populateMidiOutputDropdown, 
  selectOutputById, 
  testMidiOutput, 
  setMidiSync, 
  getMidiSync, 
  setOutputsChangedCallback 
} from './midi';
import { 
  subscribeCustomSamples, 
  sanitizeSampleName 
} from './sampleManager';

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
  onToggleControllerMode,
  onLoadCustomSample,
  onReloadSampleMap,
  onRemoveCustomSample,
  onPreviewSample,
  onStopPreview,
  audioContext,
  onInsertSnippet
}) {
  const [syncDelay, setSyncDelay] = useState(() => getMidiSync());
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem("theme") || "#434153");
  const [midiOutputs, setMidiOutputs] = useState([]);
  const [selectedMidiId, setSelectedMidiId] = useState('');
  const [midiStatus, setMidiStatus] = useState('');
  const [isPopulating, setIsPopulating] = useState(false);

  // Dropdown section accordion open states (default closed)
  const [isVizOpen, setIsVizOpen] = useState(false);
  const [isSampleOpen, setIsSampleOpen] = useState(false);
  const [isMidiOpen, setIsMidiOpen] = useState(false);

  // Sample loading states
  const [customSamples, setCustomSamples] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sampleCustomName, setSampleCustomName] = useState('');
  const [sampleStatus, setSampleStatus] = useState(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isReloadingMap, setIsReloadingMap] = useState(false);
  const [playingPreviewName, setPlayingPreviewName] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeCustomSamples((list) => {
      setCustomSamples(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setOutputsChangedCallback((outputs, activeId) => {
      setMidiOutputs(outputs);
      if (activeId) setSelectedMidiId(activeId);
    });

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

  const handleFilePicked = (file) => {
    if (!file) return;
    setSelectedFile(file);
    const suggested = sanitizeSampleName(file.name);
    setSampleCustomName(suggested);
    setSampleStatus(null);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFilePicked(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilePicked(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleLoadSample = async () => {
    if (!selectedFile) {
      setSampleStatus({ type: 'error', message: 'Please select a WAV file first.' });
      return;
    }
    const cleanName = sanitizeSampleName(sampleCustomName || selectedFile.name);
    if (!cleanName) {
      setSampleStatus({ type: 'error', message: 'Please provide a valid sample name.' });
      return;
    }

    setIsLoadingSample(true);
    setSampleStatus({ type: 'info', message: `Decoding and loading '${cleanName}'...` });

    try {
      if (onLoadCustomSample) {
        const res = await onLoadCustomSample(selectedFile, cleanName);
        if (res && res.success) {
          setSampleStatus({ 
            type: 'success', 
            message: `✓ '${res.name}' loaded! (${res.duration.toFixed(2)}s, ${res.numberOfChannels === 2 ? 'Stereo' : 'Mono'}). Use play.${res.name}[80, 0]` 
          });
          setSelectedFile(null);
          setSampleCustomName('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    } catch (err) {
      setSampleStatus({ type: 'error', message: err.message || 'Failed to load audio sample' });
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleReloadMap = async () => {
    setIsReloadingMap(true);
    setSampleStatus({ type: 'info', message: 'Reloading sample map from repository...' });
    try {
      if (onReloadSampleMap) {
        const res = await onReloadSampleMap();
        setSampleStatus({ 
          type: 'success', 
          message: `Sample map reloaded: ${res.defaultCount} Shift samples + ${res.customCount} custom samples active.` 
        });
      }
    } catch (err) {
      setSampleStatus({ type: 'error', message: err.message || 'Failed to reload sample map' });
    } finally {
      setIsReloadingMap(false);
    }
  };

  const handleTogglePreview = (sample) => {
    if (playingPreviewName === sample.name) {
      if (onStopPreview) onStopPreview();
      setPlayingPreviewName(null);
      return;
    }

    if (sample.variations && sample.variations[0]?.buffer) {
      setPlayingPreviewName(sample.name);
      if (onPreviewSample) {
        onPreviewSample(sample.variations[0].buffer, audioContext, () => {
          setPlayingPreviewName(null);
        });
      }
    }
  };

  const handleRemove = (name) => {
    if (playingPreviewName === name && onStopPreview) {
      onStopPreview();
      setPlayingPreviewName(null);
    }
    if (onRemoveCustomSample) onRemoveCustomSample(name);
  };

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
        setMidiStatus('No MIDI devices found.');
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
            {/* Controller Mode - Clean square toggle without emoji */}
            <div className="setting-item" style={{ marginBottom: '1.25rem' }}>
              <span className="setting-label">CONTROLLER MODE</span>
              <button 
                type="button"
                className={`viz-pill-btn full-width ${isControllerMode ? 'active' : ''}`}
                onClick={() => onToggleControllerMode && onToggleControllerMode()}
              >
                {isControllerMode ? 'ACTIVE' : 'DISABLED'}
              </button>
            </div>

            {/* Visualizer Dropdown Section */}
            <button 
              type="button" 
              className={`gothic-section-header ${isVizOpen ? 'open' : ''}`}
              onClick={() => setIsVizOpen(prev => !prev)}
            >
              <span>VISUALIZER</span>
              <span className="header-arrow">{isVizOpen ? '▲' : '▼'}</span>
            </button>

            {isVizOpen && (
              <div className="section-body">
                <div className="setting-item">
                  <label className="setting-label">Mode</label>
                  <select 
                    className="dropdown"
                    value={vizMode}
                    onChange={(e) => onVizModeChange(e.target.value)}
                  >
                    <option value="circle">Orbit Circle</option>
                    <option value="grid">Moving Grid</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label className="setting-label">
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
                  <div className="setting-item">
                    <label className="setting-label">Scroll Speed</label>
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
              </div>
            )}

            {/* Sample Library Dropdown Section */}
            <button 
              type="button" 
              className={`gothic-section-header ${isSampleOpen ? 'open' : ''}`}
              onClick={() => setIsSampleOpen(prev => !prev)}
            >
              <span>SAMPLE LIBRARY {customSamples.length > 0 ? `(${customSamples.length})` : ''}</span>
              <span className="header-arrow">{isSampleOpen ? '▲' : '▼'}</span>
            </button>

            {isSampleOpen && (
              <div className="section-body">
                <div className="sample-card">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept=".wav,audio/wav,audio/*" 
                    onChange={handleFileInputChange} 
                    style={{ display: 'none' }} 
                  />

                  <div 
                    className={`sample-dropzone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    title="Click or drop a WAV file here"
                  >
                    {selectedFile ? (
                      <div className="sample-file-info">
                        <span className="file-name" title={selectedFile.name}>{selectedFile.name}</span>
                        <span className="file-size">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                      </div>
                    ) : (
                      <div className="sample-prompt">
                        <span>Click or Drop WAV File Here</span>
                      </div>
                    )}
                  </div>

                  {selectedFile && (
                    <div className="sample-name-input-group">
                      <label className="sample-name-label">
                        Identifier: <code>play.{sampleCustomName || 'name'}</code>
                      </label>
                      <div className="input-with-prefix">
                        <span className="prefix">play.</span>
                        <input 
                          type="text" 
                          className="sample-name-field"
                          value={sampleCustomName}
                          onChange={(e) => setSampleCustomName(sanitizeSampleName(e.target.value))}
                          placeholder="e.g. mykick"
                          autoFocus
                        />
                      </div>
                    </div>
                  )}

                  <div className="sample-actions">
                    <button 
                      type="button" 
                      className="btn sample-btn load-btn"
                      onClick={handleLoadSample}
                      disabled={!selectedFile || isLoadingSample}
                    >
                      {isLoadingSample ? 'Loading...' : 'Load Sample'}
                    </button>
                    <button 
                      type="button" 
                      className="btn sample-btn reload-btn"
                      onClick={handleReloadMap}
                      disabled={isReloadingMap}
                      title="Reload default sampleMap.json and re-sync session library"
                    >
                      {isReloadingMap ? 'Reloading...' : 'Reload Map'}
                    </button>
                  </div>

                  {sampleStatus && (
                    <div className={`sample-status-box ${sampleStatus.type}`}>
                      {sampleStatus.message}
                    </div>
                  )}
                </div>

                {/* Session Loaded Samples List */}
                {customSamples.length > 0 && (
                  <div className="custom-samples-container">
                    <div className="custom-samples-header">
                      <span>Loaded Samples ({customSamples.length})</span>
                    </div>
                    <div className="custom-samples-list">
                      {customSamples.map((s) => {
                        const firstVar = s.variations && s.variations[0];
                        const isPlayingThis = playingPreviewName === s.name;
                        return (
                          <div key={s.name} className="custom-sample-row">
                            <div className="sample-row-main">
                              <span className="sample-code-tag">play.{s.name}</span>
                              {firstVar && (
                                <span className="sample-specs">
                                  {firstVar.duration.toFixed(1)}s • {firstVar.numberOfChannels === 2 ? 'Stereo' : 'Mono'}
                                </span>
                              )}
                            </div>
                            <div className="sample-row-actions">
                              <button 
                                type="button" 
                                className={`sample-pill-btn ${isPlayingThis ? 'playing' : ''}`}
                                onClick={() => handleTogglePreview(s)}
                                title={isPlayingThis ? 'Stop Preview' : 'Preview Sample'}
                              >
                                {isPlayingThis ? '■' : '▶'}
                              </button>
                              {onInsertSnippet && (
                                <button 
                                  type="button" 
                                  className="sample-pill-btn insert"
                                  onClick={() => onInsertSnippet(`every 1\n  play.${s.name}[80, 0]`)}
                                  title={`Insert play.${s.name} snippet into code`}
                                >
                                  +Code
                                </button>
                              )}
                              <button 
                                type="button" 
                                className="sample-pill-btn delete"
                                onClick={() => handleRemove(s.name)}
                                title="Remove sample from session"
                              >
                                &times;
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MIDI Settings Dropdown Section */}
            <button 
              type="button" 
              className={`gothic-section-header ${isMidiOpen ? 'open' : ''}`}
              onClick={() => setIsMidiOpen(prev => !prev)}
            >
              <span>MIDI SETTINGS</span>
              <span className="header-arrow">{isMidiOpen ? '▲' : '▼'}</span>
            </button>

            {isMidiOpen && (
              <div className="section-body">
                <div className="setting-item">
                  <label className="setting-label">Output Device</label>
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
                </div>

                <div className="midi-actions">
                  <button 
                    type="button"
                    className="btn midi-btn" 
                    onClick={handlePopulateMidi}
                    disabled={isPopulating}
                  >
                    {isPopulating ? 'Scanning...' : 'Populate MIDI'}
                  </button>
                  <button 
                    type="button"
                    className="btn midi-btn test-btn" 
                    onClick={handleTestMidi}
                  >
                    Test MIDI
                  </button>
                </div>

                {midiStatus && (
                  <div className="midi-status">
                    {midiStatus}
                  </div>
                )}

                <div className="setting-item" style={{ marginTop: '0.85rem' }}>
                  <label className="setting-label">Sync Delay (ms)</label>
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
                </div>
              </div>
            )}

            {/* Theme Section */}
            <div className="setting-item" style={{ marginTop: '1.25rem' }}>
              <span className="setting-label">THEME</span>
              <input 
                type="color" 
                value={themeColor} 
                onChange={handleColorChange} 
                className="color-picker" 
              />
            </div>
          </div>

          <p className="description">
            Shift is a beginner friendly live coding language designed to help introduce people to computer music!
          </p>
        </div>
      </div>
    </>
  );
}
