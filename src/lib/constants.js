export const COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
export const COLOR_LABEL = (c) => c[0].toUpperCase() + c.slice(1);

export const GRADIENTS = {
  sunrise: 'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)',
  ocean: 'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)',
  forest: 'linear-gradient(120deg, #a8e063 0%, #56ab2f 100%)',
  dusk: 'linear-gradient(120deg, #a18cd1 0%, #fbc2eb 100%)',
  ember: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
  slate: 'linear-gradient(120deg, #cfd9df 0%, #e2ebf0 100%)',
  night: 'linear-gradient(120deg, #434343 0%, #000000 100%)',
  berry: 'linear-gradient(120deg, #f093fb 0%, #f5576c 100%)',
};

export const coverStyle = (cover) => {
  if (!cover) return {};
  if (cover.startsWith('gradient:')) return { background: GRADIENTS[cover.slice(9)] || GRADIENTS.slate };
  return { backgroundImage: `url("${cover.replace(/"/g, '%22')}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
};

export const CODE_LANGUAGES = [
  'plain text', 'javascript', 'typescript', 'python', 'json', 'html', 'css', 'bash', 'sql', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'ruby', 'php', 'yaml', 'markdown',
];

export const timeAgo = (ts) => {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
