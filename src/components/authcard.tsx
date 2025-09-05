import React, { useMemo, useState } from 'react';
import logo from '../assets/logo.png';
import { useNavigate } from 'react-router-dom';

/**
 * AuthCard – A polished, Bootstrap + Cartzilla–inspired authentication component
 * -----------------------------------------------------------------------------
 * - Single component with tabbed Login / Register forms
 * - Premium UI: soft shadows, glassy card, rounded corners, subtle animations
 * - Uses only Bootstrap utility/classes so it drops into your project easily
 * - Brand accent color is customizable (default matches your mint green #3edbb7)
 * - Accessible labels, inline validation, and helpful error messaging
 * - Exposes onLogin / onRegister callbacks for integration
 *
 * Requirements:
 * - Ensure Bootstrap CSS + JS are loaded globally
 * - (Optional) Bootstrap Icons for the <i className="bi ..."/>
 * - (Optional) Cartzilla base styles (component mimics Cartzilla look & spacing)
 */

export type LoginPayload = {
    identifier: string;    // einziges Eingabefeld (E-Mail oder Benutzername)
    password: string;
    remember?: boolean;
};

export type RegisterPayload = {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone?: string;
    adresse: string;
    ustId: string;
    handelsregisterNr: string;
    lieferzeit: string;
    ansprechpartner: string;
    website: string;
    agb: boolean;
    datenschutz: boolean;
    termsAccepted: boolean;
};

export interface AuthCardProps {
    brandName?: string;
    accentColor?: string; // hex or css variable
    onLogin?: (data: LoginPayload) => Promise<void> | void;
    onRegister?: (data: RegisterPayload) => Promise<void> | void;
    loading?: boolean; // external loading flag (optional)
    defaultTab?: 'login' | 'register';
}

const fieldClass = 'form-control form-control-lg';

const Icon: React.FC<{ name: string }> = ({ name }) => (
    <i className={`bi ${name}`} aria-hidden="true" />
);

const useForm = <T extends object>(initial: T) => {
    const [values, setValues] = useState<T>(initial);
    const set = (patch: Partial<T>) => setValues((v) => ({ ...v, ...patch }));
    const reset = () => setValues(initial);
    return { values, set, reset };
};

const Spinner: React.FC = () => (
    <span className="spinner-border spinner-border-sm align-middle" role="status" aria-hidden="true" />
);

const Divider: React.FC<{ label?: string }> = ({ label }) => (
    <div className="d-flex align-items-center my-3">
        <div className="flex-grow-1 border-top" />
        {label && <span className="small text-muted px-3">{label}</span>}
        <div className="flex-grow-1 border-top" />
    </div>
);


const HelpText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <small className="text-muted d-block mt-2">{children}</small>
);

const AuthCard: React.FC<AuthCardProps> = ({
    brandName = 'Hacilar Neu',
    accentColor = '#3edbb7',
    onLogin,
    onRegister,
    loading,
    defaultTab = 'login',
}) => {
    const navigate = useNavigate();
    const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null);
    const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

    const isLoading = !!loading || busy;

    const login = useForm<LoginPayload>({ identifier: '', password: '', remember: true });
    const [showPasswordLogin, setShowPasswordLogin] = useState(false);
    const [showPasswordReg, setShowPasswordReg] = useState(false);
    const register = useForm<RegisterPayload>({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        adresse: '',
        ustId: '',
        handelsregisterNr: '',
        lieferzeit: '',
        ansprechpartner: '',
        website: '',
        agb: false,
        datenschutz: false,
        termsAccepted: false,
    });

    const accentStyle = useMemo(() => ({ '--accent': accentColor } as React.CSSProperties), [accentColor]);

    const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
    const minPass = 6;

    const getError = (field: string): string | null => {
        const v = register.values;
        if (!touched[field]) return null;

        switch (field) {
            case 'identifier':
                return !login.values.identifier ? 'Bitte Email oder Benutzername eingeben.' : null;
            case 'passwordLogin':
                return !login.values.password ? 'Bitte Passwort eingeben.' : null;
            case 'name':
                return !v.name.trim() ? 'Name ist erforderlich.' : null;
            case 'email':
                return !validateEmail(v.email) ? 'Ungültige E-Mail-Adresse.' : null;
            case 'password':
                return v.password.length < minPass ? `Passwort muss mindestens ${minPass} Zeichen haben.` : null;
            case 'confirmPassword':
                return v.password !== v.confirmPassword ? 'Passwörter stimmen nicht überein.' : null;
            case 'adresse':
                return !v.adresse.trim() ? 'Adresse ist erforderlich.' : null;
            case 'agb':
                return !v.agb ? 'AGB müssen akzeptiert werden.' : null;
            case 'datenschutz':
                return !v.datenschutz ? 'Datenschutz muss akzeptiert werden.' : null;
            default:
                return null;
        }
    };

    const handleLoginSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault();
        const id = login.values.identifier;
        if (!id.trim()) {
            setMessage({ type: 'danger', text: 'Bitte Email oder Benutzername eingeben.' });
            return;
        }
        if (!login.values.password) {
            setMessage({ type: 'danger', text: 'Bitte Passwort eingeben.' });
            return;
        }
        try {
            setBusy(true);
            await onLogin?.({
                identifier: id,
                password: login.values.password,
                remember: login.values.remember,
            });
            setMessage({ type: 'success', text: 'Anmeldung erfolgreich.' });
        } catch (err: any) {
            setMessage({ type: 'danger', text: err?.message || 'Anmeldung fehlgeschlagen.' });
        } finally {
            setBusy(false);
        }
    };

    const handleRegisterSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault();
        setMessage(null);

        const v = register.values;
        if (!v.name.trim()) return setMessage({ type: 'danger', text: 'Bitte Ihren Namen eingeben.' });
        if (!validateEmail(v.email)) return setMessage({ type: 'danger', text: 'Bitte eine gültige E‑Mail eingeben.' });
        if (v.password.length < minPass)
            return setMessage({ type: 'danger', text: `Passwort muss mindestens ${minPass} Zeichen haben.` });
        if (v.password !== v.confirmPassword)
            return setMessage({ type: 'danger', text: 'Passwörter stimmen nicht überein.' });
        if (!v.adresse.trim()) return setMessage({ type: 'danger', text: 'Bitte Adresse eingeben.' });
        if (!v.agb) return setMessage({ type: 'danger', text: 'Bitte die AGB akzeptieren.' });
        if (!v.datenschutz) return setMessage({ type: 'danger', text: 'Bitte die Datenschutzerklärung akzeptieren.' });
        // termsAccepted is legacy, keep for compatibility
        // Optionally: if (!v.termsAccepted) return setMessage({ type: 'danger', text: 'Bitte die AGB/Datenschutz akzeptieren.' });

        try {
            setBusy(true);
            await onRegister?.({
                ...v,
                // all fields passed
            });
            setMessage({ type: 'success', text: 'Registrierung erfolgreich. Sie können sich jetzt anmelden.' });
            setTab('login');
        } catch (err: any) {
            setMessage({ type: 'danger', text: err?.message || 'Registrierung fehlgeschlagen.' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="container py-5" style={accentStyle}>
            <div className="row justify-content-center">
                <div className="col-12 col-lg-10 col-xl-8">
                    <div className="card border-0 shadow-lg overflow-hidden rounded-4" style={{ backdropFilter: 'blur(6px)' }}>
                        {/* Header */}
                        <div className="position-relative">
                            <div
                                className="p-4 p-md-5"
                                style={{
                                    background: 'linear-gradient(135deg, #e6f4fa, #ffffff)', // helles Blau → Weiß
                                    color: '#0a0a0a',
                                }}
                            >
                                <div className="d-flex flex-column align-items-center text-center">
                                    <div className="badge bg-dark-subtle text-dark-emphasis mb-3 rounded-pill px-3 py-2">
                                        <Icon name="bi-shield-lock" />
                                        <span className="ms-2 fw-semibold">Sicher &amp; verschlüsselt</span>
                                    </div>
                                    <img src={logo} alt="Logo" height={50} className="mb-2" />
                                    <p className="mb-0 opacity-75">Melde dich an oder erstelle dein Konto.</p>
                                </div>
                            </div>

                            {/* Tabs */}
                            <ul className="nav nav-tabs nav-fill small bg-body-tertiary px-3" role="tablist">
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={`nav-link py-3 ${tab === 'login' ? 'active' : ''}`}
                                        onClick={() => setTab('login')}
                                        type="button"
                                        role="tab"
                                        aria-selected={tab === 'login'}
                                    >
                                        <Icon name="bi-box-arrow-in-right" /> <span className="ms-2 fw-semibold">Login</span>
                                    </button>
                                </li>
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={`nav-link py-3 ${tab === 'register' ? 'active' : ''}`}
                                        onClick={() => setTab('register')}
                                        type="button"
                                        role="tab"
                                        aria-selected={tab === 'register'}
                                    >
                                        <Icon name="bi-person-plus" /> <span className="ms-2 fw-semibold">Registrieren</span>
                                    </button>
                                </li>
                            </ul>
                        </div>

                        {/* Body */}
                        <div className="p-4 p-md-5 bg-body">

                            <div className="row g-5 align-items-center">

                                {/* Forms */}
                                <div className="col-12">
                                    {tab === 'login' ? (
                                        <form onSubmit={handleLoginSubmit} noValidate>
                                            <div className="mb-3">
                                                <label htmlFor="loginIdentifier" className="form-label fw-semibold">Email oder Benutzername</label>
                                                <input
                                                    id="loginIdentifier"
                                                    type="text"
                                                    className={`form-control form-control-lg ${getError('identifier') ? 'is-invalid' : ''}`}
                                                    value={login.values.identifier}
                                                    onChange={(e) => login.set({ identifier: e.target.value })}
                                                    onBlur={() => setTouched((t) => ({ ...t, identifier: true }))}
                                                />
                                                {getError('identifier') && <div className="invalid-feedback">{getError('identifier')}</div>}
                                            </div>

                                            <div className="mb-3">
                                                <label htmlFor="loginPassword" className="form-label fw-semibold">Passwort</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-lock" /></span>
                                                    <input
                                                        id="loginPassword"
                                                        type={showPasswordLogin ? 'text' : 'password'}
                                                        className={`form-control form-control-lg ${getError('passwordLogin') ? 'is-invalid' : ''}`}
                                                        value={login.values.password}
                                                        onChange={(e) => login.set({ password: e.target.value })}
                                                        onBlur={() => setTouched((t) => ({ ...t, passwordLogin: true }))}
                                                        aria-invalid={!!getError('passwordLogin')}
                                                        aria-describedby="loginPasswordFeedback"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary"
                                                        onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                                                    >
                                                        <i className={`bi ${showPasswordLogin ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                                    </button>
                                                </div>
                                                {getError('passwordLogin') && (
                                                    <div id="loginPasswordFeedback" className="invalid-feedback d-block">
                                                        {getError('passwordLogin')}
                                                    </div>
                                                )}
                                                <div className="d-flex justify-content-between align-items-center mt-2">
                                                    <div className="form-check">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            id="remember"
                                                            checked={!!login.values.remember}
                                                            onChange={(e) => login.set({ remember: e.target.checked })}
                                                        />
                                                        <label className="form-check-label" htmlFor="remember">Eingeloggt bleiben</label>
                                                    </div>
                                                    <a
                                                      className="link-secondary small"
                                                      href="#"
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        navigate('/forgot-password');
                                                      }}
                                                      aria-label="Passwort vergessen – Zur Seite Passwort zurücksetzen wechseln"
                                                    >
                                                      Passwort vergessen?
                                                    </a>
                                                </div>
                                            </div>

                                            <button className="btn btn-dark btn-lg w-100 d-flex align-items-center justify-content-center gap-2" type="submit" disabled={isLoading}>
                                                {isLoading ? <Spinner /> : <Icon name="bi-box-arrow-in-right" />}
                                                <span>Anmelden</span>
                                            </button>

                                            <HelpText>
                                                Neu hier?{' '}
                                                <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setTab('register')}>
                                                    Konto erstellen
                                                </button>
                                            </HelpText>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleRegisterSubmit} noValidate>
                                            <div className="mb-3">
                                                <label htmlFor="regName" className="form-label fw-semibold">Firmenbezeichnung</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-person" /></span>
                                                    <input
                                                        id="regName"
                                                        type="text"
                                                        placeholder='Hacilar Fleisch GmbH'
                                                        className={`form-control form-control-lg ${getError('name') ? 'is-invalid' : ''}`}
                                                        value={register.values.name}
                                                        onChange={(e) => register.set({ name: e.target.value })}
                                                        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                                                    />
                                                    {getError('name') && <div className="invalid-feedback">{getError('name')}</div>}
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label htmlFor="regEmail" className="form-label fw-semibold">E‑Mail Adresse</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-envelope" /></span>
                                                    <input
                                                        id="regEmail"
                                                        type="email"
                                                        className={fieldClass}
                                                        placeholder="name@beispiel.de"
                                                        autoComplete="email"
                                                        value={register.values.email}
                                                        onChange={(e) => register.set({ email: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label htmlFor="regAdresse" className="form-label fw-semibold">Adresse</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-geo-alt" /></span>
                                                    <input
                                                        id="regAdresse"
                                                        type="text"
                                                        className={fieldClass}
                                                        placeholder="Musterstraße 1, 12345 Musterstadt"
                                                        value={register.values.adresse}
                                                        onChange={(e) => register.set({ adresse: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-12">
                                                    <label htmlFor="regPassword" className="form-label fw-semibold">Passwort</label>
                                                    <div className="input-group input-group-lg">
                                                        <span className="input-group-text"><Icon name="bi-lock" /></span>
                                                        <input
                                                            id="regPassword"
                                                            type={showPasswordReg ? 'text' : 'password'}
                                                            className={fieldClass}
                                                            placeholder="Mind. 6 Zeichen"
                                                            value={register.values.password}
                                                            onChange={(e) => register.set({ password: e.target.value })}
                                                        />
                                                        {getError('password') && <div className="invalid-feedback">{getError('password')}</div>}
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => setShowPasswordReg(!showPasswordReg)}
                                                        >
                                                            <i className={`bi ${showPasswordReg ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="col-12">
                                                    <label htmlFor="regConfirm" className="form-label fw-semibold">Passwort bestätigen</label>
                                                    <div className="input-group input-group-lg">
                                                        <span className="input-group-text"><Icon name="bi-shield-check" /></span>
                                                        <input
                                                            id="regConfirm"
                                                            type="password"
                                                            className={fieldClass}
                                                            placeholder="Wiederholen"
                                                            autoComplete="new-password"
                                                            value={register.values.confirmPassword}
                                                            onChange={(e) => register.set({ confirmPassword: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-3 mt-3">
                                                <label htmlFor="regPhone" className="form-label fw-semibold">Telefon (optional)</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-telephone" /></span>
                                                    <input
                                                        id="regPhone"
                                                        type="tel"
                                                        className={fieldClass}
                                                        placeholder="+49 170 0000000"
                                                        autoComplete="tel"
                                                        value={register.values.phone}
                                                        onChange={(e) => register.set({ phone: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label htmlFor="regUstId" className="form-label fw-semibold">USt-IdNr.</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-file-earmark-text" /></span>
                                                    <input
                                                        id="regUstId"
                                                        type="text"
                                                        className={fieldClass}
                                                        placeholder="DE123456789"
                                                        value={register.values.ustId}
                                                        onChange={(e) => register.set({ ustId: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label htmlFor="regHandelsregisterNr" className="form-label fw-semibold">Handelsregister Nr.</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-journal-bookmark" /></span>
                                                    <input
                                                        id="regHandelsregisterNr"
                                                        type="text"
                                                        className={fieldClass}
                                                        placeholder="HRB 12345"
                                                        value={register.values.handelsregisterNr}
                                                        onChange={(e) => register.set({ handelsregisterNr: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label htmlFor="regLieferzeit" className="form-label fw-semibold">Lieferzeit</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-truck" /></span>
                                                    <input
                                                        id="regLieferzeit"
                                                        type="text"
                                                        className={fieldClass}
                                                        placeholder="z.B. 2-3 Werktage"
                                                        value={register.values.lieferzeit}
                                                        onChange={(e) => register.set({ lieferzeit: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label htmlFor="regAnsprechpartner" className="form-label fw-semibold">Ansprechpartner</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-person-badge" /></span>
                                                    <input
                                                        id="regAnsprechpartner"
                                                        type="text"
                                                        className={fieldClass}
                                                        placeholder="Name des Ansprechpartners"
                                                        value={register.values.ansprechpartner}
                                                        onChange={(e) => register.set({ ansprechpartner: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label htmlFor="regWebsite" className="form-label fw-semibold">Website</label>
                                                <div className="input-group input-group-lg">
                                                    <span className="input-group-text"><Icon name="bi-globe" /></span>
                                                    <input
                                                        id="regWebsite"
                                                        type="url"
                                                        className={fieldClass}
                                                        placeholder="https://www.beispiel.de"
                                                        value={register.values.website}
                                                        onChange={(e) => register.set({ website: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-check mb-2">
                                                <input
                                                    type="checkbox"
                                                    className={`form-check-input ${getError('agb') ? 'is-invalid' : ''}`}
                                                    checked={register.values.agb}
                                                    onChange={(e) => register.set({ agb: e.target.checked })}
                                                    onBlur={() => setTouched((t) => ({ ...t, agb: true }))}
                                                />
                                                {getError('agb') && <div className="invalid-feedback d-block">{getError('agb')}</div>}
                                                <label className="form-check-label" htmlFor="agb">
                                                    Ich akzeptiere die{' '}
                                                    <a href="#" onClick={(e) => e.preventDefault()}>AGB</a>
                                                </label>
                                            </div>
                                            <div className="form-check mb-3">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="datenschutz"
                                                    checked={register.values.datenschutz}
                                                    onChange={(e) => register.set({ datenschutz: e.target.checked })}
                                                    required
                                                />
                                                {getError('checkbox') && <div className="invalid-feedback d-block">{getError('checkbox')}</div>}
                                                <label className="form-check-label" htmlFor="datenschutz">
                                                    Ich akzeptiere die{' '}
                                                    <a href="#" onClick={(e) => e.preventDefault()}>Datenschutzerklärung</a>
                                                </label>
                                            </div>

                                            <button className="btn btn-dark btn-lg w-100 d-flex align-items-center justify-content-center gap-2" type="submit" disabled={isLoading}>
                                                {isLoading ? <Spinner /> : <Icon name="bi-person-check" />}
                                                <span>Konto erstellen</span>
                                            </button>

                                            <HelpText>
                                                Bereits ein Konto?{' '}
                                                <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setTab('login')}>
                                                    Jetzt anmelden
                                                </button>
                                            </HelpText>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 px-md-5 py-3 bg-body-tertiary d-flex justify-content-between align-items-center">
                            <span className="small text-muted">© {new Date().getFullYear()} {brandName}. Alle Rechte vorbehalten.</span>
                            <a
                              href="#"
                              className="small link-secondary"
                              onClick={(e) => {
                                e.preventDefault();
                                navigate('/support');
                              }}
                            >
                              Hilfe &amp; Support
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="toast-container position-fixed bottom-0 end-0 p-3">
                {message && (
                    <div
                        className={`toast align-items-center text-white bg-${message.type === 'danger' ? 'danger' : message.type}`}
                        role="alert"
                        aria-live="assertive"
                        aria-atomic="true"
                    >
                        <div className="d-flex">
                            <div className="toast-body">{message.text}</div>
                            <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setMessage(null)}></button>
                        </div>
                    </div>
                )}
            </div>

            {/* Local styles to polish visuals */}
            <style>{`
        .nav-tabs .nav-link {
          border: none;
        }
        .nav-tabs .nav-link.active {
          border-bottom: 2px solid var(--accent);
          color: #0a0a0a;
          font-weight: 700;
          background-color: transparent;
        }
        .input-group-text {
          background-color: #f6f7f9;
        }
        .btn-dark {
          background-color: #0b0c0d;
          border-color: #0b0c0d;
        }
        .btn-dark:disabled {
          opacity: .8;
        }
        .badge.bg-dark-subtle {
          background-color: rgba(255,255,255,.7) !important;
        }
        @media (prefers-reduced-motion: no-preference) {
          .card { transition: box-shadow .25s ease, transform .2s ease; }
          .card:hover { transform: translateY(-2px); box-shadow: 0 1.25rem 1.5rem rgba(0,0,0,.08); }
        }
      `}</style>
        </div>
    );
};

export default AuthCard;
