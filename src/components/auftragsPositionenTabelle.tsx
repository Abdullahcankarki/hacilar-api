import React from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { ArtikelPositionResource, ArtikelResource } from '../Resources';
import { api } from '../backend/api';

type Props = {
    positions: ArtikelPositionResource[];
    alleArtikel: ArtikelResource[];
    onChange: (positions: ArtikelPositionResource[]) => void;
    onSave: () => void;
    saving: boolean;
    kundeId: string;
};

const parseNumberInput = (value: string): number =>
    parseFloat(value.replace(',', '.'));

const AuftragPositionenTabelle: React.FC<Props> = ({
    positions,
    alleArtikel,
    onChange,
    onSave,
    saving,
    kundeId,
}) => {
    const handleChange = (
        index: number,
        field: keyof ArtikelPositionResource,
        value: any
    ) => {
        const newPositions = [...positions];
        (newPositions[index] as any)[field] = value;

        const menge = newPositions[index].menge || 0;
        const einheit = field === 'einheit' ? value : newPositions[index].einheit;
        const artikelId = newPositions[index].artikel;
        const artikel = alleArtikel.find((a) => a.id === artikelId);

        // Gewicht berechnen, wenn Einheit oder Menge geändert wurde
        if ((field === 'menge' || field === 'einheit') && artikel) {
            let gewicht = 0;

            switch (einheit) {
                case 'kg':
                    gewicht = menge;
                    break;
                case 'stück':
                    gewicht = (artikel.gewichtProStueck || 0) * menge;
                    break;
                case 'kiste':
                    gewicht = (artikel.gewichtProKiste || 0) * menge;
                    break;
                case 'karton':
                    gewicht = (artikel.gewichtProKarton || 0) * menge;
                    break;
            }

            newPositions[index].gesamtgewicht = gewicht;
            newPositions[index].gesamtpreis =
                newPositions[index].einzelpreis || 0 * menge;
        }

        onChange(newPositions);
    };

    const handleAdd = () => {
        onChange([
            ...positions,
            {
                menge: 1,
                einheit: 'stück'
            },
        ]);
    };

    const handleDelete = async (index: number) => {
        const pos = positions[index];
        if (pos.id) {
            try {
                await api.deleteArtikelPosition(pos.id);
            } catch (err: any) {
                alert('Fehler beim Löschen: ' + err.message);
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
            alert('Fehler beim Speichern der Artikelposition: ' + err.message);
        }
    };

    return (
        <div>
            <h4>Artikelpositionen</h4>
            <Button variant="outline-success" className="mb-3" onClick={handleAdd}>
                + Neue Position hinzufügen
            </Button>

            <Table bordered hover responsive>
                <thead>
                    <tr>
                        <th>Bemerkung</th>
                        <th>Menge</th>
                        <th>Einheit</th>
                        <th>Artikel</th>
                        <th>Einzelpreis (€)</th>
                        <th>Gewicht</th>
                        <th>Gesamtpreis</th>
                        <th>Aktionen</th>
                    </tr>
                </thead>
                <tbody>
                    {positions.map((pos, index) => (
                        <tr key={index}>
                            <td>
                                <Form.Control
                                    type="text"
                                    value={pos.bemerkung || ''}
                                    onChange={(e) =>
                                        handleChange(index, 'bemerkung', e.target.value)
                                    }
                                />
                            </td>

                            <td>
                                <Form.Control
                                    type="number"
                                    min="1"
                                    value={pos.menge}
                                    onChange={(e) =>
                                        handleChange(index, 'menge', parseInt(e.target.value))
                                    }
                                />
                            </td>

                            <td>
                                <Form.Select
                                    value={pos.einheit}
                                    onChange={(e) =>
                                        handleChange(index, 'einheit', e.target.value)
                                    }
                                >
                                    <option value="kg">kg</option>
                                    <option value="stück">stück</option>
                                    <option value="kiste">kiste</option>
                                    <option value="karton">karton</option>
                                </Form.Select>
                            </td>

                            <td>
                                <Form.Select
                                    value={pos.artikel}
                                    onChange={(e) => {
                                        const einheit = pos.einheit ?? 'kg';
                                        handleArtikelChange(
                                            index,
                                            e.target.value, // ← das ist die Artikel-ID
                                            pos.menge!,
                                            einheit,
                                            pos.bemerkung,
                                            pos.zerlegung,
                                            pos.vakuum
                                        );
                                    }}
                                >
                                    <option value="">Bitte wählen</option>
                                    {alleArtikel.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </td>

                            <td>{(pos.einzelpreis ?? 0).toFixed(2)} €</td>
                            <td>{(pos.gesamtgewicht ?? 0).toFixed(2)} kg</td>
                            <td>{(pos.gesamtpreis ?? 0).toFixed(2)} €</td>

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
                    Positionen speichern
                </Button>
            )}
        </div>
    );
};

export default AuftragPositionenTabelle;