// NavBar.tsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/Authcontext';
import logo from '../assets/logo.png'; // Pfad zum Logo-Bild

const NavBar: React.FC = () => {
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
        background: 'linear-gradient(90deg, #e0e0e0, #ffffff)', // Hellgrau zu Weiß
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <div className="container">
        {/* Logo: Klick führt immer zu "/home" */}
        <NavLink className="navbar-brand" to="/home">
          <img src={logo} alt="Logo" style={{ height: '40px' }} />
        </NavLink>
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
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {/* Shop: führt zu "/home" */}
            <li className="nav-item">
              <NavLink className="nav-link" to="/home">
                Shop
              </NavLink>
            </li>
            {/* Verkäufer- und Admin-spezifische Links */}
            {user && (user.role === 'v' || user.role === 'a') && (
              <>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/auftraege">
                    Aufträge
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/artikel">
                    Artikel
                  </NavLink>
                </li>
              </>
            )}
            {/* Admin-spezifischer Link */}
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
            {/* Profil-Link (für alle eingeloggten Nutzer) */}
            {user && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/profil">
                  Profil
                </NavLink>
              </li>
            )}
          </ul>
          {user && (
            <button className="btn btn-outline-dark" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;