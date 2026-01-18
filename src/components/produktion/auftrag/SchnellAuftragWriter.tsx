import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/backend/api';

interface KundeResource {
    id?: string;
    name?: string;
    kundenNummer?: string;
    adresse?: string;
}

interface ArtikelResource {
    id?: string;
    name: string;
    preis: number;
    artikelNummer: string;
    erfassungsModus?: "GEWICHT" | "KARTON" | "STÜCK";
}

interface ArtikelPositionDraft {
    tempId: string;
    artikel?: string;
    artikelName?: string;
    artikelNummer?: string;
    menge?: number;
    einheit?: "kg" | "stück" | "kiste" | "karton";
    zerlegung?: boolean;
    vakuum?: boolean;
    bemerkung?: string;
}

const normalizeText = (text: string): string => {
    return text.toLowerCase().trim();
};

const formatDateGerman = (isoDate: string): string => {
    const d = new Date(isoDate);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
};

const parseGermanDate = (german: string): string | null => {
    const match = german.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) return null;
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
};

const nextBusinessDay = (from: Date = new Date()): string => {
    const d = new Date(from);
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
    }
    return d.toISOString().split('T')[0];
};

const SchnellAuftragWriter: React.FC = () => {
    const navigate = useNavigate();

    const [kunden, setKunden] = useState<KundeResource[]>([]);
    const [artikel, setArtikel] = useState<ArtikelResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const creatingRef = useRef(false);

    const [selectedKunde, setSelectedKunde] = useState<KundeResource | null>(null);
    const [kundeSearchTerm, setKundeSearchTerm] = useState('');
    const [kundeDropdownOpen, setKundeDropdownOpen] = useState(false);
    const [kundeHighlightIndex, setKundeHighlightIndex] = useState(0);

    const [artikelSearchTerm, setArtikelSearchTerm] = useState('');
    const [artikelDropdownOpen, setArtikelDropdownOpen] = useState(false);
    const [artikelHighlightIndex, setArtikelHighlightIndex] = useState(0);

    const [positionen, setPositionen] = useState<ArtikelPositionDraft[]>([]);
    const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
    const [editingArtikelRow, setEditingArtikelRow] = useState<number | null>(null);
    const [editArtikelSearchTerm, setEditArtikelSearchTerm] = useState('');
    const [editArtikelDropdownOpen, setEditArtikelDropdownOpen] = useState(false);
    const [editArtikelHighlightIndex, setEditArtikelHighlightIndex] = useState(0);

    const [lieferdatumInput, setLieferdatumInput] = useState('');
    const [lieferdatumISO, setLieferdatumISO] = useState(nextBusinessDay());

    const kundeInputRef = useRef<HTMLInputElement>(null);
    const artikelInputRef = useRef<HTMLInputElement>(null);
    const lieferdatumInputRef = useRef<HTMLInputElement>(null);
    const kundeDropdownRef = useRef<HTMLDivElement>(null);
    const artikelDropdownRef = useRef<HTMLDivElement>(null);
    const editArtikelInputRef = useRef<HTMLInputElement>(null);
    const editArtikelDropdownRef = useRef<HTMLDivElement>(null);
    const cellRefs = useRef<{ [key: string]: HTMLElement | null }>({});

    useEffect(() => {
        const init = async () => {
            try {
                const [kundenData, artikelData] = await Promise.all([
                    api.getAllKunden(),
                    api.getAllArtikelClean()
                ]);
                setKunden(kundenData.items);
                setArtikel(artikelData.items);
                setLieferdatumInput(formatDateGerman(nextBusinessDay()));
            } catch (err: any) {
                setError(err.message || 'Fehler beim Laden der Daten');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        const handleGlobalKeydown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 's')) {
                e.preventDefault();
                // Prüfe ob bereits am Erstellen und ob alle Positionen einen Artikel haben
                if (!creatingRef.current && selectedKunde && positionen.length > 0 && lieferdatumISO && positionen.every(p => p.artikel)) {
                    creatingRef.current = true;
                    setCreating(true);
                    setError(null);
                    (async () => {
                        try {
                            const auftrag = await api.createAuftrag({
                                kunde: selectedKunde.id!,
                                kundeName: selectedKunde.name,
                                status: 'offen',
                                artikelPosition: []
                            });
                            const positionIds: string[] = [];
                            for (const pos of positionen) {
                                const created = await api.createArtikelPosition({
                                    artikel: pos.artikel,
                                    menge: pos.menge,
                                    einheit: pos.einheit,
                                    zerlegung: pos.zerlegung,
                                    vakuum: pos.vakuum,
                                    bemerkung: pos.bemerkung,
                                    auftragId: auftrag.id
                                });
                                if (created.id) positionIds.push(created.id);
                            }
                            await api.updateAuftrag(auftrag.id!, {
                                artikelPosition: positionIds,
                                lieferdatum: lieferdatumISO
                            });
                            navigate('/aufträge');
                        } catch (err: any) {
                            setError(err.message || 'Fehler beim Erstellen des Auftrags');
                            creatingRef.current = false;
                            setCreating(false);
                        }
                    })();
                }
            }
            if (e.key === 'F2') {
                e.preventDefault();
                setSelectedKunde(null);
                setKundeSearchTerm('');
                setTimeout(() => kundeInputRef.current?.focus(), 0);
            }
            if (e.key === 'F4') {
                e.preventDefault();
                if (focusedCell && positionen[focusedCell.rowIndex]) {
                    const tempId = positionen[focusedCell.rowIndex].tempId;
                    setPositionen(prev => prev.filter(p => p.tempId !== tempId));
                }
            }
            if (e.key === 'Escape') {
                setKundeDropdownOpen(false);
                setArtikelDropdownOpen(false);
                setEditArtikelDropdownOpen(false);
                setEditingArtikelRow(null);
            }
        };
        window.addEventListener('keydown', handleGlobalKeydown);
        return () => window.removeEventListener('keydown', handleGlobalKeydown);
    }, [selectedKunde, positionen, lieferdatumISO, focusedCell, navigate]);

    useEffect(() => {
        if (focusedCell && editingArtikelRow === null) {
            const key = `${focusedCell.rowIndex}-${focusedCell.colIndex}`;
            const element = cellRefs.current[key];
            if (element) {
                element.focus();
            }
        }
    }, [focusedCell, editingArtikelRow]);

    const filteredKunden = kundeSearchTerm.trim()
        ? kunden.filter(k => {
            const term = normalizeText(kundeSearchTerm);
            return normalizeText(k.name || '').includes(term) || normalizeText(k.kundenNummer || '').includes(term);
        }).slice(0, 8)
        : [];

    const filteredArtikel = artikelSearchTerm.trim()
        ? artikel.filter(a => {
            const term = normalizeText(artikelSearchTerm);
            return normalizeText(a.name).includes(term) || normalizeText(a.artikelNummer).includes(term);
        }).slice(0, 10)
        : [];

    const filteredEditArtikel = editArtikelSearchTerm.trim()
        ? artikel.filter(a => {
            const term = normalizeText(editArtikelSearchTerm);
            return normalizeText(a.name).includes(term) || normalizeText(a.artikelNummer).includes(term);
        }).slice(0, 10)
        : [];

    const handleKundeInputChange = (val: string) => {
        setKundeSearchTerm(val);
        setKundeDropdownOpen(val.trim().length > 0);
        setKundeHighlightIndex(0);
    };

    const handleKundeSelect = (k: KundeResource) => {
        setSelectedKunde(k);
        setKundeSearchTerm('');
        setKundeDropdownOpen(false);
        setTimeout(() => artikelInputRef.current?.focus(), 0);
    };

    const handleKundeKeyDown = (e: React.KeyboardEvent) => {
        if (!kundeDropdownOpen || filteredKunden.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setKundeHighlightIndex((kundeHighlightIndex + 1) % filteredKunden.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setKundeHighlightIndex((kundeHighlightIndex - 1 + filteredKunden.length) % filteredKunden.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredKunden[kundeHighlightIndex]) {
                handleKundeSelect(filteredKunden[kundeHighlightIndex]);
            }
        } else if (e.key === 'Escape') {
            setKundeDropdownOpen(false);
        }
    };

    const handleArtikelInputChange = (val: string) => {
        setArtikelSearchTerm(val);
        setArtikelDropdownOpen(val.trim().length > 0);
        setArtikelHighlightIndex(0);
    };

    const handleArtikelSelect = (a: ArtikelResource) => {
        const einheit = a.erfassungsModus === 'GEWICHT' ? 'kg' : a.erfassungsModus === 'STÜCK' ? 'stück' : a.erfassungsModus === 'KARTON' ? 'karton' : 'kg';
        const newPos: ArtikelPositionDraft = {
            tempId: Date.now().toString() + Math.random(),
            artikel: a.id,
            artikelName: a.name,
            artikelNummer: a.artikelNummer,
            menge: 1,
            einheit,
            zerlegung: false,
            vakuum: false,
            bemerkung: ''
        };
        setPositionen([...positionen, newPos]);
        setArtikelSearchTerm('');
        setArtikelDropdownOpen(false);
        setFocusedCell({ rowIndex: positionen.length, colIndex: 2 });
    };

    const handleArtikelKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            if (artikelDropdownOpen && filteredArtikel.length > 0) {
                e.preventDefault();
                setArtikelHighlightIndex((artikelHighlightIndex + 1) % filteredArtikel.length);
            } else if (!artikelDropdownOpen && positionen.length > 0) {
                e.preventDefault();
                setFocusedCell({ rowIndex: 0, colIndex: 1 });
            }
        } else if (e.key === 'ArrowUp') {
            if (artikelDropdownOpen && filteredArtikel.length > 0) {
                e.preventDefault();
                setArtikelHighlightIndex((artikelHighlightIndex - 1 + filteredArtikel.length) % filteredArtikel.length);
            }
        } else if (e.key === 'Enter') {
            if (artikelDropdownOpen && filteredArtikel.length > 0) {
                e.preventDefault();
                if (filteredArtikel[artikelHighlightIndex]) {
                    handleArtikelSelect(filteredArtikel[artikelHighlightIndex]);
                }
            }
        } else if (e.key === 'Escape') {
            setArtikelDropdownOpen(false);
        }
    };

    const handleEditArtikelInputChange = (val: string) => {
        setEditArtikelSearchTerm(val);
        setEditArtikelDropdownOpen(val.trim().length > 0);
        setEditArtikelHighlightIndex(0);
    };

    const handleEditArtikelSelect = (a: ArtikelResource, rowIndex: number) => {
        const pos = positionen[rowIndex];
        const einheit = a.erfassungsModus === 'GEWICHT' ? 'kg' : a.erfassungsModus === 'STÜCK' ? 'stück' : a.erfassungsModus === 'KARTON' ? 'karton' : 'kg';

        // Alle Updates auf einmal machen
        setPositionen(positionen.map(p =>
            p.tempId === pos.tempId
                ? {
                    ...p,
                    artikel: a.id,
                    artikelName: a.name,
                    artikelNummer: a.artikelNummer,
                    einheit: einheit
                }
                : p
        ));

        setEditArtikelSearchTerm('');
        setEditArtikelDropdownOpen(false);
        setEditingArtikelRow(null);

        // Focus auf Mengenfeld setzen
        setTimeout(() => {
            const mengeField = cellRefs.current[`${rowIndex}-2`];
            if (mengeField) {
                mengeField.focus();
            }
        }, 50);
    };

    const handleEditArtikelKeyDown = (e: React.KeyboardEvent, rowIndex: number) => {
        if (!editArtikelDropdownOpen || filteredEditArtikel.length === 0) {
            if (e.key === 'Escape') {
                e.preventDefault();
                setEditingArtikelRow(null);
                setEditArtikelDropdownOpen(false);
                setFocusedCell({ rowIndex, colIndex: 1 });
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setEditArtikelHighlightIndex((editArtikelHighlightIndex + 1) % filteredEditArtikel.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setEditArtikelHighlightIndex((editArtikelHighlightIndex - 1 + filteredEditArtikel.length) % filteredEditArtikel.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredEditArtikel[editArtikelHighlightIndex]) {
                handleEditArtikelSelect(filteredEditArtikel[editArtikelHighlightIndex], rowIndex);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditingArtikelRow(null);
            setEditArtikelDropdownOpen(false);
            setFocusedCell({ rowIndex, colIndex: 1 });
        }
    };

    const handlePositionUpdate = (tempId: string, field: keyof ArtikelPositionDraft, value: any) => {
        setPositionen(positionen.map(p => p.tempId === tempId ? { ...p, [field]: value } : p));
    };

    const handleDeletePosition = (tempId: string) => {
        setPositionen(positionen.filter(p => p.tempId !== tempId));
        setFocusedCell(null);
    };

    const handleLieferdatumChange = (val: string) => {
        setLieferdatumInput(val);
        const parsed = parseGermanDate(val);
        if (parsed) {
            setLieferdatumISO(parsed);
        }
    };

    const setLieferdatumShortcut = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const iso = d.toISOString().split('T')[0];
        setLieferdatumISO(iso);
        setLieferdatumInput(formatDateGerman(iso));
    };

    const setLieferdatumNextBusinessDay = () => {
        const iso = nextBusinessDay();
        setLieferdatumISO(iso);
        setLieferdatumInput(formatDateGerman(iso));
    };

    const canCreate = selectedKunde && positionen.length > 0 && lieferdatumISO && positionen.every(p => p.artikel);

    const handleCreateAuftrag = async () => {
        if (!canCreate || creatingRef.current) return;
        creatingRef.current = true;
        setCreating(true);
        setError(null);
        try {
            const auftrag = await api.createAuftrag({
                kunde: selectedKunde!.id!,
                kundeName: selectedKunde!.name,
                status: 'offen',
                artikelPosition: []
            });
            const positionIds: string[] = [];
            for (const pos of positionen) {
                const created = await api.createArtikelPosition({
                    artikel: pos.artikel,
                    menge: pos.menge,
                    einheit: pos.einheit,
                    zerlegung: pos.zerlegung,
                    vakuum: pos.vakuum,
                    bemerkung: pos.bemerkung,
                    auftragId: auftrag.id
                });
                if (created.id) positionIds.push(created.id);
            }
            await api.updateAuftrag(auftrag.id!, {
                artikelPosition: positionIds,
                lieferdatum: lieferdatumISO
            });
            navigate('/aufträge');
        } catch (err: any) {
            setError(err.message || 'Fehler beim Erstellen des Auftrags');
            creatingRef.current = false;
            setCreating(false);
        }
    };

    const handleCellKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
        const totalCols = 6;
        const totalRows = positionen.length;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (rowIndex < totalRows - 1) {
                setFocusedCell({ rowIndex: rowIndex + 1, colIndex });
            } else {
                // Bei der letzten Zeile: neue leere Position erstellen
                const newPos: ArtikelPositionDraft = {
                    tempId: Date.now().toString() + Math.random(),
                    artikel: undefined,
                    artikelName: '',
                    artikelNummer: '',
                    menge: undefined,
                    einheit: 'kg',
                    zerlegung: false,
                    vakuum: false,
                    bemerkung: ''
                };
                setPositionen([...positionen, newPos]);
                // Direkt in den Bearbeitungsmodus für den Artikel wechseln
                setTimeout(() => {
                    setEditingArtikelRow(totalRows);
                    setEditArtikelSearchTerm('');
                    setEditArtikelDropdownOpen(false);
                    setTimeout(() => editArtikelInputRef.current?.focus(), 0);
                }, 0);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (rowIndex > 0) {
                setFocusedCell({ rowIndex: rowIndex - 1, colIndex });
            } else {
                artikelInputRef.current?.focus();
                setFocusedCell(null);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (colIndex < totalCols - 1) {
                setFocusedCell({ rowIndex, colIndex: colIndex + 1 });
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (colIndex > 0) {
                setFocusedCell({ rowIndex, colIndex: colIndex - 1 });
            }
        } else if (e.key === 'Delete' && colIndex === totalCols - 1) {
            e.preventDefault();
            handleDeletePosition(positionen[rowIndex].tempId);
        } else if (e.key === 'Enter' && colIndex === 1) {
            e.preventDefault();
            setEditArtikelDropdownOpen(false);
            setEditArtikelSearchTerm('');
            setEditingArtikelRow(rowIndex);
            setTimeout(() => editArtikelInputRef.current?.focus(), 0);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <div className="spinner-border" role="status"><span className="visually-hidden">Lädt...</span></div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="mb-0">Schnellauftrag</h4>
                <div className="d-flex align-items-center gap-2">
                    <small className="text-muted">Ctrl+Enter</small>
                    <button className="btn btn-primary btn-sm" disabled={!canCreate || creating} onClick={handleCreateAuftrag}>
                        {creating ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                        Auftrag erstellen
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>}

            <div className="row mb-3">
                <div className="col-md-6">
                    <label className="form-label fw-bold">Kunde (Name oder Nr.)</label>
                    {selectedKunde ? (
                        <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-success">{selectedKunde.kundenNummer} — {selectedKunde.name}</span>
                            <a href="#" className="text-decoration-none small" onClick={(e) => { e.preventDefault(); setSelectedKunde(null); setKundeSearchTerm(''); setTimeout(() => kundeInputRef.current?.focus(), 0); }}>ändern</a>
                        </div>
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <input
                                ref={kundeInputRef}
                                type="text"
                                className="form-control form-control-sm"
                                value={kundeSearchTerm}
                                onChange={(e) => handleKundeInputChange(e.target.value)}
                                onKeyDown={handleKundeKeyDown}
                                onFocus={() => kundeSearchTerm.trim() && setKundeDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setKundeDropdownOpen(false), 200)}
                                placeholder="Tippen zum Suchen..."
                                autoFocus
                            />
                            {kundeDropdownOpen && filteredKunden.length > 0 && (
                                <div ref={kundeDropdownRef} className="list-group position-absolute w-100" style={{ maxHeight: '250px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                    {filteredKunden.map((k, idx) => (
                                        <button
                                            key={k.id}
                                            type="button"
                                            className={`list-group-item list-group-item-action ${idx === kundeHighlightIndex ? 'active' : ''}`}
                                            onMouseDown={() => handleKundeSelect(k)}
                                        >
                                            {k.kundenNummer} — {k.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="col-md-6">
                    <label className="form-label fw-bold">Lieferdatum (TT.MM.JJJJ)</label>
                    <div className="d-flex gap-2">
                        <input
                            ref={lieferdatumInputRef}
                            type="text"
                            className="form-control form-control-sm"
                            value={lieferdatumInput}
                            onChange={(e) => handleLieferdatumChange(e.target.value)}
                            placeholder="TT.MM.JJJJ"
                        />
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setLieferdatumShortcut(0)}>Heute</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setLieferdatumShortcut(1)}>Morgen</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={setLieferdatumNextBusinessDay}>Nächster Werktag</button>
                    </div>
                </div>
            </div>

            {selectedKunde && (
                <div className="mb-3">
                    <label className="form-label fw-bold">Artikel (Name oder Nr.)</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            ref={artikelInputRef}
                            type="text"
                            className="form-control form-control-sm"
                            value={artikelSearchTerm}
                            onChange={(e) => handleArtikelInputChange(e.target.value)}
                            onKeyDown={handleArtikelKeyDown}
                            onFocus={() => artikelSearchTerm.trim() && setArtikelDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setArtikelDropdownOpen(false), 200)}
                            placeholder="Artikel hinzufügen..."
                        />
                        {artikelDropdownOpen && filteredArtikel.length > 0 && (
                            <div ref={artikelDropdownRef} className="list-group position-absolute w-100" style={{ maxHeight: '300px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                {filteredArtikel.map((a, idx) => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        className={`list-group-item list-group-item-action ${idx === artikelHighlightIndex ? 'active' : ''}`}
                                        onMouseDown={() => handleArtikelSelect(a)}
                                    >
                                        <div>{a.name}</div>
                                        <small className="text-muted">{a.artikelNummer}</small>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {positionen.length > 0 && (
                <div className="table-responsive">
                    <table className="table table-sm table-bordered">
                        <thead className="table-light">
                            <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th style={{ minWidth: '350px' }}>Artikel</th>
                                <th style={{ width: '120px' }}>Menge</th>
                                <th style={{ width: '120px' }}>Einheit</th>
                                <th style={{ width: '180px' }}>Optionen</th>
                                <th style={{ width: '250px' }}>Bemerkung</th>
                                <th style={{ width: '80px' }}>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positionen.map((pos, rowIndex) => {
                                const isEditingArtikel = editingArtikelRow === rowIndex;
                                return (
                                    <tr key={pos.tempId}>
                                        <td className="text-center">{rowIndex + 1}</td>
                                        <td>
                                            {isEditingArtikel ? (
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        ref={editArtikelInputRef}
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={editArtikelSearchTerm}
                                                        onChange={(e) => handleEditArtikelInputChange(e.target.value)}
                                                        onKeyDown={(e) => handleEditArtikelKeyDown(e, rowIndex)}
                                                        onBlur={() => {
                                                            setTimeout(() => {
                                                                setEditArtikelDropdownOpen(false);
                                                                setEditingArtikelRow(null);
                                                            }, 200);
                                                        }}
                                                        placeholder="Tippen zum Suchen..."
                                                        autoFocus
                                                    />
                                                    {editArtikelDropdownOpen && filteredEditArtikel.length > 0 && (
                                                        <div
                                                            ref={editArtikelDropdownRef}
                                                            className="list-group position-fixed"
                                                            style={{
                                                                minWidth: '400px',
                                                                maxHeight: '350px',
                                                                overflowY: 'auto',
                                                                zIndex: 9999,
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                                backgroundColor: 'white',
                                                                border: '1px solid #dee2e6',
                                                                borderRadius: '0.25rem',
                                                                top: editArtikelInputRef.current ?
                                                                    `${editArtikelInputRef.current.getBoundingClientRect().bottom + 2}px` : '0px',
                                                                left: editArtikelInputRef.current ?
                                                                    `${editArtikelInputRef.current.getBoundingClientRect().left}px` : '0px'
                                                            }}
                                                        >
                                                            {filteredEditArtikel.map((a, idx) => (
                                                                <button
                                                                    key={a.id}
                                                                    type="button"
                                                                    className={`list-group-item list-group-item-action ${idx === editArtikelHighlightIndex ? 'active' : ''}`}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        handleEditArtikelSelect(a, rowIndex);
                                                                    }}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        padding: '0.75rem 1rem',
                                                                        textAlign: 'left'
                                                                    }}
                                                                >
                                                                    <div><strong>{a.name}</strong></div>
                                                                    <small className="text-muted">Nr: {a.artikelNummer}</small>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        setEditArtikelDropdownOpen(false);
                                                        setEditArtikelSearchTerm('');
                                                        setEditingArtikelRow(rowIndex);
                                                        setTimeout(() => editArtikelInputRef.current?.focus(), 0);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        // Enter: in Bearbeitungsmodus wechseln
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            setEditArtikelDropdownOpen(false);
                                                            setEditArtikelSearchTerm('');
                                                            setEditingArtikelRow(rowIndex);
                                                            setTimeout(() => editArtikelInputRef.current?.focus(), 0);
                                                        }
                                                        // Bei Buchstaben/Zahlen: in Bearbeitungsmodus mit diesem Zeichen
                                                        else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                                                            e.preventDefault();
                                                            setEditArtikelDropdownOpen(false);
                                                            setEditArtikelSearchTerm(e.key.length === 1 ? e.key : '');
                                                            setEditingArtikelRow(rowIndex);
                                                            setTimeout(() => editArtikelInputRef.current?.focus(), 0);
                                                        }
                                                        // Andere Tasten: normale Navigation
                                                        else {
                                                            handleCellKeyDown(e, rowIndex, 1);
                                                        }
                                                    }}
                                                    onFocus={() => setFocusedCell({ rowIndex, colIndex: 1 })}
                                                    ref={(el) => { cellRefs.current[`${rowIndex}-1`] = el; }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        padding: '0.25rem',
                                                        outline: focusedCell?.rowIndex === rowIndex && focusedCell?.colIndex === 1 ? '2px solid #6c757d' : 'none',
                                                        outlineOffset: '-2px',
                                                        borderRadius: '0.25rem'
                                                    }}
                                                >
                                                    <div>{pos.artikelName}</div>
                                                    <small className="text-muted">{pos.artikelNummer}</small>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="form-control form-control-sm"
                                                value={pos.menge ?? ''}
                                                onChange={(e) => handlePositionUpdate(pos.tempId, 'menge', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                                onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 2)}
                                                onFocus={() => setFocusedCell({ rowIndex, colIndex: 2 })}
                                                ref={(el) => { cellRefs.current[`${rowIndex}-2`] = el; }}
                                                style={{
                                                    outline: focusedCell?.rowIndex === rowIndex && focusedCell?.colIndex === 2 ? '2px solid #6c757d' : undefined,
                                                    outlineOffset: '-2px'
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <select
                                                className="form-select form-select-sm"
                                                value={pos.einheit || 'kg'}
                                                onChange={(e) => handlePositionUpdate(pos.tempId, 'einheit', e.target.value)}
                                                onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 3)}
                                                onFocus={() => setFocusedCell({ rowIndex, colIndex: 3 })}
                                                ref={(el) => { cellRefs.current[`${rowIndex}-3`] = el; }}
                                                style={{
                                                    outline: focusedCell?.rowIndex === rowIndex && focusedCell?.colIndex === 3 ? '2px solid #6c757d' : undefined,
                                                    outlineOffset: '-2px'
                                                }}
                                            >
                                                <option value="kg">kg</option>
                                                <option value="stück">Stück</option>
                                                <option value="kiste">Kiste</option>
                                                <option value="karton">Karton</option>
                                            </select>
                                        </td>
                                        <td>
                                            <div
                                                className="d-flex gap-2"
                                                tabIndex={0}
                                                onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 4)}
                                                onFocus={() => setFocusedCell({ rowIndex, colIndex: 4 })}
                                                ref={(el) => { cellRefs.current[`${rowIndex}-4`] = el; }}
                                                style={{
                                                    outline: focusedCell?.rowIndex === rowIndex && focusedCell?.colIndex === 4 ? '2px solid #6c757d' : 'none',
                                                    outlineOffset: '-2px',
                                                    borderRadius: '0.25rem',
                                                    padding: '0.25rem'
                                                }}
                                            >
                                                <div className="form-check">
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        id={`zer-${pos.tempId}`}
                                                        checked={pos.zerlegung || false}
                                                        onChange={(e) => handlePositionUpdate(pos.tempId, 'zerlegung', e.target.checked)}
                                                    />
                                                    <label className="form-check-label" htmlFor={`zer-${pos.tempId}`}>Zerlegung</label>
                                                </div>
                                                <div className="form-check">
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        id={`vak-${pos.tempId}`}
                                                        checked={pos.vakuum || false}
                                                        onChange={(e) => handlePositionUpdate(pos.tempId, 'vakuum', e.target.checked)}
                                                    />
                                                    <label className="form-check-label" htmlFor={`vak-${pos.tempId}`}>Vakuum</label>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={pos.bemerkung || ''}
                                                onChange={(e) => handlePositionUpdate(pos.tempId, 'bemerkung', e.target.value)}
                                                onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 5)}
                                                onFocus={() => setFocusedCell({ rowIndex, colIndex: 5 })}
                                                ref={(el) => { cellRefs.current[`${rowIndex}-5`] = el; }}
                                                style={{
                                                    outline: focusedCell?.rowIndex === rowIndex && focusedCell?.colIndex === 5 ? '2px solid #6c757d' : undefined,
                                                    outlineOffset: '-2px'
                                                }}
                                            />
                                        </td>
                                        <td className="text-center">
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => handleDeletePosition(pos.tempId)}
                                                onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 6)}
                                                onFocus={() => setFocusedCell({ rowIndex, colIndex: 6 })}
                                                ref={(el) => { cellRefs.current[`${rowIndex}-6`] = el; }}
                                                title="Löschen (Delete)"
                                                style={{
                                                    outline: focusedCell?.rowIndex === rowIndex && focusedCell?.colIndex === 6 ? '2px solid #6c757d' : undefined,
                                                    outlineOffset: '-2px'
                                                }}
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div >
            )}
        </div >
    );
};

export default SchnellAuftragWriter;