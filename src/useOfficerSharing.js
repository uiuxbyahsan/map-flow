import { useEffect, useRef, useState } from 'react';
import { push, ref, remove, serverTimestamp, set } from 'firebase/database';
import { db } from './firebase.js';
import { WRITE_INTERVAL_MS } from './config.js';

// Auto-starts on mount: requests GPS permission and pushes this device's position to
// /officers/{id} on a fixed cadence. No manual start/stop — sharing ends when the page is
// closed or the browser suspends the geolocation watch. The heartbeat re-sends the last fix
// even when stationary so the marker doesn't go stale.
export function useOfficerSharing() {
  const [myId, setMyId] = useState(null);
  const [myPos, setMyPos] = useState(null);
  const [error, setError] = useState(null);
  const s = useRef({ watchId: null, timer: null, latest: null, dbRef: null });

  useEffect(() => {
    const flush = () => {
      const { dbRef, latest } = s.current;
      if (!dbRef || !latest) return;
      set(dbRef, { lat: latest.lat, lng: latest.lng, updatedAt: serverTimestamp() }).catch((e) =>
        setError(`Could not send location: ${e.message}`),
      );
    };

    if (!('geolocation' in navigator)) {
      setError('This device does not support GPS location.');
      return;
    }

    const dbRef = push(ref(db, 'officers'));
    s.current.dbRef = dbRef;
    setMyId(dbRef.key);

    s.current.watchId = navigator.geolocation.watchPosition(
      (p) => {
        const first = s.current.latest === null;
        s.current.latest = { lat: p.coords.latitude, lng: p.coords.longitude };
        setMyPos(s.current.latest);
        if (first) flush();
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          setError('Location sharing is off. Allow location access in your browser settings, then reload.');
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

    // Drop this device's marker promptly when the tab is closed or hidden.
    const removeSelf = () => {
      if (s.current.dbRef) remove(s.current.dbRef).catch(() => {});
    };
    window.addEventListener('pagehide', removeSelf);

    return () => {
      window.removeEventListener('pagehide', removeSelf);
      if (s.current.watchId !== null) navigator.geolocation.clearWatch(s.current.watchId);
      if (s.current.timer !== null) clearInterval(s.current.timer);
      removeSelf();
      s.current = { watchId: null, timer: null, latest: null, dbRef: null };
    };
  }, []);

  return { myId, myPos, error };
}
