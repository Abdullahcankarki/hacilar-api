// RegisterForm.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../backend/api';
import { KundeResource } from '../Resources';


const RegisterForm: React.FC = () => {
  const navigate = useNavigate();

  const [kunde, setKunde] = useState<KundeResource>({
    name: '',
    email: '',
    password: '',
    adresse: '',
    telefon: '',
    lieferzeit: '',
    ustId: '',
    handelsregisterNr: '',
    ansprechpartner: '',
    website: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setShowSuccess(false);

    const newErrors: { [key: string]: string } = {};
    if (!kunde.name.trim()) newErrors.name = 'Name ist erforderlich.';
    if (!kunde.email.trim()) newErrors.email = 'Email ist erforderlich.';
    if (!kunde.password.trim()) newErrors.password = 'Passwort ist erforderlich.';
    if (!kunde.adresse.trim()) newErrors.adresse = 'Adresse ist erforderlich.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await api.createKunde(kunde);
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
    <main className="d-flex align-items-center justify-content-center vh-100 px-3">
      <div className="w-100" style={{ maxWidth: '600px' }}>
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
              <h1 className="h2 mt-auto">Registrieren</h1>
              <form onSubmit={handleSubmit} className="needs-validation" noValidate>
                {[
                  { name: 'name', placeholder: 'Firma' },
                  { name: 'email', placeholder: 'Email', type: 'email' },
                  { name: 'password', placeholder: 'Passwort', type: 'password' },
                  { name: 'adresse', placeholder: 'Adresse' },
                  { name: 'telefon', placeholder: 'Telefon' },
                  { name: 'ustId', placeholder: 'USt-ID' },
                  { name: 'handelsregisterNr', placeholder: 'Handelsregisternummer' },
                  { name: 'lieferzeit', placeholder: 'Lieferzeit' },
                  { name: 'ansprechpartner', placeholder: 'Ansprechpartner' },
                  { name: 'website', placeholder: 'Website' }
                ].map(({ name, placeholder, type = 'text' }) => (
                  <div className="mb-3" key={name}>
                    <input
                      type={type}
                      className={`form-control form-control-lg ${errors[name] ? 'is-invalid' : ''}`}
                      placeholder={placeholder}
                      value={String(kunde[name as keyof KundeResource] ?? '')}
                      onChange={(e) => setKunde({ ...kunde, [name]: e.target.value })}
                      required
                    />
                    {errors[name] && <div className="invalid-tooltip bg-transparent py-0">{errors[name]}</div>}
                  </div>
                ))}

                {errors.general && <div className="alert alert-danger">{errors.general}</div>}
                <button type="submit" className="btn btn-lg btn-primary w-100">Registrieren</button>
              </form>
            </>
          )}

          {showSuccess && (
            <div className="alert alert-success mt-4" role="alert">
              Registrierung erfolgreich! Weiterleitung zum Login...
            </div>
          )}
        </div>
    </main>
  );
};

export default RegisterForm;