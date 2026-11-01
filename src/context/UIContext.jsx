import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const UIContext = createContext(null);
const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

/** Toasts + full-screen loader (replaces showToast / showLoading / hideLoading from script.js). */
export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState(null);
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, removing: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 300);
  }, []);

  const toast = useCallback(
    (title, msg = '', type = 'info') => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, title, msg, type }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );
  const showLoading = useCallback((msg = 'Loading…') => setLoadingMsg(msg), []);
  const hideLoading = useCallback(() => setLoadingMsg(null), []);

  const value = useMemo(() => ({ toast, showLoading, hideLoading }), [toast, showLoading, hideLoading]);

  return (
    <UIContext.Provider value={value}>
      {children}
      <div id="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}${t.removing ? ' removing' : ''}`}>
            <span className="toast-icon">{ICONS[t.type] || 'ℹ️'}</span>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.msg ? <div className="toast-msg">{t.msg}</div> : null}
            </div>
            <span className="toast-close" onClick={() => dismiss(t.id)}>✕</span>
          </div>
        ))}
      </div>
      {loadingMsg !== null && (
        <div className="loading-overlay">
          <div className="spinner spinner-blue" style={{ width: 40, height: 40, borderWidth: 4 }} />
          <p>{loadingMsg}</p>
        </div>
      )}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
