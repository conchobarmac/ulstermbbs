import { useEffect, useState } from 'react';
import { db, type Db, type User } from './lib/db';
import { href, useRoute } from './lib/router';
import { Home } from './pages/Home';
import { Learn } from './pages/Learn';
import { Review } from './pages/Review';
import { Data } from './pages/Data';

export function App() {
  if (!db) return <Setup />;
  return <Authed db={db} />;
}

function Authed({ db }: { db: Db }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    db.getUser().then(setUser);
    return db.onAuthChange(setUser);
  }, [db]);

  if (user === undefined) return <p className="muted center pad">Loading…</p>;
  if (!user) return <Login db={db} />;
  return <Shell db={db} user={user} />;
}

function Shell({ db, user }: { db: Db; user: User }) {
  const route = useRoute();
  const [p0, p1, p2] = route.path;
  const studying = p0 === 'learn' || (p0 === 'review' && route.params.get('start') === '1');

  let page;
  if (p0 === 'learn' && p1 && p2) {
    page = <Learn key={`${p1}-${p2}-${route.params.get('restart')}`} db={db} week={Number(p1)} section={Number(p2)} restart={route.params.get('restart') === '1'} />;
  } else if (p0 === 'review') {
    page = <Review key={route.params.toString()} db={db} params={route.params} />;
  } else if (p0 === 'data') {
    page = <Data db={db} />;
  } else {
    page = <Home db={db} />;
  }

  return (
    <div className="app">
      {!studying && (
        <header className="top">
          <a className="brand" href={href('/')}>
            <span className="dots"><i className="g0" /><i className="g1" /><i className="g3" /></span> Recall
          </a>
          <nav>
            <a href={href('/')} className={!p0 ? 'on' : ''}>Home</a>
            <a href={href('/review')} className={p0 === 'review' ? 'on' : ''}>Review</a>
            <a href={href('/data')} className={p0 === 'data' ? 'on' : ''}>Import &amp; data</a>
          </nav>
          <div className="user">
            {db.kind === 'demo' ? (
              <span className="badge">Demo: saved in this browser only</span>
            ) : (
              <button className="link small" onClick={() => db.signOut()} title={user.email}>Sign out</button>
            )}
          </div>
        </header>
      )}
      <main>{page}</main>
    </div>
  );
}

function Login({ db }: { db: Db }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await db.signIn(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1 className="brand">
          <span className="dots"><i className="g0" /><i className="g1" /><i className="g3" /></span> Recall
        </h1>
        <label className="field">
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function Setup() {
  return (
    <div className="login">
      <div className="card">
        <h1>Recall isn't connected yet</h1>
        <p>
          The environment variables <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> are missing. Add them in Vercel → your project →
          Settings → Environment Variables, then redeploy. See the README for the full steps.
        </p>
      </div>
    </div>
  );
}
