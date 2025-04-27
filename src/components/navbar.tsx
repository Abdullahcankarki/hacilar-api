// NavBar.tsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/Authcontext';
import logo from '../assets/logo.png';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import { KundeResource } from '../Resources';
import { Form } from 'react-bootstrap';

type NavBarProps = {
  onCartClick: () => void;
  cartLength: number;
  kunden: KundeResource[];
  ausgewaehlterKunde: string | null;
  setAusgewaehlterKunde: (id: string) => void;
};

const NavBar: React.FC<NavBarProps> = ({
  onCartClick,
  cartLength,
  kunden,
  ausgewaehlterKunde,
  setAusgewaehlterKunde,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav
      className="navbar navbar-expand-lg"
      style={{
        background: 'linear-gradient(90deg, #e0e0e0, #ffffff)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <div className="container">
        {/* Logo */}
        <NavLink className="navbar-brand" to="/home">
          <img src={logo} alt="Logo" style={{ height: '40px' }} />
        </NavLink>

        {/* Toggle für mobile Ansicht */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Navigation umschalten"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Inhalt der Navigation */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <NavLink className="nav-link" to="/home">
                Shop
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/auftraege">
                Aufträge
              </NavLink>
            </li>

            {user && (user.role === 'v' || user.role === 'a') && (
              <>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/artikel">
                    Artikel
                  </NavLink>
                </li>
              </>
            )}

            {user && user.role === 'a' && (
              <>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/kunden">
                    Kunden
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/verkaeufer">
                    Verkäufer
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/stats">
                    Statistiken
                  </NavLink>
                </li>
              </>
            )}

            {user && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/profil">
                  Profil
                </NavLink>
              </li>
            )}
          </ul>

          {/* Rechte Seite – Kunde auswählen + Warenkorb + Logout */}
          <div className="d-flex align-items-center gap-2">
            {(user?.role === 'a' || user?.role === 'v') && (
              <Form.Select
                size="sm"
                className="border-0 border-dark"
                style={{ maxWidth: 200 }}
                value={ausgewaehlterKunde ?? ''}
                onChange={(e) => setAusgewaehlterKunde(e.target.value)}
              >
                <option value="">Kunde wählen</option>
                {kunden.map((kunde) => (
                  <option key={kunde.id} value={kunde.id}>
                    {kunde.name}
                  </option>
                ))}
              </Form.Select>
            )}

            {user && (
              <>
                {/* 🛒 Warenkorb-Icon */}
                <button
                  className="btn p-0 border-0 bg-transparent position-relative icon-btn text-secondary"
                  onClick={onCartClick}
                  title="Warenkorb öffnen"
                >
                  <i className="bi bi-cart fs-4"></i>
                  {cartLength > 0 && (
                    <span
                      className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                      style={{ fontSize: '0.7rem' }}
                    >
                      {cartLength}
                    </span>
                  )}
                </button>

                {/* 🔒 Logout-Icon */}
                <button
                  className="btn p-0 border-0 bg-transparent icon-btn text-secondary ms-3"
                  onClick={handleLogout}
                  title="Abmelden"
                >
                  <i className="bi bi-box-arrow-right fs-4"></i>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;