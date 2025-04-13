// AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LoginResponse, LoginResource } from '../Resources';
import { login as apiLogin } from '../backend/api';
import { fetchWithErrorHandling } from '../backend/fetchWithErrorHandling';

interface AuthContextType {
  user: LoginResource | null;
  token: string | null;
  login: (credentials: { email?: string; name?: string; password: string }) => Promise<void>;
  logout: () => void;
  loading: boolean; // 👈 hier hinzufügen
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<LoginResource | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const API_URL = process.env.REACT_APP_API_SERVER_URL || "";

  useEffect(() => {
    if (!token) return;

    const decoded = parseJwt(token);
    const exp = decoded?.exp;
    if (!exp) return;

    const now = Date.now();
    const expiry = exp * 1000;
    const warnAt = expiry - 60_000; // 1 Minute vorher

    const warnTimeout = setTimeout(() => {
      setShowExpiryModal(true);
    }, warnAt - now);

    const logoutTimeout = setTimeout(() => {
      logout();
    }, expiry - now);

    return () => {
      clearTimeout(warnTimeout);
      clearTimeout(logoutTimeout);
    };
  }, [token]);

  // Stelle beim Laden des Contexts den gespeicherten Zustand wieder her
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Fehler beim Parsen des gespeicherten Benutzers:', error);
        localStorage.removeItem('user');
      }
    }

    setLoading(false); // ✅ Wichtig!
  }, []);

  const parseJwt = (token: string): { exp: number } | null => {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      return null;
    }
  };

  const login = async (credentials: { email?: string; name?: string; password: string }) => {
    const response: LoginResponse = await apiLogin(credentials);
    setUser(response.user);
    setToken(response.token);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setShowExpiryModal(false)
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
      {showExpiryModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Sitzung läuft ab</h5>
              </div>
              <div className="modal-body">
                <p>Deine Sitzung läuft in weniger als 1 Minute ab.</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowExpiryModal(false)}>
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth muss innerhalb eines AuthProviders verwendet werden');
  }
  return context;
};