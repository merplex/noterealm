import { useState, useEffect } from 'react';
import { C } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { lineApi, notesApi } from '../utils/api';
import { clearImageCache, getImageCacheStats, formatBytes } from '../utils/imageCache';
import { sync, isAutoSyncEnabled, getSyncInfo, SYNC_AUTO_KEY, setUserId } from '../utils/syncService';

function formatSyncTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Settings({ onClose }) {
  const { state, dispatch } = useApp();
  const [lineConnecting, setLineConnecting] = useState(false);
  const [cacheStats, setCacheStats] = useState(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [syncAuto, setSyncAuto] = useState(() => isAutoSyncEnabled());
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | ok | error
  const [syncInfo, setSyncInfo] = useState(() => getSyncInfo());

  const refreshSyncInfo = () => setSyncInfo(getSyncInfo());

  useEffect(() => {
    getImageCacheStats().then(setCacheStats);
    window.addEventListener('sync-updated', refreshSyncInfo);
    return () => window.removeEventListener('sync-updated', refreshSyncInfo);
  }, []);

  const handleSyncToggle = () => {
    const next = !syncAuto;
    setSyncAuto(next);
    localStorage.setItem(SYNC_AUTO_KEY, next ? 'true' : 'false');
  };

  const handleManualSync = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    try {
      const { db } = await import('../db/localDb');
      await sync('local');
      const [notes, todos] = await Promise.all([
        db.notes.orderBy('updatedAt').reverse().toArray(),
        db.todos.orderBy('updatedAt').reverse().toArray(),
      ]);
      dispatch({ type: 'SET_NOTES', payload: notes });
      dispatch({ type: 'SET_TODOS', payload: todos });
      refreshSyncInfo();
      setSyncStatus('ok');
    } catch {
      setSyncStatus('error');
    }
  };

  const handleClearImageCache = async () => {
    setClearingCache(true);
    await clearImageCache();
    setCacheStats({ count: 0, size: 0 });
    setClearingCache(false);
  };

  const isLoggedIn = !!state.user;
  const isLineConnected = state.connections?.some((c) => c.type === 'line' && c.enabled);

  const handleLogin = () => {
    const w = 500, h = 600;
    const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
    const popup = window.open(
      `${import.meta.env.VITE_API_URL || ''}/api/oauth/google?mode=login`,
      'login', `width=${w},height=${h},left=${left},top=${top}`
    );
    const listener = (e) => {
      if (e.data?.type === 'LOGIN_SUCCESS') {
        window.removeEventListener('message', listener);
        const user = e.data.user;
        dispatch({ type: 'SET_USER', payload: user });
        setUserId(user.id);
        // อัปเดต userId ให้โน้ต/todo เก่าที่ยังไม่มี userId แล้ว push ใหม่
        (async () => {
          const { db } = await import('../db/localDb');
          const [orphanNotes, orphanTodos] = await Promise.all([
            db.notes.filter(n => !n.userId).toArray(),
            db.todos.filter(t => !t.userId).toArray(),
          ]);
          await Promise.all([
            ...orphanNotes.map(n => db.notes.update(n.id, { userId: user.id, dirty: true })),
            ...orphanTodos.map(t => db.todos.update(t.id, { userId: user.id, dirty: true })),
          ]);
          // sync: push dirty (รวมที่เพิ่ง mark) → pull
          await sync();
          const [notes, todos] = await Promise.all([
            db.notes.orderBy('updatedAt').reverse().toArray(),
            db.todos.orderBy('updatedAt').reverse().toArray(),
          ]);
          dispatch({ type: 'SET_NOTES', payload: notes });
          dispatch({ type: 'SET_TODOS', payload: todos });
        })().catch(console.warn);
      }
    };
    window.addEventListener('message', listener);
  };

  const handleLogout = () => {
    dispatch({ type: 'SET_USER', payload: null });
    setUserId(null);
  };

  const handleLineConnect = async () => {
    setLineConnecting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/webhook/line/status`);
      const data = await res.json();
      if (data.connected) {
        const conn = { type: 'line', enabled: true, label: data.displayName || 'LINE Bot', basicId: data.basicId || null, linkedAt: new Date().toISOString() };
        const updated = [...(state.connections || []).filter((c) => c.type !== 'line'), conn];
        dispatch({ type: 'SET_CONNECTIONS', payload: updated });
      } else {
        alert('ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาตรวจสอบ Token ใน Railway');
      }
    } catch {
      alert('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    } finally {
      setLineConnecting(false);
    }
  };

  const handleLineDisconnect = () => {
    const updated = (state.connections || []).filter((c) => c.type !== 'line');
    dispatch({ type: 'SET_CONNECTIONS', payload: updated });
  };

  const handleLineTrim = async (period) => {
    dispatch({ type: 'SET_LINE_TRIM', payload: period });
    try {
      await lineApi.trim(period);
      // Reload notes เพื่อแสดง content ที่ตัดแล้ว
      const notes = await notesApi.list();
      dispatch({ type: 'SET_NOTES', payload: notes });
    } catch { /* silent */ }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />

        <div style={styles.header}>
          <h2 style={styles.title}>ตั้งค่า</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Default view */}
          <div style={styles.row}>
            <div>
              <div style={styles.label}>หน้าเริ่มต้น</div>
              <div style={styles.desc}>เข้าแอปแล้วจะเปิดหน้าไหนก่อน</div>
            </div>
            <div style={styles.segmented}>
              <button
                style={{ ...styles.seg, background: state.defaultTab === 'note' ? C.amber : C.white, color: state.defaultTab === 'note' ? C.white : C.sub }}
                onClick={() => dispatch({ type: 'SET_DEFAULT_TAB', payload: 'note' })}
              >
                📝 Note
              </button>
              <button
                style={{ ...styles.seg, background: state.defaultTab === 'todo' ? C.amber : C.white, color: state.defaultTab === 'todo' ? C.white : C.sub }}
                onClick={() => dispatch({ type: 'SET_DEFAULT_TAB', payload: 'todo' })}
              >
                ✅ Todo
              </button>
            </div>
          </div>

          <div style={styles.divider} />

          {/* Login for backup */}
          <div style={styles.row}>
            <div>
              <div style={styles.label}>Login</div>
              <div style={styles.desc}>
                {isLoggedIn ? `${state.user.name || state.user.email}` : 'เข้าสู่ระบบเพื่อ Backup ข้อมูล'}
              </div>
            </div>
            {isLoggedIn ? (
              <button style={{ ...styles.actionBtn, background: C.white, color: C.sub, border: `1px solid ${C.border}` }} onClick={handleLogout}>
                ออกจากระบบ
              </button>
            ) : (
              <button style={styles.actionBtn} onClick={handleLogin}>
                🔐 เข้าสู่ระบบ
              </button>
            )}
          </div>

          <div style={styles.divider} />

          {/* Sync */}
          <div style={styles.row}>
            <div>
              <div style={styles.label}>ซิงค์อัตโนมัติ</div>
              <div style={styles.desc}>
                {syncInfo.lastSyncAt
                  ? `${formatSyncTime(syncInfo.lastSyncAt)} · จาก ${syncInfo.direction === 'local' ? 'client' : 'server'}`
                  : 'ยังไม่เคยซิงค์'}
              </div>
            </div>
            <button onClick={handleSyncToggle} style={styles.toggle(syncAuto)}>
              <span style={styles.toggleKnob(syncAuto)} />
            </button>
          </div>
          <button
            onClick={handleManualSync}
            disabled={syncStatus === 'syncing'}
            style={{
              ...styles.syncBtn,
              opacity: syncStatus === 'syncing' ? 0.6 : 1,
              color: syncStatus === 'error' ? '#ef4444' : syncStatus === 'ok' ? '#16a34a' : C.amber,
              borderColor: syncStatus === 'error' ? '#fca5a5' : syncStatus === 'ok' ? '#86efac' : C.amber,
            }}
          >
            <span style={{ display: 'inline-block', animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
            {' '}
            {syncStatus === 'syncing'
              ? 'กำลังซิงค์...'
              : syncStatus === 'error'
              ? 'ซิงค์ล้มเหลว ลองอีกครั้ง'
              : syncStatus === 'ok' && syncInfo.lastSyncAt
              ? `ซิงค์สำเร็จ · ${formatSyncTime(syncInfo.lastSyncAt)} · จาก ${syncInfo.direction === 'local' ? 'client' : 'server'}`
              : 'ซิงค์ตอนนี้'}
          </button>

          <div style={styles.divider} />

          {/* LINE Connect */}
          <div style={styles.row}>
            <div>
              <div style={styles.label}>LINE Connect</div>
              <div style={styles.desc}>
                {isLineConnected
                  ? `💬 ${state.connections?.find((c) => c.type === 'line')?.label || 'LINE'}`
                  : 'เชื่อมต่อ LINE เพื่อรับ-ส่งโน้ต'}
              </div>
            </div>
            {isLineConnected ? (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {(() => {
                  const lineConn = state.connections?.find((c) => c.type === 'line');
                  if (!lineConn?.basicId) return null;
                  const addUrl = `https://line.me/ti/p/~${lineConn.basicId}`;
                  return (
                    <a
                      href={addUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...styles.actionBtn, background: '#06C755', color: C.white, textDecoration: 'none' }}
                    >
                      💬 เพิ่มเพื่อน
                    </a>
                  );
                })()}
                <button style={{ ...styles.actionBtn, background: C.white, color: C.sub, border: `1px solid ${C.border}` }} onClick={handleLineDisconnect}>
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                style={{ ...styles.actionBtn, background: '#06C755', color: C.white }}
                onClick={handleLineConnect}
                disabled={lineConnecting}
              >
                💬 {lineConnecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ LINE'}
              </button>
            )}
          </div>

          <>
            <div style={styles.divider} />
            <div style={styles.row}>
              <div>
                <div style={styles.label}>ตัดโน้ต LINE</div>
                <div style={styles.desc}>เก็บข้อมูลย้อนหลัง</div>
              </div>
                <div style={styles.segmented}>
                  {[
                    { key: 'week', label: 'สัปดาห์' },
                    { key: 'month', label: 'เดือน' },
                    { key: 'year', label: 'ปี' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      style={{ ...styles.seg, background: state.lineTrim === opt.key ? C.amber : C.white, color: state.lineTrim === opt.key ? C.white : C.sub }}
                      onClick={() => handleLineTrim(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
            </div>
          </>

          <div style={styles.divider} />

          {/* Image Cache */}
          <div style={styles.row}>
            <div>
              <div style={styles.label}>รูปภาพในเครื่อง</div>
              <div style={styles.desc}>
                {cacheStats
                  ? cacheStats.count > 0
                    ? `${cacheStats.count} รูป · ${formatBytes(cacheStats.size)}`
                    : 'ไม่มีรูปที่ cache ไว้'
                  : 'กำลังโหลด...'}
              </div>
            </div>
            <button
              style={{ ...styles.actionBtn, background: C.white, color: C.sub, border: `1px solid ${C.border}`, opacity: cacheStats?.count === 0 ? 0.4 : 1 }}
              onClick={handleClearImageCache}
              disabled={clearingCache || cacheStats?.count === 0}
            >
              {clearingCache ? 'กำลังลบ...' : 'เคลียร์รูป'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    margin: '0 auto',
    background: C.bg,
    borderRadius: '20px 20px 0 0',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: C.border,
    margin: '12px auto 0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px 10px',
  },
  title: { fontSize: 18, fontWeight: 700, color: C.text },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.muted },
  body: { padding: '4px 20px 24px' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 0',
    gap: 12,
  },
  label: { fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 },
  desc: { fontSize: 12, color: C.muted },
  segmented: {
    display: 'flex',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  seg: {
    padding: '7px 12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: C.font,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  divider: { height: 1, background: C.border },
  toggle: (on) => ({
    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
    background: on ? C.amber : C.border,
    display: 'flex', alignItems: 'center', padding: '0 3px',
    transition: 'background 0.2s',
  }),
  toggleKnob: (on) => ({
    width: 18, height: 18, borderRadius: '50%', background: C.white,
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    marginLeft: on ? 'auto' : 0,
    transition: 'margin 0.2s',
  }),
  syncBtn: {
    width: '100%', padding: '10px', borderRadius: 8, marginBottom: 4,
    background: C.white, border: `1px solid ${C.amber}`,
    fontSize: 13, fontWeight: 600, fontFamily: C.font,
    cursor: 'pointer', color: C.amber,
  },
  actionBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: C.amber,
    color: C.white,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: C.font,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};
