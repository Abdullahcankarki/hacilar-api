import React, { useEffect, useState } from 'react';
import { useAuth } from '@/providers/Authcontext';
import { getKundeById, updateKunde } from '@/backend/api';
import { KundeResource } from '@/Resources';
import { useNavigate } from 'react-router-dom';

const MobileProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [kunde, setKunde] = useState<KundeResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // 'contact' | 'password' | null
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const k = await getKundeById(user.id);
        setKunde(k);
        setEmail((k as any).email || '');
        setTelefon((k as any).telefon || '');
      } catch {}
      finally { setLoading(false); }
    })();
  }, [user]);

  const handleSaveContact = async () => {
    if (!kunde?.id) return;
    setSaving(true);
    try {
      await updateKunde(kunde.id, { email, telefon } as any);
      setMessage('Kontaktdaten gespeichert');
      setEditing(null);
      setTimeout(() => setMessage(null), 3000);
    } catch { setMessage('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!kunde?.id || newPassword.length < 6) {
      setMessage('Passwort muss mind. 6 Zeichen haben');
      return;
    }
    setSaving(true);
    try {
      await updateKunde(kunde.id, { password: newPassword } as any);
      setMessage('Passwort geändert');
      setNewPassword('');
      setEditing(null);
      setTimeout(() => setMessage(null), 3000);
    } catch { setMessage('Fehler beim Ändern'); }
    finally { setSaving(false); }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="ms-empty">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  const k = kunde as any;

  return (
    <div style={{ paddingBottom: '24px' }}>
      {/* Message Toast */}
      {message && (
        <div className="ms-toast success">
          <span>{message}</span>
          <button className="ms-toast-close" onClick={() => setMessage(null)}>&times;</button>
        </div>
      )}

      {/* Profile Card */}
      <div className="ms-profile-card">
        <div className="ms-profile-header">
          <div className="ms-profile-avatar">
            <i className="ci-user" style={{ fontSize: '1.5rem' }} />
          </div>
          <p className="ms-profile-name">{k?.name || 'Kunde'}</p>
          <p className="ms-profile-email">{k?.email || ''}</p>
        </div>

        <div className="ms-profile-menu">
          {/* Persönliche Daten */}
          <div className="ms-profile-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontWeight: 600 }}>Persönliche Daten</span>
            </div>
            {k?.adresse && <div style={{ fontSize: '0.85rem', color: 'var(--ms-muted)' }}>Adresse: {k.adresse}</div>}
            {k?.ustId && <div style={{ fontSize: '0.85rem', color: 'var(--ms-muted)' }}>USt-Id: {k.ustId}</div>}
            {k?.ansprechpartner && <div style={{ fontSize: '0.85rem', color: 'var(--ms-muted)' }}>Ansprechpartner: {k.ansprechpartner}</div>}
          </div>

          {/* Kontaktdaten */}
          <div
            className="ms-profile-item"
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}
            onClick={() => editing !== 'contact' && setEditing('contact')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontWeight: 600 }}>Kontaktdaten</span>
              <i className="ci-edit" style={{ color: 'var(--ms-accent)' }} />
            </div>
            {editing === 'contact' ? (
              <div style={{ width: '100%' }} onClick={e => e.stopPropagation()}>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="E-Mail"
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginBottom: '8px', fontSize: '0.9rem' }}
                />
                <input
                  type="tel" value={telefon} onChange={e => setTelefon(e.target.value)}
                  placeholder="Telefon"
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginBottom: '8px', fontSize: '0.9rem' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="ms-btn-primary" style={{ flex: 1, padding: '10px', fontSize: '0.9rem' }} onClick={handleSaveContact} disabled={saving}>
                    {saving ? 'Speichern...' : 'Speichern'}
                  </button>
                  <button style={{ flex: 1, padding: '10px', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', fontWeight: 600 }} onClick={() => setEditing(null)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.85rem', color: 'var(--ms-muted)' }}>{email || '–'}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--ms-muted)' }}>{telefon || '–'}</div>
              </>
            )}
          </div>

          {/* Passwort */}
          <div
            className="ms-profile-item"
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}
            onClick={() => editing !== 'password' && setEditing('password')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontWeight: 600 }}>Passwort ändern</span>
              <i className="ci-lock" style={{ color: 'var(--ms-accent)' }} />
            </div>
            {editing === 'password' && (
              <div style={{ width: '100%' }} onClick={e => e.stopPropagation()}>
                <input
                  type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Neues Passwort (mind. 6 Zeichen)"
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginBottom: '8px', fontSize: '0.9rem' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="ms-btn-primary" style={{ flex: 1, padding: '10px', fontSize: '0.9rem' }} onClick={handleChangePassword} disabled={saving}>
                    {saving ? 'Ändern...' : 'Passwort ändern'}
                  </button>
                  <button style={{ flex: 1, padding: '10px', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', fontWeight: 600 }} onClick={() => setEditing(null)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout */}
      <button className="ms-btn-danger" onClick={handleLogout}>
        Abmelden
      </button>
    </div>
  );
};

export default MobileProfile;
