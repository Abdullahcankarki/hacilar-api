// App.tsx
import React, { JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './providers/Authcontext';
import NavBar from './components/navbar';
import LoginForm from './components/login';
import Dashboard from './components/dashboard';
import Auftraege from './components/auftraege';
import Artikel from './components/artikel';
import Kunden from './components/kunden';
import KundeEdit from './components/kundeEdit';
import Profil from './components/profil';
import KundeDetail from './components/kundeDetails';
import KundenaufpreisEditor from './components/kundenaufpreiseditor';
import AuftragDetail from './components/auftragDetail';
import 'bootstrap/dist/css/bootstrap.min.css';
import Verkaeufer from './components/verkaeufer';
import VerkaeuferDetails from './components/verkaeuferDetails';
import VerkaeuferEdit from './components/verkaeuferEdit';
import Statistiken from './components/stats';
import { Layout } from './components/layout';
import "./App.css"
import './Cartzilla/assets/css/theme.min.css';
import './Cartzilla/assets/icons/cartzilla-icons.min.css';
import 'leaflet/dist/leaflet.css'
import ArtikelDetails from './components/artikelDetails';
import AllArtikel from './components/allArtikel';
import RegisterForm from './components/register';
import ZerlegeAuftraege from './components/zerlegeAuftraege';
import ZerlegeDetail from './components/zerlegeDetail';
import KomAuftraege from './components/komAuftraege';
import KomAuftragDetail from './components/komAuftragDetail';
import FahrzeugUebersicht from './components/fahrzeug';
import RegionRuleOverview from './components/RegionRuleOverview';
import KundenOverview from './components/KundenOverview';
import MitarbeiterVerwaltung from './components/MitarbeiterOverview';
import ArtikelOverview from './components/artikelOverview';
import ReihenfolgeVorlageOverview from './components/ReihenfolgeVorlage';
import { TourManager } from './components/TourManager';
import DriverTour from './components/DriverTour';
import AuftraegeOverview from './components/auftragOverview';
import AuftraegeBoard from './components/AuftragBoard';
import Login2Form from './components/login2';
import FleetPage from './components/Fleetpage';
import SupportHelp from './components/SupportHelp';
import ForgotPassword from './components/forgot-password';
import ResetPassword from './components/reset-password';


// 📌 App-Routen
const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();
  const roles = Array.isArray(user?.role) ? user.role : [];

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Lade Benutzerdaten...</div>;
  }

  return (
    <Routes>
      {/* Login immer erreichbar */}
      <Route path="/login" element={<Login2Form />} />
      <Route path="/register" element={<RegisterForm />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/support" element={<SupportHelp />} />

      {/* Nicht eingeloggt → alles auf Login umleiten */}
      {!user && <Route path="*" element={<Navigate to="/login" replace />} />}

      {/* Eingeloggt: Geschützte Layout-Route mit differenzierter Rollentrennung */}
      {user && (
        <Route path="/" element={<Layout />}>
          {roles.includes('admin') ? (
            <>
              <Route path="home" element={<Dashboard />} />
              <Route path="auftraege" element={<AuftraegeOverview />} />
              <Route path="auftraege/:id" element={<AuftragDetail />} />
              <Route path="kommissionierung" element={<AuftraegeBoard />} />
              <Route path="kommissionierung/:id" element={<KomAuftragDetail />} />
              <Route path="zerlege" element={<ZerlegeAuftraege />} />
              <Route path="zerlege/:id" element={<ZerlegeDetail />} />
              <Route path="artikel" element={<ArtikelOverview />} />
              <Route path="allArtikel" element={<AllArtikel />} />
              <Route path="artikel/:id" element={<ArtikelDetails />} />
              <Route path="kunden" element={<KundenOverview />} />
              <Route path="kunden/:id" element={<KundeDetail />} />
              <Route path="kunden/edit/:id" element={<KundeEdit />} />
              <Route path="kundenaufpreise/:artikelId" element={<KundenaufpreisEditor />} />
              <Route path="profil" element={<Profil />} />
              <Route path="mitarbeiter" element={<MitarbeiterVerwaltung />} />
              <Route path="mitarbeiter/:id" element={<VerkaeuferDetails />} />
              <Route path="mitarbeiter/edit/:id" element={<VerkaeuferEdit />} />
              <Route path="stats" element={<Statistiken />} />
              <Route path="fahrzeug" element={<FahrzeugUebersicht />} />
              <Route path="region-rule" element={<RegionRuleOverview />} />
              <Route path="reihenfolge-vorlage" element={<ReihenfolgeVorlageOverview />} />
              <Route path="tour-manager" element={<TourManager />} />
              <Route path="fahrer" element={<DriverTour />} />
              <Route path="fleet" element={<FleetPage />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </>
          ) : roles.includes('zerleger') ? (
            <>
              <Route path="zerlege" element={<ZerlegeAuftraege />} />
              <Route path="zerlege/:id" element={<ZerlegeDetail />} />
              <Route path="profil" element={<Profil />} />
              <Route path="*" element={<Navigate to="/zerlege" replace />} />
            </>
          ) : roles.includes('kunde') ? (
            <>
              <Route path="home" element={<Dashboard />} />
              <Route path="profil" element={<Profil />} />
              <Route path="allArtikel" element={<AllArtikel />} />
              <Route path="artikel/:id" element={<ArtikelDetails />} />
              <Route path="auftraege/:id" element={<AuftragDetail />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </>
          ) : roles.includes('kommissionierung') ? (
            <>
              <Route path="kommissionierung" element={<AuftraegeBoard />} />
              <Route path="kommissionierung/:id" element={<KomAuftragDetail />} />
              <Route path="profil" element={<Profil />} />
              <Route path="*" element={<Navigate to="/kommissionierung" replace />} />
            </>
          ) : roles.includes('kontrolle') ? (
            <>
              <Route path="kommissionierung" element={<AuftraegeBoard />} />
              <Route path="kommissionierung/:id" element={<KomAuftragDetail />} />
              <Route path="profil" element={<Profil />} />
              <Route path="*" element={<Navigate to="/kommissionierung" replace />} />
            </>
          ) : roles.includes('fahrer') ? (
            <>
              <Route path="fahrer" element={<DriverTour />} />
              <Route path="profil" element={<Profil />} />
              <Route path="*" element={<Navigate to="/fahrer" replace />} />
            </>
          ) : (
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Route>
      )}
    </Routes>
  );
};

// 🚀 Hauptkomponente
const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;