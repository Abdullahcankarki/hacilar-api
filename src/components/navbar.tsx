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
    <header className="navbar navbar-expand-lg bg-body sticky-top p-0">
      <div className="container py-3 px-4">

        {/* Logo */}
        <NavLink className="navbar-brand p-0" to="/home">
          <img src={logo} alt="Logo" style={{ height: '30px', width: 'auto' }} />
        </NavLink>

        {/* Offcanvas Toggle */}
        <button
          type="button"
          className="navbar-toggler"
          data-bs-toggle="offcanvas"
          data-bs-target="#navbarOffcanvas"
          aria-controls="navbarOffcanvas"
          aria-expanded="false"
          aria-label="Navigation umschalten"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Offcanvas-Menü */}
        <div
          className="offcanvas offcanvas-end"
          id="navbarOffcanvas"
          tabIndex={-1}
          aria-labelledby="navbarOffcanvasLabel"
        >
          <div className="offcanvas-header">
            <h5 className="offcanvas-title" id="navbarOffcanvasLabel">Menü</h5>
            <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Schließen"></button>
          </div>

          <div className="offcanvas-body pt-0">
            <ul className="navbar-nav ms-lg-4 list-unstyled">
              <li className="nav-item">
                <NavLink className="nav-link" to="/home">Shop</NavLink>
              </li>

              {user && (user.role === 'v' || user.role === 'a') && (
                <>
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/auftraege">Aufträge</NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/artikel">Artikel</NavLink>
                  </li>
                </>
              )}
              {user && user.role === 'a' && (
                <>
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/kunden">Kunden</NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/verkaeufer">Verkäufer</NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/stats">Statistiken</NavLink>
                  </li>
                </>
              )}
              {user && (
                <li className="nav-item">
                  <NavLink className="nav-link" to="/profil">Profil</NavLink>
                </li>
              )}

              {/* Kunde wählen - kein Punkt */}
              {(user?.role === 'a' || user?.role === 'v') && (
                <div className="mt-3">
                  <Form.Select
                    size="sm"
                    className="form-select border border-secondary"
                    style={{ maxWidth: 250 }}
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
                </div>
              )}

              {/* Icon-Buttons - kein Punkt */}
              <div className="d-flex align-items-center gap-3 mt-3">
                <button
                  className="btn p-0 border-0 bg-transparent position-relative icon-btn text-secondary"
                  onClick={onCartClick}
                  title="Warenkorb"
                >
                  <img
                    src="https://img.icons8.com/?size=100&id=10603&format=png&color=000000"
                    alt="Shopping Cart"
                    style={{
                      width: '24px',
                      height: '24px',
                      flexShrink: 0,
                      flexGrow: 0,
                    }}
                  />
                  {cartLength > 0 && (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.7rem' }}>
                      {cartLength}
                    </span>
                  )}
                </button>

                <button
                  className="btn p-0 border-0 bg-transparent icon-btn text-secondary"
                  onClick={handleLogout}
                  title="Abmelden"
                >
                  <i className="ci-log-out fs-4"></i>
                </button>
              </div>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
};

export default NavBar;