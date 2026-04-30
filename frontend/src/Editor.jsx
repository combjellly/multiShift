import React, { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { shiftLanguage } from './shift-grammar';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import { database } from './firebase';
import { FirebaseProvider } from './firebase-yjs';

// Custom syntax highlighting colors for Shift
const shiftHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#6c7086', fontStyle: 'italic' },
  { tag: t.string, color: '#a6e3a1' },
  { tag: t.number, color: '#fab387' },
  { tag: t.operator, color: '#89dceb' },
  { tag: t.keyword, color: '#cba6f7', fontWeight: '500' },
]);

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
             // Lines must come before widgets at the same position
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

import { RangeSetBuilder } from "@codemirror/state";

export function Editor({ code, onChange, onEvaluate }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const ydocRef = useRef(null);

  // Initialize CodeMirror and Yjs only once
  useEffect(() => {
    if (!editorRef.current) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const ytext = ydoc.getText('codemirror');

    // Create Firebase provider
    const provider = new FirebaseProvider(database, 'shift_collaboration', ydoc);

    const onEvaluateKey = keymap.of([{
      key: "Shift-Space",
      run: (view) => {
        onEvaluate(view.state.doc.toString());
        return true;
      }
    }]);

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        keymap.of([indentWithTab, ...defaultKeymap]),
        shiftLanguage,
        syntaxHighlighting(shiftHighlightStyle),
        mutePlugin,
        yCollab(ytext, null), // Collaborative editing extension
        onEvaluateKey,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            backgroundColor: "transparent",
            color: "var(--text-main)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "1.1rem",
            outline: "none !important"
          },
          ".cm-content": {
            caretColor: "var(--accent)",
            paddingLeft: "42px"
          },
          "&.cm-focused .cm-cursor": {
            borderLeftColor: "var(--accent)"
          },
          "&.cm-focused .cm-selectionBackground, ::selection": {
            backgroundColor: "rgba(203, 166, 247, 0.3)"
          },
          ".every-block": {
             borderLeft: "2px solid transparent",
             paddingLeft: "10px",
             marginLeft: "-12px",
             transition: "border-color 0.2s",
             position: "relative"
          },
          ".every-block:hover": {
             borderLeftColor: "var(--accent)"
          },
          ".every-block.commented": {
             opacity: "0.5",
             borderLeftColor: "#f38ba8"
          }
        })
      ]
    });

    const view = new EditorView({
      state,
      parent: editorRef.current
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      ydoc.destroy();
    };
  }, []); // Empty dependency array -> runs once

  // Sync external code changes (like presets) into Yjs
  useEffect(() => {
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

  return (
    <div className="editor-container" ref={editorRef} />
  );
}
