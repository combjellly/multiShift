// Theme and dynamic high-contrast token highlighter computation

function hexToRgb(hex) {
  let clean = (hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [30, 30, 46];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getRelativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function computeThemeTokens(bgHex) {
  const [r, g, b] = hexToRgb(bgHex);
  const lum = getRelativeLuminance(r, g, b);
  const isLight = lum >= 0.38;
  const isReddish = (r > 105 && r > g * 1.25 && r > b * 1.25);

  if (isLight) {
    // High-contrast saturated dark tokens for light backgrounds
    return {
      isLight: true,
      textMain: '#09090b',
      tokenComment: '#52525b',
      tokenString: '#15803d',     // deep emerald green
      tokenNumber: '#b45309',     // deep warm amber
      tokenOperator: '#0369a1',   // deep crisp azure
      tokenKeyword: '#7e22ce',    // deep rich purple
      tokenHlBg: '#09090b',       // stark black block
      tokenHlColor: '#ffffff',    // pure white text
      tokenHlOutline: isReddish ? '#ffffff' : '#b91c1c',
      tokenScrubBg: '#b91c1c',    // crimson block
      tokenScrubColor: '#ffffff',
      tokenScrubOutline: '#000000',
      editorCursor: '#09090b',
      editorSelection: 'rgba(0, 0, 0, 0.18)',
      everyBlockBorder: '#b91c1c'
    };
  } else {
    // High-contrast vibrant bright tokens for dark backgrounds
    return {
      isLight: false,
      textMain: '#ffffff',
      tokenComment: '#94a3b8',
      tokenString: '#4ade80',     // vibrant mint green
      tokenNumber: '#fbbf24',     // vibrant warm gold
      tokenOperator: '#38bdf8',   // bright sky cyan
      tokenKeyword: '#c084fc',    // vibrant lilac
      tokenHlBg: isReddish ? '#000000' : '#9e0c1b',       // contrast against reddish bg
      tokenHlColor: '#ffffff',
      tokenHlOutline: isReddish ? '#ffffff' : '#d90429',
      tokenScrubBg: '#f59e0b',    // high-visibility amber gold
      tokenScrubColor: '#000000',
      tokenScrubOutline: '#ffffff',
      editorCursor: '#ffffff',
      editorSelection: 'rgba(255, 255, 255, 0.22)',
      everyBlockBorder: '#d90429'
    };
  }
}

export function applyTheme(bgHex) {
  if (typeof document === 'undefined') return;
  const tokens = computeThemeTokens(bgHex);
  const root = document.documentElement;

  document.body.style.backgroundColor = bgHex;
  root.style.setProperty('--bg-color', bgHex);
  root.style.setProperty('--text-main', tokens.textMain);
  root.style.setProperty('--token-comment', tokens.tokenComment);
  root.style.setProperty('--token-string', tokens.tokenString);
  root.style.setProperty('--token-number', tokens.tokenNumber);
  root.style.setProperty('--token-operator', tokens.tokenOperator);
  root.style.setProperty('--token-keyword', tokens.tokenKeyword);
  root.style.setProperty('--token-hl-bg', tokens.tokenHlBg);
  root.style.setProperty('--token-hl-color', tokens.tokenHlColor);
  root.style.setProperty('--token-hl-outline', tokens.tokenHlOutline);
  root.style.setProperty('--token-scrub-bg', tokens.tokenScrubBg);
  root.style.setProperty('--token-scrub-color', tokens.tokenScrubColor);
  root.style.setProperty('--token-scrub-outline', tokens.tokenScrubOutline);
  root.style.setProperty('--editor-cursor', tokens.editorCursor);
  root.style.setProperty('--editor-selection', tokens.editorSelection);
  root.style.setProperty('--every-block-border', tokens.everyBlockBorder);

  if (tokens.isLight) {
    root.classList.add('light-theme');
    root.classList.remove('dark-theme');
  } else {
    root.classList.add('dark-theme');
    root.classList.remove('light-theme');
  }

  try {
    localStorage.setItem('theme', bgHex);
  } catch (e) {}
}
