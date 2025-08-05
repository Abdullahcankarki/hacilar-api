// NavBar.tsx
import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/Authcontext';
import logo from '../assets/logo.png';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import { KundeResource } from '../Resources';
import Select from 'react-select';
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
  React.useEffect(() => {
    const gespeicherterKunde = localStorage.getItem('ausgewaehlterKunde');
    if (gespeicherterKunde) {
      setAusgewaehlterKunde(gespeicherterKunde);
    }
  }, []);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = () => {
    setIsLoggingOut(true);
    logout();
    navigate('/login');
  };

  const role = user?.role || [];
  const isAdmin = role.includes('admin');
  const isVerkauf = role.includes('verkauf');
  const isKommissionierer = role.length === 1 && role[0] === 'kommissionierung';
  const isKontrolleur = role.length === 1 && role[0] === 'kontrolle';
  const isZerleger = role.length === 1 && role[0] === 'zerleger';
  const isKunde = role.length === 1 && role[0] === 'kunde';
  const isAdminOderVerkauf = isAdmin || isVerkauf;

  const navLinks = [
    { to: isKommissionierer ? '/kommissionierung' : '/shop', label: isKommissionierer ? 'Kommissionierung' : 'Shop', visible: isKunde || isAdminOderVerkauf || isKommissionierer },
    { to: '/auftraege', label: 'Aufträge', visible: isAdminOderVerkauf },
    { to: '/artikel', label: 'Artikel', visible: isAdminOderVerkauf },
    { to: '/zerlege', label: 'Zerlegung', visible: isZerleger || isAdminOderVerkauf },
    { to: '/kommissionierung', label: 'Kommissionierung', visible: isKommissionierer || isAdminOderVerkauf },
    { to: '/kontrolle', label: 'Kontrolle', visible: isKontrolleur },
    { to: '/kunden', label: 'Kunden', visible: isAdminOderVerkauf },
    { to: '/mitarbeiter', label: 'Mitarbeiter', visible: isAdminOderVerkauf },
    { to: '/stats', label: 'Statistiken', visible: isAdminOderVerkauf },
    { to: '/profil', label: 'Profil', visible: !!user },
  ];

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
              {(isKunde || isAdminOderVerkauf || isKommissionierer) && (
                <li className="nav-item">
                  <NavLink className="nav-link" to={isKommissionierer ? '/kommissionierung' : '/shop'}>
                    {isKommissionierer ? 'Kommissionierung' : 'Shop'}
                  </NavLink>
                </li>
              )}
              {isAdminOderVerkauf && (
                <>
                  <li className="nav-item dropdown">
                    <span className="nav-link dropdown-toggle" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                      Produktion
                    </span>
                    <ul className="dropdown-menu">
                      <li><NavLink className="dropdown-item" to="/auftraege">Aufträge</NavLink></li>
                      <li><NavLink className="dropdown-item" to="/zerlege">Zerlegung</NavLink></li>
                      <li><NavLink className="dropdown-item" to="/kommissionierung">Kommissionierung</NavLink></li>
                    </ul>
                  </li>

                  <li className="nav-item dropdown">
                    <span className="nav-link dropdown-toggle" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                      Verwaltung
                    </span>
                    <ul className="dropdown-menu">
                      <li><NavLink className="dropdown-item" to="/kunden">Kunden</NavLink></li>
                      <li><NavLink className="dropdown-item" to="/mitarbeiter">Mitarbeiter</NavLink></li>
                      <li><NavLink className="dropdown-item" to="/artikel">Artikel</NavLink></li>
                      <li><NavLink className="dropdown-item" to="/stats">Statistiken</NavLink></li>
                    </ul>
                  </li>
                </>
              )}
              {navLinks.filter(link => link.visible && link.to !== '/auftraege' && link.to !== '/artikel' && link.to !== '/zerlege' && link.to !== '/kommissionierung' && link.to !== '/kunden' && link.to !== '/mitarbeiter' && link.to !== '/stats' && (link.to !== '/shop' && !(isKommissionierer && link.to === '/kommissionierung'))).map(link => (
                <li className="nav-item" key={link.to}>
                  <NavLink className="nav-link" to={link.to}>{link.label}</NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {isAdminOderVerkauf && (
          <div className="ms-auto me-3" style={{ width: 250 }}>
            <Select
              options={
                [...kunden]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(k => ({ value: k.id, label: k.name }))
              }
              value={
                kunden
                  .map(k => ({ value: k.id, label: k.name }))
                  .find(opt => opt.value === ausgewaehlterKunde) || null
              }
              onChange={(selected) => {
                if (selected) {
                  localStorage.setItem('ausgewaehlterKunde', selected.value);
                  setAusgewaehlterKunde(selected.value);
                } else {
                  localStorage.removeItem('ausgewaehlterKunde');
                  setAusgewaehlterKunde('');
                }
                navigate(0);
              }}
              placeholder="Kunde wählen..."
              isClearable
              styles={{
                container: (base) => ({
                  ...base,
                  width: '100%',
                }),
                control: (base) => ({
                  ...base,
                  borderColor: '#6c757d',
                  minHeight: '32px',
                  height: '32px',
                }),
                valueContainer: (base) => ({
                  ...base,
                  height: '32px',
                  padding: '0 8px',
                }),
                input: (base) => ({
                  ...base,
                  margin: 0,
                  padding: 0,
                }),
                indicatorsContainer: (base) => ({
                  ...base,
                  height: '32px',
                }),
              }}
            />
          </div>
        )}

        <div className="d-flex align-items-center gap-3 ms-auto my-auto">
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
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <span className="spinner-border spinner-border-sm"></span>
            ) : (
              <i className="ci-log-out fs-4"></i>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default NavBar;