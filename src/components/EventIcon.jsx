import { IconCalendar, IconCake, IconHospital, IconPlane, IconHotel } from '../icons.jsx';

// The icon of a calendar entry by its type (kind): plain entries get a calendar.
export function EventIcon({ kind }) {
  if (kind === 'dogum') return <IconCake />;
  if (kind === 'hastane') return <IconHospital />;
  if (kind === 'ucus') return <IconPlane />;
  if (kind === 'otel') return <IconHotel />;
  return <IconCalendar />;
}
