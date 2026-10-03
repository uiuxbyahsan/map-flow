import { useEffect, useMemo, useState } from 'react';
import { ref, remove, serverTimestamp, update } from 'firebase/database';
import { db } from './firebase.js';
import { HIDE_AFTER_MS, PIN_TYPES, STALE_AFTER_MS } from './config.js';
import { useLiveData } from './useLiveData.js';
import { useOfficerSharing } from './useOfficerSharing.js';
import LeafletMap from './LeafletMap.jsx';
import PinForm from './PinForm.jsx';
import SearchBox from './SearchBox.jsx';
import { shapeTypeOf } from './shapes.js';

export default function MapScreen({ isAdmin }) {
  const { officers, pins, now } = useLiveData();
  const sharing = useOfficerSharing();
  const [form, setForm] = useState(null); // { id?, shapeType, geometry?, pin?, type, label, note }
  const [editError, setEditError] = useState(null);
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
    setForm({ shapeType: 'point', geometry: { lat: latlng.lat, lng: latlng.lng }, type: 'incident', label: '', note: '' });
  };

  const openDrawn = (shapeType, geometry) => {
    const type = shapeType === 'circle' ? 'search_zone' : 'cordon';
    setForm({ shapeType, geometry, type, label: '', note: '' });
  };

  const openEdit = (id) => {
    const p = pins[id];
    if (p) setForm({ id, shapeType: shapeTypeOf(p), pin: p, type: p.type, label: p.label, note: p.note || '' });
  };

  // Vertex edits from the Leaflet.draw "Edit layers" toolbar.
  const saveEditedShapes = (edits) => {
    setEditError(null);
    for (const { id, geometry } of edits) {
      update(ref(db, `pins/${id}`), { ...geometry, updatedAt: serverTimestamp() }).catch((e) =>
        setEditError(`Could not save shape change: ${e.message}`),
      );
    }
  };

  return (
    <div className={`screen ${isAdmin ? 'admin' : 'officer'}`}>
      <header className="topbar">
        <div className="brand">
          Map{isAdmin && <span className="admin-tag">Admin</span>}
        </div>
        {isAdmin && (
          <div className="stats">
            <span><i className="dot live" /> {counts.live} live</span>
            <span><i className="dot stale" /> {counts.stale} stale</span>
            <span>{counts.pins} pins</span>
          </div>
        )}
      </header>

      {isAdmin && <SearchBox onSelect={setFocus} />}

      <div className="map-wrap">
        <LeafletMap
          officers={officers}
          pins={pins}
          now={now}
          myId={sharing.myId}
          isAdmin={isAdmin}
          onMapClick={isAdmin ? openNew : undefined}
          onEditPin={isAdmin ? openEdit : undefined}
          onShapeDrawn={isAdmin ? openDrawn : undefined}
          onShapesEdited={isAdmin ? saveEditedShapes : undefined}
          hasDraft={Boolean(form && !form.id && form.shapeType !== 'point')}
          focus={focus}
        />
        <Legend />
      </div>

      {isAdmin ? (
        !form && (
          <div className="hint">
            {editError || 'Tap the map for a point pin, or use the drawing tools (left) for an area'}
          </div>
        )
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
          <li><i className="area-key" /> Shaded area: drawn zone (colour = type)</li>
          <li><i className="dot cluster-key" /> Several items close together</li>
        </ul>
      )}
    </div>
  );
}
