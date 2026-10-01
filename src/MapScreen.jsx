import { useEffect, useMemo, useState } from 'react';
import { ref, remove } from 'firebase/database';
import { db } from './firebase.js';
import { HIDE_AFTER_MS, PIN_TYPES, STALE_AFTER_MS } from './config.js';
import { useLiveData } from './useLiveData.js';
import { useOfficerSharing } from './useOfficerSharing.js';
import LeafletMap from './LeafletMap.jsx';
import PinForm from './PinForm.jsx';

export default function MapScreen({ isAdmin }) {
  const { officers, pins, now } = useLiveData();
  const sharing = useOfficerSharing();
  const [form, setForm] = useState(null); // { id?, lat, lng, type, label, note }
  const [focus, setFocus] = useState(null);

  // Admin housekeeping: drop officer records abandoned for 12+ hours (tab closed without Stop).
  useEffect(() => {
    if (!isAdmin) return;
    for (const [id, o] of Object.entries(officers)) {
      if (typeof o?.updatedAt === 'number' && now - o.updatedAt > HIDE_AFTER_MS) {
        remove(ref(db, `officers/${id}`)).catch(() => {});
      }
    }
  }, [isAdmin, officers, now]);

  const counts = useMemo(() => {
    let live = 0;
    let stale = 0;
    for (const o of Object.values(officers)) {
      if (typeof o?.updatedAt !== 'number' || now - o.updatedAt > HIDE_AFTER_MS) continue;
      if (now - o.updatedAt > STALE_AFTER_MS) stale++;
      else live++;
    }
    return { live, stale, pins: Object.keys(pins).length };
  }, [officers, pins, now]);

  const openNew = (latlng) => {
    if (!isAdmin) return;
    setForm({ lat: latlng.lat, lng: latlng.lng, type: 'incident', label: '', note: '' });
  };

  const openEdit = (id) => {
    const p = pins[id];
    if (p) setForm({ id, lat: p.lat, lng: p.lng, type: p.type, label: p.label, note: p.note || '' });
  };

  return (
    <div className={`screen ${isAdmin ? 'admin' : 'officer'}`}>
      <header className="topbar">
        <div className="brand">
          Mirpurkhas Police Map{isAdmin && <span className="admin-tag">Admin</span>}
        </div>
        {isAdmin && (
          <div className="stats">
            <span><i className="dot live" /> {counts.live} live</span>
            <span><i className="dot stale" /> {counts.stale} stale</span>
            <span>{counts.pins} pins</span>
          </div>
        )}
      </header>

      <LeafletMap
        officers={officers}
        pins={pins}
        now={now}
        myId={sharing.myId}
        isAdmin={isAdmin}
        onMapClick={isAdmin ? openNew : undefined}
        onEditPin={isAdmin ? openEdit : undefined}
        focus={focus}
      />

      <Legend />

      {isAdmin ? (
        !form && <div className="hint">Tap the map to place a pin</div>
      ) : (
        <div className="controls">
          {sharing.error && <div className="error">{sharing.error}</div>}
          <div className="control-row">
            <button
              className={`share-btn ${sharing.active ? 'on' : ''}`}
              onClick={sharing.active ? sharing.stop : sharing.start}
            >
              {sharing.active ? 'Stop Map' : 'Start Map'}
            </button>
            {sharing.active && sharing.myPos && (
              <button className="center-btn" onClick={() => setFocus({ ...sharing.myPos })} aria-label="Centre on me">
                ◎
              </button>
            )}
          </div>
          <div className="disclosure">
            {sharing.active ? (
              <><i className="pulse" /> Your live location is being shared on this map</>
            ) : (
              'Start Map shares your live location on this map until you tap Stop Map'
            )}
          </div>
        </div>
      )}

      {isAdmin && form && <PinForm initial={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`legend ${open ? 'open' : ''}`}>
      <button className="legend-toggle" onClick={() => setOpen(!open)}>
        {open ? '×' : 'Key'}
      </button>
      {open && (
        <ul>
          <li><i className="dot live" /> Officer (live)</li>
          <li><i className="dot stale" /> Officer (no update 5+ min)</li>
          {Object.entries(PIN_TYPES).map(([k, t]) => (
            <li key={k}><i className="dot" style={{ background: t.color }} /> {t.label}</li>
          ))}
          <li><i className="dot cluster-key" /> Several items close together</li>
        </ul>
      )}
    </div>
  );
}
