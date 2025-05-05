// LoginForm.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../providers/Authcontext';
import { useNavigate } from 'react-router-dom';
import coverImg from '../Cartzilla/assets/img/account/cover.png';


const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIdentifierError('');
    setPasswordError('');
    setShowSuccess(false);

    let hasError = false;
    if (!identifier.trim()) {
      setIdentifierError('Email oder Benutzername ist erforderlich.');
      hasError = true;
    }
    if (!password.trim()) {
      setPasswordError('Passwort ist erforderlich.');
      hasError = true;
    }
    if (hasError) return;

    try {
      await login({
        email: identifier.includes('@') ? identifier : undefined,
        name: !identifier.includes('@') ? identifier : undefined,
        password,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate('/home');
      }, 1000);
    } catch (err: any) {
      const errorMsg = err.message || 'Login fehlgeschlagen';
      if (errorMsg.toLowerCase().includes('email')) {
        setIdentifierError(errorMsg);
      } else if (errorMsg.toLowerCase().includes('passwort')) {
        setPasswordError(errorMsg);
      } else {
        setIdentifierError(errorMsg);
        setPasswordError(errorMsg);
      }
    }
  };

  return (
    <main className="content-wrapper w-100 px-3 ps-lg-5 pe-lg-4 mx-auto" style={{ maxWidth: '1920px' }}>
      <div className="d-lg-flex">
        <div className="d-flex flex-column min-vh-100 w-100 py-4 mx-auto me-lg-5" style={{ maxWidth: '416px' }}>
          <header className="navbar px-0 pb-4 mt-n2 mt-sm-0 mb-2 mb-md-3 mb-lg-4">
            <a href="/" className="navbar-brand pt-0">
              <span className="d-flex flex-shrink-0 text-primary me-2">
                <i className="ci-user" style={{ fontSize: '2rem' }}></i>
              </span>
              Hacilar
            </a>
          </header>

          {!showSuccess && (
            <>
              <h1 className="h2 mt-auto">Willkommen zurück</h1>
              <div className="nav fs-sm mb-4">
                Du möchtest einen Zugang?<br />
                Dann kontaktiere uns einfach per{' '}
                <span>
                  <i className="ci-mail me-2"></i>
                  <a href="mailto:info@hacilar.eu" className="fw-semibold text-primary text-decoration-underline">
                    info@hacilar.eu
                  </a>
                </span>
              </div>

              <form onSubmit={handleSubmit} className="needs-validation" noValidate>
                <div className="position-relative mb-4">
                  <input
                    type="text"
                    className={`form-control form-control-lg ${identifierError ? 'is-invalid' : ''}`}
                    placeholder="Email oder Benutzername"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                  {identifierError && (
                    <div className="invalid-tooltip bg-transparent py-0">{identifierError}</div>
                  )}
                </div>
                <div className="mb-4">
                  <div className="password-toggle">
                    <input
                      type="password"
                      className={`form-control form-control-lg ${passwordError ? 'is-invalid' : ''}`}
                      placeholder="Passwort"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <label className="password-toggle-button fs-lg" aria-label="Show/hide password">
                      <input type="checkbox" className="btn-check" />
                    </label>
                    {passwordError && (
                      <div className="invalid-tooltip bg-transparent py-0">{passwordError}</div>
                    )}
                  </div>
                </div>
                <button type="submit" className="btn btn-lg btn-primary w-100">Anmelden</button>
              </form>

              <footer className="mt-auto">
                <p className="fs-xs mb-0">
                  &copy; Alle Rechte vorbehalten. Erstellt von Hacilar.
                </p>
              </footer>
            </>
          )}
        </div>

        {/* Rechte Bildhälfte (optional) */}
        <div className="d-none d-lg-block w-100 py-4 ms-auto" style={{ maxWidth: '1034px' }}>
          <div className="d-flex flex-column justify-content-end h-100 rounded-5 overflow-hidden">
            <span className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'linear-gradient(-90deg, #accbee 0%, #e7f0fd 100%)' }}></span>
            <div className="ratio position-relative z-2" style={{ aspectRatio: '1030 / 1032' }}>
              <img src={coverImg} alt="Login" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default LoginForm;