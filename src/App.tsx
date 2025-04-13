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
      {/* Login bleibt immer zugänglich */}
      <Route path="/login" element={<LoginForm />} />

      {/* Wenn kein User vorhanden ist, ALLE anderen Routen => Login */}
      {!user && <Route path="*" element={<Navigate to="/login" replace />} />}

      {/* Wenn eingeloggt, alle geschützten Routen */}
      {user && (
        <>
          <Route
            path="/"
            element={
              <>
                <NavBar />
                <Routes>
                  <Route path="home" element={<Dashboard />} />
                  <Route path="auftraege" element={<Auftraege />} />
                  <Route path="auftraege/:id" element={<AuftragDetail />} />
                  <Route path="artikel" element={<Artikel />} />
                  <Route path="kunden" element={<Kunden />} />
                  <Route path="kunden/:id" element={<KundeDetail />} />
                  <Route path="kunden/edit/:id" element={<KundeEdit />} />
                  <Route path="kundenaufpreise/:artikelId" element={<KundenaufpreisEditor />} />
                  <Route path="profil" element={<Profil />} />
                  <Route path="verkaeufer" element={<Verkaeufer />} />
                  <Route path="verkaeufer/:id" element={<VerkaeuferDetails />} />
                  <Route path="verkaeufer/edit/:id" element={<VerkaeuferEdit />} />
                  <Route path="stats" element={<Statistiken />} />
                  {/* ALLE ungültigen Pfade => /home */}
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              </>
            }
          />
        </>
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