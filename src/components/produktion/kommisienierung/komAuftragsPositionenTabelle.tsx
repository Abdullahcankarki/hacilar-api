import React, { useEffect, useState } from 'react';
import { useAuth } from '@/providers/Authcontext';
import { Button, Form, Table, Alert, Modal } from 'react-bootstrap';
import { ArtikelPositionResource, ArtikelResource } from '@/Resources';
import { api } from '@/backend/api';

type Props = {
    positions: ArtikelPositionResource[];
    alleArtikel: ArtikelResource[];
    onChange: (positions: ArtikelPositionResource[]) => void;
    onSave: () => void;
    saving: boolean;
    auftragId: string;
};

const parseNumberInput = (value: string): number => parseFloat(value.replace(',', '.'));

// Holt das Karton-Gewicht aus dem Artikel (passe Feldnamen an deinen ArtikelResource an)
const getKartonGewicht = (artikel?: Partial<ArtikelResource>) => {
    return (artikel as any)?.kartonGewicht
        ?? (artikel as any)?.kartongewicht
        ?? (artikel as any)?.gewichtProKarton
        ?? (artikel as any)?.gewicht_karton
        ?? null;
};

// Rechnet Nettogewicht im KARTON-Modus:
// basis = anzahl * kgProKarton
// für Irregularitäten (mehrere Gruppen möglich): (basis - irregularCount*kgProKarton + sum(irregularCount_i * irregularGew_i))
const computeNettoForKarton = (anzahl: number, kgProKarton: number, irregulars: Array<{ anzahl: number, gewicht: number }>) => {
    const basis = anzahl * kgProKarton;
    if (!irregulars?.length) return basis;
    const totalIrreg = irregulars.reduce((acc, cur) => acc + (cur.anzahl || 0), 0);
    const sumIrregGewicht = irregulars.reduce((acc, cur) => acc + (cur.anzahl || 0) * (cur.gewicht || 0), 0);
    return basis - (totalIrreg * kgProKarton) + sumIrregGewicht;
};


const KomAuftragPositionenTabelle: React.FC<Props> = ({
    positions,
    alleArtikel,
    onChange,
    onSave,
    saving,
    auftragId,
}) => {
    const [error, setError] = useState<string | null>(null);
    // Auth
    const { user } = useAuth();
    const isAdmin = user?.role?.includes('admin');
    const isKontrolleur = user?.role?.includes('kontrolle');
    // Modal state
    const [modalOpenIndex, setModalOpenIndex] = useState<number | null>(null);
    const [modalFields, setModalFields] = useState<any>({});
    // Edit mode state for modal
    const [isEditMode, setIsEditMode] = useState(false);

    // Helper for Modal Pflichtfeld-Check
    const modalPflichtfelderGefuellt = () => {
        if (modalOpenIndex === null) return false;
        const modus = positions[modalOpenIndex]?.erfassungsModus;
        if (modus === 'STÜCK') {
            return modalFields.kommissioniertMenge !== '' && modalFields.kommissioniertMenge !== undefined && modalFields.kommissioniertMenge !== null;
        }
        if (modus === 'KARTON') {
            return modalFields.kartonAnzahl !== '' && modalFields.kartonAnzahl !== undefined && modalFields.kartonAnzahl !== null;
        }
        // Gewichtsmodus
        return modalFields.bruttogewicht !== '' && modalFields.bruttogewicht !== undefined && modalFields.bruttogewicht !== null;
    };


    // Admin darf Modal immer schließen
    const darfModalSchliessen = isAdmin || modalPflichtfelderGefuellt();

    // Modal öffnen, Werte initialisieren
    const openKommissionierenModal = (index: number) => {
        const pos = positions[index];
        setModalOpenIndex(index);
        setModalFields({
            artikelName: pos.artikelName,
            menge: pos.menge,
            einheit: pos.einheit,
            kommisioniertMenge: pos.kommissioniertMenge,
            kommisioniertEinheit: pos.kommissioniertEinheit,
            kommissioniertBemerkung: pos.kommissioniertBemerkung || '',
            bruttogewicht: pos.bruttogewicht || '',
            // NEU:
            kartonAnzahl: (pos.kommissioniertEinheit === 'karton' ? pos.kommissioniertMenge : '') ?? '',
            kartonIrregulars: [], // [{ anzahl: number, gewicht: number }]
            //
            leergut: pos.leergut?.length ? pos.leergut.map((l: any) => ({ ...l })) : [],
            chargennummern: pos.chargennummern?.length ? [...pos.chargennummern] : [],
            kommissioniertAm: pos.kommissioniertAm,
        });

        // Nur editierbar, wenn noch nicht kommissioniert
        setIsEditMode(!pos.kommissioniertAm);
    };

    // Modal schließen
    const closeKommissionierenModal = () => {
        setModalOpenIndex(null);
        setModalFields({});
        setIsEditMode(false);
    };

    // Modal-Feld ändern
    const handleModalFieldChange = (field: string, value: any) => {
        setModalFields((prev: any) => ({
            ...prev,
            [field]: value,
        }));
    };

    // Automatisches Setzen des Leergut-Gewichts bei Auswahl
    useEffect(() => {
        if (!modalFields.leergut) return;
        const updatedLeergut = modalFields.leergut.map((item: any) => {
            if (item.leergutArt === 'korb') return { ...item, leergutGewicht: 1.5 };
            if (item.leergutArt === 'e2') return { ...item, leergutGewicht: 2 };
            if (item.leergutArt === 'e1') return { ...item, leergutGewicht: 1.50 };
            if (item.leergutArt === 'h1') return { ...item, leergutGewicht: 18 };
            if (item.leergutArt === 'e6') return { ...item, leergutGewicht: 1.5 };
            if (item.leergutArt === 'big box') return { ...item, leergutGewicht: 34.5 };
            if (item.leergutArt === 'karton') return item; // manuell
            // additional cases
            if (item.leergutArt === 'euro palette') return item; // manuell
            if (item.leergutArt === 'einwegpalette') return item; // manuell
            if (item.leergutArt === 'haken') return { ...item, leergutGewicht: 1.3 };
            if (item.leergutArt === 'tüten') return { ...item, leergutGewicht: 0 };
            return item;
        });
        setModalFields((prev: any) => ({
            ...prev,
            leergut: updatedLeergut,
        }));
        // eslint-disable-next-line
    }, [modalFields.leergut?.map((l: any) => l.leergutArt).join(',')]);

    // Leergut hinzufügen/entfernen
    const addLeergut = () => {
        setModalFields((prev: any) => ({
            ...prev,
            leergut: [...(prev.leergut || []), { leergutArt: '', leergutAnzahl: '', leergutGewicht: '' }],
        }));
    };
    const removeLeergut = (idx: number) => {
        setModalFields((prev: any) => ({
            ...prev,
            leergut: (prev.leergut || []).filter((_: any, i: number) => i !== idx),
        }));
    };
    const handleLeergutChange = (idx: number, field: string, value: any) => {
        setModalFields((prev: any) => ({
            ...prev,
            leergut: prev.leergut.map((l: any, i: number) =>
                i === idx ? { ...l, [field]: value } : l
            ),
        }));
    };

    // Chargennummern hinzufügen/entfernen
    const addChargennummer = () => {
        setModalFields((prev: any) => ({
            ...prev,
            chargennummern: [...(prev.chargennummern || []), ''],
        }));
    };
    const removeChargennummer = (idx: number) => {
        setModalFields((prev: any) => ({
            ...prev,
            chargennummern: (prev.chargennummern || []).filter((_: any, i: number) => i !== idx),
        }));
    };
    const handleChargennummerChange = (idx: number, value: string) => {
        setModalFields((prev: any) => ({
            ...prev,
            chargennummern: prev.chargennummern.map((c: string, i: number) =>
                i === idx ? value : c
            ),
        }));
    };

    // Fertigstellen
    const fertigstellen = async () => {
        if (modalOpenIndex === null) return;
        const pos = positions[modalOpenIndex];
        const now = new Date();
        setError(null);

        try {
            const isStueckModus = positions[modalOpenIndex]?.erfassungsModus === 'STÜCK';
            const isKartonModus = positions[modalOpenIndex]?.erfassungsModus === 'KARTON';

            // Basis-Payload (für beide Modi)
            const payload: any = {
                kommissioniertBemerkung: modalFields.kommissioniertBemerkung,
                chargennummern: modalFields.chargennummern,
                kommissioniertAm: now,
            };

            if (isStueckModus) {
                const mengeVal = modalFields.kommissioniertMenge;
                if (mengeVal === '' || mengeVal === undefined || mengeVal === null) {
                    setError('Bitte die Stückanzahl eingeben.');
                    return;
                }
                payload.kommissioniertMenge = parseNumberInput(String(mengeVal));
                payload.kommissioniertEinheit = modalFields.kommissioniertEinheit || 'stück';
            } else if (isKartonModus) {
                const anzahlVal = modalFields.kartonAnzahl;
                if (anzahlVal === '' || anzahlVal === undefined || anzahlVal === null) {
                    setError('Bitte die Anzahl der Kartons eingeben.');
                    return;
                }
                const artikelObj = alleArtikel.find(a => a.id === pos.artikel);
                const kgProKartonRaw = getKartonGewicht(artikelObj);
                if (!kgProKartonRaw || isNaN(Number(kgProKartonRaw))) {
                    setError('Für diesen Artikel ist kein Kartongewicht hinterlegt.');
                    return;
                }
                const anzahl = parseNumberInput(String(anzahlVal));
                const kgProKarton = Number(kgProKartonRaw);

                const irregulars = (modalFields.kartonIrregulars || []).map((r: any) => ({
                    anzahl: (r.anzahl === '' || r.anzahl === undefined || r.anzahl === null) ? 0 : parseNumberInput(String(r.anzahl)),
                    gewicht: (r.gewicht === '' || r.gewicht === undefined || r.gewicht === null) ? 0 : parseNumberInput(String(r.gewicht)),
                }));

                const netto = computeNettoForKarton(anzahl, kgProKarton, irregulars);

                // Wir wollen NETTO speichern.
                // Da dein Backend das Nettogewicht aus Brutto/Leergut ableitet,
                // schicken wir bruttogewicht = netto und KEIN Leergut => Backend setzt nettogewicht = bruttogewicht.
                payload.kommissioniertMenge = anzahl;
                payload.kommissioniertEinheit = 'karton';
                payload.bruttogewicht = netto;   // <-- netto als bruttogewicht senden
                payload.leergut = [];            //    leergut leer lassen => nettogewicht = bruttogewicht im Backend
            } else {
                // Gewichts-Modus (wie gehabt)
                const bruttoVal = modalFields.bruttogewicht;
                if (bruttoVal === '' || bruttoVal === undefined || bruttoVal === null) {
                    setError('Bitte das Bruttogewicht eingeben.');
                    return;
                }
                // Leergut wird NICHT mehr hier ins Payload gepackt, sondern separat gespeichert!
                // const leergutTyped = (modalFields.leergut || []).map((l: any) => ({
                //     leergutArt: l.leergutArt,
                //     leergutAnzahl: l.leergutAnzahl === '' || l.leergutAnzahl === undefined || l.leergutAnzahl === null
                //         ? undefined
                //         : parseNumberInput(String(l.leergutAnzahl)),
                //     leergutGewicht: l.leergutGewicht === '' || l.leergutGewicht === undefined || l.leergutGewicht === null
                //         ? undefined
                //         : parseNumberInput(String(l.leergutGewicht)),
                // }));
                payload.bruttogewicht = parseNumberInput(String(bruttoVal));
                // payload.leergut = leergutTyped; // <--- ENTFERNT!
            }


            // API-Update
            await api.updateArtikelPositionKommissionierung(pos.id, payload);

            // --- Leergut separat über neue API speichern ---
            if (
                Array.isArray(modalFields.leergut) &&
                (isAdmin || isKontrolleur)
            ) {
                const leergutPayload = modalFields.leergut
                    .filter((l: any) => l.leergutArt)
                    .map((l: any) => ({
                        leergutArt: l.leergutArt,
                        leergutAnzahl:
                            l.leergutAnzahl === '' || l.leergutAnzahl === undefined || l.leergutAnzahl === null
                                ? 0
                                : parseNumberInput(String(l.leergutAnzahl)),
                        leergutGewicht:
                            l.leergutGewicht === '' || l.leergutGewicht === undefined || l.leergutGewicht === null
                                ? 0
                                : parseNumberInput(String(l.leergutGewicht)),
                    }));

                await api.updateArtikelPositionLeergut(pos.id, leergutPayload);
            }

            // Soft update local state
            const updated = [...positions];
            updated[modalOpenIndex] = {
                ...pos,
                kommissioniertBemerkung: payload.kommissioniertBemerkung,
                chargennummern: payload.chargennummern,
                kommissioniertAm: now,
                ...(payload.hasOwnProperty('kommissioniertMenge') ? {
                    kommissioniertMenge: payload.kommissioniertMenge,
                    kommissioniertEinheit: payload.kommissioniertEinheit,
                } : {}),
                ...(payload.hasOwnProperty('bruttogewicht') ? {
                    bruttogewicht: payload.bruttogewicht,
                    nettogewicht: payload.bruttogewicht, // UI-Optimismus
                    leergut: modalFields.leergut,
                } : {}),
            } as any;


            onChange(updated);
            closeKommissionierenModal();
        } catch (err: any) {
            setError('Beim Speichern ist ein Problem aufgetreten. Bitte überprüfe deine Eingaben und versuche es erneut.');
        }
    };

    return (
        <div>
            <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-4">
                <h2 className="h4 mb-0">Artikel</h2>
            </div>

            {/* Fehleranzeige */}
            {error && (
                <Alert className="print-hidden shadow-sm border" variant="danger" onClose={() => setError(null)} dismissible>
                    {error}
                </Alert>
            )}

            <div className="card shadow-sm mb-4">
                <div className="card-body p-3">
                    <Table bordered hover responsive className="table-sm align-middle text-nowrap">
                        <thead>
                            <tr>
                                <th className="d-none d-md-table-cell">Bemerkung</th>
                                <th>Artikel</th>
                                <th>Menge</th>
                                {(isKontrolleur || isAdmin) && <th>Kommissioniertes Gewicht (netto)</th>}
                                {(isKontrolleur || isAdmin) && <th>Leergut</th>}
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions
                                .map((pos, index) => {
                                const artikelObj = alleArtikel.find(a => a.id === pos.artikel);
                                const isKommissioniert = !!pos.kommissioniertAm;
                                return (
                                    <tr
                                        key={index}
                                        className={isKommissioniert ? "table-secondary" : ""}
                                    >
                                        {/* Bemerkung */}
                                        <td className="d-none d-md-table-cell">
                                            {pos.bemerkung ? (
                                                <span style={{ backgroundColor: '#dc3545', color: 'white', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', display: 'inline-block' }}>
                                                    {pos.bemerkung}
                                                </span>
                                            ) : (
                                                <span className="text-muted">–</span>
                                            )}
                                        </td>
                                        {/* Artikel */}
                                        <td>
                                            {artikelObj
                                                ? `${artikelObj.name} - ${artikelObj.artikelNummer}`
                                                : '-'}
                                        </td>
                                        {/* Menge */}
                                        <td>
                                            {pos.menge ?? '-'} {pos.einheit ?? "kg"}
                                        </td>
                                        {/* Kommissioniertes Gewicht (netto) */}
                                        {(isKontrolleur || isAdmin) && (
                                            <td>
                                                {pos.kommissioniertAm
                                                    ? (typeof pos.nettogewicht !== "undefined" && pos.nettogewicht !== null
                                                        ? pos.nettogewicht
                                                        : '—')
                                                    : 'noch nicht kommissioniert'}
                                            </td>
                                        )}
                                        {/* Leergut Spalte */}
                                        {(isKontrolleur || isAdmin) && (
                                            <td>
                                                {pos.leergut && pos.leergut.length > 0 ? (
                                                    pos.leergut
                                                        .filter(l => l.leergutArt && l.leergutAnzahl)
                                                        .map(l => `${l.leergutArt}: ${l.leergutAnzahl}`)
                                                        .join(', ')
                                                ) : (
                                                    <span className="text-muted">–</span>
                                                )}
                                            </td>
                                        )}
                                        {/* Kommissionieren-Button */}
                                        <td>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                disabled={isKommissioniert && !isAdmin && !isKontrolleur}
                                                style={{ minWidth: 130 }}
                                                onClick={() => openKommissionierenModal(index)}
                                                className="me-2"
                                                hidden={false}
                                            >
                                                {isKommissioniert ? (isAdmin || isKontrolleur ? 'Details' : 'Abgeschlossen') : 'Kommissionieren'}
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                    {/* Summierte Leergutarten-Tabelle */}
                    {(isKontrolleur || isAdmin) && (
                        <Table bordered size="sm" className="mt-4 w-auto">
                            <thead>
                                <tr>
                                    {Array.from(new Set(positions.flatMap(p => p.leergut || []).map(l => l.leergutArt)))
                                        .map((art, i) => (
                                            <th key={i} className="text-center">{art}</th>
                                        ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    {Array.from(new Set(positions.flatMap(p => p.leergut || []).map(l => l.leergutArt)))
                                        .map((art, i) => {
                                            const summe = positions
                                                .flatMap(p => p.leergut || [])
                                                .filter(l => l.leergutArt === art)
                                                .reduce((acc, l) => acc + (typeof l.leergutAnzahl === 'number' ? l.leergutAnzahl : 0), 0);
                                            return <td key={i} className="text-center fw-bold">{summe || '–'}</td>;
                                        })}
                                </tr>
                            </tbody>
                        </Table>
                    )}
                </div>
            </div>

            {/* Kommissionieren-Modal */}
            <Modal
                show={modalOpenIndex !== null}
                onHide={darfModalSchliessen ? closeKommissionierenModal : undefined}
                backdrop={darfModalSchliessen ? true : "static"}
                keyboard={darfModalSchliessen}
                centered
            >
                <Modal.Header closeButton={darfModalSchliessen}>
                    <Modal.Title>Kommissionieren</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="text-muted mt-2 mb-3">
                        Zu kommissionieren: <strong>{modalFields.artikelName}</strong> – <strong>{modalFields.menge} {modalFields.einheit}</strong>
                    </p>
                    <Form>
                        <Form.Group className="mb-2">
                            {positions[modalOpenIndex]?.erfassungsModus === 'STÜCK' ? (
                                <>
                                    <Form.Label>Stückanzahl</Form.Label>
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        value={modalFields.kommissioniertMenge ?? ''}
                                        onChange={e => {
                                            handleModalFieldChange('kommissioniertMenge', e.target.value);
                                            handleModalFieldChange('kommissioniertEinheit', 'stück');
                                        }}
                                        required
                                        disabled={!!modalFields.kommissioniertAm && (isAdmin || isKontrolleur) && !isEditMode}
                                    />
                                </>
                            ) : positions[modalOpenIndex]?.erfassungsModus === 'KARTON' ? (
                                <>
                                    <Form.Label>Anzahl Kartons <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        value={modalFields.kartonAnzahl ?? ''}
                                        onChange={e => {
                                            handleModalFieldChange('kartonAnzahl', e.target.value);
                                            handleModalFieldChange('kommissioniertEinheit', 'karton');
                                        }}
                                        required
                                        disabled={!!modalFields.kommissioniertAm && (isAdmin || isKontrolleur) && !isEditMode}
                                    />

                                    {/* Irregularitäten-Editor */}
                                    <div className="mt-3">
                                        <div className="d-flex align-items-center justify-content-between">
                                            <Form.Label className="mb-0">Irregularitäten (abweichende Kartons)</Form.Label>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    const arr = Array.isArray(modalFields.kartonIrregulars) ? modalFields.kartonIrregulars : [];
                                                    handleModalFieldChange('kartonIrregulars', [...arr, { anzahl: '', gewicht: '' }]);
                                                }}
                                                disabled={!!modalFields.kommissioniertAm && (isAdmin || isKontrolleur) && !isEditMode}
                                            >
                                                +
                                            </Button>
                                        </div>

                                        {(modalFields.kartonIrregulars || []).map((row: any, i: number) => (
                                            <div key={i} className="d-flex gap-2 mt-2">
                                                <Form.Control
                                                    placeholder="Anzahl"
                                                    type="number"
                                                    min="0"
                                                    value={row.anzahl ?? ''}
                                                    onChange={e => {
                                                        const arr = [...(modalFields.kartonIrregulars || [])];
                                                        arr[i] = { ...arr[i], anzahl: e.target.value };
                                                        handleModalFieldChange('kartonIrregulars', arr);
                                                    }}
                                                    size="sm"
                                                    disabled={!!modalFields.kommissioniertAm && (isAdmin || isKontrolleur) && !isEditMode}
                                                />
                                                <Form.Control
                                                    placeholder="Gewicht pro Karton (kg)"
                                                    type="number"
                                                    min="0"
                                                    value={row.gewicht ?? ''}
                                                    onChange={e => {
                                                        const arr = [...(modalFields.kartonIrregulars || [])];
                                                        arr[i] = { ...arr[i], gewicht: e.target.value };
                                                        handleModalFieldChange('kartonIrregulars', arr);
                                                    }}
                                                    size="sm"
                                                    disabled={!!modalFields.kommissioniertAm && (isAdmin || isKontrolleur) && !isEditMode}
                                                />
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => {
                                                        const arr = [...(modalFields.kartonIrregulars || [])];
                                                        arr.splice(i, 1);
                                                        handleModalFieldChange('kartonIrregulars', arr);
                                                    }}
                                                    disabled={!!modalFields.kommissioniertAm && (isAdmin || isKontrolleur) && !isEditMode}
                                                >
                                                    –
                                                </Button>
                                            </div>
                                        ))}

                                        {/* Vorschau Netto */}
                                        {(() => {
                                            const pos = positions[modalOpenIndex!];
                                            const art = alleArtikel.find(a => a.id === pos.artikel);
                                            const kgProKarton = Number(getKartonGewicht(art)) || 0;
                                            const anzahl = Number(String(modalFields.kartonAnzahl || '').replace(',', '.')) || 0;
                                            const irregulars = (modalFields.kartonIrregulars || [])
                                                .map((r: any) => ({
                                                    anzahl: Number(String(r.anzahl || '').replace(',', '.')) || 0,
                                                    gewicht: Number(String(r.gewicht || '').replace(',', '.')) || 0,
                                                }));
                                            const preview = kgProKarton ? computeNettoForKarton(anzahl, kgProKarton, irregulars) : null;
                                            return preview ? <small className="text-muted">≈ Netto: {preview} kg</small> : null;
                                        })()}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Form.Label>Bruttogewicht <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        value={modalFields.bruttogewicht ?? ''}
                                        onChange={e => handleModalFieldChange('bruttogewicht', e.target.value)}
                                        required
                                        disabled={!!modalFields.kommissioniertAm && (isAdmin || isKontrolleur) && !isEditMode}
                                    />
                                </>
                            )}
                        </Form.Group>

                        <Form.Group className="mb-2">
                            <Form.Label>Bemerkung</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={modalFields.kommissioniertBemerkung ?? ''}
                                onChange={e => handleModalFieldChange('kommissioniertBemerkung', e.target.value)}
                                disabled={
                                    !!modalFields.kommissioniertAm &&
                                    (isAdmin || isKontrolleur) &&
                                    !isEditMode
                                }
                            />
                        </Form.Group>
                        {/* Leergut */}
                        <Form.Group className="mb-2">
                            <Form.Label>Leergut <span className="text-danger">*</span></Form.Label>
                            <Table bordered size="sm" className="mb-2">
                                <thead>
                                    <tr>
                                        <th>Art</th>
                                        <th>Anzahl</th>
                                        <th>Gewicht</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(modalFields.leergut || []).map((l: any, i: number) => (
                                        <tr key={i}>
                                            <td>
                                                <Form.Select
                                                    value={l.leergutArt}
                                                    onChange={e => handleLeergutChange(i, 'leergutArt', e.target.value)}
                                                    size="sm"
                                                    disabled={
                                                        !!modalFields.kommissioniertAm &&
                                                        (isAdmin || isKontrolleur) &&
                                                        !isEditMode
                                                    }
                                                >
                                                    <option value="">Bitte wählen...</option>
                                                    <option value="e2">E2</option>
                                                    <option value="e1">E1</option>
                                                    <option value="h1">H1</option>
                                                    <option value="karton">Karton</option>
                                                    <option value="e6">E6</option>
                                                    <option value="big box">Big Box</option>
                                                    <option value="korb">Korb</option>
                                                    <option value="euro palette">Europalette</option>
                                                    <option value="einwegpalette">Einwegpalette</option>
                                                    <option value="haken">Haken</option>
                                                    <option value="tüten">Tüte(n)</option>
                                                </Form.Select>
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="number"
                                                    value={l.leergutAnzahl}
                                                    onChange={e => handleLeergutChange(i, 'leergutAnzahl', e.target.value)}
                                                    size="sm"
                                                    disabled={
                                                        !!modalFields.kommissioniertAm &&
                                                        (isAdmin || isKontrolleur) &&
                                                        !isEditMode
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="number"
                                                    value={l.leergutGewicht}
                                                    onChange={e => handleLeergutChange(i, 'leergutGewicht', e.target.value)}
                                                    size="sm"
                                                    disabled={
                                                        !(l.leergutArt === 'karton' || l.leergutArt === 'einwegpalette' || l.leergutArt === 'euro palette') ||
                                                        (!!modalFields.kommissioniertAm &&
                                                            (isAdmin || isKontrolleur) &&
                                                            !isEditMode)
                                                    }
                                                />
                                                {(l.leergutArt === 'karton' || l.leergutArt === 'einwegpalette' || l.leergutArt === 'euro palette') && !l.leergutGewicht && (
                                                    <small className="text-danger">Bitte wiege das Objekt ab und trage das Gewicht ein.</small>
                                                )}
                                            </td>
                                            <td>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => removeLeergut(i)}
                                                    tabIndex={-1}
                                                    disabled={
                                                        !!modalFields.kommissioniertAm &&
                                                        (isAdmin || isKontrolleur) &&
                                                        !isEditMode
                                                    }
                                                >–</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={addLeergut}
                                disabled={
                                    !!modalFields.kommissioniertAm &&
                                    (isAdmin || isKontrolleur) &&
                                    !isEditMode
                                }
                            >
                                +
                            </Button>
                        </Form.Group>
                        {/* Chargennummern */}
                        <Form.Group className="mb-2">
                            <Form.Label>Chargennummern</Form.Label>
                            {(modalFields.chargennummern || []).map((c: string, i: number) => (
                                <div key={i} className="d-flex mb-1">
                                    <Form.Control
                                        value={c}
                                        onChange={e => handleChargennummerChange(i, e.target.value)}
                                        size="sm"
                                        disabled={
                                            !!modalFields.kommissioniertAm &&
                                            (isAdmin || isKontrolleur) &&
                                            !isEditMode
                                        }
                                    />
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        className="ms-1"
                                        onClick={() => removeChargennummer(i)}
                                        tabIndex={-1}
                                        disabled={
                                            !!modalFields.kommissioniertAm &&
                                            (isAdmin || isKontrolleur) &&
                                            !isEditMode
                                        }
                                    >–</Button>
                                </div>
                            ))}
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={addChargennummer}
                                disabled={
                                    !!modalFields.kommissioniertAm &&
                                    (isAdmin || isKontrolleur) &&
                                    !isEditMode
                                }
                            >
                                +
                            </Button>
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={closeKommissionierenModal}
                        disabled={!darfModalSchliessen}
                    >
                        Abbrechen
                    </Button>
                    {(isAdmin || isKontrolleur) && modalFields.kommissioniertAm && !isEditMode ? (
                        <Button
                            variant="primary"
                            onClick={() => setIsEditMode(true)}
                        >
                            Bearbeiten
                        </Button>
                    ) : (
                        <Button
                            variant="success"
                            onClick={fertigstellen}
                            disabled={(!isAdmin && !isKontrolleur) && !modalPflichtfelderGefuellt()}
                        >
                            Fertigstellen
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default KomAuftragPositionenTabelle;

