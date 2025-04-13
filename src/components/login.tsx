// LoginForm.tsx
import React, { useState } from 'react';
import { useAuth } from '../providers/Authcontext';
import { useNavigate } from 'react-router-dom';
import SuccessOverlay from './sucessoverlay';

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
      setIdentifierError('Email falsch');
      hasError = true;
    }
    if (!password.trim()) {
      setPasswordError('Passwort falsch');
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
    <div
      className="container d-flex align-items-center justify-content-center"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0d47a1, #1565c0, #1e88e5, #42a5f5)',
      }}
    >
      {showSuccess && <SuccessOverlay />}
      {!showSuccess && (
        <div className="card shadow" style={{ width: '100%', maxWidth: '400px', zIndex: 1 }}>
          <div className="card-body">
            <h2 className="card-title text-center mb-4" style={{ color: '#0d47a1' }}>
              Anmelden
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-floating mb-3">
                <input
                  type="text"
                  className={`form-control ${identifierError ? 'is-invalid' : ''}`}
                  id="floatingIdentifier"
                  placeholder="Email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
                <label htmlFor="floatingIdentifier">Email</label>
                {identifierError && <div className="invalid-feedback">{identifierError}</div>}
              </div>
              <div className="form-floating mb-3">
                <input
                  type="password"
                  className={`form-control ${passwordError ? 'is-invalid' : ''}`}
                  id="floatingPassword"
                  placeholder="Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <label htmlFor="floatingPassword">Passwort</label>
                {passwordError && <div className="invalid-feedback">{passwordError}</div>}
              </div>
              <button
                type="submit"
                className="btn w-100"
                style={{
                  background: 'linear-gradient(90deg, #1565c0, #1e88e5)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  padding: '0.75rem',
                  color: '#fff',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s',
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = 'scale(0.98)')
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = 'scale(1)')
                }
              >
                Anmelden
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginForm;