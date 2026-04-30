import React, { useState, useEffect, useRef } from 'react';
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

interface PositionDraft {
    tempId: string;
    artikel?: string;
    artikelName?: string;
    artikelNummer?: string;
    menge: number;
    einheit: "kg" | "stück" | "kiste" | "karton";
    einzelpreis: number;
    zerlegung: boolean;
    vakuum: boolean;
    bemerkung: string;
}

const normalizeText = (text: string): string => text.toLowerCase().trim();

const formatDateGerman = (isoDate: string): string => {
    const d = new Date(isoDate);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const parseGermanDate = (german: string): string | null => {
    const match = german.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
};

const nextBusinessDay = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
};

let _tempIdCounter = 0;
const newTempId = () => `t${Date.now()}-${++_tempIdCounter}`;

const SchnellAuftragWriter: React.FC = () => {

    const [kunden, setKunden] = useState<KundeResource[]>([]);
    const [artikel, setArtikel] = useState<ArtikelResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const creatingRef = useRef(false);
    const [lastAuftragId, setLastAuftragId] = useState<string | null>(null);
    const [lastAuftragNr, setLastAuftragNr] = useState<string | null>(null);

    // Kunde
    const [selectedKunde, setSelectedKunde] = useState<KundeResource | null>(null);
    const [kundeSearch, setKundeSearch] = useState('');
    const [kundeOpen, setKundeOpen] = useState(false);
    const [kundeIdx, setKundeIdx] = useState(0);
    const kundeInputRef = useRef<HTMLInputElement>(null);

    // Datum
    const [lieferdatumInput, setLieferdatumInput] = useState('');
    const [lieferdatumISO, setLieferdatumISO] = useState(nextBusinessDay());

    // Bemerkungen (Auftragsebene)
    const [bemerkungen, setBemerkungen] = useState('');

    // Positionen
    const [positionen, setPositionen] = useState<PositionDraft[]>([]);

    // Artikel-Suche (für neue Position)
    const [artikelSearch, setArtikelSearch] = useState('');
    const [artikelOpen, setArtikelOpen] = useState(false);
    const [artikelIdx, setArtikelIdx] = useState(0);
    const artikelInputRef = useRef<HTMLInputElement>(null);

    // Inline-Artikel-Edit
    const [editRow, setEditRow] = useState<number | null>(null);
    const [editSearch, setEditSearch] = useState('');
    const [editOpen, setEditOpen] = useState(false);
    const [editIdx, setEditIdx] = useState(0);
    const editInputRef = useRef<HTMLInputElement>(null);

    const cellRefs = useRef<Record<string, HTMLElement | null>>({});

    // --- Init ---
    useEffect(() => {
        (async () => {
            try {
                const [k, a] = await Promise.all([api.getAllKunden(), api.getAllArtikelClean()]);
                setKunden(k.items);
                setArtikel(a.items);
                setLieferdatumInput(formatDateGerman(nextBusinessDay()));
            } catch (err: any) {
                setError(err.message || 'Fehler beim Laden');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // --- Global Keys ---
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 's')) {
                e.preventDefault();
                handleCreate();
            }
            if (e.key === 'F2') {
                e.preventDefault();
                setSelectedKunde(null);
                setKundeSearch('');
                setTimeout(() => kundeInputRef.current?.focus(), 0);
            }
            if (e.key === 'Escape') {
                setKundeOpen(false);
                setArtikelOpen(false);
                setEditOpen(false);
                setEditRow(null);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });

    // --- Filter ---
    const filteredKunden = kundeSearch.trim()
        ? kunden.filter(k => {
            const t = normalizeText(kundeSearch);
            return normalizeText(k.name || '').includes(t) || normalizeText(k.kundenNummer || '').includes(t);
        }).slice(0, 8)
        : [];

    const filterArtikel = (term: string) => term.trim()
        ? artikel.filter(a => {
            const t = normalizeText(term);
            return normalizeText(a.name).includes(t) || normalizeText(a.artikelNummer).includes(t);
        }).slice(0, 10)
        : [];

    const filteredArtikel = filterArtikel(artikelSearch);
    const filteredEditArtikel = filterArtikel(editSearch);

    // --- Kunde ---
    const selectKunde = (k: KundeResource) => {
        setSelectedKunde(k);
        setKundeSearch('');
        setKundeOpen(false);
        setTimeout(() => artikelInputRef.current?.focus(), 0);
    };

    // --- Artikel auswählen → neue Position ---
    const addPosition = (a: ArtikelResource) => {
        const einheit = a.erfassungsModus === 'STÜCK' ? 'stück' : a.erfassungsModus === 'KARTON' ? 'karton' : 'kg';
        const pos: PositionDraft = {
            tempId: newTempId(),
            artikel: a.id,
            artikelName: a.name,
            artikelNummer: a.artikelNummer,
            menge: 1,
            einheit,
            einzelpreis: a.preis || 0,
            zerlegung: false,
            vakuum: false,
            bemerkung: '',
        };
        setPositionen(prev => [...prev, pos]);
        setArtikelSearch('');
        setArtikelOpen(false);
        // Focus auf Menge der neuen Zeile
        setTimeout(() => {
            const el = cellRefs.current[`${positionen.length}-menge`];
            if (el) (el as HTMLInputElement).focus();
        }, 50);
    };

    // --- Position updaten ---
    const updatePos = (tempId: string, updates: Partial<PositionDraft>) => {
        setPositionen(prev => prev.map(p => {
            if (p.tempId !== tempId) return p;
            return { ...p, ...updates };
        }));
    };

    const deletePos = (tempId: string) => {
        setPositionen(prev => prev.filter(p => p.tempId !== tempId));
    };

    // --- Inline Artikel Edit ---
    const selectEditArtikel = (a: ArtikelResource, rowIndex: number) => {
        const einheit = a.erfassungsModus === 'STÜCK' ? 'stück' : a.erfassungsModus === 'KARTON' ? 'karton' : 'kg';
        updatePos(positionen[rowIndex].tempId, {
            artikel: a.id,
            artikelName: a.name,
            artikelNummer: a.artikelNummer,
            einheit,
            einzelpreis: a.preis || 0,
        });
        setEditSearch('');
        setEditOpen(false);
        setEditRow(null);
        setTimeout(() => {
            const el = cellRefs.current[`${rowIndex}-menge`];
            if (el) (el as HTMLInputElement).focus();
        }, 50);
    };

    // --- Datum ---
    const setDatum = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const iso = d.toISOString().split('T')[0];
        setLieferdatumISO(iso);
        setLieferdatumInput(formatDateGerman(iso));
    };

    const setDatumNextBusiness = () => {
        const iso = nextBusinessDay();
        setLieferdatumISO(iso);
        setLieferdatumInput(formatDateGerman(iso));
    };

    // --- Erstellen ---
    const realPositionen = positionen.filter(p => p.artikel);
    const canCreate = selectedKunde && realPositionen.length > 0 && lieferdatumISO;

    const handleCreate = async () => {
        if (!canCreate || creatingRef.current) return;
        creatingRef.current = true;
        setCreating(true);
        setError(null);
        try {
            const auftrag = await api.createAuftragCompleteMitPreis({
                kunde: selectedKunde!.id!,
                lieferdatum: lieferdatumISO,
                bemerkungen: bemerkungen.trim() || undefined,
                positionen: positionen.map(p => ({
                    artikel: p.artikel,
                    menge: p.menge,
                    einheit: p.einheit,
                    einzelpreis: p.einzelpreis,
                    zerlegung: p.zerlegung,
                    vakuum: p.vakuum,
                    bemerkung: p.bemerkung,
                })),
            });
            setLastAuftragId(auftrag.id || null);
            setLastAuftragNr(auftrag.auftragsnummer || null);
            creatingRef.current = false;
            setCreating(false);
        } catch (err: any) {
            setError(err.message || 'Fehler beim Erstellen');
            creatingRef.current = false;
            setCreating(false);
        }
    };

    // --- Dropdown key helpers ---
    const dropdownKeys = (
        e: React.KeyboardEvent,
        items: any[],
        idx: number,
        setIdx: (n: number) => void,
        onSelect: (item: any) => void,
        onClose: () => void,
    ) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((idx + 1) % items.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((idx - 1 + items.length) % items.length); }
        else if (e.key === 'Enter' && items[idx]) { e.preventDefault(); onSelect(items[idx]); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };

    // --- PDF Drucken ---
    const handlePrint = async (auftragId: string, auftragNr?: string | null) => {
        try {
            const blob = await api.generateSchnellauftragPdf(auftragId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Auftrag-${auftragNr || auftragId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            setError('Fehler beim PDF-Erstellen: ' + (err.message || ''));
        }
    };

    // --- Neuer Auftrag (Formular zurücksetzen) ---
    const handleNeu = () => {
        setLastAuftragId(null);
        setLastAuftragNr(null);
        setSelectedKunde(null);
        setKundeSearch('');
        setBemerkungen('');
        setPositionen([]);
        setLieferdatumISO(nextBusinessDay());
        setLieferdatumInput(formatDateGerman(nextBusinessDay()));
        creatingRef.current = false;
        setCreating(false);
        setTimeout(() => kundeInputRef.current?.focus(), 0);
    };

    // --- Move position up/down ---
    const movePos = (index: number, dir: -1 | 1) => {
        const target = index + dir;
        if (target < 0 || target >= positionen.length) return;
        setPositionen(prev => {
            const arr = [...prev];
            [arr[index], arr[target]] = [arr[target], arr[index]];
            return arr;
        });
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
            {/* Header */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h4 className="mb-0">Schnellauftrag</h4>
                <div className="d-flex align-items-center gap-2">
                    {lastAuftragId ? (
                        <>
                            <span className="badge bg-success">Auftrag {lastAuftragNr} erstellt</span>
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => handlePrint(lastAuftragId, lastAuftragNr)}>
                                Drucken
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={handleNeu}>
                                Neuer Auftrag
                            </button>
                        </>
                    ) : (
                        <>
                            <small className="text-muted d-none d-sm-inline">Ctrl+Enter</small>
                            <button className="btn btn-primary btn-sm" disabled={!canCreate || creating} onClick={handleCreate}>
                                {creating && <span className="spinner-border spinner-border-sm me-1"></span>}
                                Auftrag erstellen
                            </button>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                    {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
            )}

            {/* Kunde + Datum */}
            <div className="row mb-3">
                <div className="col-md-6">
                    <label className="form-label fw-bold">Kunde</label>
                    {selectedKunde ? (
                        <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-success">{selectedKunde.kundenNummer} — {selectedKunde.name}</span>
                            <a href="#" className="text-decoration-none small" onClick={(e) => {
                                e.preventDefault();
                                setSelectedKunde(null);
                                setKundeSearch('');
                                setTimeout(() => kundeInputRef.current?.focus(), 0);
                            }}>ändern</a>
                        </div>
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <input
                                ref={kundeInputRef}
                                type="text"
                                className="form-control form-control-sm"
                                value={kundeSearch}
                                onChange={e => { setKundeSearch(e.target.value); setKundeOpen(e.target.value.trim().length > 0); setKundeIdx(0); }}
                                onKeyDown={e => {
                                    if (kundeOpen && filteredKunden.length > 0) {
                                        dropdownKeys(e, filteredKunden, kundeIdx, setKundeIdx, selectKunde, () => setKundeOpen(false));
                                    }
                                }}
                                onFocus={() => kundeSearch.trim() && setKundeOpen(true)}
                                onBlur={() => setTimeout(() => setKundeOpen(false), 200)}
                                placeholder="Name oder Kundennr. eingeben..."
                                autoFocus
                            />
                            {kundeOpen && filteredKunden.length > 0 && (
                                <div className="list-group position-absolute w-100" style={{ maxHeight: 250, overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                    {filteredKunden.map((k, i) => (
                                        <button key={k.id} type="button"
                                            className={`list-group-item list-group-item-action ${i === kundeIdx ? 'active' : ''}`}
                                            onMouseDown={() => selectKunde(k)}>
                                            {k.kundenNummer} — {k.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="col-md-6">
                    <label className="form-label fw-bold">Lieferdatum</label>
                    <div className="d-flex flex-wrap gap-2">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            style={{ minWidth: 120, flex: '1 1 120px' }}
                            value={lieferdatumInput}
                            onChange={e => {
                                setLieferdatumInput(e.target.value);
                                const parsed = parseGermanDate(e.target.value);
                                if (parsed) setLieferdatumISO(parsed);
                            }}
                            placeholder="TT.MM.JJJJ"
                        />
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setDatum(0)}>Heute</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setDatum(1)}>Morgen</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={setDatumNextBusiness}>Werktag</button>
                    </div>
                </div>
            </div>

            {/* Auftragsbemerkung */}
            {selectedKunde && (
                <div className="mb-3">
                    <label className="form-label fw-bold">Auftragsbemerkung</label>
                    <textarea
                        className="form-control form-control-sm"
                        rows={2}
                        value={bemerkungen}
                        onChange={e => setBemerkungen(e.target.value)}
                        placeholder="Bemerkung zum gesamten Auftrag..."
                    />
                </div>
            )}

            {/* Artikel-Suche */}
            {selectedKunde && (
                <div className="mb-3 d-flex gap-2 align-items-end">
                    <div style={{ position: 'relative', flex: 1 }}>
                        <label className="form-label fw-bold">Artikel hinzufügen</label>
                        <input
                            ref={artikelInputRef}
                            type="text"
                            className="form-control form-control-sm"
                            value={artikelSearch}
                            onChange={e => { setArtikelSearch(e.target.value); setArtikelOpen(e.target.value.trim().length > 0); setArtikelIdx(0); }}
                            onKeyDown={e => {
                                if (artikelOpen && filteredArtikel.length > 0) {
                                    dropdownKeys(e, filteredArtikel, artikelIdx, setArtikelIdx, addPosition, () => setArtikelOpen(false));
                                }
                            }}
                            onFocus={() => artikelSearch.trim() && setArtikelOpen(true)}
                            onBlur={() => setTimeout(() => setArtikelOpen(false), 200)}
                            placeholder="Artikelname oder Nr...."
                        />
                        {artikelOpen && filteredArtikel.length > 0 && (
                            <div className="list-group position-absolute w-100" style={{ maxHeight: 300, overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                {filteredArtikel.map((a, i) => (
                                    <button key={a.id} type="button"
                                        className={`list-group-item list-group-item-action ${i === artikelIdx ? 'active' : ''}`}
                                        onMouseDown={() => addPosition(a)}>
                                        <div>{a.name}</div>
                                        <small className="text-muted">{a.artikelNummer} — {a.preis?.toFixed(2)} €/kg</small>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Positionen-Tabelle */}
            {positionen.length > 0 && (
                <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                        <thead className="table-light">
                            <tr>
                                <th style={{ width: 40 }}>#</th>
                                <th style={{ width: 90 }}>Menge</th>
                                <th style={{ width: 100 }}>Einheit</th>
                                <th style={{ minWidth: 250 }}>Artikel</th>
                                <th style={{ width: 110 }}>€/kg</th>
                                <th style={{ width: 140 }}>Optionen</th>
                                <th style={{ width: 180 }}>Bemerkung</th>
                                <th style={{ width: 100 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {positionen.map((pos, ri) => {
                                const isEditing = editRow === ri;
                                return (
                                    <tr key={pos.tempId}>
                                        <td className="text-center">{ri + 1}</td>
                                        {/* Menge */}
                                        <td>
                                            <input type="number" className="form-control form-control-sm"
                                                ref={el => { cellRefs.current[`${ri}-menge`] = el; }}
                                                value={pos.menge || ''}
                                                onChange={e => updatePos(pos.tempId, { menge: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                                min={0} step="any"
                                            />
                                        </td>
                                        {/* Einheit */}
                                        <td>
                                            <select className="form-select form-select-sm"
                                                value={pos.einheit}
                                                onChange={e => updatePos(pos.tempId, { einheit: e.target.value as any })}>
                                                <option value="kg">kg</option>
                                                <option value="stück">Stück</option>
                                                <option value="kiste">Kiste</option>
                                                <option value="karton">Karton</option>
                                            </select>
                                        </td>
                                        {/* Artikel */}
                                        <td>
                                            {isEditing ? (
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        ref={editInputRef}
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={editSearch}
                                                        onChange={e => { setEditSearch(e.target.value); setEditOpen(e.target.value.trim().length > 0); setEditIdx(0); }}
                                                        onKeyDown={e => {
                                                            if (editOpen && filteredEditArtikel.length > 0) {
                                                                dropdownKeys(e, filteredEditArtikel, editIdx, setEditIdx,
                                                                    (a: ArtikelResource) => selectEditArtikel(a, ri),
                                                                    () => { setEditOpen(false); setEditRow(null); });
                                                            } else if (e.key === 'Escape') {
                                                                setEditRow(null);
                                                                setEditOpen(false);
                                                            }
                                                        }}
                                                        onBlur={() => setTimeout(() => { setEditOpen(false); setEditRow(null); }, 200)}
                                                        placeholder="Suchen..."
                                                        autoFocus
                                                    />
                                                    {editOpen && filteredEditArtikel.length > 0 && (
                                                        <div className="list-group position-fixed" style={{
                                                            minWidth: 350, maxHeight: 300, overflowY: 'auto', zIndex: 9999,
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', backgroundColor: 'white',
                                                            border: '1px solid #dee2e6', borderRadius: '0.25rem',
                                                            top: editInputRef.current ? `${editInputRef.current.getBoundingClientRect().bottom + 2}px` : 0,
                                                            left: editInputRef.current ? `${editInputRef.current.getBoundingClientRect().left}px` : 0,
                                                        }}>
                                                            {filteredEditArtikel.map((a, i) => (
                                                                <button key={a.id} type="button"
                                                                    className={`list-group-item list-group-item-action ${i === editIdx ? 'active' : ''}`}
                                                                    onMouseDown={e => { e.preventDefault(); selectEditArtikel(a, ri); }}>
                                                                    <div><strong>{a.name}</strong></div>
                                                                    <small className="text-muted">{a.artikelNummer} — {a.preis?.toFixed(2)} €/kg</small>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ cursor: 'pointer', padding: '0.25rem' }}
                                                    onClick={() => { setEditSearch(''); setEditOpen(false); setEditRow(ri); setTimeout(() => editInputRef.current?.focus(), 0); }}>
                                                    <div>{pos.artikelName || <span className="text-muted">Artikel wählen...</span>}</div>
                                                    {pos.artikelNummer && <small className="text-muted">{pos.artikelNummer}</small>}
                                                </div>
                                            )}
                                        </td>
                                        {/* Einzelpreis */}
                                        <td>
                                            <input type="number" className="form-control form-control-sm"
                                                value={pos.einzelpreis || ''}
                                                onChange={e => updatePos(pos.tempId, { einzelpreis: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                                min={0} step="0.01"
                                            />
                                        </td>
                                        {/* Optionen */}
                                        <td>
                                            <div className="d-flex gap-2">
                                                <div className="form-check">
                                                    <input type="checkbox" className="form-check-input" id={`zer-${pos.tempId}`}
                                                        checked={pos.zerlegung}
                                                        onChange={e => updatePos(pos.tempId, { zerlegung: e.target.checked })} />
                                                    <label className="form-check-label" htmlFor={`zer-${pos.tempId}`}>Z</label>
                                                </div>
                                                <div className="form-check">
                                                    <input type="checkbox" className="form-check-input" id={`vak-${pos.tempId}`}
                                                        checked={pos.vakuum}
                                                        onChange={e => updatePos(pos.tempId, { vakuum: e.target.checked })} />
                                                    <label className="form-check-label" htmlFor={`vak-${pos.tempId}`}>V</label>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Bemerkung */}
                                        <td>
                                            <input type="text" className="form-control form-control-sm"
                                                value={pos.bemerkung}
                                                onChange={e => updatePos(pos.tempId, { bemerkung: e.target.value })}
                                                placeholder="..." />
                                        </td>
                                        {/* Aktionen */}
                                        <td className="text-center">
                                            <div className="d-flex gap-1 justify-content-center">
                                                <button className="btn btn-sm btn-outline-secondary py-0 px-1" onClick={() => movePos(ri, -1)} disabled={ri === 0} title="Hoch">↑</button>
                                                <button className="btn btn-sm btn-outline-secondary py-0 px-1" onClick={() => movePos(ri, 1)} disabled={ri === positionen.length - 1} title="Runter">↓</button>
                                                <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => deletePos(pos.tempId)}>×</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SchnellAuftragWriter;
