import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_SERVER_URL || '';

/**
 * ForgotPassword.tsx — Cartzilla x Bootstrap
 * Option A: Einfache Seite zum Anfordern eines Passwort-Reset-Links.
 * Backend ist noch nicht angebunden: aktuell nur Demo-Erfolg (Toast).
 *
 * Plug-in später:
 * - POST /auth/forgot { email }
 * - Bei Erfolg: Erfolgsmeldung anzeigen
 * - Bei Fehler: Fehlermeldung anzeigen
 */

const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const valid = useMemo(() => emailRegex.test(email), [email]);

  const resetToastLater = () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) {
      setToast({ type: 'error', msg: 'Bitte gib eine gültige E‑Mail-Adresse ein.' });
      resetToastLater();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/login/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Senden fehlgeschlagen.');
      }
      setToast({ type: 'success', msg: 'Wenn die E‑Mail existiert, senden wir einen Reset‑Link.' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', msg: 'Senden fehlgeschlagen. Bitte später erneut versuchen.' });
    } finally {
      setSubmitting(false);
      resetToastLater();
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 560 }}>
      <style>{`
        .cz-card { border-radius: 1rem; }
        .cz-brand { color: #3edbb7; }
      `}</style>

      <div className="text-center mb-4">
        <h1 className="h4 mb-1">Passwort zurücksetzen</h1>
        <p className="text-muted mb-0">
          Gib deine E‑Mail ein. Wenn sie bei uns registriert ist, erhältst du einen Link zum Zurücksetzen.
        </p>
      </div>

      <div className="card shadow-sm cz-card">
        <div className="card-body p-4 p-lg-5">
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="fpEmail" className="form-label fw-semibold">E‑Mail-Adresse</label>
              <div className="input-group input-group-lg">
                <span className="input-group-text"><i className="bi bi-envelope"></i></span>
                <input
                  id="fpEmail"
                  type="email"
                  className={`form-control form-control-lg ${(touched && !valid) ? 'is-invalid' : ''}`}
                  placeholder="name@firma.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(true)}
                  aria-invalid={touched && !valid}
                  aria-describedby="fpEmailFeedback"
                  required
                />
              </div>
              {touched && !valid && (
                <div id="fpEmailFeedback" className="invalid-feedback d-block">
                  Bitte gib eine gültige E‑Mail-Adresse ein.
                </div>
              )}
            </div>

            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-dark btn-lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Senden …
                  </>
                ) : (
                  <>Reset‑Link anfordern</>
                )}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate('/login')}
              >
                Zurück zum Login
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer Hint */}
      <div className="text-center mt-3">
        <small className="text-muted">
          Du brauchst Hilfe?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/support'); }}>
            Support kontaktieren
          </a>
        </small>
      </div>

      {/* Toasts */}
      <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }} aria-live="assertive" aria-atomic="true">
        {toast && (
          <div className={`toast show align-items-center text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
            <div className="d-flex">
              <div className="toast-body">{toast.msg}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                aria-label="Close"
                onClick={() => setToast(null)}
              ></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;