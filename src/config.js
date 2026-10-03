import L from 'leaflet';

// Mirpurkhas district bounding box (approx.)
export const MIRPURKHAS_BOUNDS = L.latLngBounds([25.3, 68.75], [25.75, 69.3]);

export const STALE_AFTER_MS = 5 * 60 * 1000; // marker greyed out after 5 min without updates
export const HIDE_AFTER_MS = 12 * 60 * 60 * 1000; // abandoned records hidden (and pruned by admin) after 12 h
export const WRITE_INTERVAL_MS = 8000; // officer position push cadence (spec: 5–10 s)

export const PIN_TYPES = {
  incident: { label: 'Incident', color: '#d62828', glyph: '!' },
  checkpoint: { label: 'Checkpoint', color: '#e09f00', glyph: 'C' },
  patrol: { label: 'Patrol point', color: '#2a9d4b', glyph: 'P' },
  cordon: { label: 'Cordon', color: '#c2185b', glyph: 'X' },
  search_zone: { label: 'Search zone', color: '#0277bd', glyph: 'S' },
  other: { label: 'Other', color: '#7b2cbf', glyph: '•' },
};

// Drawn areas stay translucent so the map underneath and marker clusters remain readable.
export const SHAPE_FILL_OPACITY = 0.22;

// Only a SHA-256 hash of the admin slug ships in the bundle, so the admin URL can't be read from the JS.
const ADMIN_SLUG_HASH = (import.meta.env.VITE_ADMIN_SLUG_HASH || '').trim().toLowerCase();

export async function isAdminPath(path) {
  const m = /^\/admin-([A-Za-z0-9_-]{16,})$/.exec(path);
  if (!m || !/^[0-9a-f]{64}$/.test(ADMIN_SLUG_HASH) || !crypto.subtle) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m[1]));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === ADMIN_SLUG_HASH;
}
