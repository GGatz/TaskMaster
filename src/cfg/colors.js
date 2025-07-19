import chroma from 'chroma-js';

export function generateColorScheme(primary) {
  const base = chroma(primary);

  return {
    primary: base.hex(),
    background: base.brighten(2).hex(),  // lighter background
    highlight: base.brighten(1).saturate(1).hex(), // a bit brighter highlight
    text: base.luminance() < 0.5 ? '#fff' : '#000', // white text on dark bg, black otherwise
  };
}


// Base colors with good contrast text colors
export const colorSchemes = {
  red: {
    background: '#d9534f',
    text: '#ffffff', // white text on red bg
  },
  green: {
    background: '#5cb85c',
    text: '#ffffff',
  },
  blue: {
    background: '#0275d8',
    text: '#ffffff',
  },
  yellow: {
    background: '#f0ad4e',
    text: '#000000',
  },
  gray: {
    background: '#6c757d',
    text: '#ffffff',
  }
};
