import { useEffect, useState } from 'react';
import { push, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import { db } from './firebase.js';
import { PIN_TYPES } from './config.js';

export default function PinForm({ initial, onClose }) {
  const [type, setType] = useState(initial.type);
  const [label, setLabel] = useState(initial.label);
  const [note, setNote] = useState(initial.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const editing = Boolean(initial.id);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const save = (e) => {
    e.preventDefault();
    const fields = { type, label: label.trim(), note: note.trim() };
    if (!fields.label) return setError('Label is required.');
    run(() =>
      editing
        ? update(ref(db, `pins/${initial.id}`), { ...fields, updatedAt: serverTimestamp() })
        : set(push(ref(db, 'pins')), { ...fields, lat: initial.lat, lng: initial.lng, createdAt: serverTimestamp() }),
    );
  };

  const del = () => {
    if (window.confirm(`Delete pin "${initial.label}"? Everyone will see it disappear.`)) {
      run(() => remove(ref(db, `pins/${initial.id}`)));
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? 'Edit pin' : 'New pin'}</h2>
        <div className="coords">
          {initial.lat.toFixed(5)}, {initial.lng.toFixed(5)}
        </div>

        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(PIN_TYPES).map(([k, t]) => (
              <option key={k} value={k}>{t.label}</option>
            ))}
          </select>
        </label>
        <label>
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} autoFocus required />
        </label>
        <label>
          <span>Note <span className="optional">(optional)</span></span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
        </label>

        {error && <div className="error">{error}</div>}

        <div className="sheet-actions">
          {editing && (
            <button type="button" className="danger" onClick={del} disabled={busy}>Delete</button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{editing ? 'Save' : 'Add pin'}</button>
        </div>
      </form>
    </div>
  );
}
