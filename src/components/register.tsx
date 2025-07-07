// RegisterForm.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../backend/api';
import { KundeResource } from '../Resources';


const RegisterForm: React.FC = () => {
  const navigate = useNavigate();

  const [kunde, setKunde] = useState<any>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    adresse: '',
    telefon: '',
    lieferzeit: '',
    ustId: '',
    handelsregisterNr: '',
    ansprechpartner: '',
    website: '',
    agb: false,
    datenschutz: false,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setShowSuccess(false);

    const newErrors: { [key: string]: string } = {};
    if (!kunde.name.trim()) newErrors.name = 'Name ist erforderlich.';
    if (!kunde.email.trim()) newErrors.email = 'Email ist erforderlich.';
    if (!kunde.password.trim()) newErrors.password = 'Passwort ist erforderlich.';
    if (!kunde.adresse.trim()) newErrors.adresse = 'Adresse ist erforderlich.';
    if (kunde.password !== kunde.confirmPassword) newErrors.confirmPassword = 'Passwörter stimmen nicht überein.';
    if (!kunde.agb) newErrors.agb = 'AGB müssen akzeptiert werden.';
    if (!kunde.datenschutz) newErrors.datenschutz = 'Datenschutzerklärung muss akzeptiert werden.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // KundeResource hat kein confirmPassword, agb, datenschutz - also nicht mitsenden
    const kundeToSend = { ...kunde };
    delete kundeToSend.confirmPassword;
    delete kundeToSend.agb;
    delete kundeToSend.datenschutz;

    try {
      await api.createKunde(kundeToSend);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate('/login');
      }, 1500);
    } catch (error) {
      setErrors({ general:  error + 'Registrierung fehlgeschlagen' });
    }
  };

  return (
    <div className="container-fluid bg-gradient min-vh-100 d-flex align-items-center justify-content-center px-4">
      <div className="card rounded-4 shadow-lg p-4 w-100" style={{ maxWidth: '1100px' }}>
        <header className="navbar px-0 pb-4 mt-n2 mt-sm-0 mb-4 mb-md-5 mb-lg-6">
          <a href="/" className="navbar-brand pt-0 fs-3 fw-bold d-flex align-items-center gap-3">
            <span className="d-flex flex-shrink-0 text-primary me-3" style={{ fontSize: '2.5rem' }}>
              <i className="ci-user"></i>
            </span>
            Hacilar
          </a>
        </header>
        {!showSuccess && (
          <>
            <div className="text-center mb-4">
              <div className="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '72px', height: '72px' }}>
                <i className="ci-user text-white fs-2"></i>
              </div>
              <p className="mb-2 text-muted">Jetzt kostenlos registrieren</p>
              <h2 className="h4">Registrieren</h2>
            </div>
            <form onSubmit={handleSubmit} className="needs-validation" noValidate>
              <div className="row">
                <div className="col-md-6">
                  {/* Name */}
                  <div className="mb-3">
                    <label htmlFor="register-name" className="form-label">Firma</label>
                    <input
                      type="text"
                      className={`form-control form-control-lg ${errors.name ? 'is-invalid' : ''}`}
                      id="register-name"
                      autoComplete="off"
                      placeholder="Firma"
                      value={kunde.name}
                      onChange={e => setKunde({ ...kunde, name: e.target.value })}
                      required
                    />
                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                  </div>
                  {/* Email */}
                  <div className="mb-3">
                    <label htmlFor="register-email" className="form-label">Email</label>
                    <input
                      type="email"
                      className={`form-control form-control-lg ${errors.email ? 'is-invalid' : ''}`}
                      id="register-email"
                      autoComplete="off"
                      placeholder="Email"
                      value={kunde.email}
                      onChange={e => setKunde({ ...kunde, email: e.target.value })}
                      required
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                  </div>
                  {/* Passwort */}
                  <div className="mb-3">
                    <label htmlFor="register-password" className="form-label">Passwort</label>
                    <div className="input-group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`form-control form-control-lg ${errors.password ? 'is-invalid' : ''}`}
                        id="register-password"
                        autoComplete="off"
                        placeholder="Passwort"
                        value={kunde.password}
                        onChange={e => setKunde({ ...kunde, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        tabIndex={-1}
                        onClick={() => setShowPassword((prev) => !prev)}
                        style={{ borderTopRightRadius: '0.5rem', borderBottomRightRadius: '0.5rem' }}
                        aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                    {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                  </div>
                  {/* Passwort wiederholen */}
                  <div className="mb-3">
                    <label htmlFor="register-confirm-password" className="form-label">Passwort wiederholen</label>
                    <div className="input-group">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`form-control form-control-lg ${errors.confirmPassword ? 'is-invalid' : ''}`}
                        id="register-confirm-password"
                        autoComplete="off"
                        placeholder="Passwort wiederholen"
                        value={kunde.confirmPassword}
                        onChange={e => setKunde({ ...kunde, confirmPassword: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        style={{ borderTopRightRadius: '0.5rem', borderBottomRightRadius: '0.5rem' }}
                        aria-label={showConfirmPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                      >
                        <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                    {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword}</div>}
                  </div>
                  {/* Adresse */}
                  <div className="mb-3">
                    <label htmlFor="register-adresse" className="form-label">Adresse</label>
                    <input
                      type="text"
                      className={`form-control form-control-lg ${errors.adresse ? 'is-invalid' : ''}`}
                      id="register-adresse"
                      autoComplete="off"
                      placeholder="Adresse"
                      value={kunde.adresse}
                      onChange={e => setKunde({ ...kunde, adresse: e.target.value })}
                      required
                    />
                    {errors.adresse && <div className="invalid-feedback">{errors.adresse}</div>}
                  </div>
                  {/* Telefon */}
                  <div className="mb-3">
                    <label htmlFor="register-telefon" className="form-label">Telefon</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      id="register-telefon"
                      autoComplete="off"
                      placeholder="Telefon"
                      value={kunde.telefon}
                      onChange={e => setKunde({ ...kunde, telefon: e.target.value })}
                    />
                    {/* Kein Pflichtfeld, daher keine Fehleranzeige */}
                  </div>
                </div>
                <div className="col-md-6">
                  {/* USt-ID */}
                  <div className="mb-3">
                    <label htmlFor="register-ustid" className="form-label">USt-ID</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      id="register-ustid"
                      autoComplete="off"
                      placeholder="USt-ID"
                      value={kunde.ustId}
                      onChange={e => setKunde({ ...kunde, ustId: e.target.value })}
                    />
                  </div>
                  {/* Handelsregisternummer */}
                  <div className="mb-3">
                    <label htmlFor="register-handelsregisternr" className="form-label">Handelsregisternummer</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      id="register-handelsregisternr"
                      autoComplete="off"
                      placeholder="Handelsregisternummer"
                      value={kunde.handelsregisterNr}
                      onChange={e => setKunde({ ...kunde, handelsregisterNr: e.target.value })}
                    />
                  </div>
                  {/* Lieferzeit */}
                  <div className="mb-3">
                    <label htmlFor="register-lieferzeit" className="form-label">Lieferzeit</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      id="register-lieferzeit"
                      autoComplete="off"
                      placeholder="Lieferzeit"
                      value={kunde.lieferzeit}
                      onChange={e => setKunde({ ...kunde, lieferzeit: e.target.value })}
                    />
                  </div>
                  {/* Ansprechpartner */}
                  <div className="mb-3">
                    <label htmlFor="register-ansprechpartner" className="form-label">Ansprechpartner</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      id="register-ansprechpartner"
                      autoComplete="off"
                      placeholder="Ansprechpartner"
                      value={kunde.ansprechpartner}
                      onChange={e => setKunde({ ...kunde, ansprechpartner: e.target.value })}
                    />
                  </div>
                  {/* Website */}
                  <div className="mb-3">
                    <label htmlFor="register-website" className="form-label">Website</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      id="register-website"
                      autoComplete="off"
                      placeholder="Website"
                      value={kunde.website}
                      onChange={e => setKunde({ ...kunde, website: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              {/* Checkboxen für AGB und Datenschutz */}
              <div className="mb-2 mt-4">
                <div className="form-check">
                  <input
                    className={`form-check-input ${errors.agb ? 'is-invalid' : ''}`}
                    type="checkbox"
                    id="register-agb"
                    checked={kunde.agb}
                    onChange={e => setKunde({ ...kunde, agb: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="register-agb">
                    Ich akzeptiere die AGB.
                  </label>
                  {errors.agb && <div className="invalid-feedback d-block">{errors.agb}</div>}
                </div>
                <div className="form-check mt-2">
                  <input
                    className={`form-check-input ${errors.datenschutz ? 'is-invalid' : ''}`}
                    type="checkbox"
                    id="register-datenschutz"
                    checked={kunde.datenschutz}
                    onChange={e => setKunde({ ...kunde, datenschutz: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="register-datenschutz">
                    Ich habe die Datenschutzerklärung gelesen.
                  </label>
                  {errors.datenschutz && <div className="invalid-feedback d-block">{errors.datenschutz}</div>}
                </div>
              </div>
              {errors.general && <div className="alert alert-danger">{errors.general}</div>}
              <button type="submit" className="btn btn-primary btn-lg w-100 mt-2">Registrieren</button>
              <div className="text-center mt-3">
                <p className="mb-0">
                  Bereits ein Konto?{' '}
                  <a href="/login" className="fw-semibold text-decoration-underline">
                    Jetzt einloggen
                  </a>
                </p>
              </div>
            </form>
          </>
        )}
        {showSuccess && (
          <div className="alert alert-success mt-4" role="alert">
            Registrierung erfolgreich! Weiterleitung zum Login...
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterForm;