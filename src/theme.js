export const THEMES = [
  { key: 'mozaik', name: 'Mozaik', desc: 'Renkli bloklar, yumuşak köşeler', sw: ['#2F4BFF', '#FFD43B', '#FF9EC0', '#5EEAD4'], bar: '#E8ECF3' },
  { key: 'yorunge', name: 'Yörünge', desc: 'Koyu zemin, halkalar', sw: ['#0B0F1A', '#C6F432', '#FF7A66', '#7CC8FF'], bar: '#0B0F1A' },
  { key: 'teknik', name: 'Teknik Pano', desc: 'Sade, tablo düzeni, tek vurgu', sw: ['#FAFAFA', '#0A0A0A', '#FF4F00', '#C9C9C9'], bar: '#FAFAFA' },
];
const KEYS = THEMES.map((t) => t.key);

export function applyTheme(key) {
  if (!KEYS.includes(key)) return;
  document.documentElement.dataset.theme = key;
  try { localStorage.setItem('cassandra.theme', key); } catch { /* storage may be blocked */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEMES.find((t) => t.key === key).bar;
}
export const currentTheme = () => document.documentElement.dataset.theme || 'mozaik';
