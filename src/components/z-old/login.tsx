// LoginForm.tsx
import React, { useState, useRef } from 'react';
import { useAuth } from '../../providers/Authcontext';
import { Link, useNavigate } from 'react-router-dom';
import coverImg from '../assets/hijab.png';
import { ErrorFromValidation } from '../../backend/fetchWithErrorHandling';


const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Lädt...</span>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIdentifierError('');
    setPasswordError('');
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
      if (err instanceof ErrorFromValidation) {
        // express-validator Fehler auswerten
        err.validationErrors.forEach(e => {
          if (e.path === 'email' || e.path === 'name') {
            setIdentifierError(e.msg);
          } else if (e.path === 'password') {
            setPasswordError(e.msg);
          }
        });
      } else {
        const errorMsg = err.message?.toLowerCase() || '';

        if (errorMsg.includes('Anmeldedaten') || errorMsg.includes('benutzer')) {
          setIdentifierError('Benutzername oder E-Mail ist nicht korrekt.');
        } else if (errorMsg.includes('passwort')) {
          setPasswordError('Das Passwort scheint nicht korrekt zu sein.');
        } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
          setIdentifierError('Verbindungsfehler. Bitte überprüfe deine Internetverbindung.');
        } else {
          setIdentifierError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="col-md-8 col-lg-6 col-xl-5 px-3">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4">
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
                    Du möchtest einen Zugang?
                    <p>
                      <Link to="/register" className="text-primary">
                        Registrieren
                      </Link>
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="needs-validation" noValidate>
                    <div className="form-floating mb-3">
                      <input
                        type="text"
                        className={`form-control form-control-lg ${identifierError ? 'is-invalid' : ''}`}
                        id="identifierInput"
                        placeholder="Email oder Benutzername"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          setIdentifierError('');
                        }}
                        required
                        autoFocus
                      />
                      <label htmlFor="identifierInput">Email oder Benutzername</label>
                      {identifierError && (
                        <div className="invalid-feedback d-block">{identifierError}</div>
                      )}
                    </div>
                    <div className="mb-4 position-relative">
                      <div className="password-toggle form-floating">
                        <input
                          ref={passwordInputRef}
                          type={showPassword ? "text" : "password"}
                          className={`form-control form-control-lg ${passwordError ? 'is-invalid' : ''}`}
                          id="passwordInput"
                          placeholder="Passwort"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setPasswordError('');
                          }}
                          required
                        />
                        <label htmlFor="passwordInput">Passwort</label>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="btn btn-link position-absolute top-50 end-0 translate-middle-y me-3 p-0"
                          aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                          tabIndex={-1}
                          style={{ zIndex: 5 }}
                        >
                          {showPassword ? (
                            <i className="ci-eye fs-lg text-dark"></i>
                          ) : (
                            <i className="ci-eye-off fs-lg text-dark"></i>
                          )}
                        </button>
                        {passwordError && (
                          <div className="invalid-feedback d-block">{passwordError}</div>
                        )}
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg w-100" disabled={isLoading}>
                      {isLoading ? 'Bitte warten…' : 'Anmelden'}
                    </button>
                  </form>

                  <footer className="mt-auto">
                    <p className="fs-xs mb-0">
                      &copy; Alle Rechte vorbehalten. Erstellt von Hacilar.
                    </p>
                  </footer>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="d-none d-xl-block col-xl-6">
          <img src={coverImg} className="img-fluid rounded-4" alt="Login Visual" />
        </div>
      </div>
  );
};

export default LoginForm;