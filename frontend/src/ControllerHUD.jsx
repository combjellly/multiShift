import React, { useState, useEffect, useRef } from 'react';
import { sampleList } from './samples.js';
import { getKnownVariables, generateRandomVariableName } from './controllerEngine.js';

export function ControllerHUD({
  isActive,
  onToggle,
  currentToken,
  isHoldingS,
  isDMenuOpen,
  onCloseDMenu,
  onSelectDMenuItem,
  code,
  cursorCoords
}) {
  const [activeCategory, setActiveCategory] = useState('statements');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const menuRef = useRef(null);

  const knownVariables = getKnownVariables(code);

  // Menu items grouped by category
  const categories = [
    { id: 'statements', label: '➕ Statements' },
    { id: 'samples', label: '🎵 Samples' },
    { id: 'variables', label: '🏷️ Variables' },
    { id: 'values', label: '🔢 Values' }
  ];

  const getItemsForCategory = () => {
    switch (activeCategory) {
      case 'statements':
        return [
          { type: 'snippet', label: 'every 1', detail: 'loop block', code: 'every 1\n  play.gba[80, 60]\n' },
          { type: 'snippet', label: 'every 0.5', detail: 'fast loop block', code: 'every 0.5\n  play.synth[80, 40]\n' },
          { type: 'snippet', label: 'play.gba', detail: 'sample play', code: 'play.gba[80, 60]' },
          { type: 'snippet', label: 'play.synth', detail: 'synth voice', code: 'play.synth[80, 60]' },
          { type: 'snippet', label: 'if [ ... ]', detail: 'conditional', code: 'if x > 5 [\n  play.gba\n]' },
          { type: 'snippet', label: 'seq = [ ... ]', detail: 'sequence', code: 'scale = [60, 62, 64, 67]' },
          { type: 'snippet', label: 'random.[ ... ]', detail: 'random choice', code: 'r = random.[1, 2, 4]' }
        ];
      case 'samples':
        return sampleList.slice(0, 40).map(s => ({
          type: 'sample',
          label: s,
          detail: 'sample',
          code: `play.${s}[80, 60]`
        }));
      case 'variables': {
        const items = [
          {
            type: 'snippet',
            label: 'example_variable = 1',
            detail: 'variable definition',
            code: 'example_variable = 1\n'
          },
          {
            type: 'action',
            action: 'random_var',
            label: '🎲 Generate Random Variable = 1',
            detail: 'new variable definition'
          },
          {
            type: 'snippet',
            label: 'tempo = 1',
            detail: 'variable definition',
            code: 'tempo = 1\n'
          },
          {
            type: 'snippet',
            label: 'pitch = 60',
            detail: 'variable definition',
            code: 'pitch = 60\n'
          }
        ];
        knownVariables.forEach(v => {
          items.push({
            type: 'variable',
            label: v,
            detail: 'variable token',
            code: v
          });
        });
        return items;
      }
      case 'values':
        return [
          { type: 'number', label: '0.25', detail: '16th note', code: '0.25' },
          { type: 'number', label: '0.5', detail: '8th note', code: '0.5' },
          { type: 'number', label: '1', detail: 'quarter note', code: '1' },
          { type: 'number', label: '2', detail: 'half note', code: '2' },
          { type: 'number', label: '40', detail: 'E2 bass note', code: '40' },
          { type: 'number', label: '60', detail: 'C4 middle C', code: '60' },
          { type: 'number', label: '80', detail: 'gain 80', code: '80' }
        ];
      default:
        return [];
    }
  };

  const currentItems = getItemsForCategory();

  // Reset selected item index on category switch or menu open
  useEffect(() => {
    setSelectedIdx(0);
  }, [activeCategory, isDMenuOpen]);

  // Handle keyboard navigation inside D menu
  useEffect(() => {
    if (!isDMenuOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIdx(prev => (prev + 1) % currentItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIdx(prev => (prev - 1 + currentItems.length) % currentItems.length);
      } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const catIdx = categories.findIndex(c => c.id === activeCategory);
        setActiveCategory(categories[(catIdx + 1) % categories.length].id);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        const catIdx = categories.findIndex(c => c.id === activeCategory);
        setActiveCategory(categories[(catIdx - 1 + categories.length) % categories.length].id);
      } else if (e.key.toLowerCase() === 'w' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const chosen = currentItems[selectedIdx];
        if (chosen) {
          if (chosen.action === 'random_var') {
            const newVar = generateRandomVariableName(code);
            onSelectDMenuItem({
              type: 'snippet',
              code: `${newVar} = 60\n`,
              label: newVar
            });
          } else {
            onSelectDMenuItem(chosen);
          }
        }
      } else if (e.key.toLowerCase() === 'a' || e.key === 'Escape' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        e.stopPropagation();
        onCloseDMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isDMenuOpen, currentItems, selectedIdx, activeCategory]);

  if (!isActive) return null;

  return (
    <>
      {/* Floating Controller HUD Bar */}
      <div className={`controller-hud active`}>
        <div className="controller-hud-header">
          <button 
            className={`controller-toggle-btn ${isActive ? 'active' : ''}`}
            onClick={onToggle}
            title="Toggle Controller Mode (Esc or Click)"
          >
            <span className="controller-icon">🎮</span>
            <span className="controller-title">CONTROLLER MODE</span>
            <span className={`controller-pill ${isActive ? 'on' : 'off'}`}>
              {isActive ? 'ACTIVE' : 'OFF'}
            </span>
          </button>

          {isActive && (
            <div className="controller-status-info">
              {currentToken ? (
                <div className={`token-badge ${isHoldingS ? 'holding-s' : ''}`}>
                  <span className="token-type">{currentToken.type.toUpperCase()}:</span>
                  <span className="token-val">{currentToken.text}</span>
                  {isHoldingS && (
                    <span className="token-scrub-hint">⚡ [HOLDING S: SCRUB WITH ARROWS]</span>
                  )}
                </div>
              ) : (
                <span className="no-token-hint">NAVIGATE WITH ARROWS</span>
              )}
            </div>
          )}
        </div>

        {isActive && (
          <div className="controller-hud-legend">
            <span className="legend-item"><kbd>Arrows</kbd> Move</span>
            <span className="legend-item"><kbd>Q</kbd> Line Up</span>
            <span className="legend-item"><kbd>R</kbd> Line Down</span>
            <span className="legend-item highlight-s"><kbd>Hold S + Arrows</kbd> Scrub Value</span>
            <span className="legend-item highlight-d"><kbd>D</kbd> Add Token</span>
            <span className="legend-item highlight-a"><kbd>A</kbd> Delete</span>
            <span className="legend-item highlight-w"><kbd>W</kbd> Confirm</span>
          </div>
        )}
      </div>

      {/* D Dropdown Token Menu */}
      {isActive && isDMenuOpen && (
        <div 
          className="controller-d-menu-overlay"
          onClick={onCloseDMenu}
        >
          <div 
            ref={menuRef}
            className="controller-d-menu"
            onClick={e => e.stopPropagation()}
            style={{
              top: cursorCoords ? `${Math.min(window.innerHeight - 340, Math.max(70, cursorCoords.bottom + 10))}px` : '35%',
              left: cursorCoords ? `${Math.min(window.innerWidth - 380, Math.max(40, cursorCoords.left))}px` : '35%'
            }}
          >
            <div className="d-menu-header">
              <span className="d-menu-title">⚡ CREATE TOKEN / INSERT (D)</span>
              <span className="d-menu-shortcuts"><kbd>W</kbd> Confirm &bull; <kbd>A</kbd> Close</span>
            </div>

            {/* Category Tabs */}
            <div className="d-menu-tabs">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`d-menu-tab ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Item List */}
            <div className="d-menu-list">
              {currentItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`d-menu-item ${idx === selectedIdx ? 'selected' : ''}`}
                  onClick={() => {
                    if (item.action === 'random_var') {
                      const newVar = generateRandomVariableName(code);
                      onSelectDMenuItem({
                        type: 'snippet',
                        code: `${newVar} = 60\n`,
                        label: newVar
                      });
                    } else {
                      onSelectDMenuItem(item);
                    }
                  }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                >
                  <div className="item-label-group">
                    <span className="item-label">{item.label}</span>
                    <span className="item-detail">{item.detail}</span>
                  </div>
                  {idx === selectedIdx && (
                    <span className="item-confirm-hint">Press <kbd>W</kbd></span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
