import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { C } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { lineApi, notesApi } from '../utils/api';
import { clearImageCache, getImageCacheStats, formatBytes } from '../utils/imageCache';
import { sync, isAutoSyncEnabled, getSyncInfo, SYNC_AUTO_KEY, setUserId } from '../utils/syncService';
import { getAlertSettings, setAlertSetting } from '../utils/alertSettings';
import { pushSettings, pullSettings } from '../utils/settingsSync';
import { useFontSize, setFontSizeLevel } from '../utils/useFontSize';
import { useLocale, setLocale } from '../utils/useLocale';

function formatSyncTime(iso, locale) {
  if (!iso) return null;
  const d = new Date(iso);
  const lc = locale === 'en' ? 'en-US' : 'th-TH';
  return d.toLocaleString(lc, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Settings({ onClose }) {
  const { state, dispatch } = useApp();
  const fontLevel = useFontSize();
  const d = (fontLevel - 1) * 2;
  const { t, locale } = useLocale();
  const [lineConnecting, setLineConnecting] = useState(false);
  const [cacheStats, setCacheStats] = useState(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [syncAuto, setSyncAuto] = useState(() => isAutoSyncEnabled());
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | ok | error
  const [syncInfo, setSyncInfo] = useState(() => getSyncInfo());

  const [emailFilterSpam, setEmailFilterSpam] = useState(() => localStorage.getItem('nk_email_filter_spam') === 'true');
  const [emailFilterAds, setEmailFilterAds] = useState(() => localStorage.getItem('nk_email_filter_ads') === 'true');
  const [emailFilterSummary, setEmailFilterSummary] = useState(() => localStorage.getItem('nk_email_filter_summary') === 'true');

  const [alertSettings, setAlertSettingsState] = useState(() => getAlertSettings());

  const handleAlertChange = (key, value) => {
    setAlertSetting(key, value);
    setAlertSettingsState(getAlertSettings());
    window.dispatchEvent(new Event('alert-settings-changed'));
    pushSettings().catch(() => {});
  };

  const refreshSyncInfo = () => setSyncInfo(getSyncInfo());

  useEffect(() => {
    getImageCacheStats().then(setCacheStats);
    window.addEventListener('sync-updated', refreshSyncInfo);
    return () => window.removeEventListener('sync-updated', refreshSyncInfo);
  }, []);

  // Fetch email filter settings from server
  useEffect(() => {
    if (!state.user?.id) return;
    const apiUrl = import.meta.env.VITE_API_URL || '';
    fetch(`${apiUrl}/api/oauth/email-filter`, {
      headers: { 'x-user-id': state.user.id },
    })
      .then((r) => r.json())
      .then((data) => {
        const spam = data.filterSpam || false;
        const ads = data.filterAds || false;
        const summary = data.filterSummary || false;
        setEmailFilterSpam(spam);
        setEmailFilterAds(ads);
        setEmailFilterSummary(summary);
        localStorage.setItem('nk_email_filter_spam', spam);
        localStorage.setItem('nk_email_filter_ads', ads);
        localStorage.setItem('nk_email_filter_summary', summary);
      })
      .catch(() => {});
  }, [state.user?.id]);

  const handleEmailFilterToggle = (key, value) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const newSpam = key === 'spam' ? value : emailFilterSpam;
    const newAds = key === 'ads' ? value : emailFilterAds;
    const newSummary = key === 'summary' ? value : emailFilterSummary;
    if (key === 'spam') { setEmailFilterSpam(value); localStorage.setItem('nk_email_filter_spam', value); }
    if (key === 'ads') { setEmailFilterAds(value); localStorage.setItem('nk_email_filter_ads', value); }
    if (key === 'summary') { setEmailFilterSummary(value); localStorage.setItem('nk_email_filter_summary', value); }
    fetch(`${apiUrl}/api/oauth/email-filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': state.user.id },
      body: JSON.stringify({ filterSpam: newSpam, filterAds: newAds, filterSummary: newSummary }),
    }).catch(() => {});
  };

  // ดึง inboxToken จาก server ถ้ายังไม่มีใน state
  useEffect(() => {
    if (!state.user?.id || state.user?.inboxToken) return;
    const apiUrl = import.meta.env.VITE_API_URL || '';
    fetch(`${apiUrl}/api/oauth/inbox-token`, {
      headers: { 'x-user-id': state.user.id },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.inboxToken) {
          dispatch({ type: 'SET_USER', payload: { ...state.user, inboxToken: data.inboxToken } });
        }
      })
      .catch(() => {});
  }, [state.user?.id]);

  const handleSyncToggle = () => {
    const next = !syncAuto;
    setSyncAuto(next);
    localStorage.setItem(SYNC_AUTO_KEY, next ? 'true' : 'false');
    pushSettings().catch(() => {});
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
    const isNative = Capacitor.isNativePlatform();
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const platform = isNative ? 'android' : 'web';
    const oauthUrl = `${apiUrl}/api/oauth/google?mode=login&platform=${platform}`;

    const handleUser = async (user) => {
      dispatch({ type: 'SET_USER', payload: user });
      setUserId(user.id);
      // Pull settings จาก server ทันทีหลัง login
      pullSettings().then(() => {
        setAlertSettingsState(getAlertSettings());
      }).catch(() => {});
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
        await sync();
        const [notes, todos] = await Promise.all([
          db.notes.orderBy('updatedAt').reverse().toArray(),
          db.todos.orderBy('updatedAt').reverse().toArray(),
        ]);
        dispatch({ type: 'SET_NOTES', payload: notes });
        dispatch({ type: 'SET_TODOS', payload: todos });
      })().catch(console.warn);
    };

    if (isNative) {
      // Android: เปิด OAuth ใน browser ภายนอก → deep link noterealm:// ส่งกลับ
      const listener = (e) => {
        window.removeEventListener('nativeOAuth', listener);
        handleUser(e.detail);
      };
      window.addEventListener('nativeOAuth', listener);
      window.open(oauthUrl, '_system'); // _system = เปิด browser ภายนอก
    } else {
      // Web browser: popup + postMessage
      const w = 500, h = 600;
      const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
      window.open(oauthUrl, 'login', `width=${w},height=${h},left=${left},top=${top}`);
      const listener = (e) => {
        if (e.data?.type === 'LOGIN_SUCCESS') {
          window.removeEventListener('message', listener);
          handleUser(e.data.user);
        }
      };
      window.addEventListener('message', listener);
    }
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
        <div style={styles.header}>
          <h2 style={{ ...styles.title, fontSize: 18 + d }}>{t('settings.title')}</h2>
          <button style={{ ...styles.closeBtn, fontSize: 18 + d }} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Profile photo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0 14px' }}>
            <label style={{ cursor: 'pointer', position: 'relative' }}>
              <div style={{ width: 56 + d, height: 56 + d, borderRadius: '50%', background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {state.profileImage
                  ? <img src={state.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: C.white, fontSize: 22 + d, fontWeight: 700 }}>N</span>
                }
              </div>
              <span style={{ position: 'absolute', bottom: -2, right: -2, background: C.white, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, fontSize: 11 }}>📷</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const size = 128;
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    const min = Math.min(img.width, img.height);
                    ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
                    dispatch({ type: 'SET_PROFILE_IMAGE', payload: canvas.toDataURL('image/jpeg', 0.8) });
                  };
                  img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }} />
            </label>
            <div style={{ flex: 1 }}>
              <div style={{ ...styles.label, fontSize: 14 + d }}>{state.user?.displayName || 'NoteRealm'}</div>
              {state.profileImage && (
                <button
                  style={{ background: 'none', border: 'none', fontSize: 11 + d, color: C.muted, cursor: 'pointer', padding: 0, fontFamily: C.font }}
                  onClick={() => dispatch({ type: 'SET_PROFILE_IMAGE', payload: null })}
                >{locale === 'en' ? 'Remove photo' : 'ลบรูป'}</button>
              )}
            </div>
          </div>

          <div style={styles.divider} />

          {/* Language */}
          <div style={styles.row}>
            <div>
              <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.language')}</div>
              <div style={{ ...styles.desc, fontSize: 12 + d }}>{t('settings.languageDesc')}</div>
            </div>
            <div style={styles.segmented}>
              {[{ code: 'th', label: 'ไทย' }, { code: 'en', label: 'EN' }].map((lng) => (
                <button
                  key={lng.code}
                  style={{
                    ...styles.seg, fontSize: 12 + d,
                    background: locale === lng.code ? C.amber : C.white,
                    color: locale === lng.code ? C.white : C.sub,
                    minWidth: 40,
                  }}
                  onClick={() => { setLocale(lng.code); pushSettings().catch(() => {}); }}
                >
                  {lng.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.divider} />

          {/* Font size */}
          <div style={styles.row}>
            <div>
              <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.fontSize')}</div>
              <div style={{ ...styles.desc, fontSize: 12 + d }}>{t('settings.fontSizeDesc')}</div>
            </div>
            <div style={styles.segmented}>
              {[1, 2, 3].map((level) => {
                const ch = locale === 'en' ? 'A' : 'ก';
                return (
                  <button
                    key={level}
                    style={{
                      ...styles.seg,
                      fontSize: 10 + level * 2 + d,
                      background: fontLevel === level ? C.amber : C.white,
                      color: fontLevel === level ? C.white : C.sub,
                      minWidth: 36,
                    }}
                    onClick={() => { setFontSizeLevel(level); pushSettings().catch(() => {}); }}
                  >
                    {ch.repeat(level)}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={styles.divider} />

          {/* Default view */}
          <div style={styles.row}>
            <div>
              <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.defaultView')}</div>
              <div style={{ ...styles.desc, fontSize: 12 + d }}>{t('settings.defaultViewDesc')}</div>
            </div>
            <div style={styles.segmented}>
              <button
                style={{ ...styles.seg, fontSize: 12 + d, background: state.defaultTab === 'note' ? C.amber : C.white, color: state.defaultTab === 'note' ? C.white : C.sub }}
                onClick={() => dispatch({ type: 'SET_DEFAULT_TAB', payload: 'note' })}
              >
                📝 Note
              </button>
              <button
                style={{ ...styles.seg, fontSize: 12 + d, background: state.defaultTab === 'todo' ? C.amber : C.white, color: state.defaultTab === 'todo' ? C.white : C.sub }}
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
              <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.login')}</div>
              <div style={{ ...styles.desc, fontSize: 12 + d }}>
                {isLoggedIn ? `${state.user.name || state.user.email}` : t('settings.loginDesc')}
              </div>
            </div>
            {isLoggedIn ? (
              <button style={{ ...styles.actionBtn, fontSize: 13 + d, background: C.white, color: C.sub, border: `1px solid ${C.border}` }} onClick={handleLogout}>
                {t('settings.logout')}
              </button>
            ) : (
              <button style={{ ...styles.actionBtn, fontSize: 13 + d }} onClick={handleLogin}>
                {t('settings.signIn')}
              </button>
            )}
          </div>

          {/* Sync — ใต้ Login */}
          <div style={styles.row}>
            <div>
              <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.autoSync')}</div>
              <div style={{ ...styles.desc, fontSize: 12 + d }}>
                {syncInfo.lastSyncAt
                  ? `${formatSyncTime(syncInfo.lastSyncAt, locale)} · ${t('settings.syncFrom')} ${syncInfo.direction === 'local' ? t('settings.syncClient') : t('settings.syncServer')}`
                  : t('settings.neverSynced')}
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
              ...styles.syncBtn, fontSize: 13 + d,
              opacity: syncStatus === 'syncing' ? 0.6 : 1,
              color: syncStatus === 'error' ? '#ef4444' : syncStatus === 'ok' ? '#16a34a' : C.amber,
              borderColor: syncStatus === 'error' ? '#fca5a5' : syncStatus === 'ok' ? '#86efac' : C.amber,
            }}
          >
            <span style={{ display: 'inline-block', animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
            {' '}
            {syncStatus === 'syncing'
              ? t('settings.syncing')
              : syncStatus === 'error'
              ? t('settings.syncFailed')
              : syncStatus === 'ok' && syncInfo.lastSyncAt
              ? `${t('settings.syncSuccess')} · ${formatSyncTime(syncInfo.lastSyncAt, locale)} · ${t('settings.syncFrom')} ${syncInfo.direction === 'local' ? t('settings.syncClient') : t('settings.syncServer')}`
              : t('settings.syncNow')}
          </button>

          {/* Email Inbox */}
          {isLoggedIn && state.user?.inboxToken && (
            <>
              <div style={styles.divider} />
              <div style={styles.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.emailNote')}</div>
                  <div style={{ ...styles.desc, fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                    notes-{state.user.inboxToken}@neverjod.com
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {t('settings.emailForwardDesc')}
                  </div>
                </div>
                <button
                  style={{ ...styles.actionBtn, background: C.white, color: C.sub, border: `1px solid ${C.border}`, fontSize: 12 + d }}
                  onClick={() => {
                    navigator.clipboard?.writeText(`notes-${state.user.inboxToken}@neverjod.com`);
                  }}
                >
                  {t('common.copy')}
                </button>
              </div>
              <div style={styles.row}>
                <div>
                  <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.filterSpam')}</div>
                  <div style={{ ...styles.desc, fontSize: 12 + d }}>{t('settings.filterSpamDesc')}</div>
                </div>
                <button onClick={() => handleEmailFilterToggle('spam', !emailFilterSpam)} style={styles.toggle(emailFilterSpam)}>
                  <span style={styles.toggleKnob(emailFilterSpam)} />
                </button>
              </div>
              <div style={styles.row}>
                <div>
                  <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.filterAds')}</div>
                  <div style={{ ...styles.desc, fontSize: 12 + d }}>{t('settings.filterAdsDesc')}</div>
                </div>
                <button onClick={() => handleEmailFilterToggle('ads', !emailFilterAds)} style={styles.toggle(emailFilterAds)}>
                  <span style={styles.toggleKnob(emailFilterAds)} />
                </button>
              </div>
              <div style={styles.row}>
                <div>
                  <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.autoSummary')}</div>
                  <div style={{ ...styles.desc, fontSize: 12 + d }}>{t('settings.autoSummaryDesc')}</div>
                </div>
                <button onClick={() => handleEmailFilterToggle('summary', !emailFilterSummary)} style={styles.toggle(emailFilterSummary)}>
                  <span style={styles.toggleKnob(emailFilterSummary)} />
                </button>
              </div>
            </>
          )}

          <div style={styles.divider} />

          {/* Alert lead-time */}
          <div style={{ padding: '14px 0 4px' }}>
            <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.alertLeadTime')}</div>
            <div style={{ ...styles.desc, fontSize: 12 + d, marginBottom: 10 }}>{t('settings.alertLeadTimeDesc')}</div>

            {/* Urgent row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13 + d, fontWeight: 600, color: '#ef4444', minWidth: 60 }}>🔴 {t('priority.urgent')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <div style={styles.alertInputWrap}>
                  <input
                    type="number" min="0" max="365" step="1"
                    value={alertSettings.urgentDays}
                    onChange={(e) => handleAlertChange('urgentDays', Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)))}
                    style={styles.alertInput}
                  />
                  <span style={styles.alertUnit}>{t('settings.alertDays')}</span>
                </div>
                <div style={styles.alertInputWrap}>
                  <input
                    type="number" min="0" max="23.5" step="0.5"
                    value={alertSettings.urgentHours}
                    onChange={(e) => handleAlertChange('urgentHours', Math.max(0, Math.min(23.5, parseFloat(e.target.value) || 0)))}
                    style={styles.alertInput}
                  />
                  <span style={styles.alertUnit}>{t('settings.alertHours')}</span>
                </div>
              </div>
            </div>

            {/* High row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13 + d, fontWeight: 600, color: '#f97316', minWidth: 60 }}>🟠 {t('priority.high')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <div style={styles.alertInputWrap}>
                  <input
                    type="number" min="0" max="365" step="1"
                    value={alertSettings.highDays}
                    onChange={(e) => handleAlertChange('highDays', Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)))}
                    style={styles.alertInput}
                  />
                  <span style={styles.alertUnit}>{t('settings.alertDays')}</span>
                </div>
                <div style={styles.alertInputWrap}>
                  <input
                    type="number" min="0" max="23.5" step="0.5"
                    value={alertSettings.highHours}
                    onChange={(e) => handleAlertChange('highHours', Math.max(0, Math.min(23.5, parseFloat(e.target.value) || 0)))}
                    style={styles.alertInput}
                  />
                  <span style={styles.alertUnit}>{t('settings.alertHours')}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.divider} />

          {/* LINE Connect */}
          <div style={styles.row}>
            <div>
              <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.lineConnect')}</div>
              <div style={{ ...styles.desc, fontSize: 12 + d }}>
                {isLineConnected
                  ? `💬 ${state.connections?.find((c) => c.type === 'line')?.label || 'LINE'}`
                  : t('settings.lineConnectDesc')}
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
                      style={{ ...styles.actionBtn, fontSize: 13 + d, background: '#06C755', color: C.white, textDecoration: 'none' }}
                    >
                      {t('settings.lineAddFriend')}
                    </a>
                  );
                })()}
                <button style={{ ...styles.actionBtn, fontSize: 13 + d, background: C.white, color: C.sub, border: `1px solid ${C.border}` }} onClick={handleLineDisconnect}>
                  {t('settings.lineDisconnect')}
                </button>
              </div>
            ) : (
              <button
                style={{ ...styles.actionBtn, fontSize: 13 + d, background: '#06C755', color: C.white }}
                onClick={handleLineConnect}
                disabled={lineConnecting}
              >
                {lineConnecting ? t('settings.lineConnecting') : t('settings.lineConnectBtn')}
              </button>
            )}
          </div>

          <>
            <div style={styles.divider} />
            <div style={styles.row}>
              <div>
                <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.lineTrim')}</div>
                <div style={{ ...styles.desc, fontSize: 12 + d }}>{t('settings.lineTrimDesc')}</div>
              </div>
                <div style={styles.segmented}>
                  {[
                    { key: 'week', label: t('settings.week') },
                    { key: 'month', label: t('settings.month') },
                    { key: 'year', label: t('settings.year') },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      style={{ ...styles.seg, fontSize: 12 + d, background: state.lineTrim === opt.key ? C.amber : C.white, color: state.lineTrim === opt.key ? C.white : C.sub }}
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
              <div style={{ ...styles.label, fontSize: 14 + d }}>{t('settings.imageCache')}</div>
              <div style={{ ...styles.desc, fontSize: 12 + d }}>
                {cacheStats
                  ? cacheStats.count > 0
                    ? `${cacheStats.count} · ${formatBytes(cacheStats.size)}`
                    : t('settings.noCache')
                  : t('settings.loadingCache')}
              </div>
            </div>
            <button
              style={{ ...styles.actionBtn, fontSize: 13 + d, background: C.white, color: C.sub, border: `1px solid ${C.border}`, opacity: cacheStats?.count === 0 ? 0.4 : 1 }}
              onClick={handleClearImageCache}
              disabled={clearingCache || cacheStats?.count === 0}
            >
              {clearingCache ? t('settings.clearing') : t('settings.clearCache')}
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
    maxHeight: '90vh',
    margin: '0 auto',
    background: C.bg,
    borderRadius: '20px 20px 0 0',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 'var(--sat, env(safe-area-inset-top, 0px))',
    paddingBottom: 'var(--sab, env(safe-area-inset-bottom, 0px))',
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
  body: { padding: '4px 20px 24px', overflowY: 'auto', flex: 1 },
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
  alertInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    background: C.white,
    padding: '5px 8px',
    minWidth: 0,
  },
  alertInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 13,
    fontFamily: C.font,
    color: C.text,
    textAlign: 'center',
    minWidth: 0,
  },
  alertUnit: {
    fontSize: 11,
    color: C.muted,
    whiteSpace: 'nowrap',
    flexShrink: 0,
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
