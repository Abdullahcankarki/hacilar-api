// App.tsx
import React, { useEffect, useState } from 'react';
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
import "./mobile.css"
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
import GefluegelPage from './components/gefluegel/GefluegelPage';
import GefluegelLieferanten from './components/gefluegel/GefluegelLieferanten';
import GefluegelZerlegerVerwaltung from './components/gefluegel/GefluegelZerlegerVerwaltung';
import MobileLayout from './components/mobile/MobileLayout';
import MobileShop from './components/mobile/MobileShop';
import MobileOrders from './components/mobile/MobileOrders';
import MobileOrderDetail from './components/mobile/MobileOrderDetail';
import MobileProfile from './components/mobile/MobileProfile';

const PackingList = React.lazy(() => import('./components/gefluegel/PackingList'));
const OffenePostenTool = React.lazy(() => import('./components/buchhaltung/OffenePostenTool'));
const LeergutTool = React.lazy(() => import('./components/buchhaltung/LeergutTool'));


// 📌 App-Routen
const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();
  const roles = Array.isArray(user?.role) ? user.role : [];

  // Mobile-Erkennung (max 768px)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

      {/* Kunden auf Handy: Neues Mobile Layout */}
      {user && roles.includes('kunde') && isMobile && (
        <Route path="/" element={<MobileLayout />}>
          <Route path="home" element={<MobileShop />} />
          <Route path="meine-auftraege" element={<MobileOrders />} />
          <Route path="auftraege/:id" element={<MobileOrderDetail />} />
          <Route path="profil" element={<MobileProfile />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      )}

      {/* Eingeloggt: Desktop-Layout (alle Nicht-Kunden + Kunden auf Desktop) */}
      {user && !(roles.includes('kunde') && isMobile) && (
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
              <Route path="gefluegel" element={<GefluegelPage />} />
              <Route path="gefluegel/lieferanten" element={<GefluegelLieferanten />} />
              <Route path="gefluegel/zerleger" element={<GefluegelZerlegerVerwaltung />} />
              <Route path="gefluegel/packing-list" element={<React.Suspense fallback={<div className="text-center py-5">Lade...</div>}><PackingList /></React.Suspense>} />
                            <Route path="buchhaltung/offene-posten" element={<React.Suspense fallback={<div className="text-center py-5">Lade...</div>}><OffenePostenTool /></React.Suspense>} />
              <Route path="buchhaltung/leergut" element={<React.Suspense fallback={<div className="text-center py-5">Lade...</div>}><LeergutTool /></React.Suspense>} />
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
            // Desktop-Kunden: Altes Layout
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
          ) : roles.includes('gefluegel') ? (
            <>
              <Route path="gefluegel" element={<GefluegelPage />} />
              <Route path="gefluegel/lieferanten" element={<GefluegelLieferanten />} />
              <Route path="gefluegel/zerleger" element={<GefluegelZerlegerVerwaltung />} />
              <Route path="gefluegel/packing-list" element={<React.Suspense fallback={<div className="text-center py-5">Lade...</div>}><PackingList /></React.Suspense>} />
                            <Route path="profil" element={<Profil />} />
              <Route path="*" element={<Navigate to="/gefluegel" replace />} />
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