// The frame drawn around "Günün notu". Chosen in Ayarlar, kept in MY note prefs (users/{uid}/prefs/notes, ui.dayframe) with the phone's copy as the quick fallback.
export const FRAMES = [
  { key: 'kitap', name: 'Kitap', desc: 'Cilt sırtı, sayfa kenarları, ayraç ve kıvrık köşe' },
  { key: 'sade', name: 'Sade çizgi', desc: 'Çerçeve yok: üstte ve altta çizgi, büyük tırnak işareti' },
  { key: 'sekme', name: 'Klasör sekmesi', desc: 'Yumuşak kutu, köşesinde dosya sekmesi gibi etiket' },
  { key: 'serit', name: 'Kenar şeridi', desc: 'Solda renkli kalın şerit, altta kesik çizgi' },
  { key: 'bilet', name: 'Bilet', desc: 'Çentikli, kesik çizgiyle bölünmüş bilet' },
  { key: 'not', name: 'Not kağıdı', desc: 'Eğik sarı yapışkan not, üstünde bant' },
];
export const FRAME_KEY = 'cassandra.dayframe';
const OK = FRAMES.map((f) => f.key);
export function dayFrame(prefs) {
  let v = prefs?.ui?.dayframe;
  if (!OK.includes(v)) { try { v = localStorage.getItem(FRAME_KEY); } catch { v = null; } }
  return OK.includes(v) ? v : 'kitap';
}
