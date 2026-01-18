import React, { useEffect, useState } from 'react';
import { useAuth } from '@/providers/Authcontext';
import { getAuftragByCutomerId } from '@/backend/api';
import KundenAuftraegeTabelle from './KundenAuftraegeTabelle';

const MeineAuftraege: React.FC = () => {
  const { user } = useAuth();
  const [auftraege, setAuftraege] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const fetchAuftraege = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAuftragByCutomerId(user.id);
        setAuftraege(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Fehler beim Laden der Aufträge:', err);
        setError(err.message || 'Fehler beim Laden der Aufträge');
      } finally {
        setLoading(false);
      }
    };

    fetchAuftraege();
  }, [user?.id]);

  if (loading) {
    return (
      <main className="page-wrapper">
        <div className="container py-5">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Lädt...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-wrapper">
        <div className="container py-5">
          <div className="alert alert-danger" role="alert">
            <i className="ci-close-circle me-2"></i>
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrapper">
      <div className="container py-5">
        <div className="row">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h1 className="h3 mb-0">Meine Aufträge</h1>
              <div className="text-muted">
                <i className="ci-package me-2"></i>
                {auftraege.length} {auftraege.length === 1 ? 'Auftrag' : 'Aufträge'}
              </div>
            </div>

            <KundenAuftraegeTabelle auftraege={auftraege} kundeId={user?.id} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default MeineAuftraege;
