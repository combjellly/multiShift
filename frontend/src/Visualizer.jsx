import React, { useEffect, useRef, useState, useMemo } from 'react';

// Curated vibrant palette for instruments & synths
const PALETTE = {
  bd: { name: 'KICK', primary: '#ff007f', glow: 'rgba(255, 0, 127, 0.4)' },
  bass: { name: 'BASS', primary: '#f72585', glow: 'rgba(247, 37, 133, 0.4)' },
  sn: { name: 'SNARE', primary: '#00f5d4', glow: 'rgba(0, 245, 212, 0.4)' },
  snare: { name: 'SNARE', primary: '#00f5d4', glow: 'rgba(0, 245, 212, 0.4)' },
  cp: { name: 'CLAP', primary: '#ff9e00', glow: 'rgba(255, 158, 0, 0.4)' },
  hh: { name: 'HI-HAT', primary: '#fee440', glow: 'rgba(254, 228, 64, 0.4)' },
  hat: { name: 'HI-HAT', primary: '#fee440', glow: 'rgba(254, 228, 64, 0.4)' },
  synth: { name: 'SYNTH', primary: '#4cc9f0', glow: 'rgba(76, 201, 240, 0.4)' },
  piano: { name: 'PIANO', primary: '#b5179e', glow: 'rgba(181, 23, 158, 0.4)' },
  casio: { name: 'CASIO', primary: '#7209b7', glow: 'rgba(114, 9, 183, 0.4)' },
  perc: { name: 'PERC', primary: '#70e000', glow: 'rgba(112, 224, 0, 0.4)' },
  gba: { name: 'GBA', primary: '#a06cd5', glow: 'rgba(160, 108, 213, 0.4)' },
  famicom: { name: 'FAMICOM', primary: '#ff5964', glow: 'rgba(255, 89, 100, 0.4)' },
  default: { name: 'SAMPLE', primary: '#3a86ff', glow: 'rgba(58, 134, 255, 0.4)' }
};

const DYNAMIC_COLORS = [
  '#00f5d4', '#ff007f', '#fee440', '#70e000',
  '#ff9e00', '#b5179e', '#4cc9f0', '#7209b7',
  '#f72585', '#3a86ff', '#e0aaff', '#9d4edd'
];

export function getTrackTheme(soundKey, loopIndex = 0) {
  const fullKey = String(soundKey || '').toLowerCase();
  const [baseName, idx] = fullKey.split(':');
  const cleanBase = baseName.replace(/[^a-z0-9]/g, '');

  const colorIndex = (typeof loopIndex === 'number' && loopIndex >= 0)
    ? loopIndex % DYNAMIC_COLORS.length
    : 0;
  const dynColor = DYNAMIC_COLORS[colorIndex];

  let displayName = fullKey.toUpperCase();
  let primaryColor = dynColor;

  if (idx === undefined) {
    if (PALETTE[cleanBase]) {
      displayName = PALETTE[cleanBase].name;
      // If we have an assigned dynamic color for the band index, keep unique band coloring
      primaryColor = dynColor;
    }
  } else {
    const baseDisplay = PALETTE[cleanBase] ? PALETTE[cleanBase].name : cleanBase.toUpperCase();
    displayName = `${baseDisplay}:${idx}`;
  }

  return {
    name: displayName,
    primary: primaryColor,
    glow: primaryColor + '66'
  };
}

// Extracts every "every <interval>" block as a dedicated band
export function extractEveryBands(code) {
  if (!code) return [];
  // Strip comments: multi-line {- -} and single-line --
  const clean = code
    .replace(/\{-[\s\S]*?-\}/g, '')
    .split('\n')
    .map(line => line.replace(/--.*$/, ''))
    .join('\n');

  // Match each "every" statement and capture until the next "every" or EOF
  const everyRegex = /\bevery\s+([^\n\r]+)/g;
  const indices = [];
  let match;

  while ((match = everyRegex.exec(clean)) !== null) {
    indices.push({
      start: match.index,
      interval: match[1].trim(),
      headerEnd: match.index + match[0].length
    });
  }

  const bands = [];
  for (let i = 0; i < indices.length; i++) {
    const cur = indices[i];
    const nextStart = (i + 1 < indices.length) ? indices[i + 1].start : clean.length;
    const body = clean.substring(cur.headerEnd, nextStart);

    // Find sample actions in this block
    const soundMatches = Array.from(body.matchAll(/\bplay\.([a-zA-Z0-9_\-]+)(?:\s*:\s*([0-9]+))?/g));
    const sounds = [];
    for (const sm of soundMatches) {
      const sName = sm[1].toLowerCase();
      const sIdx = sm[2];
      sounds.push(sIdx !== undefined ? `${sName}:${sIdx}` : sName);
    }
    if (sounds.length === 0 && /\bsynth\b/i.test(body)) {
      sounds.push('synth');
    }

    // If an every loop does not have a play, do not display it
    if (sounds.length === 0) {
      continue;
    }

    const primarySound = sounds[0];
    const soundDisplay = sounds.map(s => s.toUpperCase()).join(' / ');
    const loopId = bands.length;

    bands.push({
      loopId,
      key: `loop_${loopId}`,
      soundKey: primarySound,
      sounds,
      name: soundDisplay,
      shortName: soundDisplay,
      theme: getTrackTheme(primarySound, loopId)
    });
  }

  return bands;
}

export function extractActiveSounds(code) {
  if (!code) return [];
  const clean = code
    .replace(/\{-[\s\S]*?-\}/g, '')
    .split('\n')
    .map(line => line.replace(/--.*$/, ''))
    .join('\n');

  const matches = clean.matchAll(/\bplay\.([a-zA-Z0-9_\-]+)(?:\s*:\s*([0-9]+))?/g);
  const sounds = new Set();
  for (const m of matches) {
    if (m[1]) {
      const soundName = m[1].toLowerCase();
      const soundIndex = m[2];
      sounds.add(soundIndex !== undefined ? `${soundName}:${soundIndex}` : soundName);
    }
  }
  return Array.from(sounds);
}

export function Visualizer({ subscribeToEvents, isPlaying, mode = 'circle', opacity = 0.65, speed = 380 }) {
  const canvasRef = useRef(null);

  // Mutable state for the 60fps render loop
  const stateRef = useRef({
    notes: [],
    ripples: [],
    tracks: new Map(), // key -> { key, name, shortName, theme, lastHit, peakGlow, basePitch, prevPitch }
    activeBandKeys: null, // Set of active band keys from compilation
    centerPulse: 0
  });

  // Subscribe to audio engine events
  useEffect(() => {
    if (!subscribeToEvents) return;

    const unsubscribe = subscribeToEvents((event) => {
      if (event.type === 'stop') {
        stateRef.current.notes = [];
        stateRef.current.ripples = [];
        return;
      }

      // When code is compiled / evaluated, configure separate bands for every "every"
      if (event.type === 'compile') {
        const bands = extractEveryBands(event.code);
        let newTracks = new Map();
        let activeKeys = new Set();

        if (bands.length > 0) {
          bands.forEach((band) => {
            activeKeys.add(band.key);
            const existing = stateRef.current.tracks.get(band.key);
            newTracks.set(band.key, {
              key: band.key,
              loopId: band.loopId,
              name: band.name,
              shortName: band.shortName,
              interval: band.interval,
              theme: band.theme,
              lastHit: existing ? existing.lastHit : 0,
              peakGlow: existing ? existing.peakGlow : 0,
              basePitch: undefined, // Recalibrate on first note of new compilation
              prevPitch: undefined
            });
          });
        } else {
          // Fallback if no "every" blocks exist (e.g. standalone play statements)
          const fallbackSounds = extractActiveSounds(event.code);
          fallbackSounds.forEach((snd, idx) => {
            const key = `loop_${idx}`;
            activeKeys.add(key);
            const theme = getTrackTheme(snd, idx);
            newTracks.set(key, {
              key,
              loopId: idx,
              name: snd.toUpperCase(),
              shortName: snd.toUpperCase(),
              interval: '',
              theme,
              lastHit: 0,
              peakGlow: 0,
              basePitch: undefined,
              prevPitch: undefined
            });
          });
        }

        stateRef.current.activeBandKeys = activeKeys;
        stateRef.current.tracks = newTracks;

        // Prune any notes belonging to removed bands
        stateRef.current.notes = stateRef.current.notes.filter(note =>
          stateRef.current.activeBandKeys.has(note.track)
        );
        return;
      }

      // Normal sample / synth playback event
      const hasLoopId = event.loopId !== undefined && event.loopId !== null;
      const loopId = hasLoopId ? Number(event.loopId) : 0;
      const loopKey = `loop_${loopId}`;
      const sName = (event.s || 'sample').toLowerCase();
      const nIdx = event.n !== undefined ? Math.round(Number(event.n)) : 0;
      const exactSound = `${sName}:${nIdx}`;

      let targetTrackKey = null;

      // 1. If explicit loopId was passed and matches this track's sound:
      if (hasLoopId && stateRef.current.tracks.has(loopKey)) {
        const candidateTrk = stateRef.current.tracks.get(loopKey);
        const sounds = candidateTrk.sounds || (candidateTrk.soundKey ? [candidateTrk.soundKey] : []);
        if (sounds.some(s => s === exactSound || s === sName || s.startsWith(sName + ':') || sName.startsWith(s.split(':')[0]))) {
          targetTrackKey = loopKey;
        }
      }

      // 2. Match by sound identity across compiled tracks
      if (!targetTrackKey && stateRef.current.tracks.size > 0) {
        // Priority A: exact sound with index (e.g. "junoorgan:2")
        for (const [key, trk] of stateRef.current.tracks.entries()) {
          const sounds = trk.sounds || (trk.soundKey ? [trk.soundKey] : []);
          if (sounds.includes(exactSound)) {
            targetTrackKey = key;
            break;
          }
        }
        // Priority B: sound name without index or base match (e.g. "gba" or "junoorgan")
        if (!targetTrackKey) {
          for (const [key, trk] of stateRef.current.tracks.entries()) {
            const sounds = trk.sounds || (trk.soundKey ? [trk.soundKey] : []);
            if (sounds.some(s => s === sName || s.startsWith(sName + ':') || sName.startsWith(s.split(':')[0]))) {
              targetTrackKey = key;
              break;
            }
          }
        }
      }

      // 3. Fallback to loopId or first track if direct sound match wasn't found
      if (!targetTrackKey) {
        if (hasLoopId && stateRef.current.tracks.has(loopKey)) {
          targetTrackKey = loopKey;
        } else if (stateRef.current.tracks.size > 0) {
          const keys = Array.from(stateRef.current.tracks.keys());
          targetTrackKey = keys[loopId % keys.length];
        }
      }

      // If still not found and no bands were compiled, dynamically register
      if (!targetTrackKey) {
        targetTrackKey = loopKey;
        const theme = getTrackTheme(sName, loopId);
        const displayName = (sName + (nIdx ? `:${nIdx}` : '')).toUpperCase();
        stateRef.current.tracks.set(targetTrackKey, {
          key: targetTrackKey,
          loopId,
          name: displayName,
          shortName: displayName,
          theme,
          lastHit: 0,
          peakGlow: 0,
          basePitch: undefined,
          prevPitch: undefined
        });
      }

      const trk = stateRef.current.tracks.get(targetTrackKey);
      if (!trk) return;

      const rawPitch = (typeof event.note === 'number' && !isNaN(event.note)) ? event.note : 0;

      // Track base note and previous note for proportional pitch positioning
      if (trk.basePitch === undefined) {
        trk.basePitch = rawPitch;
        trk.prevPitch = rawPitch;
      }
      const prevPitch = trk.prevPitch !== undefined ? trk.prevPitch : rawPitch;
      trk.prevPitch = rawPitch;

      const nowWall = performance.now();
      const nowPosix = Date.now() / 1000;
      const latency = event.latency !== undefined ? event.latency : 0.4;
      const timeUntilHit = (event.whenPosix ? (event.whenPosix - nowPosix) : 0) + latency;
      const targetWallTime = nowWall + Math.max(0, timeUntilHit * 1000);

      stateRef.current.notes.push({
        id: Math.random().toString(36).substring(2, 9),
        track: targetTrackKey,
        theme: trk.theme,
        pitch: rawPitch,
        basePitch: trk.basePitch,
        prevPitch: prevPitch,
        gain: event.gain !== undefined ? event.gain : 1,
        createdWallTime: nowWall,
        targetWallTime,
        triggered: false
      });
    });

    return () => unsubscribe();
  }, [subscribeToEvents]);

  // 60fps RequestAnimationFrame Canvas Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const now = performance.now();
      const state = stateRef.current;

      ctx.clearRect(0, 0, width, height);

      const trackKeys = Array.from(state.tracks.keys());
      // When no tracks exist (visualizer launched before code is evaluated), visualizer is empty
      if (trackKeys.length === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const numTracks = Math.max(trackKeys.length, 1);

      // Process note hits, pulses, and ripples
      state.notes.forEach((note) => {
        const diff = (note.targetWallTime - now) / 1000;

        // Trigger moment (playhead hit)
        if (!note.triggered && diff <= 0.02) {
          note.triggered = true;

          const trk = state.tracks.get(note.track);
          const vol = Math.max(0.08, Math.min(1.2, note.gain !== undefined ? note.gain : 0.8));
          if (trk) {
            trk.lastHit = now;
            trk.peakGlow = Math.min(1.0, vol);
          }

          state.centerPulse = Math.min(1.0, state.centerPulse + 0.35 * vol);

          let impactX = width * 0.22;
          let impactY = height / 2;

          if (mode === 'grid') {
            const trackIdx = trackKeys.indexOf(note.track);
            const laneH = height / numTracks;
            impactY = trackIdx * laneH + laneH / 2;
          } else {
            const trackIdx = trackKeys.indexOf(note.track);
            const minR = Math.min(width, height) * 0.12;
            const maxR = Math.min(width, height) * 0.42;
            const ringR = minR + ((trackIdx + 0.5) / numTracks) * (maxR - minR);
            impactX = width / 2;
            impactY = height / 2 - ringR;
          }

          state.ripples.push({
            x: impactX,
            y: impactY,
            color: note.theme.primary,
            radius: 5,
            maxRadius: mode === 'circle' ? (50 + vol * 70) : (25 + vol * 35),
            alpha: Math.min(1.0, vol * 0.95)
          });
        }
      });

      // Update and draw ripples
      for (let i = state.ripples.length - 1; i >= 0; i--) {
        const r = state.ripples[i];
        r.radius += 3.5;
        r.alpha -= 0.035;

        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          state.ripples.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = r.alpha;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      state.centerPulse = Math.max(0, state.centerPulse * 0.9);

      state.tracks.forEach((trk) => {
        trk.peakGlow = Math.max(0, trk.peakGlow * 0.92);
      });

      // Render Active Mode
      if (mode === 'grid') {
        drawGridMode(ctx, width, height, state, now, speed, trackKeys);
      } else {
        drawCircleMode(ctx, width, height, state, now, trackKeys);
      }

      // Prune old notes
      const maxAgeSec = mode === 'grid' ? 1.8 : 1.0;
      state.notes = state.notes.filter(
        (n) => (now - n.targetWallTime) / 1000 < maxAgeSec
      );

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [mode, speed]);

  return (
    <canvas
      ref={canvasRef}
      className="shift-visualizer-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1,
        opacity: opacity,
        transition: 'opacity 0.25s ease'
      }}
    />
  );
}

// ==========================================
// MODE 1: MOVING GRID SEQUENCER WITH PITCH
// ==========================================
function drawGridMode(ctx, width, height, state, now, speed, trackKeys) {
  if (trackKeys.length === 0) return;
  const playheadX = width * 0.22;
  const numTracks = Math.max(trackKeys.length, 1);
  const laneHeight = height / numTracks;

  // Background tempo grid lines
  const gridSpacing = speed * 0.5;
  const offset = (now * (speed / 1000)) % gridSpacing;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let x = width - offset; x > 0; x -= gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // Draw each separate "every" band / lane
  trackKeys.forEach((key, index) => {
    const trk = state.tracks.get(key);
    const yTop = index * laneHeight;
    const yCenter = yTop + laneHeight / 2;

    // Lane border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yTop + laneHeight);
    ctx.lineTo(width, yTop + laneHeight);
    ctx.stroke();

    // Baseline: center reference pitch line inside the band
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(playheadX, yCenter);
    ctx.lineTo(width, yCenter);
    ctx.stroke();
    ctx.restore();

    // Lane ambient wash on hit
    if (trk && trk.peakGlow > 0.01) {
      ctx.save();
      const grad = ctx.createLinearGradient(0, yCenter, width, yCenter);
      grad.addColorStop(0, trk.theme.primary + '18');
      grad.addColorStop(playheadX / width, trk.theme.primary + '38');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.globalAlpha = trk.peakGlow * 0.45;
      ctx.fillRect(0, yTop, width, laneHeight);
      ctx.restore();
    }

    // Band Header Badge (Left)
    ctx.save();
    const badgeX = 24;
    const badgeY = yCenter;
    const glow = trk ? trk.peakGlow : 0;

    // Activity LED
    ctx.fillStyle = trk ? trk.theme.primary : '#6c7086';
    ctx.shadowColor = trk ? trk.theme.primary : 'transparent';
    ctx.shadowBlur = glow > 0.1 ? 16 * glow : 4;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 5 + glow * 3, 0, Math.PI * 2);
    ctx.fill();

    // Band Label Text
    ctx.fillStyle = glow > 0.2 ? '#ffffff' : (trk ? trk.theme.primary : '#a6adc8');
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(trk ? trk.name : key.toUpperCase(), badgeX + 16, badgeY);
    ctx.restore();
  });

  // Glowing Vertical Playhead Line
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00f5d4';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(playheadX, 0);
  ctx.lineTo(playheadX, height);
  ctx.stroke();

  // Playhead arrow markers
  ctx.fillStyle = '#00f5d4';
  ctx.beginPath();
  ctx.moveTo(playheadX - 6, 0);
  ctx.lineTo(playheadX + 6, 0);
  ctx.lineTo(playheadX, 10);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(playheadX - 6, height);
  ctx.lineTo(playheadX + 6, height);
  ctx.lineTo(playheadX, height - 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Draw connecting pitch ribbons / contours per band
  trackKeys.forEach((key, index) => {
    const yCenter = index * laneHeight + laneHeight / 2;
    const trk = state.tracks.get(key);
    if (!trk) return;

    const bandNotes = state.notes
      .filter((n) => n.track === key)
      .sort((a, b) => a.targetWallTime - b.targetWallTime);

    if (bandNotes.length >= 2) {
      ctx.save();
      ctx.strokeStyle = trk.theme.primary + '55';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      let hasStarted = false;

      bandNotes.forEach((note) => {
        const diffSec = (note.targetWallTime - now) / 1000;
        const xPos = playheadX + diffSec * speed;
        if (xPos < -50 || xPos > width + 50) return;

        // Proportional pitch calculation: higher pitch = higher on screen (more negative Y)
        const maxOffset = Math.max(10, (laneHeight - 26) * 0.42);
        const semitoneScale = Math.max(2.5, Math.min(7, maxOffset / 12));
        const yOffset = -Math.max(-maxOffset, Math.min(maxOffset, (note.pitch - (note.basePitch || 0)) * semitoneScale));
        const noteY = yCenter + yOffset;

        if (!hasStarted) {
          ctx.moveTo(xPos, noteY);
          hasStarted = true;
        } else {
          ctx.lineTo(xPos, noteY);
        }
      });
      ctx.stroke();
      ctx.restore();
    }
  });

  // Draw Approaching and Trailing Notes with Pitch Positioning
  state.notes.forEach((note) => {
    const trackIndex = trackKeys.indexOf(note.track);
    if (trackIndex === -1) return;

    const yCenter = trackIndex * laneHeight + laneHeight / 2;
    const diffSec = (note.targetWallTime - now) / 1000;
    const xPos = playheadX + diffSec * speed;

    if (xPos > width + 100 || xPos < -100) return;

    // Pitch proportional offset within the band:
    // If base note changes, position note higher or lower relative to base/previous note
    const maxOffset = Math.max(10, (laneHeight - 26) * 0.42);
    const semitoneScale = Math.max(2.5, Math.min(7, maxOffset / 12));
    const yOffset = -Math.max(-maxOffset, Math.min(maxOffset, (note.pitch - (note.basePitch || 0)) * semitoneScale));
    const noteY = yCenter + yOffset;

    const isFuture = diffSec > 0;
    const isHitting = Math.abs(diffSec) < 0.05;
    const timeAlpha = isFuture
      ? Math.min(1.0, 0.4 + (1.0 - Math.min(diffSec, 1.0)) * 0.6)
      : Math.max(0, 1.0 + diffSec * 0.7);

    // Map volume of note to opacity
    const vol = Math.max(0.08, Math.min(1.2, note.gain !== undefined ? note.gain : 0.8));
    const volOpacity = 0.15 + 0.85 * Math.min(1.0, vol);
    const alpha = timeAlpha * volOpacity;

    const pillW = Math.max(36, 28 + Math.min(vol, 1.5) * 16);
    const pillH = Math.min(laneHeight * 0.45, 26);
    const radius = pillH / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    // If offset from centerline, draw faint indicator guide line back to baseline
    if (Math.abs(yOffset) > 4) {
      ctx.strokeStyle = note.theme.primary + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xPos, yCenter);
      ctx.lineTo(xPos, noteY);
      ctx.stroke();
    }

    // Glowing impact flare
    if (isHitting) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.shadowColor = note.theme.primary;
      ctx.shadowBlur = isFuture ? 10 : 4;
      ctx.fillStyle = note.theme.primary;
    }

    // Note Capsule
    ctx.beginPath();
    ctx.roundRect(xPos - pillW / 2, noteY - pillH / 2, pillW, pillH, radius);
    ctx.fill();

    // Capsule border
    ctx.strokeStyle = isHitting ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pitch label (e.g. +4, -3, or 0)
    ctx.fillStyle = isHitting ? '#11111b' : '#0b0c10';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;

    let label = '';
    if (note.pitch !== 0) {
      label = note.pitch > 0 ? `+${Math.round(note.pitch)}` : `${Math.round(note.pitch)}`;
    } else {
      label = '0';
    }
    ctx.fillText(label, xPos, noteY);

    ctx.restore();
  });
}

// ==========================================
// MODE 2: CIRCULAR / ORBITAL RADAR SEQUENCER
// ==========================================
function drawCircleMode(ctx, width, height, state, now, trackKeys) {
  if (trackKeys.length === 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const minR = Math.min(width, height) * 0.12;
  const maxR = Math.min(width, height) * 0.42;
  const numTracks = Math.max(trackKeys.length, 1);
  const ringStep = (maxR - minR) / numTracks;

  // Central Sun
  ctx.save();
  const baseCoreR = minR * 0.55;
  const corePulse = baseCoreR * (1 + state.centerPulse * 0.3);
  const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, corePulse * 1.5);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.3, 'rgba(0, 245, 212, 0.6)');
  coreGrad.addColorStop(0.8, 'rgba(114, 9, 183, 0.2)');
  coreGrad.addColorStop(1, 'transparent');

  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, corePulse * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00f5d4';
  ctx.shadowBlur = 12 * (1 + state.centerPulse);
  ctx.beginPath();
  ctx.arc(cx, cy, corePulse * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 12 o'clock strike line
  const strikeAngle = -Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00f5d4';
  ctx.shadowBlur = 14;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, cy - minR * 0.7);
  ctx.lineTo(cx, cy - maxR * 1.08);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#00f5d4';
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy - maxR * 1.1);
  ctx.lineTo(cx + 7, cy - maxR * 1.1);
  ctx.lineTo(cx, cy - maxR * 1.1 + 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Draw Concentric Orbit Rings for each "every" band
  trackKeys.forEach((key, index) => {
    const trk = state.tracks.get(key);
    const ringR = minR + (index + 0.5) * ringStep;
    const glow = trk ? trk.peakGlow : 0;

    // Base ring (idle line)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Active ring glow mapped to note volume
    if (glow > 0.01 && trk) {
      ctx.strokeStyle = trk.theme.primary;
      ctx.globalAlpha = Math.min(1.0, glow * 0.95);
      ctx.lineWidth = 1.5 + glow * 2.5;
      ctx.shadowColor = trk.theme.primary;
      ctx.shadowBlur = 8 + glow * 24;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Baseline guide ring inside the band
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Band label at 3 o'clock
    if (trk) {
      ctx.save();
      ctx.fillStyle = glow > 0.1 ? trk.theme.primary : 'rgba(255, 255, 255, 0.35)';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText(trk.name, cx + ringR + 8, cy);
      ctx.restore();
    }
  });

  // Draw Orbiting Notes Moving Towards 12 o'clock
  const orbitalSpeed = (Math.PI * 2) / 3.2;

  state.notes.forEach((note) => {
    const trackIndex = trackKeys.indexOf(note.track);
    if (trackIndex === -1) return;

    const ringR = minR + (trackIndex + 0.5) * ringStep;
    const diffSec = (note.targetWallTime - now) / 1000;
    const angle = strikeAngle + diffSec * orbitalSpeed;

    const isFuture = diffSec > 0;
    const isHitting = Math.abs(diffSec) < 0.06;
    const timeAlpha = isFuture
      ? Math.min(1.0, 0.4 + (1.0 - Math.min(diffSec, 1.2)) * 0.6)
      : Math.max(0, 1.0 + diffSec * 1.5);

    if (timeAlpha <= 0) return;

    // Map volume of note to opacity of the ball
    const vol = Math.max(0.08, Math.min(1.2, note.gain !== undefined ? note.gain : 0.8));
    const volOpacity = 0.15 + 0.85 * Math.min(1.0, vol);
    const alpha = timeAlpha * volOpacity;

    // Pitch radial offset: higher pitch orbits slightly outward on the band
    const maxRadialOffset = ringStep * 0.38;
    const radialScale = Math.max(1.5, Math.min(4, maxRadialOffset / 12));
    const radialOffset = Math.max(-maxRadialOffset, Math.min(maxRadialOffset, (note.pitch - (note.basePitch || 0)) * radialScale));
    const currentR = ringR + radialOffset;

    const nx = cx + Math.cos(angle) * currentR;
    const ny = cy + Math.sin(angle) * currentR;
    const noteSize = 8 + Math.min(vol, 1.5) * 5;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (isHitting) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15 + vol * 15;
    } else {
      ctx.fillStyle = note.theme.primary;
      ctx.shadowColor = note.theme.primary;
      ctx.shadowBlur = 4 + vol * 10;
    }

    ctx.beginPath();
    ctx.arc(nx, ny, noteSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(nx, ny, noteSize * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}
