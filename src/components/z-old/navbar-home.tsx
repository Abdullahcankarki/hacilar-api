// navbar.tsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/Authcontext';
import logo from '../assets/logo.png';
import 'bootstrap/dist/js/bootstrap.bundle.min';

type NavBarProps = {
  onCartClick: () => void;
  cartLength: number;
};

const NavBarHome: React.FC<NavBarProps> = ({ onCartClick, cartLength }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar navbar-expand navbar-sticky sticky-top d-block bg-body z-fixed py-1 py-lg-0 py-xl-1 px-0">
      <div className="container justify-content-start py-2 py-lg-3">

        {/* Offcanvas Toggle */}
        <button
          type="button"
          className="navbar-toggler d-block flex-shrink-0 me-3 me-sm-4"
          data-bs-toggle="offcanvas"
          data-bs-target="#navbarOffcanvas"
          aria-controls="navbarOffcanvas"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Logo */}
        <NavLink className="navbar-brand fs-2 p-0 pe-lg-2 pe-xxl-0 me-0 me-sm-3 me-md-4 me-xxl-5" to="/home">
          <img src={logo} alt="Logo" style={{ height: '30px' }} />
        </NavLink>

        {/* Suche (nur Desktop) */}
        <div className="position-relative w-100 d-none d-md-block me-3 me-xl-4">
          <input
            type="search"
            className="form-control form-control-lg rounded-pill"
            placeholder="Produkte suchen"
            aria-label="Suche"
          />
          <button type="button" className="btn btn-icon btn-ghost fs-lg btn-secondary border-0 position-absolute top-0 end-0 rounded-circle mt-1 me-1" aria-label="Suchen">
            <i className="ci-search"></i>
          </button>
        </div>

        {/* Icon-Buttons */}
        <div className="d-flex align-items-center gap-md-1 gap-lg-2 ms-auto">

          {/* Suche Mobil */}
          <button
            type="button"
            className="btn btn-icon fs-xl btn-outline-secondary border-0 rounded-circle d-md-none"
            data-bs-toggle="collapse"
            data-bs-target="#searchBar"
            aria-controls="searchBar"
            aria-label="Suche anzeigen"
          >
            <i className="ci-search"></i>
          </button>

          {/* Profil */}
          <NavLink to="/profil" className="btn btn-icon fs-lg btn-outline-secondary border-0 rounded-circle d-none d-md-inline-flex">
            <i className="ci-user"></i>
            <span className="visually-hidden">Konto</span>
          </NavLink>

          {/* Warenkorb */}
          <button
            type="button"
            className="btn btn-icon fs-xl btn-outline-secondary position-relative border-0 rounded-circle"
            onClick={onCartClick}
            aria-label="Warenkorb"
          >
            {cartLength > 0 && (
              <span className="position-absolute top-0 start-100 badge fs-xs text-bg-primary rounded-pill ms-n3">
                {cartLength}
              </span>
            )}
            <i className="ci-shopping-cart"></i>
          </button>

          {/* Logout */}
          <button
            className="btn btn-icon fs-lg btn-outline-secondary border-0 rounded-circle"
            onClick={handleLogout}
            title="Abmelden"
          >
            <i className="ci-log-out"></i>
          </button>
        </div>
      </div>

      {/* Suche collapse (mobil) */}
      <div className="collapse d-md-none" id="searchBar">
        <div className="container pt-2 pb-3">
          <div className="position-relative">
            <i className="ci-search position-absolute top-50 translate-middle-y d-flex fs-lg ms-3"></i>
            <input type="search" className="form-control form-icon-start rounded-pill" placeholder="Produkte suchen" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default NavBarHome;