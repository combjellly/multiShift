import React, { useEffect, useRef, useState, useMemo } from 'react';
import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { EditorView, keymap, Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { autocompletion, startCompletion, completionKeymap } from '@codemirror/autocomplete';
import { shiftLanguage } from './shift-grammar';
import { sampleCompletionSource } from './samples';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import * as Y from 'yjs';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import { database } from './firebase';
import { FirebaseProvider } from './firebase-yjs';
import { 
  tokenizeShiftCode, 
  modifyNumberToken, 
  modifySampleToken, 
  modifyOperatorToken, 
  deleteToken 
} from './controllerEngine';
import { ControllerHUD } from './ControllerHUD';

// Custom syntax highlighting colors for Shift dynamically bound to theme CSS variables
const shiftHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: 'var(--token-comment, #94a3b8)', fontStyle: 'italic' },
  { tag: t.string, color: 'var(--token-string, #4ade80)' },
  { tag: t.number, color: 'var(--token-number, #fbbf24)' },
  { tag: t.operator, color: 'var(--token-operator, #38bdf8)' },
  { tag: t.keyword, color: 'var(--token-keyword, #c084fc)', fontWeight: '600' },
]);

// StateEffect and StateField for Controller Mode token highlight
export const setControllerHighlight = StateEffect.define();

const controllerHighlightField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setControllerHighlight)) {
        if (!e.value) {
          return Decoration.none;
        }
        const { from, to, isScrubbing } = e.value;
        const docLen = tr.newDoc.length;
        if (
          typeof from !== 'number' ||
          typeof to !== 'number' ||
          isNaN(from) ||
          isNaN(to) ||
          from < 0 ||
          to > docLen ||
          from >= to
        ) {
          return Decoration.none;
        }
        const className = isScrubbing 
          ? "cm-controller-token cm-controller-token-scrubbing" 
          : "cm-controller-token cm-controller-token-selected";
        try {
          return Decoration.set([
            Decoration.mark({ class: className }).range(from, to)
          ]);
        } catch (err) {
          return Decoration.none;
        }
      }
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(f)
});

// Helper navigation functions across lines (skipping empty_line tokens)
function findTokenAbove(tokens, currentToken) {
  if (!currentToken || tokens.length === 0) return 0;
  const prevLineTokens = tokens.filter(t => t.line === currentToken.line - 1 && t.type !== 'empty_line' && t.start < t.end);
  if (prevLineTokens.length > 0) {
    let best = prevLineTokens[0];
    let minDist = Math.abs(best.col - currentToken.col);
    for (const t of prevLineTokens) {
      const dist = Math.abs(t.col - currentToken.col);
      if (dist < minDist) {
        minDist = dist;
        best = t;
      }
    }
    return tokens.indexOf(best);
  }
  const upperTokens = tokens.filter(t => t.line < currentToken.line && t.type !== 'empty_line' && t.start < t.end);
  if (upperTokens.length > 0) {
    return tokens.indexOf(upperTokens[upperTokens.length - 1]);
  }
  return tokens.indexOf(currentToken);
}

function findTokenBelow(tokens, currentToken) {
  if (!currentToken || tokens.length === 0) return 0;
  const nextLineTokens = tokens.filter(t => t.line === currentToken.line + 1 && t.type !== 'empty_line' && t.start < t.end);
  if (nextLineTokens.length > 0) {
    let best = nextLineTokens[0];
    let minDist = Math.abs(best.col - currentToken.col);
    for (const t of nextLineTokens) {
      const dist = Math.abs(t.col - currentToken.col);
      if (dist < minDist) {
        minDist = dist;
        best = t;
      }
    }
    return tokens.indexOf(best);
  }
  const lowerTokens = tokens.filter(t => t.line > currentToken.line && t.type !== 'empty_line' && t.start < t.end);
  if (lowerTokens.length > 0) {
    return tokens.indexOf(lowerTokens[0]);
  }
  return tokens.indexOf(currentToken);
}

function findFirstTokenOnPrevLine(tokens, currentToken) {
  if (!currentToken || tokens.length === 0) return 0;
  for (let l = currentToken.line - 1; l >= 0; l--) {
    const t = tokens.find(tok => tok.line === l && tok.type !== 'empty_line' && tok.start < tok.end);
    if (t) return tokens.indexOf(t);
  }
  return tokens.indexOf(currentToken);
}

function findFirstTokenOnNextLine(tokens, currentToken) {
  if (!currentToken || tokens.length === 0) return 0;
  const maxLine = tokens[tokens.length - 1].line;
  for (let l = currentToken.line + 1; l <= maxLine; l++) {
    const t = tokens.find(tok => tok.line === l && tok.type !== 'empty_line' && tok.start < tok.end);
    if (t) return tokens.indexOf(t);
  }
  return tokens.indexOf(currentToken);
}

// Widget for the Mute Toggle Circle
class MuteWidget extends WidgetType {
  constructor(isCommented, blockStart, blockText, view) {
    super();
    this.isCommented = isCommented;
    this.blockStart = blockStart;
    this.blockText = blockText;
    this.view = view;
  }
  toDOM() {
    const div = document.createElement("div");
    div.className = "click-zone";
    if (this.isCommented) {
      div.style.backgroundColor = "transparent";
      div.style.opacity = "0.5";
    }
    div.title = this.isCommented ? "Unmute block" : "Mute block";
    div.onclick = (e) => {
       e.preventDefault();
       let newText = "";
       let uncommented = this.blockText.replace(/^\s*\{\-\s*/, '').replace(/\s*\-\}\s*$/, '');
       if (this.isCommented) {
          newText = uncommented;
          if (!newText.endsWith('\n')) newText += '\n';
       } else {
          const match = this.blockText.match(/([\s\S]*?)(\n*)$/);
          const mainText = match ? match[1] : this.blockText;
          const trailingNewlines = match ? match[2] : '';
          newText = `{- ${mainText} -}${trailingNewlines}`;
       }
       this.view.dispatch({
         changes: { from: this.blockStart, to: this.blockStart + this.blockText.length, insert: newText }
       });
    };
    return div;
  }
}

// Plugin to draw line borders and mute widgets
const mutePlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.buildDecorations(view);
  }
  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }
  buildDecorations(view) {
    const builder = new RangeSetBuilder();
    const docText = view.state.doc.toString();
    const blocks = docText.split(/(?=^\s*(?:\{\-\s*)?every\b)/gm);
    
    const decos = [];
    let pos = 0;
    
    for (let i = 0; i < blocks.length; i++) {
      const blockText = blocks[i];
      const isCommented = /^\s*\{\-\s*every[\s\S]*\-\}\s*$/.test(blockText);
      const isEvery = /^\s*\bevery\b/.test(blockText);
      
      if (isEvery || isCommented) {
         const lines = blockText.split('\n');
         let linePos = pos;
         
         for (let j = 0; j < lines.length; j++) {
            if (linePos < view.state.doc.length || (linePos === 0 && view.state.doc.length === 0)) {
               decos.push({
                 from: linePos,
                 to: linePos,
                 deco: Decoration.line({ class: "every-block " + (isCommented ? "commented" : "") })
               });
            }
            if (j === 0) {
               const firstLineEnd = linePos + lines[0].length;
               decos.push({
                 from: firstLineEnd,
                 to: firstLineEnd,
                 deco: Decoration.widget({
                   widget: new MuteWidget(isCommented, pos, blockText, view),
                   side: 1
                 })
               });
            }
            linePos += lines[j].length + 1;
         }
      }
      pos += blockText.length;
    }
    
    // RangeSetBuilder requires sorted ranges
    decos.sort((a, b) => {
        if (a.from === b.from) {
             const aIsLine = a.deco.spec.class !== undefined;
             const bIsLine = b.deco.spec.class !== undefined;
             if (aIsLine && !bIsLine) return -1;
             if (!aIsLine && bIsLine) return 1;
             return 0;
        }
        return a.from - b.from;
    });
    
    for (const d of decos) {
       builder.add(d.from, d.to, d.deco);
    }
    return builder.finish();
  }
}, {
  decorations: v => v.decorations
});

export function Editor({ 
  code, 
  onChange, 
  onEvaluate, 
  isControllerMode = false, 
  onToggleControllerMode = () => {} 
}) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const ydocRef = useRef(null);
  const isInitialSyncDone = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  // Controller Mode state
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const [isHoldingS, setIsHoldingS] = useState(false);
  const [isDMenuOpen, setIsDMenuOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState(null);

  // Compute tokens from current code
  const tokens = useMemo(() => tokenizeShiftCode(code), [code]);
  const currentToken = (tokens && tokens.length > 0) 
    ? tokens[Math.min(selectedTokenIdx, tokens.length - 1)] 
    : null;

  const onEvaluateRef = useRef(onEvaluate);
  useEffect(() => {
    onEvaluateRef.current = onEvaluate;
  }, [onEvaluate]);

  // Initialize CodeMirror and Yjs only once
  useEffect(() => {
    if (!editorRef.current) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const ytext = ydoc.getText('codemirror');

    // Localhost can read all live production code from shift_collaboration in real-time,
    // but only the official production domain writes back to the database.
    const isProduction = typeof window !== 'undefined' && 
      window.location.hostname === 'combjellly.github.io';
    const isReadOnly = !isProduction;

    const provider = new FirebaseProvider(database, 'shift_collaboration', ydoc, isReadOnly);

    let view = null;
    let cancelled = false;

    provider.ready.then(() => {
      if (cancelled || !editorRef.current) return;

      const onEvaluateKey = keymap.of([
        {
          key: "Shift-Space",
          run: (v) => {
            if (onEvaluateRef.current) {
              onEvaluateRef.current(v.state.doc.toString());
            }
            return true;
          }
        },
        {
          key: "Mod-Enter",
          run: (v) => {
            if (onEvaluateRef.current) {
              onEvaluateRef.current(v.state.doc.toString());
            }
            return true;
          }
        },
        {
          key: "Shift-Enter",
          run: (v) => {
            if (onEvaluateRef.current) {
              onEvaluateRef.current(v.state.doc.toString());
            }
            return true;
          }
        }
      ]);

      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          keymap.of([
            ...yUndoManagerKeymap,
            indentWithTab,
            ...completionKeymap,
            ...defaultKeymap
          ]),
          autocompletion({
            override: [sampleCompletionSource],
            defaultKeymap: true,
            activateOnTyping: true
          }),
          shiftLanguage,
          syntaxHighlighting(shiftHighlightStyle),
          mutePlugin,
          controllerHighlightField,
          yCollab(ytext, null),
          onEvaluateKey,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());

              // Auto-trigger sample autocomplete when typing after "play."
              const pos = update.state.selection.main.head;
              const line = update.state.doc.lineAt(pos);
              const textBefore = line.text.slice(0, pos - line.from);
              if (/play\.[\w-]*$/.test(textBefore)) {
                startCompletion(update.view);
              }
            }
            // Update token selection when clicking in editor
            if (update.selectionSet && !update.docChanged) {
              const head = update.state.selection.main.head;
              const currentDoc = update.state.doc.toString();
              const toks = tokenizeShiftCode(currentDoc);
              const hitIdx = toks.findIndex(t => t.type !== 'empty_line' && t.start < t.end && head >= t.start && head <= t.end);
              if (hitIdx !== -1) {
                setSelectedTokenIdx(hitIdx);
              }
            }
          }),
          EditorView.theme({
            "&": {
              height: "100%",
              backgroundColor: "transparent",
              color: "var(--text-main, #ffffff)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "1.1rem",
              outline: "none !important"
            },
            ".cm-content": {
              caretColor: "var(--editor-cursor, #ffffff)",
              paddingLeft: "42px"
            },
            "&.cm-focused .cm-cursor": {
              borderLeftColor: "var(--editor-cursor, #ffffff)"
            },
            "&.cm-focused .cm-selectionBackground, ::selection": {
              backgroundColor: "var(--editor-selection, rgba(255, 255, 255, 0.22))"
            },
            ".every-block": {
               borderLeft: "2px solid transparent",
               paddingLeft: "10px",
               marginLeft: "-12px",
               transition: "border-color 0.2s",
               position: "relative"
            },
            ".every-block:hover": {
               borderLeftColor: "var(--every-block-border, #d90429)"
            },
            ".every-block.commented": {
               opacity: "0.5",
               borderLeftColor: "#9e0c1b"
            }
          })
        ]
      });

      const loadedCode = ytext.toString();
      if (loadedCode.length > 0) {
        onChange(loadedCode);
      } else if (code && code.length > 0) {
        ydoc.transact(() => {
          ytext.insert(0, code);
        });
      }

      view = new EditorView({
        state,
        parent: editorRef.current
      });
      viewRef.current = view;
      setIsLoading(false);
      setTimeout(() => {
        isInitialSyncDone.current = true;
      }, 100);
    });

    return () => {
      cancelled = true;
      if (view) view.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, []);

  // Sync external code changes (like presets) into Yjs
  useEffect(() => {
    if (!isInitialSyncDone.current) return;
    if (ydocRef.current && viewRef.current) {
      const currentDoc = viewRef.current.state.doc.toString();
      if (code !== currentDoc) {
        const ytext = ydocRef.current.getText('codemirror');
        ydocRef.current.transact(() => {
          ytext.delete(0, ytext.length);
          ytext.insert(0, code);
        });
      }
    }
  }, [code]);

  // Sync CodeMirror highlight with current token and controller mode state
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (!isControllerMode || !currentToken || currentToken.type === 'empty_line' || currentToken.start >= currentToken.end) {
      view.dispatch({ effects: setControllerHighlight.of(null) });
      return;
    }

    const docLen = view.state.doc.length;
    const from = Math.max(0, Math.min(docLen, currentToken.start));
    const to = Math.max(0, Math.min(docLen, currentToken.end));

    if (from >= to) {
      view.dispatch({ effects: setControllerHighlight.of(null) });
      return;
    }

    try {
      view.dispatch({
        effects: setControllerHighlight.of({
          from,
          to,
          isScrubbing: isHoldingS
        }),
        scrollIntoView: true
      });
    } catch (err) {
      console.warn("Failed to highlight controller token:", err);
    }
  }, [isControllerMode, currentToken, isHoldingS]);

  // Handle Controller Mode key events (WASD, Arrows, Q, R)
  useEffect(() => {
    if (!isControllerMode) {
      setIsHoldingS(false);
      setIsDMenuOpen(false);
      return;
    }

    const handleKeyDown = (e) => {
      // If D menu is open, handle closing on Escape
      if (isDMenuOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setIsDMenuOpen(false);
        }
        return;
      }

      const view = viewRef.current;
      if (!view) return;
      const currentDoc = view.state.doc.toString();
      const currentTokens = tokenizeShiftCode(currentDoc);
      const curToken = currentTokens[selectedTokenIdx] || currentTokens[0] || null;

      // Escape toggles controller mode off
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onToggleControllerMode();
        return;
      }

      // S key hold for select / scrub
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        if (!isHoldingS) {
          setIsHoldingS(true);
        }
        return;
      }

      // Q: Skip up 1 line
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        e.stopPropagation();
        const nextIdx = findFirstTokenOnPrevLine(currentTokens, curToken);
        setSelectedTokenIdx(nextIdx);
        return;
      }

      // R: Skip down 1 line
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        e.stopPropagation();
        const nextIdx = findFirstTokenOnNextLine(currentTokens, curToken);
        setSelectedTokenIdx(nextIdx);
        return;
      }

      // D: Open create token dropdown menu
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        e.stopPropagation();
        if (curToken && view) {
          try {
            const coords = view.coordsAtPos(curToken.start);
            setCursorCoords(coords);
          } catch (err) {
            setCursorCoords(null);
          }
        } else {
          setCursorCoords(null);
        }
        setIsDMenuOpen(true);
        return;
      }

      // A: Delete token
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        e.stopPropagation();
        if (curToken) {
          const res = deleteToken(currentDoc, curToken, currentTokens);
          view.dispatch({
            changes: { from: 0, to: currentDoc.length, insert: res.code }
          });
          onChange(res.code);
          onEvaluate(res.code);
          const nextTokens = tokenizeShiftCode(res.code);
          setSelectedTokenIdx(prev => Math.min(prev, Math.max(0, nextTokens.length - 1)));
        }
        return;
      }

      // W: Confirm selection / number edit etc.
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        e.stopPropagation();
        onEvaluate(currentDoc);
        return;
      }

      // Arrows
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();

        if (isHoldingS && curToken) {
          // Scrubbing mode:
          // Up/Down: increment/decrement decimals
          // Left/Right: increment/decrement integers
          let res = null;

          if (curToken.type === 'number') {
            if (e.key === 'ArrowUp') {
              res = modifyNumberToken(currentDoc, curToken, +0.1, true);
            } else if (e.key === 'ArrowDown') {
              res = modifyNumberToken(currentDoc, curToken, -0.1, true);
            } else if (e.key === 'ArrowRight') {
              res = modifyNumberToken(currentDoc, curToken, +1, false);
            } else if (e.key === 'ArrowLeft') {
              res = modifyNumberToken(currentDoc, curToken, -1, false);
            }
          } else if (curToken.type === 'sample') {
            const dir = (e.key === 'ArrowUp' || e.key === 'ArrowRight') ? 1 : -1;
            res = modifySampleToken(currentDoc, curToken, dir);
          } else if (curToken.type === 'operator') {
            const dir = (e.key === 'ArrowUp' || e.key === 'ArrowRight') ? 1 : -1;
            res = modifyOperatorToken(currentDoc, curToken, dir);
          }

          if (res && res.newText !== undefined) {
            view.dispatch({
              changes: { from: curToken.start, to: curToken.end, insert: res.newText }
            });
            const updatedDoc = view.state.doc.toString();
            onChange(updatedDoc);
            onEvaluate(updatedDoc);
          }
          return;
        }

        // Token navigation mode
        if (currentTokens.length === 0) return;

        if (e.key === 'ArrowRight') {
          let nextIdx = selectedTokenIdx + 1;
          while (nextIdx < currentTokens.length && (currentTokens[nextIdx].type === 'empty_line' || currentTokens[nextIdx].start >= currentTokens[nextIdx].end)) {
            nextIdx++;
          }
          if (nextIdx < currentTokens.length) {
            setSelectedTokenIdx(nextIdx);
          }
        } else if (e.key === 'ArrowLeft') {
          let prevIdx = selectedTokenIdx - 1;
          while (prevIdx >= 0 && (currentTokens[prevIdx].type === 'empty_line' || currentTokens[prevIdx].start >= currentTokens[prevIdx].end)) {
            prevIdx--;
          }
          if (prevIdx >= 0) {
            setSelectedTokenIdx(prevIdx);
          }
        } else if (e.key === 'ArrowUp') {
          setSelectedTokenIdx(findTokenAbove(currentTokens, curToken));
        } else if (e.key === 'ArrowDown') {
          setSelectedTokenIdx(findTokenBelow(currentTokens, curToken));
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        setIsHoldingS(false);
        const view = viewRef.current;
        if (view) {
          onEvaluate(view.state.doc.toString());
        }
      }
    };

    const handleWindowBlur = () => {
      setIsHoldingS(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isControllerMode, isHoldingS, isDMenuOpen, selectedTokenIdx, code, onChange, onEvaluate, onToggleControllerMode]);

  // Insert or apply item from D Dropdown Menu
  const handleSelectDMenuItem = (item) => {
    setIsDMenuOpen(false);
    if (!viewRef.current) return;
    const view = viewRef.current;
    const currentDoc = view.state.doc.toString();
    const currentTokens = tokenizeShiftCode(currentDoc);
    const curToken = currentTokens[selectedTokenIdx] || null;

    let newCode = '';
    let targetPos = 0;

    if (curToken && curToken.type === 'empty_line') {
      let snippet = item.code || item.label;
      if (!snippet.endsWith('\n')) snippet += '\n';
      newCode = currentDoc.slice(0, curToken.start) + snippet + currentDoc.slice(curToken.end);
      targetPos = curToken.start;
    } else if (curToken && item.type === 'sample' && curToken.type === 'sample') {
      newCode = currentDoc.slice(0, curToken.start) + item.label + currentDoc.slice(curToken.end);
      targetPos = curToken.start;
    } else if (curToken && item.type === 'number' && curToken.type === 'number') {
      newCode = currentDoc.slice(0, curToken.start) + item.code + currentDoc.slice(curToken.end);
      targetPos = curToken.start;
    } else if (curToken && item.type === 'variable' && (curToken.type === 'identifier' || curToken.type === 'sample')) {
      newCode = currentDoc.slice(0, curToken.start) + item.label + currentDoc.slice(curToken.end);
      targetPos = curToken.start;
    } else {
      // Inserting a statement or snippet
      const insertPos = curToken ? curToken.end : currentDoc.length;
      let snippet = item.code || item.label;
      if (snippet.includes('\n')) {
        const lineEnd = currentDoc.indexOf('\n', insertPos);
        const insertAt = lineEnd === -1 ? currentDoc.length : lineEnd + 1;
        const prefix = (insertAt > 0 && currentDoc[insertAt - 1] !== '\n') ? '\n' : '';
        newCode = currentDoc.slice(0, insertAt) + prefix + snippet + (snippet.endsWith('\n') ? '' : '\n') + currentDoc.slice(insertAt);
        targetPos = insertAt;
      } else {
        const needsSpaceBefore = insertPos > 0 && !/\s/.test(currentDoc[insertPos - 1]);
        const prefix = needsSpaceBefore ? ' ' : '';
        newCode = currentDoc.slice(0, insertPos) + prefix + snippet + currentDoc.slice(insertPos);
        targetPos = insertPos + prefix.length;
      }
    }

    view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: newCode }
    });
    onChange(newCode);
    onEvaluate(newCode);

    setTimeout(() => {
      const updatedTokens = tokenizeShiftCode(newCode);
      const foundIdx = updatedTokens.findIndex(t => t.start >= targetPos);
      if (foundIdx !== -1) {
        setSelectedTokenIdx(foundIdx);
      }
    }, 20);
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted, #6c7086)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.9rem',
          letterSpacing: '0.05em',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          loading last session…
        </div>
      )}

      {/* Controller HUD Bar & D Dropdown Menu */}
      <ControllerHUD
        isActive={isControllerMode}
        onToggle={onToggleControllerMode}
        currentToken={currentToken}
        isHoldingS={isHoldingS}
        isDMenuOpen={isDMenuOpen}
        onCloseDMenu={() => setIsDMenuOpen(false)}
        onSelectDMenuItem={handleSelectDMenuItem}
        code={code}
        cursorCoords={cursorCoords}
      />

      <div 
        className="editor-container" 
        ref={editorRef} 
        style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.3s' }} 
      />
    </div>
  );
}
