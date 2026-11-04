import { IconToday, IconCalendar, IconNotes, IconShared, IconLock } from '../icons.jsx';

export const TABS = [
  { key: 'bugun', label: 'Bugün', Icon: IconToday },
  { key: 'takvim', label: 'Takvim', Icon: IconCalendar },
  { key: 'notlar', label: 'Notlar', Icon: IconNotes },
  { key: 'ortak', label: 'Ortak', Icon: IconShared },
  { key: 'kisisel', label: 'Kişisel', Icon: IconLock },
];

export function Nav({ tab, onChange }) {
  return (
    <nav class="nav" aria-label="Ana menü">
      {TABS.map(({ key, label, Icon }) => (
        <button key={key} aria-label={label} aria-current={tab === key ? 'page' : undefined} onClick={() => onChange(key)}>
          <Icon />
        </button>
      ))}
    </nav>
  );
}
