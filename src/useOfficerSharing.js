import { useCallback, useEffect, useRef, useState } from 'react';
import { push, ref, remove, serverTimestamp, set } from 'firebase/database';
import { db } from './firebase.js';
import { WRITE_INTERVAL_MS } from './config.js';

// Watches GPS and pushes this device's position to /officers/{id} on a fixed cadence.
// The heartbeat re-sends the last fix even when stationary so the marker doesn't go stale.
export function useOfficerSharing() {
  const [active, setActive] = useState(false);
  const [myId, setMyId] = useState(null);
  const [myPos, setMyPos] = useState(null);
  const [error, setError] = useState(null);
  const s = useRef({ watchId: null, timer: null, latest: null, dbRef: null });

  const flush = useCallback(() => {
    const { dbRef, latest } = s.current;
    if (!dbRef || !latest) return;
    set(dbRef, { lat: latest.lat, lng: latest.lng, updatedAt: serverTimestamp() }).catch((e) =>
      setError(`Could not send location: ${e.message}`),
    );
  }, []);

  const stop = useCallback(() => {
    const st = s.current;
    if (st.watchId !== null) navigator.geolocation.clearWatch(st.watchId);
    if (st.timer !== null) clearInterval(st.timer);
    if (st.dbRef) remove(st.dbRef).catch(() => {});
    s.current = { watchId: null, timer: null, latest: null, dbRef: null };
    setActive(false);
    setMyId(null);
    setMyPos(null);
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('This device does not support GPS location.');
      return;
    }
    setError(null);
    const dbRef = push(ref(db, 'officers'));
    s.current.dbRef = dbRef;
    setMyId(dbRef.key);
    setActive(true);

    s.current.watchId = navigator.geolocation.watchPosition(
      (p) => {
        const first = s.current.latest === null;
        s.current.latest = { lat: p.coords.latitude, lng: p.coords.longitude };
        setMyPos(s.current.latest);
        if (first) flush();
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          setError('Location permission was denied. Enable it in your browser settings to use Start Map.');
          stop();
        } else {
          setError('Waiting for GPS signal…');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    s.current.timer = setInterval(() => {
      if (s.current.latest) setError(null);
      flush();
    }, WRITE_INTERVAL_MS);
  }, [flush, stop]);

  useEffect(() => stop, [stop]);

  return { active, myId, myPos, error, start, stop };
}
