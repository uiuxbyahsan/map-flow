import L from 'leaflet';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
// Default basemap; "google" opts into the Google layer (admin can still toggle).
export const DEFAULT_BASEMAP = import.meta.env.VITE_BASEMAP === 'google' ? 'google' : 'streets';
export const GOOGLE_AVAILABLE = Boolean(GOOGLE_KEY);

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function osmLayer() {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: OSM_ATTR });
}

// Streets basemap: MapTiler when a key is set, otherwise the public OSM server as a safe fallback
// so the map is never blank.
export function streetsLayer() {
  if (!MAPTILER_KEY) {
    console.warn('[basemap] VITE_MAPTILER_KEY is not set — falling back to the public OSM tile server.');
    return osmLayer();
  }
  return L.tileLayer(
    `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
    { maxZoom: 19, tileSize: 256, attribution: '&copy; MapTiler &copy; OpenStreetMap contributors' },
  );
}

let googleScript = null;
function loadGoogle() {
  if (window.google?.maps) return Promise.resolve();
  if (!googleScript) {
    googleScript = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&loading=async`;
      el.async = true;
      el.onload = resolve;
      el.onerror = () => {
        googleScript = null;
        reject(new Error('Google Maps script failed to load'));
      };
      document.head.appendChild(el);
    });
  }
  return googleScript;
}

// Google roadmap under Leaflet via googlemutant (ToS-compliant). Falls back to streets on any failure.
export async function googleLayer() {
  if (!GOOGLE_KEY) return streetsLayer();
  try {
    await loadGoogle();
    await import('leaflet.gridlayer.googlemutant');
    return L.gridLayer.googleMutant({ type: 'roadmap', maxZoom: 21 });
  } catch (e) {
    console.warn('[basemap] Google basemap unavailable, using streets.', e);
    return streetsLayer();
  }
}
