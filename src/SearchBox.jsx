import { useEffect, useRef, useState } from 'react';
import { MIRPURKHAS_BOUNDS } from './config.js';

const DEBOUNCE_MS = 500;
const MIN_CHARS = 3;
const b = MIRPURKHAS_BOUNDS;
const VIEWBOX = [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()].join(',');

/**
 * Place search via OpenStreetMap Nominatim, restricted to the district. Selecting a result only
 * moves the map; placing or drawing a pin is a separate action.
 * Usage policy: debounced (no per-keystroke calls), one request in flight, and the browser's
 * Referer identifies the app (browsers don't allow scripts to set User-Agent).
 */
export default function SearchBox({ onSelect }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | empty | error
  const [open, setOpen] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    const query = q.trim();
    abortRef.current?.abort();
    if (query.length < MIN_CHARS) {
      setResults([]);
      setStatus('idle');
      return;
    }
    const timer = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStatus('loading');
      try {
        const params = new URLSearchParams({
          q: query,
          format: 'jsonv2',
          limit: '6',
          countrycodes: 'pk',
          viewbox: VIEWBOX,
          bounded: '1',
          'accept-language': 'en',
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          signal: ctrl.signal,
          referrerPolicy: 'strict-origin-when-cross-origin',
        });
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        setResults(data);
        setStatus(data.length ? 'idle' : 'empty');
        setOpen(true);
      } catch (e) {
        if (e.name !== 'AbortError') setStatus('error');
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const pick = (r) => {
    const [s, n, w, e] = r.boundingbox.map(Number);
    onSelect({ bounds: [[s, w], [n, e]] });
    setQ(r.name || r.display_name.split(',')[0]);
    setOpen(false);
  };

  return (
    <div className="search">
      <input
        type="search"
        placeholder="Search a place in Mirpurkhas…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) pick(results[0]);
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-label="Search places"
      />
      {open && q.trim().length >= MIN_CHARS && (
        <ul className="search-results">
          {status === 'loading' && <li className="search-msg">Searching…</li>}
          {status === 'empty' && <li className="search-msg">No places found in the district</li>}
          {status === 'error' && <li className="search-msg">Search unavailable, try again</li>}
          {status !== 'loading' &&
            results.map((r) => (
              <li key={r.place_id}>
                <button type="button" onClick={() => pick(r)}>
                  <strong>{r.name || r.display_name.split(',')[0]}</strong>
                  <span>{r.display_name}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
