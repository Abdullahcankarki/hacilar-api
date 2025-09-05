import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
const API_BASE = process.env.REACT_APP_API_SERVER_URL || '';

/**
 * ResetPassword.tsx — Cartzilla x Bootstrap
 * Option B Schritt 2: Neues Passwort festlegen anhand eines Tokens (?token=...)
 * - Validierung: min. 6 Zeichen (Backend-Anforderung), Anzeige Stärkeindikator
 * - Show/Hide Passwort
 * - Call: POST /password/reset { token, newPassword }
 */

const MIN_LEN = 6; // muss mit Backend übereinstimmen
const hasLower = (s: string) => /[a-z]/.test(s);
const hasUpper = (s: string) => /[A-Z]/.test(s);
const hasDigit = (s: string) => /\d/.test(s);
const hasSymbol = (s: string) => /[^A-Za-z0-9]/.test(s);

function strengthScore(pw: string) {
  let score = 0;
  if (pw.length >= MIN_LEN) score++;
  if (hasLower(pw)) score++;
  if (hasUpper(pw)) score++;
  if (hasDigit(pw)) score++;
  if (hasSymbol(pw)) score++;
  return Math.min(score, 5);
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({ pw: false, confirm: false });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const score = useMemo(() => strengthScore(password), [password]);

  const validPw = useMemo(() => password.length >= MIN_LEN, [password]);
  const match = useMemo(() => password === confirm && confirm.length > 0, [password, confirm]);
  const tokenMissing = !token;

  const resetToastLater = () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ pw: true, confirm: true });
    if (tokenMissing || !validPw || !match) {
      setToast({ type: 'error', msg: tokenMissing ? 'Ungültiger oder fehlender Reset‑Token.' : 'Bitte prüfe die rot markierten Felder.' });
      resetToastLater();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/login/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Zurücksetzen fehlgeschlagen.');
      }
      setToast({ type: 'success', msg: 'Passwort aktualisiert. Du kannst dich jetzt anmelden.' });
      resetToastLater();
      setTimeout(() => navigate('/login'), 800);
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message || 'Zurücksetzen fehlgeschlagen. Bitte später erneut versuchen.' });
      resetToastLater();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 560 }}>
      <style>{`
        .cz-card { border-radius: 1rem; }
        .cz-meter { height: 6px; border-radius: 999px; }
      `}</style>

      <div className="text-center mb-4">
        <h1 className="h4 mb-1">Neues Passwort festlegen</h1>
        <p className="text-muted mb-0">
          Bitte wähle ein neues Passwort. Der Link ist zeitlich begrenzt gültig.
        </p>
      </div>

      <div className="card shadow-sm cz-card">
        <div className="card-body p-4 p-lg-5">
          {tokenMissing && (
            <div className="alert alert-danger" role="alert">
              Der Reset‑Token fehlt oder ist ungültig. Bitte starte den Prozess erneut über&nbsp;
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}>„Passwort vergessen“</a>.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="rpw" className="form-label fw-semibold">Neues Passwort</label>
              <div className="input-group input-group-lg">
                <span className="input-group-text"><i className="bi bi-lock"></i></span>
                <input
                  id="rpw"
                  type={showPw ? 'text' : 'password'}
                  className={`form-control form-control-lg ${(touched.pw && !validPw) ? 'is-invalid' : ''}`}
                  placeholder={`Mind. ${MIN_LEN} Zeichen`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, pw: true }))}
                  aria-invalid={touched.pw && !validPw}
                  aria-describedby="rpwFeedback"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {touched.pw && !validPw && (
                <div id="rpwFeedback" className="invalid-feedback d-block">
                  Bitte mind. {MIN_LEN} Zeichen verwenden.
                </div>
              )}

              {/* Strength meter */}
              <div className="mt-2">
                <div className="progress cz-meter">
                  <div
                    className={`progress-bar`}
                    role="progressbar"
                    style={{ width: `${(score / 5) * 100}%` }}
                    aria-valuenow={(score / 5) * 100}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  ></div>
                </div>
                <small className="text-muted">
                  Stärke: {['Sehr schwach', 'Schwach', 'Mittel', 'Gut', 'Stark'][Math.max(0, score - 1)] || 'Sehr schwach'}
                </small>
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="rcf" className="form-label fw-semibold">Passwort bestätigen</label>
              <div className="input-group input-group-lg">
                <span className="input-group-text"><i className="bi bi-shield-check"></i></span>
                <input
                  id="rcf"
                  type={showConfirm ? 'text' : 'password'}
                  className={`form-control form-control-lg ${(touched.confirm && !match) ? 'is-invalid' : ''}`}
                  placeholder="Wiederholen"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                  aria-invalid={touched.confirm && !match}
                  aria-describedby="rcfFeedback"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  <i className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {touched.confirm && !match && (
                <div id="rcfFeedback" className="invalid-feedback d-block">
                  Die Passwörter stimmen nicht überein.
                </div>
              )}
            </div>

            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-dark btn-lg" disabled={submitting || tokenMissing}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Speichern …
                  </>
                ) : (
                  <>Passwort speichern</>
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
          Probleme mit dem Link?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}>
            Neuen Link anfordern
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

export default ResetPassword;
