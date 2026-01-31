// App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './providers/Authcontext';
import Dashboard from './components/dashboard/dashboard';
import KundeEdit from './components/verwaltung/kunden/kundeEdit';
import Profil from './components/profil/profil';
import KundeDetail from './components/verwaltung/kunden/kundeDetails';
import AuftragDetail from './components/produktion/auftrag/auftragDetail';
import VerkaeuferDetails from './components/verwaltung/mitarbeiter/verkaeuferDetails';
import VerkaeuferEdit from './components/verwaltung/mitarbeiter/verkaeuferEdit';
import StatsDashboard from './components/verwaltung/statistiken/stats';
import { Layout } from './components/layout/layout';
import "./App.css"
import './Cartzilla/assets/css/theme.min.css';
import './Cartzilla/assets/icons/cartzilla-icons.min.css';
import 'leaflet/dist/leaflet.css'
import ArtikelDetails from './components/verwaltung/artikel/artikelDetails';
import AllArtikel from './components/z-old/allArtikel';
import RegisterForm from './components/login/register';
import ZerlegeAuftraege from './components/produktion/zerlegung/zerlegeAuftraege';
import ZerlegeDetail from './components/produktion/zerlegung/zerlegeDetail';
import KomAuftragDetail from './components/produktion/kommisienierung/komAuftragDetail';
import FahrzeugUebersicht from './components/verwaltung/fahrzeug/fahrzeug';
import RegionRuleOverview from './components/verwaltung/region-regel/RegionRuleOverview';
import KundenOverview from './components/verwaltung/kunden/KundenOverview';
import MitarbeiterVerwaltung from './components/verwaltung/mitarbeiter/MitarbeiterOverview';
import ArtikelOverview from './components/verwaltung/artikel/artikelOverview';
import ReihenfolgeVorlageOverview from './components/verwaltung/reihenfolge-vorlage/ReihenfolgeVorlage';
import { TourManager } from './components/produktion/tour/TourManager';
import DriverTour from './components/fahrer/DriverTour';
import AuftraegeOverview from './components/produktion/auftrag/auftragOverview';
import AuftraegeBoard from './components/produktion/kommisienierung/AuftragBoard';
import Login2Form from './components/login/login2';
import FleetPage from './components/verwaltung/fahrzeug/Fleetpage';
import SupportHelp from './components/login/SupportHelp';
import ForgotPassword from './components/login/forgot-password';
import ResetPassword from './components/login/reset-password';
import SchnellAuftragWriter from './components/produktion/auftrag/SchnellAuftragWriter';
import MeineAuftraege from './components/profil/MeineAuftraege';
import EmailLogOverview from './components/verwaltung/email-log/EmailLogOverview';
// import InventoryDashboard from './components/inventoryDashboard';


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
              <Route path="auftrag-schnell" element={<SchnellAuftragWriter />} />
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
              <Route path="profil" element={<Profil />} />
              <Route path="mitarbeiter" element={<MitarbeiterVerwaltung />} />
              <Route path="mitarbeiter/:id" element={<VerkaeuferDetails />} />
              <Route path="mitarbeiter/edit/:id" element={<VerkaeuferEdit />} />
              <Route path="stats" element={<StatsDashboard />} />
              <Route path="fahrzeug" element={<FahrzeugUebersicht />} />
              <Route path="region-rule" element={<RegionRuleOverview />} />
              <Route path="reihenfolge-vorlage" element={<ReihenfolgeVorlageOverview />} />
              <Route path="tour-manager" element={<TourManager />} />
              <Route path="fahrer" element={<DriverTour />} />
              <Route path="fleet" element={<FleetPage />} />
              <Route path="email-log" element={<EmailLogOverview />} />
              {/* <Route path="inventory" element={<InventoryDashboard />} /> */}
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
              <Route path="meine-auftraege" element={<MeineAuftraege />} />
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