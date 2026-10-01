import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { HIDE_AFTER_MS, MIRPURKHAS_BOUNDS, PIN_TYPES, STALE_AFTER_MS } from './config.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString() : '—');

function ago(ms, now) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min ago`;
}

function officerIcon(stale, mine) {
  return L.divIcon({
    className: '',
    html: `<div class="officer-dot${stale ? ' stale' : ''}${mine ? ' mine' : ''}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
}

function pinIcon(type) {
  const t = PIN_TYPES[type] || PIN_TYPES.other;
  return L.divIcon({
    className: '',
    html: `<div class="pin-marker" style="--pin:${t.color}"><span>${esc(t.glyph)}</span></div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });
}

function officerHtml(o, now, mine) {
  const stale = now - o.updatedAt > STALE_AFTER_MS;
  return `<div class="pop">
    <div class="pop-title"><span class="badge ${stale ? 'b-stale' : 'b-live'}">${stale ? 'Stale' : 'Live'}</span> Officer${mine ? ' (you)' : ''}</div>
    <div class="pop-meta">Last update: ${ago(o.updatedAt, now)}<br>${fmtTime(o.updatedAt)}</div>
  </div>`;
}

function pinHtml(id, p, isAdmin) {
  const t = PIN_TYPES[p.type] || PIN_TYPES.other;
  return `<div class="pop">
    <div class="pop-title"><span class="badge" style="background:${t.color}">${esc(t.label)}</span> ${esc(p.label)}</div>
    ${p.note ? `<div class="pop-note">${esc(p.note)}</div>` : ''}
    <div class="pop-meta">Created: ${fmtTime(p.createdAt)}${p.updatedAt ? `<br>Edited: ${fmtTime(p.updatedAt)}` : ''}</div>
    ${isAdmin ? `<button class="pop-btn" data-edit-pin="${esc(id)}">Edit / Delete</button>` : ''}
  </div>`;
}

function clusterIcon(cluster) {
  const kids = cluster.getAllChildMarkers();
  const hasPin = kids.some((m) => m.options.item.kind === 'pin');
  const hasOfficer = kids.some((m) => m.options.item.kind === 'officer');
  const cls = hasPin && hasOfficer ? 'mixed' : hasPin ? 'pins' : 'officers';
  return L.divIcon({
    className: '',
    html: `<div class="cluster cluster-${cls}">${kids.length}</div>`,
    iconSize: [38, 38],
  });
}

/**
 * Imperative Leaflet map. Officer dots and pins share one cluster group so any overlapping
 * items collapse into a count badge; tapping a badge zooms in, or — if the items are within
 * a few meters or the map is fully zoomed — lists everything at that spot in one popup.
 */
export default function LeafletMap({ officers, pins, now, myId, isAdmin, onMapClick, onEditPin, focus }) {
  const elRef = useRef(null);
  const st = useRef(null);
  const cb = useRef({});
  cb.current = { onMapClick, onEditPin, isAdmin };

  useEffect(() => {
    const map = L.map(elRef.current, {
      maxBounds: MIRPURKHAS_BOUNDS.pad(0.15),
      maxBoundsViscosity: 1.0,
      minZoom: 9,
      maxZoom: 19,
      zoomControl: true,
    });
    map.fitBounds(MIRPURKHAS_BOUNDS);
    map.setMinZoom(Math.max(9, map.getZoom() - 1));
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: clusterIcon,
    });
    cluster.on('clusterclick', (e) => {
      const c = e.propagatedFrom || e.layer;
      const b = c.getBounds();
      const spanM = b.getNorthEast().distanceTo(b.getSouthWest());
      if (map.getZoom() >= map.getMaxZoom() || spanM < 30) {
        const items = c.getAllChildMarkers().map((m) => m.getPopup().getContent());
        // Deferred: opened synchronously, the same tap's map click handling closes it again.
        setTimeout(() =>
          L.popup({ maxHeight: 300, className: 'list-popup' })
            .setLatLng(c.getLatLng())
            .setContent(`<div class="pop-list-head">${items.length} items here</div>${items.join('<hr>')}`)
            .openOn(map),
        );
      } else {
        c.zoomToBounds({ padding: [40, 40] });
      }
    });
    map.addLayer(cluster);

    // A tap that only closes an open popup shouldn't also open the new-pin form.
    let lastPopupClose = 0;
    map.on('popupclose', () => (lastPopupClose = Date.now()));
    map.on('click', (e) => {
      if (Date.now() - lastPopupClose < 400) return;
      cb.current.onMapClick?.(e.latlng);
    });

    // Edit buttons live in popup HTML (re-rendered on every refresh), so delegate from the pane.
    L.DomEvent.on(map.getPane('popupPane'), 'click', (ev) => {
      const btn = ev.target.closest?.('[data-edit-pin]');
      if (!btn) return;
      L.DomEvent.stop(ev);
      const id = btn.getAttribute('data-edit-pin');
      setTimeout(() => {
        map.closePopup();
        if (cb.current.isAdmin) cb.current.onEditPin?.(id);
      });
    });

    st.current = { map, cluster, officerMarkers: new Map(), pinMarkers: new Map() };
    return () => {
      map.remove();
      st.current = null;
    };
  }, []);

  // Sync officer + pin markers with live data.
  useEffect(() => {
    const s = st.current;
    if (!s) return;
    const { cluster, officerMarkers, pinMarkers } = s;
    const toAdd = [];

    const seenO = new Set();
    for (const [id, o] of Object.entries(officers)) {
      if (typeof o?.lat !== 'number' || typeof o?.updatedAt !== 'number') continue;
      if (now - o.updatedAt > HIDE_AFTER_MS) continue;
      seenO.add(id);
      const stale = now - o.updatedAt > STALE_AFTER_MS;
      const mine = id === myId;
      const html = officerHtml(o, now, mine);
      let m = officerMarkers.get(id);
      if (!m) {
        m = L.marker([o.lat, o.lng], { icon: officerIcon(stale, mine), item: { kind: 'officer' } }).bindPopup(html);
        m._state = `${stale}|${mine}`;
        officerMarkers.set(id, m);
        toAdd.push(m);
      } else {
        const ll = m.getLatLng();
        if (ll.lat !== o.lat || ll.lng !== o.lng) m.setLatLng([o.lat, o.lng]);
        if (m._state !== `${stale}|${mine}`) {
          m.setIcon(officerIcon(stale, mine));
          m._state = `${stale}|${mine}`;
        }
        if (m.getPopup().getContent() !== html) m.setPopupContent(html);
      }
    }
    for (const [id, m] of officerMarkers) {
      if (!seenO.has(id)) {
        cluster.removeLayer(m);
        officerMarkers.delete(id);
      }
    }

    const seenP = new Set();
    for (const [id, p] of Object.entries(pins)) {
      if (typeof p?.lat !== 'number') continue;
      seenP.add(id);
      const html = pinHtml(id, p, isAdmin);
      let m = pinMarkers.get(id);
      if (!m) {
        m = L.marker([p.lat, p.lng], { icon: pinIcon(p.type), item: { kind: 'pin' } }).bindPopup(html);
        m._type = p.type;
        pinMarkers.set(id, m);
        toAdd.push(m);
      } else {
        const ll = m.getLatLng();
        if (ll.lat !== p.lat || ll.lng !== p.lng) m.setLatLng([p.lat, p.lng]);
        if (m._type !== p.type) {
          m.setIcon(pinIcon(p.type));
          m._type = p.type;
        }
        if (m.getPopup().getContent() !== html) m.setPopupContent(html);
      }
    }
    for (const [id, m] of pinMarkers) {
      if (!seenP.has(id)) {
        cluster.removeLayer(m);
        pinMarkers.delete(id);
      }
    }

    if (toAdd.length) cluster.addLayers(toAdd);
    cluster.refreshClusters();
  }, [officers, pins, now, myId, isAdmin]);

  // Pan to a requested point (e.g. "centre on me").
  useEffect(() => {
    if (focus && st.current) st.current.map.setView([focus.lat, focus.lng], Math.max(st.current.map.getZoom(), 16));
  }, [focus]);

  return <div ref={elRef} className="map" />;
}
