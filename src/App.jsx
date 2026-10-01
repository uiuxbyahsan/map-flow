import { useEffect, useState } from 'react';
import { firebaseConfigured } from './firebase.js';
import { isAdminPath } from './config.js';
import MapScreen from './MapScreen.jsx';

export default function App() {
  let path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') {
    window.history.replaceState(null, '', '/map');
    path = '/map';
  }
  const isOfficer = path === '/map';
  const [isAdmin, setIsAdmin] = useState(isOfficer ? false : null); // null = still checking

  useEffect(() => {
    if (!isOfficer) isAdminPath(path).then(setIsAdmin, () => setIsAdmin(false));
  }, [isOfficer, path]);

  if (isAdmin === null) return null;
  if (!isOfficer && !isAdmin) {
    return (
      <div className="notice">
        <h1>Page not found</h1>
      </div>
    );
  }
  if (!firebaseConfigured) {
    return (
      <div className="notice">
        <h1>Not configured</h1>
        <p>
          Firebase environment variables are missing. Copy <code>.env.example</code> to{' '}
          <code>.env.local</code> (or set them in Vercel) and restart.
        </p>
      </div>
    );
  }
  return <MapScreen isAdmin={isAdmin} />;
}
