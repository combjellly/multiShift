import { sampleList } from './samples.js';

// Curated list of cool musical/synthesizer variable names for the random generator
const VARIABLE_DICTIONARY = [
  'tempo', 'pitch', 'gain', 'cutoff', 'riff', 'groove', 'pulse', 'spark',
  'drift', 'flux', 'warp', 'bass', 'lead', 'perc', 'chop', 'verb',
  'rate', 'step', 'swing', 'drive', 'decay', 'glitch', 'echo', 'glide',
  'depth', 'shape', 'vibe', 'beat', 'zone', 'shade', 'wave', 'glow'
];

// In-memory set of variables created via the generator or discovered in code
const createdVariables = new Set(['x', 'y', 'scale', 'melody']);

export function getKnownVariables(code = '') {
  const vars = new Set(createdVariables);
  // Scan code for any assignments: identifier = ...
  const lines = code.split('\n');
  for (const line of lines) {
    const clean = line.replace(/--.*$/, '').replace(/\{-[\s\S]*?-\}/g, '').trim();
    const match = clean.match(/^([a-zA-Z][a-zA-Z0-9_\-]*)\s*=/);
    if (match && match[1]) {
      vars.add(match[1]);
    }
  }
  return Array.from(vars);
}

export function generateRandomVariableName(code = '') {
  const existing = new Set(getKnownVariables(code));
  // Filter candidates that are not already in use
  const candidates = VARIABLE_DICTIONARY.filter(name => !existing.has(name));
  let chosen = '';
  if (candidates.length > 0) {
    chosen = candidates[Math.floor(Math.random() * candidates.length)];
  } else {
    // If all are used, generate v1, v2, etc.
    let idx = 1;
    while (existing.has(`var${idx}`)) {
      idx++;
    }
    chosen = `var${idx}`;
  }
  createdVariables.add(chosen);
  return chosen;
}

// Tokenizes Shift code into high-precision AST-mapped tokens
export function tokenizeShiftCode(code) {
  if (!code) return [];
  const tokens = [];
  const lines = code.split('\n');
  let charPos = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let col = 0;

    if (line.trim() === '') {
      tokens.push({
        id: tokens.length,
        type: 'empty_line',
        text: '<empty>',
        start: charPos,
        end: charPos,
        line: lineIdx,
        col: 0
      });
      charPos += line.length + 1;
      continue;
    }

    while (col < line.length) {
      // Whitespace
      if (/\s/.test(line[col])) {
        col++;
        charPos++;
        continue;
      }

      const start = charPos;
      const startCol = col;

      // Line comments --
      if (line.slice(col, col + 2) === '--') {
        const text = line.slice(col);
        tokens.push({
          id: tokens.length,
          type: 'comment',
          text,
          start,
          end: start + text.length,
          line: lineIdx,
          col: startCol
        });
        charPos += text.length;
        break;
      }

      // Numbers (integers or decimals)
      const numMatch = line.slice(col).match(/^\d+(\.\d+)?\b/);
      if (numMatch) {
        const text = numMatch[0];
        tokens.push({
          id: tokens.length,
          type: 'number',
          text,
          value: parseFloat(text),
          start,
          end: start + text.length,
          line: lineIdx,
          col: startCol
        });
        col += text.length;
        charPos += text.length;
        continue;
      }

      // Multi-character comparison operators
      const cmpMatch = line.slice(col).match(/^(==|!=|<=|>=)/);
      if (cmpMatch) {
        const text = cmpMatch[0];
        tokens.push({
          id: tokens.length,
          type: 'operator',
          text,
          start,
          end: start + text.length,
          line: lineIdx,
          col: startCol
        });
        col += text.length;
        charPos += text.length;
        continue;
      }

      // Single-character operators & punctuation
      if (/[=+\-*\/%<>:,\[\].]/.test(line[col])) {
        const text = line[col];
        let type = 'punctuation';
        if (/[=+\-*\/%<>]/.test(text)) type = 'operator';
        tokens.push({
          id: tokens.length,
          type,
          text,
          start,
          end: start + 1,
          line: lineIdx,
          col: startCol
        });
        col++;
        charPos++;
        continue;
      }

      // Words (keywords, sample names, identifiers)
      const wordMatch = line.slice(col).match(/^[a-zA-Z0-9_\-]+/);
      if (wordMatch) {
        const text = wordMatch[0];
        const prevToken = tokens[tokens.length - 1];
        const prevPrevToken = tokens[tokens.length - 2];

        let type = 'identifier';
        if (['every', 'play', 'if', 'random', 'midi', 'elif', 'else'].includes(text)) {
          type = 'keyword';
        } else if (prevToken && prevToken.text === '.' && prevPrevToken && prevPrevToken.text === 'play') {
          type = 'sample';
        }

        tokens.push({
          id: tokens.length,
          type,
          text,
          start,
          end: start + text.length,
          line: lineIdx,
          col: startCol
        });
        col += text.length;
        charPos += text.length;
        continue;
      }

      // Single char fallback
      tokens.push({
        id: tokens.length,
        type: 'char',
        text: line[col],
        start,
        end: start + 1,
        line: lineIdx,
        col: startCol
      });
      col++;
      charPos++;
    }

    charPos++; // Account for newline \n
  }

  return tokens;
}

// Modify a number token: decimals (Up/Down) or integers (Left/Right)
export function modifyNumberToken(code, token, delta, isDecimal = false) {
  if (!token || token.type !== 'number') return { code, newPos: token?.start };
  const val = token.value;
  let nextVal;

  if (isDecimal) {
    const step = delta > 0 ? 0.1 : -0.1;
    nextVal = Math.max(0, parseFloat((val + step).toFixed(2)));
  } else {
    const step = delta > 0 ? 1 : -1;
    nextVal = Math.max(0, Math.round(val) + step);
  }

  const newText = String(nextVal);
  const updatedCode = code.slice(0, token.start) + newText + code.slice(token.end);
  return {
    code: updatedCode,
    newPos: token.start,
    newText
  };
}

// Cycle sample token to previous or next loaded sample
export function modifySampleToken(code, token, direction, samples = sampleList) {
  if (!token || token.type !== 'sample' || samples.length === 0) return { code, newPos: token?.start };
  const currentName = token.text.toLowerCase();
  const currentIdx = samples.indexOf(currentName);
  let nextIdx = 0;
  if (currentIdx !== -1) {
    nextIdx = (currentIdx + direction + samples.length) % samples.length;
  } else {
    nextIdx = direction > 0 ? 0 : samples.length - 1;
  }

  const nextSample = samples[nextIdx];
  const updatedCode = code.slice(0, token.start) + nextSample + code.slice(token.end);
  return {
    code: updatedCode,
    newPos: token.start,
    newText: nextSample
  };
}

// Cycle operator token (e.g. == -> != -> < -> >)
export function modifyOperatorToken(code, token, direction) {
  const COMPARATORS = ['==', '!=', '<', '>', '<=', '>='];
  const ARITHMETIC = ['+', '-', '*', '/', '%'];
  const ops = COMPARATORS.includes(token.text) ? COMPARATORS : ARITHMETIC;
  const idx = ops.indexOf(token.text);
  if (idx === -1) return { code, newPos: token.start };

  const nextIdx = (idx + direction + ops.length) % ops.length;
  const nextOp = ops[nextIdx];
  const updatedCode = code.slice(0, token.start) + nextOp + code.slice(token.end);
  return {
    code: updatedCode,
    newPos: token.start,
    newText: nextOp
  };
}

// Delete token cleanly
export function deleteToken(code, token, tokens = []) {
  if (!token) return { code, newPos: 0 };
  let start = token.start;
  let end = token.end;

  // Clean up surrounding whitespace or comma if part of a list [a, b]
  if (code[end] === ',' && code[end + 1] === ' ') {
    end += 2;
  } else if (code[end] === ',') {
    end += 1;
  } else if (code.slice(start - 2, start) === ', ') {
    start -= 2;
  }

  // If token is on a line by itself, remove the entire line
  const lineStart = code.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = code.indexOf('\n', end);
  const fullLineEnd = lineEnd === -1 ? code.length : lineEnd;
  const lineText = code.slice(lineStart, fullLineEnd).trim();

  let updatedCode;
  if (lineText === token.text) {
    // Delete full line
    const delEnd = lineEnd === -1 ? fullLineEnd : lineEnd + 1;
    updatedCode = code.slice(0, lineStart) + code.slice(delEnd);
    return { code: updatedCode, newPos: Math.min(lineStart, updatedCode.length) };
  }

  updatedCode = code.slice(0, start) + code.slice(end);
  return {
    code: updatedCode,
    newPos: Math.min(start, updatedCode.length)
  };
}

// Insert new token or template at position
export function insertToken(code, pos, snippet) {
  const safePos = Math.max(0, Math.min(pos, code.length));
  // If inserting at start of line or between statements, format with newline if needed
  let insertText = snippet;
  const updatedCode = code.slice(0, safePos) + insertText + code.slice(safePos);
  return {
    code: updatedCode,
    newPos: safePos + insertText.length
  };
}
