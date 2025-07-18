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
import ArtikelDetails from './components/artikelDetails';
import AllArtikel from './components/allArtikel';
import RegisterForm from './components/register';
import ZerlegeAuftraege from './components/zerlegeAuftraege';
import ZerlegeDetail from './components/zerlegeDetail';


// 🛡️ Route-Schutz-Komponente
const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Lade Benutzerdaten...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// 📌 App-Routen
const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Lade Benutzerdaten...</div>;
  }

  return (
    <Routes>
      {/* Login immer erreichbar */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/register" element={<RegisterForm />} />

      {/* Nicht eingeloggt → alles auf Login umleiten */}
      {!user && <Route path="*" element={<Navigate to="/login" replace />} />}

      {/* Eingeloggt: Geschützte Layout-Route mit differenzierter Rollentrennung */}
      {user && (user.role.includes('admin')) && (
        <Route path="/" element={<Layout />}>
          <Route path="home" element={<Dashboard />} />
          <Route path="auftraege" element={<Auftraege />} />
          <Route path="auftraege/:id" element={<AuftragDetail />} />
          <Route path="zerlege" element={<ZerlegeAuftraege />} />
          <Route path="zerlege/:id" element={<ZerlegeDetail />} />
          <Route path="artikel" element={<Artikel />} />
          <Route path="allArtikel" element={<AllArtikel />} />
          <Route path="artikel/:id" element={<ArtikelDetails />} />
          <Route path="kunden" element={<Kunden />} />
          <Route path="kunden/:id" element={<KundeDetail />} />
          <Route path="kunden/edit/:id" element={<KundeEdit />} />
          <Route path="kundenaufpreise/:artikelId" element={<KundenaufpreisEditor />} />
          <Route path="profil" element={<Profil />} />
          <Route path="mitarbeiter" element={<Verkaeufer />} />
          <Route path="mitarbeiter/:id" element={<VerkaeuferDetails />} />
          <Route path="mitarbeiter/edit/:id" element={<VerkaeuferEdit />} />
          <Route path="stats" element={<Statistiken />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      )}

      {user && user.role.includes('zerleger') && !user.role.includes('admin') && (
        <Route path="/" element={<Layout />}>
          <Route path="zerlege" element={<ZerlegeAuftraege />} />
          <Route path="zerlege/:id" element={<ZerlegeDetail />} />
          <Route path="profil" element={<Profil />} />
          <Route path="*" element={<Navigate to="/zerlege" replace />} />
        </Route>
      )}

      {user && user.role.includes('kunde') && !user.role.includes('admin') && (
        <Route path="/" element={<Layout />}>
          <Route path="home" element={<Dashboard />} />
          <Route path="profil" element={<Profil />} />
          <Route path="allArtikel" element={<AllArtikel />} />
          <Route path="artikel/:id" element={<ArtikelDetails />} />
          <Route path="auftraege/:id" element={<AuftragDetail />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
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