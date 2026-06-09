import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getFirestore, collection, getDocs,
} from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';

// ─────────────────────────────────────────────────────────────────────────────
// USAGE: mount <LccAdmin app={firebaseApp} /> anywhere in your app tree.
// Access by navigating to  yourapp.com/#admin
// ─────────────────────────────────────────────────────────────────────────────

export default function LccAdmin({ app }) {
  const [visible, setVisible] = useState(window.location.hash === '#admin');

  useEffect(() => {
    const handler = () => setVisible(window.location.hash === '#admin');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  if (!visible) return null;

  const close = () => {
    window.history.pushState('', document.title, window.location.pathname);
    setVisible(false);
  };

  return <AdminRoot app={app} onClose={close} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root — login gate or dashboard
// ─────────────────────────────────────────────────────────────────────────────
function AdminRoot({ app, onClose }) {
  const auth = getAuth(app);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    return auth.onAuthStateChanged(user => setAuthed(!!user));
  }, [auth]);

  const logout = async () => { await signOut(auth); setAuthed(false); };

  return (
    <div style={S.overlay}>
      <div style={S.panel}>

        {/* Header */}
        <div style={S.header}>
          <span style={S.headerTitle}>🩺 Long COVID — Admin</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {authed && (
              <span style={{ fontSize: 11, color: '#706e68', fontFamily: 'monospace' }}>
                {auth.currentUser?.email}
              </span>
            )}
            {authed && (
              <button style={S.btnGhost} onClick={logout}>Sign out</button>
            )}
            <button style={{ ...S.btnGhost, borderColor: '#d4d0c8', color: '#706e68' }}
              onClick={onClose}>✕</button>
          </div>
        </div>

        {authed
          ? <AdminDashboard app={app} />
          : <AdminLogin auth={auth} onAuthed={() => setAuthed(true)} />
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
function AdminLogin({ auth, onAuthed }) {
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      onAuthed();
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
          ? 'Incorrect email or password'
          : err.message
      );
    }
    setLoading(false);
  };

  return (
    <div style={S.loginWrap}>
      <form style={S.loginBox} onSubmit={submit}>
        <div style={{ fontSize: 38, marginBottom: 12 }}>🔐</div>
        <h2 style={S.loginTitle}>Admin Access</h2>
        <p style={S.loginSub}>Sign in with your Firebase admin account</p>

        <div style={S.field}>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" autoFocus autoComplete="username"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={S.field}>
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" autoComplete="current-password"
            value={pass} onChange={e => setPass(e.target.value)} />
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        <button type="submit" style={{ ...S.btn, width: '100%', marginTop: 8 }}
          disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function AdminDashboard({ app }) {
  const db = getFirestore(app);

  const [users,    setUsers]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState('');
  const [search,   setSearch]  = useState('');
  const [sortCol,  setSortCol] = useState('entries');
  const [sortDir,  setSortDir] = useState(-1);
  const [selected, setSelected] = useState(null); // user object for detail drawer

  // ── Load all users + food journals
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const results = [];

      for (const userDoc of usersSnap.docs) {
        const u   = userDoc.data();
        const uid = userDoc.id;

        const journalSnap = await getDocs(
          collection(db, 'users', uid, 'food_journal')
        );

        let totalCal = 0, totalCarbs = 0, totalFat = 0, totalProt = 0;
        let firstDate = '', lastDate = '';
        const entriesData = journalSnap.docs.map(d => {
          const e = d.data();
          totalCal   += Number(e.calories) || 0;
          totalCarbs += Number(e.carbs)    || 0;
          totalFat   += Number(e.fat)      || 0;
          totalProt  += Number(e.protein)  || 0;
          if (e.date) {
            if (!firstDate || e.date < firstDate) firstDate = e.date;
            if (!lastDate  || e.date > lastDate)  lastDate  = e.date;
          }
          return { id: d.id, ...e };
        });

        results.push({
          uid,
          email:         u.email         || '—',
          age:           u.age           ?? '—',
          covidDate:     u.covidDate     || '—',
          covidDuration: u.covidDuration || '—',
          createdAt:     u.createdAt     || '',
          energyLevel:   u.energyProfile?.currentEnergyLevel ?? '—',
          entries:       entriesData.length,
          entriesData,
          totalCal:      Math.round(totalCal),
          totalCarbs:    Math.round(totalCarbs * 10) / 10,
          totalFat:      Math.round(totalFat   * 10) / 10,
          totalProt:     Math.round(totalProt  * 10) / 10,
          avgCal:        entriesData.length
                           ? Math.round(totalCal / entriesData.length)
                           : 0,
          firstDate, lastDate,
          activeDays:    firstDate && lastDate
            ? Math.round((new Date(lastDate) - new Date(firstDate)) / 86400000) + 1
            : 0,
        });
      }

      setUsers(results);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  // ── Sort + filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...users]
      .filter(u => !q ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q) ||
        String(u.covidDuration).toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        return sortDir * (av > bv ? 1 : av < bv ? -1 : 0);
      });
  }, [users, search, sortCol, sortDir]);

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => -d);
    else { setSortCol(col); setSortDir(-1); }
  };

  // ── Top-level stats
  const stats = useMemo(() => {
    const active = users.filter(u => u.entries > 0);
    const totalEntries = users.reduce((s, u) => s + u.entries, 0);
    const totalCal     = users.reduce((s, u) => s + u.totalCal, 0);
    return {
      totalUsers:   users.length,
      activeUsers:  active.length,
      totalEntries,
      avgEntries:   active.length
        ? Math.round(totalEntries / active.length)
        : 0,
      totalCal:     totalCal.toLocaleString(),
    };
  }, [users]);

  // ── CSV export
  const exportCSV = () => {
    const header = [
      'email','uid','age','covidDate','covidDuration',
      'entries','totalCal','avgCal','totalCarbs','totalFat',
      'firstEntry','lastEntry','activeDays','energyLevel',
    ];
    const rows = users.map(u => [
      u.email, u.uid, u.age, u.covidDate, u.covidDuration,
      u.entries, u.totalCal, u.avgCal, u.totalCarbs, u.totalFat,
      u.firstDate, u.lastDate, u.activeDays, u.energyLevel,
    ].map(v => `"${v}"`).join(','));
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `longcovid-admin-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80, color: '#706e68' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      Loading users and food journals…
    </div>
  );

  if (error) return (
    <div style={{ margin: 32, padding: 20, background: '#faeaea', borderRadius: 6, color: '#8a3010' }}>
      <strong>Error:</strong> {error}
      <br />
      <small>Check Firestore security rules — admin user may need read access to all users.</small>
    </div>
  );

  return (
    <div style={{ padding: '20px 24px 60px' }}>

      {/* Stat cards */}
      <div style={S.statsGrid}>
        <StatCard label="Total Users"        value={stats.totalUsers} />
        <StatCard label="Active (have logs)"  value={stats.activeUsers} accent="#4ac48a" />
        <StatCard label="Total Journal Entries" value={stats.totalEntries.toLocaleString()} accent="#c4a84a" />
        <StatCard label="Avg Entries / User"  value={stats.avgEntries} />
        <StatCard label="Total Calories Logged" value={stats.totalCal} accent="#c46a4a" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, margin: '20px 0 12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Search by email, uid, condition…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={S.searchInput}
        />
        <button style={S.btnSmall} onClick={load}>↻ Refresh</button>
        <button style={{ ...S.btnSmall, background: '#eaf4ed', color: '#2a7040', borderColor: '#b0d8bc' }}
          onClick={exportCSV}>⬇ Export CSV</button>
        <span style={{ fontSize: 11, color: '#706e68', fontFamily: 'monospace' }}>
          {filtered.length} of {users.length} users
        </span>
      </div>

      {/* User table */}
      <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #d4d0c8' }}>
        <table style={S.table}>
          <thead>
            <tr>
              {[
                { key: 'email',     label: 'Email' },
                { key: 'age',       label: 'Age' },
                { key: 'covidDate', label: 'COVID Date' },
                { key: 'covidDuration', label: 'Duration' },
                { key: 'entries',   label: 'Entries ↕' },
                { key: 'totalCal',  label: 'Total kcal' },
                { key: 'avgCal',    label: 'Avg kcal' },
                { key: 'activeDays',label: 'Days span' },
                { key: 'firstDate', label: 'First log' },
                { key: 'lastDate',  label: 'Last log' },
                { key: 'energyLevel', label: 'Energy' },
              ].map(col => (
                <th key={col.key} style={S.th}
                  onClick={() => toggleSort(col.key)}>
                  {col.label}
                  {sortCol === col.key ? (sortDir === -1 ? ' ▼' : ' ▲') : ''}
                </th>
              ))}
              <th style={S.th}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.uid}
                style={{ background: i % 2 ? '#f9f8f6' : '#fff', cursor: 'default' }}>
                <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={u.email}>{u.email}</td>
                <td style={S.tdCenter}>{u.age}</td>
                <td style={S.tdCenter}>{u.covidDate}</td>
                <td style={{ ...S.td, fontSize: 10 }}>{u.covidDuration}</td>
                <td style={S.tdNum}>
                  <span style={{
                    background: u.entries > 50 ? '#eaf4ed' : u.entries > 10 ? '#fdf5dc' : '#f5f3f0',
                    color: u.entries > 50 ? '#2a7040' : u.entries > 10 ? '#7a6010' : '#706e68',
                    padding: '2px 7px', borderRadius: 10, fontWeight: 700, fontSize: 11,
                  }}>{u.entries}</span>
                </td>
                <td style={S.tdNum}>{u.totalCal.toLocaleString()}</td>
                <td style={S.tdNum}>{u.avgCal || '—'}</td>
                <td style={S.tdNum}>{u.activeDays || '—'}</td>
                <td style={S.tdCenter}>{u.firstDate || '—'}</td>
                <td style={S.tdCenter}>{u.lastDate  || '—'}</td>
                <td style={S.tdCenter}>
                  {u.energyLevel !== '—'
                    ? <EnergyBar level={u.energyLevel} />
                    : '—'}
                </td>
                <td style={{ ...S.td, textAlign: 'center' }}>
                  <button style={S.btnTiny} onClick={() => setSelected(u)}>
                    View →
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: 32, color: '#9a9488' }}>
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User detail drawer */}
      {selected && (
        <UserDetail user={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User detail drawer
// ─────────────────────────────────────────────────────────────────────────────
function UserDetail({ user, onClose }) {
  const [entrySearch, setEntrySearch] = useState('');

  const entries = useMemo(() => {
    const q = entrySearch.toLowerCase();
    return [...user.entriesData]
      .filter(e => !q || String(e.date).includes(q))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [user.entriesData, entrySearch]);

  // daily calories chart data
  const dailyData = useMemo(() => {
    const byDay = {};
    user.entriesData.forEach(e => {
      if (e.date) byDay[e.date] = (byDay[e.date] || 0) + (Number(e.calories) || 0);
    });
    return Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  }, [user.entriesData]);

  const maxCal = Math.max(...dailyData.map(d => d[1]), 1);

  return (
    <div style={S.drawerOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.drawer}>

        {/* Drawer header */}
        <div style={{ ...S.header, position: 'sticky', top: 0, zIndex: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e1c18' }}>{user.email}</div>
            <div style={{ fontSize: 10, color: '#706e68', fontFamily: 'monospace' }}>{user.uid}</div>
          </div>
          <button style={{ ...S.btnGhost, borderColor: '#d4d0c8', color: '#706e68' }}
            onClick={onClose}>✕ Close</button>
        </div>

        <div style={{ padding: '20px 24px 60px' }}>

          {/* User meta */}
          <div style={S.statsGrid}>
            <StatCard label="Age"           value={user.age} />
            <StatCard label="COVID Date"    value={user.covidDate} />
            <StatCard label="Duration"      value={user.covidDuration} />
            <StatCard label="Energy Level"  value={`${user.energyLevel}/100`} accent="#4ac48a" />
          </div>

          <div style={{ ...S.statsGrid, marginTop: 12 }}>
            <StatCard label="Journal Entries" value={user.entries} accent="#4a90c4" />
            <StatCard label="Total Calories"  value={user.totalCal.toLocaleString()} accent="#c46a4a" />
            <StatCard label="Avg Calories"    value={`${user.avgCal} kcal/meal`} />
            <StatCard label="Active Days"     value={user.activeDays} />
          </div>

          {/* Macros */}
          {user.entries > 0 && (
            <div style={{ ...S.card, marginTop: 16 }}>
              <div style={S.cardTitle}>Macros — lifetime totals</div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[
                  { label: 'Carbs',   value: `${user.totalCarbs} g`, color: '#4a90c4' },
                  { label: 'Fat',     value: `${user.totalFat} g`,   color: '#c46a4a' },
                  { label: 'Protein', value: `${user.totalProt} g`,  color: '#4ac48a' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: m.color,
                      fontFamily: 'monospace' }}>{m.value}</div>
                    <div style={{ fontSize: 10, color: '#706e68', textTransform: 'uppercase',
                      letterSpacing: '.05em' }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily calories spark chart */}
          {dailyData.length > 0 && (
            <div style={{ ...S.card, marginTop: 12 }}>
              <div style={S.cardTitle}>Daily calories — {dailyData.length} days logged</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2,
                height: 80, overflowX: 'auto' }}>
                {dailyData.map(([date, cal]) => (
                  <div key={date} title={`${date}: ${Math.round(cal)} kcal`}
                    style={{
                      flex: '0 0 8px', background: '#4a90c4',
                      borderRadius: '2px 2px 0 0',
                      height: `${Math.max((cal / maxCal) * 100, 4)}%`,
                      opacity: 0.75,
                    }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 9, color: '#9a9488', fontFamily: 'monospace', marginTop: 4 }}>
                <span>{dailyData[0]?.[0]}</span>
                <span>{dailyData[dailyData.length-1]?.[0]}</span>
              </div>
            </div>
          )}

          {/* Food journal entries */}
          <div style={{ ...S.card, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 12 }}>
              <div style={S.cardTitle}>Food Journal ({user.entries} entries)</div>
              <input type="text" placeholder="Filter by date…" value={entrySearch}
                onChange={e => setEntrySearch(e.target.value)}
                style={{ ...S.searchInput, width: 140, fontSize: 11 }} />
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Date','Calories','Carbs','Fat','Protein','LC Adjust'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={e.id} style={{ background: i % 2 ? '#f9f8f6' : '#fff' }}>
                      <td style={S.tdCenter}>{e.date || '—'}</td>
                      <td style={S.tdNum}>{e.calories ?? '—'}</td>
                      <td style={S.tdNum}>{e.carbs    ?? '—'}</td>
                      <td style={S.tdNum}>{e.fat      ?? '—'}</td>
                      <td style={S.tdNum}>{e.protein  ?? '—'}</td>
                      <td style={{ ...S.tdCenter, fontSize: 11 }}>
                        {e.longCovidAdjust
                          ? <span style={{ color: '#4ac48a', fontWeight: 700 }}>✓</span>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {!entries.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#9a9488' }}>
                        No entries
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent = '#4a90c4' }) {
  return (
    <div style={S.statCard}>
      <div style={{ ...S.statValue, color: accent }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function EnergyBar({ level }) {
  const pct = Math.min(100, Math.max(0, Number(level)));
  const color = pct >= 60 ? '#4ac48a' : pct >= 30 ? '#c4a84a' : '#c46a4a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 48, height: 6, background: '#eceae6', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 10, color, fontFamily: 'monospace', fontWeight: 700 }}>{pct}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(30,28,24,0.5)', backdropFilter: 'blur(3px)',
    display: 'flex', justifyContent: 'flex-end',
  },
  panel: {
    width: 'min(1000px, 100vw)', height: '100vh',
    background: '#f5f3f0', overflowY: 'auto',
    boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    padding: '14px 24px', background: '#ffffff',
    borderBottom: '1px solid #d4d0c8',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 10,
  },
  headerTitle: {
    fontSize: 15, fontWeight: 700, color: '#1e1c18',
    fontFamily: "'Libre Baskerville', Georgia, serif",
  },
  loginWrap: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 40,
  },
  loginBox: {
    background: '#fff', border: '1px solid #d4d0c8', borderRadius: 6,
    padding: '40px 36px', width: 340,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center',
  },
  loginTitle: {
    fontSize: 18, fontWeight: 700, color: '#1e1c18', marginBottom: 4,
    fontFamily: "'Libre Baskerville', Georgia, serif",
  },
  loginSub:  { color: '#706e68', fontSize: 12, marginBottom: 24 },
  field:     { marginBottom: 16, textAlign: 'left' },
  label:     { display: 'block', fontSize: 12, fontWeight: 600, color: '#706e68', marginBottom: 5 },
  input: {
    width: '100%', padding: '9px 12px', border: '1px solid #d4d0c8',
    borderRadius: 3, fontSize: 13, fontFamily: 'inherit',
    background: '#fff', boxSizing: 'border-box', outline: 'none',
  },
  errorBox: {
    background: '#faeaea', color: '#8a3010', padding: '7px 12px',
    borderRadius: 3, fontSize: 12, marginBottom: 10, textAlign: 'left',
  },
  btn: {
    background: '#4a90c4', color: '#fff', border: 'none', borderRadius: 3,
    padding: '10px 20px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnGhost: {
    background: 'transparent', color: '#4a90c4', border: '1px solid #4a90c4',
    borderRadius: 3, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSmall: {
    background: '#eceae6', color: '#1e1c18', border: '1px solid #d4d0c8',
    borderRadius: 3, padding: '6px 12px', fontSize: 11,
    cursor: 'pointer', fontFamily: 'monospace',
  },
  btnTiny: {
    background: '#eceae6', color: '#4a90c4', border: '1px solid #d4d0c8',
    borderRadius: 3, padding: '3px 8px', fontSize: 10,
    cursor: 'pointer', fontFamily: 'monospace',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },
  statCard: {
    background: '#fff', border: '1px solid #d4d0c8', borderRadius: 4,
    padding: '14px 16px', textAlign: 'center',
  },
  statValue: {
    fontSize: 26, fontWeight: 700, fontFamily: 'monospace', marginBottom: 4,
  },
  statLabel: {
    fontSize: 10, color: '#706e68', textTransform: 'uppercase', letterSpacing: '.05em',
  },
  searchInput: {
    padding: '7px 10px', border: '1px solid #d4d0c8', borderRadius: 3,
    fontSize: 12, fontFamily: 'monospace', background: '#fff',
    outline: 'none', flex: 1, minWidth: 200,
  },
  table:    { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    padding: '8px 10px', background: '#f5f3f0', color: '#706e68',
    fontWeight: 600, fontSize: 10, textTransform: 'uppercase',
    letterSpacing: '.04em', borderBottom: '1px solid #d4d0c8',
    whiteSpace: 'nowrap', cursor: 'pointer', textAlign: 'left',
    fontFamily: 'monospace',
  },
  td:        { padding: '7px 10px', color: '#1e1c18', borderBottom: '1px solid #eceae6', fontSize: 12 },
  tdCenter:  { padding: '7px 10px', color: '#1e1c18', borderBottom: '1px solid #eceae6', fontSize: 11, textAlign: 'center', fontFamily: 'monospace' },
  tdNum:     { padding: '7px 10px', color: '#1e1c18', borderBottom: '1px solid #eceae6', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' },
  card: {
    background: '#fff', border: '1px solid #d4d0c8', borderRadius: 4, padding: '16px 20px',
  },
  cardTitle: {
    fontSize: 11, fontWeight: 700, color: '#706e68', textTransform: 'uppercase',
    letterSpacing: '.05em', marginBottom: 12, fontFamily: 'monospace',
  },
  drawerOverlay: {
    position: 'fixed', inset: 0, zIndex: 10001,
    background: 'rgba(30,28,24,0.4)', display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    width: 'min(680px, 100vw)', height: '100vh',
    background: '#f5f3f0', overflowY: 'auto',
    boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
  },
};
