import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from './firebase.js';

// Live subscription to /officers and /pins, plus a clock (corrected to server time)
// that ticks so stale markers re-evaluate without new data arriving.
export function useLiveData() {
  const [officers, setOfficers] = useState({});
  const [pins, setPins] = useState({});
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const unsubs = [
      onValue(ref(db, 'officers'), (s) => setOfficers(s.val() || {})),
      onValue(ref(db, 'pins'), (s) => setPins(s.val() || {})),
      onValue(ref(db, '.info/serverTimeOffset'), (s) => setOffset(s.val() || 0)),
    ];
    const timer = setInterval(() => setTick(Date.now()), 15000);
    return () => {
      unsubs.forEach((u) => u());
      clearInterval(timer);
    };
  }, []);

  return { officers, pins, now: tick + offset };
}
