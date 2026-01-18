// Auftraege.tsx
import React, { useEffect, useState } from 'react';
import { AuftragResource } from '../../Resources';
import { getAlleAuftraegeInBearbeitung } from '../../backend/api';
import { useAuth } from '../../providers/Authcontext';
import KomAuftragTabelle from './komAuftragTabelle';

// Erweiterung von AuftragResource um Kommissionierungs- und Kontrollfelder


const KomAuftraege: React.FC = () => {
    const [auftraege, setAuftraege] = useState<AuftragResource[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const { user } = useAuth();

    const isAdminOrKontrolleur = user?.role.includes('admin') || user?.role.includes('kontrolle');
    const isNurKommissionierer = user?.role.includes('kommissionierung') && !isAdminOrKontrolleur;

    // Alle Aufträge laden
    const fetchAuftraege = async () => {
        try {
            if (user?.role.includes('admin') || user?.role.includes('kommissionierung') || user?.role.includes('kontrolle')) {
                const data = await getAlleAuftraegeInBearbeitung();
                setAuftraege(data);
            } else {
                throw new Error('Keine Berechtigung zum Laden der Aufträge.');
            }
        } catch (err: any) {
            setError(err.message || 'Fehler beim Laden der Aufträge');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuftraege();
    }, []);

    // Weitere Filter und Suche
    const filteredAuftraege = auftraege.filter((auftrag) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;

        const id = auftrag.id ?? '';
        const kunde = (auftrag as any).kundeName ?? auftrag.kunde ?? '';

        const idMatch = id.toString().toLowerCase().includes(term);
        const kundeMatch = kunde ? String(kunde).toLowerCase().includes(term) : false;

        return idMatch || kundeMatch;
    });
    // Fügt innerhalb der Komponente (z.B. direkt nach useState) diese Funktionen ein:
    const gruppiertNachStatus = {
        offen: filteredAuftraege.filter(a => a.kommissioniertStatus === 'offen'),
        gestartet: filteredAuftraege.filter(a => a.kommissioniertStatus === 'gestartet'),
        fertig: filteredAuftraege.filter(
            a => a.kommissioniertStatus === 'fertig' &&
                (a.kontrolliertStatus === 'offen' || a.kontrolliertStatus === 'in Kontrolle')
        ),
        gepruft: filteredAuftraege.filter(a => a.kontrolliertStatus === 'geprüft'),
    };

    const renderTabellen = () => {
        if (isAdminOrKontrolleur) {
            return (
                <>
                    <KomAuftragTabelle titel="Bereit zur Kommissionierung" auftraege={gruppiertNachStatus.offen} />
                    <KomAuftragTabelle titel="In Kommissionierung" auftraege={gruppiertNachStatus.gestartet} />
                    <KomAuftragTabelle titel="Bereit zur Kontrolle" auftraege={gruppiertNachStatus.fertig} />
                    <KomAuftragTabelle titel="Bereit zum Beladen" auftraege={gruppiertNachStatus.gepruft} />
                </>
            );
        }
        if (isNurKommissionierer) {
            return (
                <>
                    <KomAuftragTabelle titel="Bereit zur Kommissionierung" auftraege={gruppiertNachStatus.offen} />
                    <KomAuftragTabelle titel="In Kommissionierung" auftraege={gruppiertNachStatus.gestartet} />
                    <KomAuftragTabelle titel="Bereit zum Beladen" auftraege={gruppiertNachStatus.gepruft} />
                </>
            );
        }
        return null;
    };

    if (loading)
        return (
            <div className="container text-center my-4">
                <p>Lädt...</p>
            </div>
        );
    if (error)
        return (
            <div className="container my-4">
                <div className="alert alert-danger">{error}</div>
            </div>
        );
    return (
        <div className="container my-4">
            <h2 className="mb-4">Aufträge</h2>

            {/* Such-, Filter- und Sortierleiste */}
            <div className="row mb-4">
                <div className="col-md-4">
                    <div className="input-group">
                        <span className="input-group-text bg-white">
                            <i className="bi bi-search"></i>
                        </span>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Suche (Auftrag, Kunde)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {renderTabellen()}

        </div>
    );
};

export default KomAuftraege;