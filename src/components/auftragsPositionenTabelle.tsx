import React, { useState } from 'react';
import { Button, Form, Table, Alert, Spinner } from 'react-bootstrap';
import { ArtikelPositionResource, ArtikelResource } from '../Resources';
import { api } from '../backend/api';
import Select from 'react-select';
import { FaPen } from 'react-icons/fa';

type Props = {
    positions: ArtikelPositionResource[];
    alleArtikel: ArtikelResource[];
    onChange: (positions: ArtikelPositionResource[]) => void;
    onSave: () => void;
    saving: boolean;
    auftragId: string;
};

const parseNumberInput = (value: string): number => parseFloat(value.replace(',', '.'));

const AuftragPositionenTabelle: React.FC<Props> = ({
    positions,
    alleArtikel,
    onChange,
    onSave,
    saving,
    auftragId,
}) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingField, setEditingField] = useState<keyof ArtikelPositionResource | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startEdit = (index: number, field: keyof ArtikelPositionResource) => {
        setEditingIndex(index);
        setEditingField(field);
    };

    const stopEdit = () => {
        setEditingIndex(null);
        setEditingField(null);
    };
    const handleChange = (index: number, field: keyof ArtikelPositionResource, value: any) => {
        const newPositions = [...positions];
        (newPositions[index] as any)[field] = value;
    
        const pos = newPositions[index];
    
        // Artikel suchen
        const artikel = alleArtikel.find(a => a.id === pos.artikel);
    
        // Menge setzen
        const menge = pos.menge || 0;
        const einzelpreis = pos.einzelpreis ?? 0;
    
        // Standard: Gewicht
        let gewicht = 0;
    
        if (artikel) {
            switch (pos.einheit) {
                case 'kg':
                    gewicht = menge;
                    break;
                case 'stück':
                    gewicht = (artikel.gewichtProStueck ?? 0) * menge;
                    break;
                case 'kiste':
                    gewicht = (artikel.gewichtProKiste ?? 0) * menge;
                    break;
                case 'karton':
                    gewicht = (artikel.gewichtProKarton ?? 0) * menge;
                    break;
                default:
                    gewicht = 0;
            }
        }
    
        pos.gesamtgewicht = gewicht;
        pos.gesamtpreis = einzelpreis * gewicht; // Jetzt gewichtsbasiert!
    
        onChange(newPositions);
    };

    const handleAdd = () => {
        onChange([
            ...positions,
            {
                menge: 1,
                einheit: 'stück',
                artikel: '',
                einzelpreis: 0,
                gesamtpreis: 0,
                gesamtgewicht: 0,
            },
        ]);
    };

    const handleDelete = async (index: number) => {
        const pos = positions[index];
        if (pos.id) {
            try {
                await api.deleteArtikelPosition(pos.id);
            } catch (err: any) {
                setError('Fehler beim Löschen: ' + (err.message || 'Unbekannter Fehler'));
                return;
            }
        }
        const updated = positions.filter((_, i) => i !== index);
        onChange(updated);
    };

    const handleArtikelChange = async (
        index: number,
        artikelId: string,
        menge: number,
        einheit: 'kg' | 'stück' | 'kiste' | 'karton',
        bemerkung?: string,
        zerlegung?: boolean,
        vakuum?: boolean
    ) => {
        const artikel = alleArtikel.find((a) => a.id === artikelId);
        if (!artikel) return;

        try {
            const neuePosition = await api.createArtikelPosition({
                artikel: artikelId,
                menge,
                einheit,
                bemerkung,
                zerlegung,
                vakuum,
                auftragId: auftragId,  // (musst du aus Props übergeben!)
            });

            const updated = [...positions];
            updated[index] = {
                id: neuePosition.id,
                artikel: neuePosition.artikel,
                artikelName: neuePosition.artikelName,
                menge: neuePosition.menge,
                einheit: neuePosition.einheit,
                einzelpreis: neuePosition.einzelpreis,
                gesamtgewicht: neuePosition.gesamtgewicht,
                gesamtpreis: neuePosition.gesamtpreis,
                bemerkung: neuePosition.bemerkung,
                zerlegung: neuePosition.zerlegung,
                vakuum: neuePosition.vakuum,
            };

            onChange(updated);
        } catch (err: any) {
            setError('Fehler beim Speichern der Artikelposition: ' + (err.message || 'Unbekannter Fehler'));
        }
    };

    return (
        <div>
            <h4>Artikelpositionen</h4>

            {/* Fehleranzeige */}
            {error && (
                <Alert variant="danger" onClose={() => setError(null)} dismissible>
                    {error}
                </Alert>
            )}

            <Button variant="outline-success" className="mb-3" onClick={handleAdd}>
                + Neue Position hinzufügen
            </Button>

            <Table bordered hover responsive>
                <thead>
                    <tr>
                        <th>Bemerkung</th>
                        <th>Menge</th>
                        <th>Einheit</th>
                        <th>Artikel + Nummer</th>
                        <th>Einzelpreis (€)</th>
                        <th>Gewicht (kg)</th>
                        <th>Gesamtpreis (€)</th>
                        <th>Aktionen</th>
                    </tr>
                </thead>
                <tbody>
                    {positions.map((pos, index) => (
                        <tr key={index}>
                            {/* Bemerkung */}
                            <td onClick={() => startEdit(index, 'bemerkung')}>
                                {editingIndex === index && editingField === 'bemerkung' ? (
                                    <Form.Control
                                        value={pos.bemerkung || ''}
                                        autoFocus
                                        onBlur={stopEdit}
                                        onKeyDown={(e) => e.key === 'Enter' && stopEdit()}
                                        onChange={(e) => handleChange(index, 'bemerkung', e.target.value)}
                                    />
                                ) : (
                                    <>
                                        <div className="editable-cell">
                                            {pos.bemerkung || '-'}
                                            <FaPen className="edit-icon" />
                                        </div>
                                    </>
                                )}
                            </td>

                            {/* Menge */}
                            <td onClick={() => startEdit(index, 'menge')}>
                                {editingIndex === index && editingField === 'menge' ? (
                                    <Form.Control
                                        type="number"
                                        min="1"
                                        value={pos.menge}
                                        autoFocus
                                        onBlur={stopEdit}
                                        onKeyDown={(e) => e.key === 'Enter' && stopEdit()}
                                        onChange={(e) => handleChange(index, 'menge', parseNumberInput(e.target.value))}
                                    />
                                ) : (
                                    <>
                                        <div className="editable-cell">
                                            {pos.menge || '-'}
                                            <FaPen className="edit-icon" />
                                        </div>
                                    </>
                                )}
                            </td>

                            {/* Einheit */}
                            <td onClick={() => startEdit(index, 'einheit')}>
                                {editingIndex === index && editingField === 'einheit' ? (
                                    <Form.Select
                                        value={pos.einheit}
                                        onChange={(e) => {
                                            handleChange(index, 'einheit', e.target.value);
                                            stopEdit();
                                        }}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && stopEdit()}
                                    >
                                        <option value="kg">kg</option>
                                        <option value="stück">stück</option>
                                        <option value="kiste">kiste</option>
                                        <option value="karton">karton</option>
                                    </Form.Select>
                                ) : (
                                    <div className="editable-cell">
                                        {pos.einheit}
                                        <FaPen className="edit-icon" />
                                    </div>
                                )}
                            </td>

                            {/* Artikel + Nummer */}
                            <td onClick={() => startEdit(index, 'artikel')}>
                                {editingIndex === index && editingField === 'artikel' ? (
                                    <Select
                                        value={alleArtikel.find(a => a.id === pos.artikel) ? {
                                            value: pos.artikel!,
                                            label: `${alleArtikel.find(a => a.id === pos.artikel)?.name} (${alleArtikel.find(a => a.id === pos.artikel)?.artikelNummer})`
                                        } : null}
                                        onChange={(option) => {
                                            if (!option || typeof option.value !== 'string') return;
                                            handleArtikelChange(
                                                index,
                                                option.value,
                                                pos.menge!,
                                                pos.einheit!,
                                                pos.bemerkung,
                                                pos.zerlegung,
                                                pos.vakuum
                                            );
                                            stopEdit();
                                        }}
                                        options={alleArtikel.map(a => ({
                                            value: a.id!,
                                            label: `${a.name} - ${a.artikelNummer}`
                                        }))}
                                        placeholder="Artikel suchen..."
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={{
                                            container: (base) => ({ ...base, minWidth: '280px' }),
                                            menu: (base) => ({ ...base, zIndex: 9999, maxHeight: '300px', overflowY: 'auto' })
                                        }}
                                    />
                                ) : (
                                    <div className="editable-cell">
                                        {alleArtikel.find(a => a.id === pos.artikel)
                                            ? `${alleArtikel.find(a => a.id === pos.artikel)?.name} - ${alleArtikel.find(a => a.id === pos.artikel)?.artikelNummer}`
                                            : '-'}
                                        <FaPen className="edit-icon" />
                                    </div>
                                )}
                            </td>

                            {/* Einzelpreis */}
                            <td>{(pos.einzelpreis ?? 0).toFixed(2)} €</td>

                            {/* Gewicht */}
                            <td>{(pos.gesamtgewicht ?? 0).toFixed(2)} kg</td>

                            {/* Gesamtpreis */}
                            <td>{(pos.gesamtpreis ?? 0).toFixed(2)} €</td>

                            {/* Aktionen */}
                            <td>
                                <Button variant="danger" size="sm" onClick={() => handleDelete(index)}>
                                    Löschen
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            {positions.length > 0 && (
                <Button variant="primary" onClick={onSave} disabled={saving}>
                    {saving ? (
                        <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Speichern...
                        </>
                    ) : (
                        'Positionen speichern'
                    )}
                </Button>
            )}
        </div>
    );
};

export default AuftragPositionenTabelle;