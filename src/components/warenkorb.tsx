import React, { useEffect, useMemo, useState } from 'react';
import { Offcanvas, Button, Form, Row, Col, Modal } from 'react-bootstrap';
import { ArtikelPositionResource, ArtikelResource, RegionRuleResource } from '../Resources';
import 'flatpickr/dist/flatpickr.min.css';
import flatpickr from 'flatpickr';
import { German } from 'flatpickr/dist/l10n/de.js';
import { getAllRegionRules } from '../backend/api';
import { DateTime } from 'luxon';


const ZONE = 'Europe/Berlin';

// Interpret a JS Date (from flatpickr) as a calendar day without shifting across zones
function toDateOnlyInZone(jsDate: Date, zone: string): DateTime {
  const local = DateTime.fromJSDate(jsDate); // uses browser zone
  return DateTime.fromObject(
    { year: local.year, month: local.month, day: local.day },
    { zone }
  ).startOf('day');
}

function weekdayLuxon(dt: DateTime): number {
    // Luxon: Monday=1 ... Sunday=7
    return dt.setZone(ZONE).weekday;
}

function isExceptionDate(dt: DateTime, rule: RegionRuleResource): boolean {
    if (!rule.exceptionDates?.length) return false;
    const ymd = dt.setZone(ZONE).toFormat('yyyy-LL-dd');
    return rule.exceptionDates.includes(ymd);
}

function isPastCutoffForToday(candidate: DateTime, rule: RegionRuleResource, now: DateTime): boolean {
    if (!rule.orderCutoff) return false;
    // Cutoff nur für HEUTE
    if (candidate.setZone(ZONE).toISODate() !== now.setZone(ZONE).toISODate()) return false;
    const [hh, mm] = rule.orderCutoff.split(':').map(Number);
    const cutoff = now.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
    return now > cutoff;
}

type AllowResult = { ok: true } | { ok: false; reason: 'inactive' | 'weekday' | 'exception' | 'cutoff' | 'past' };

function isDateAllowed(date: Date, rule: RegionRuleResource, now: DateTime = DateTime.now().setZone(ZONE)): AllowResult {
    const dt = toDateOnlyInZone(date, ZONE);
    if (!rule.isActive) return { ok: false, reason: 'inactive' };
    if (dt < now.startOf('day')) return { ok: false, reason: 'past' };
    const wd = weekdayLuxon(dt);
    if (!rule.allowedWeekdays.includes(wd)) return { ok: false, reason: 'weekday' };
    if (isExceptionDate(dt, rule)) return { ok: false, reason: 'exception' };
    if (isPastCutoffForToday(dt, rule, now)) return { ok: false, reason: 'cutoff' };
    return { ok: true };
}

function nextAllowedDate(startFrom: Date, rule: RegionRuleResource, maxLookaheadDays = 90): Date | null {
    let cursor = DateTime.fromJSDate(startFrom).setZone(ZONE).startOf('day');
    const now = DateTime.now().setZone(ZONE);
    for (let i = 0; i < maxLookaheadDays; i++) {
        const res = isDateAllowed(cursor.toJSDate(), rule, now);
        if (res.ok) return cursor.toJSDate();
        cursor = cursor.plus({ days: 1 });
    }
    return null;
}

type Props = {
    show: boolean;
    onHide: () => void;
    cart: ArtikelPositionResource[];
    articles: ArtikelResource[]; // 🆕 Neue Prop
    kundeRegion: string | null;
    onQuantityChange: (index: number, qty: number) => void;
    onEinheitChange: (index: number, einheit: ArtikelPositionResource['einheit']) => void;
    onRemove: (index: number) => void;
    onSubmit: (lieferdatum: string, bemerkung: string) => void;
};

const WarenkorbPanel: React.FC<Props> = ({
    show,
    onHide,
    cart,
    articles,
    kundeRegion,
    onQuantityChange,
    onEinheitChange,
    onRemove,
    onSubmit
}) => {
    const [lieferdatum, setLieferdatum] = useState('');
    const [showDateModal, setShowDateModal] = useState(false);
    const [showFehlerAlert, setShowFehlerAlert] = useState(false);
    const [bemerkung, setBemerkung] = useState('');
    const [fetchedRule, setFetchedRule] = useState<RegionRuleResource | null>(null);
    const [ruleLoading, setRuleLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function loadRule() {
            if (!kundeRegion) { setFetchedRule(null); return; }
            setRuleLoading(true);
            try {
                const res = await getAllRegionRules({
                    region: kundeRegion,
                    active: true,
                    limit: 1,
                    page: 1,
                    sortBy: 'updatedAt:desc'
                });
                const rule = res.items && res.items.length ? res.items[0] : null;
                if (!cancelled) setFetchedRule(rule);
            } catch {
                if (!cancelled) setFetchedRule(null);
            } finally {
                if (!cancelled) setRuleLoading(false);
            }
        }
        loadRule();
        return () => { cancelled = true; };
    }, [kundeRegion]);

    // Regel anhand Region auswählen (Fallback: Mo–Sa, aktiv)
    // Regel: Bevorzugt API-Regel, sonst Fallback (Mo–Sa, aktiv)
    const rule = useMemo<RegionRuleResource>(() => {
        if (fetchedRule) return fetchedRule;
        const region = kundeRegion ?? 'UNBEKANNT';
        return {
            region,
            allowedWeekdays: [1, 2, 3, 4, 5, 6],
            orderCutoff: undefined,
            exceptionDates: [],
            isActive: true,
        } as RegionRuleResource;
    }, [fetchedRule, kundeRegion]);

    const nextAvail = useMemo(() => nextAllowedDate(new Date(), rule), [rule]);

    const berechneGesamtgewicht = (
        item: ArtikelPositionResource,
        artikel: ArtikelResource | undefined
    ): number => {
        if (!item.menge || !item.einheit || !artikel) return 0;
        switch (item.einheit) {
            case 'kg':
                return item.menge;
            case 'stück':
                return artikel.gewichtProStueck ? artikel.gewichtProStueck * item.menge : 0;
            case 'kiste':
                return artikel.gewichtProKiste ? artikel.gewichtProKiste * item.menge : 0;
            case 'karton':
                return artikel.gewichtProKarton ? artikel.gewichtProKarton * item.menge : 0;
            default:
                return 0;
        }
    };

    const berechneGesamtpreis = (
        item: ArtikelPositionResource,
        artikel: ArtikelResource | undefined
    ): number => {
        const gewicht = berechneGesamtgewicht(item, artikel);
        return gewicht * (item.einzelpreis ?? 0);
    };

    const gesamtpreis = cart.reduce((sum, item) => {
        const artikel = articles.find(a => a.id === item.artikel);
        return sum + berechneGesamtpreis(item, artikel);
    }, 0);

    const handleBestellungStart = () => {
        setShowDateModal(true);
    };

    const handleBestellungAbsenden = () => {
        if (!lieferdatum) {
            setShowFehlerAlert(true);
            setTimeout(() => setShowFehlerAlert(false), 3000);
            return;
        }
        if (ruleLoading) {
            setShowFehlerAlert(true);
            setTimeout(() => setShowFehlerAlert(false), 3000);
            return;
        }
        // Regel-Validierung
        const parsed = DateTime.fromISO(lieferdatum, { zone: ZONE });
        if (!parsed.isValid || !isDateAllowed(parsed.toJSDate(), rule).ok) {
            setShowFehlerAlert(true);
            setTimeout(() => setShowFehlerAlert(false), 3000);
            return;
        }
        setShowDateModal(false);
        onSubmit(lieferdatum, bemerkung);
    };

    return (
        <>
            {show && (
                <div className="offcanvas offcanvas-end show pb-sm-2 px-sm-2" style={{ width: '500px', visibility: 'visible' }}>
                    {/* Header */}
                    <div className="offcanvas-header flex-column align-items-start py-3 pt-lg-4">
                        <div className="d-flex align-items-center justify-content-between w-100 mb-3 mb-lg-4">
                            <h4 className="offcanvas-title">Warenkorb</h4>
                            <button type="button" className="btn-close" onClick={onHide} aria-label="Schließen" />
                        </div>
                    </div>

                    {/* Body */}
                    <div className="offcanvas-body d-flex flex-column gap-4 pt-2">
                        {cart.map((item, index) => {
                            const artikel = articles.find(a => a.id === item.artikel);
                            const gesamtgewicht = berechneGesamtgewicht(item, artikel);
                            return (
                                <div className="d-flex align-items-center" key={index}>
                                    <div className="w-100 min-w-0 ps-2 ps-sm-3">
                                        <h5 className="d-flex animate-underline mb-2">
                                            <span className="d-block fs-sm fw-medium text-truncate animate-target">
                                                {item.artikelName}
                                            </span>
                                        </h5>
                                        <div className="h6 pb-1 mb-2">
                                            {item.einzelpreis?.toFixed(2)} € – {gesamtgewicht.toFixed(2)} kg
                                        </div>
                                        <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                            <div className="count-input rounded-2 d-flex align-items-center">
                                                <button
                                                    type="button"
                                                    className="btn btn-icon btn-sm"
                                                    onClick={() => onQuantityChange(index, Math.max(1, item.menge! - 1))}
                                                >
                                                    <i className="ci-minus" />
                                                </button>
                                                <input
                                                    type="number"
                                                    className="form-control form-control-sm"
                                                    value={item.menge}
                                                    readOnly
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-icon btn-sm"
                                                    onClick={() => onQuantityChange(index, item.menge! + 1)}
                                                >
                                                    <i className="ci-plus" />
                                                </button>
                                            </div>
                                            <Form.Select
                                                className="form-select form-select-sm w-auto"
                                                value={item.einheit}
                                                onChange={(e) =>
                                                    onEinheitChange(index, e.target.value as ArtikelPositionResource['einheit'])
                                                }
                                            >
                                                <option value="kg">kg</option>
                                                <option value="stück">Stück</option>
                                                <option value="kiste">Kiste</option>
                                                <option value="karton">Karton</option>
                                            </Form.Select>
                                            <button
                                                type="button"
                                                className="btn-close fs-sm"
                                                onClick={() => onRemove(index)}
                                                aria-label="Entfernen"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="offcanvas-header flex-column align-items-start">
                        {/* <div className="d-flex align-items-center justify-content-between w-100 mb-3 mb-md-4">
                            <span className="text-light-emphasis">Gesamtsumme:</span>
                            <span className="h6 mb-0">{gesamtpreis.toFixed(2)} €</span>
                        </div> */}
                        <div className="d-flex w-100 gap-3">
                            <button className="btn btn-lg btn-secondary w-100" onClick={onHide}>
                                Schließen
                            </button>
                            <button className="btn btn-lg btn-primary w-100" onClick={() => setShowDateModal(true)}>
                                Bestellen
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showFehlerAlert && (
                <div className="position-fixed top-0 start-50 translate-middle-x mt-3 z-index-9999" style={{ zIndex: 1056 }}>
                    <div className="alert alert-warning alert-dismissible fade show shadow" role="alert">
                        Bitte wähle ein Lieferdatum!
                    </div>
                </div>
            )}

            {/* Lieferdatum Modal */}
            <Modal show={showDateModal} onHide={() => setShowDateModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Lieferdatum</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Label className="form-label">Lieferdatum</Form.Label>
                    <div className="position-relative">
                        <input
                            ref={(el) => {
                                if (el && showDateModal && !ruleLoading) {
                                    // Wenn noch kein Datum gesetzt und wir eine nächste Option haben, vorausfüllen
                                    const defaultIso = lieferdatum || (nextAvail ? DateTime.fromJSDate(nextAvail).setZone(ZONE).toISODate() : undefined);

                                    flatpickr(el, {
                                        altInput: true,
                                        altFormat: 'd.m.Y',
                                        dateFormat: 'Y-m-d',
                                        locale: German,
                                        defaultDate: defaultIso,
                                        minDate: 'today',
                                        // IMPORTANT: isDateAllowed treats dates as date-only in Europe/Berlin to avoid TZ day shifts
                                        disable: [
                                            (d: Date) => !isDateAllowed(d, rule).ok,
                                        ],
                                        onChange: (selectedDates, dateStr) => setLieferdatum(dateStr)
                                    });
                                }
                            }}
                            className="form-control date-picker pe-5"
                            type="text"
                            placeholder="Datum wählen"
                        />
                        <i
                            className="ci-calendar position-absolute top-50 end-0 translate-middle-y me-3"
                            style={{ pointerEvents: 'none' }}
                        />
                    </div>
                    <div className="small text-muted mt-2">
                        {nextAvail
                            ? <>Nächster verfügbarer Termin: <strong>{DateTime.fromJSDate(nextAvail).setZone(ZONE).toFormat('dd.MM.yyyy')}</strong></>
                            : <>Derzeit kein Termin in den nächsten 90 Tagen verfügbar.</>}
                    </div>
                    {ruleLoading && (
                        <div className="small text-muted">Lieferzeiten werden geladen…</div>
                    )}
                    {!ruleLoading && !fetchedRule && kundeRegion && (
                        <div className="small text-warning">
                            Keine spezifische Liefertage für Region „{kundeRegion}“ gefunden. Es gilt Standard: Mo–Sa.
                        </div>
                    )}
                    <Form.Label className="form-label mt-4">Bemerkung</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        value={bemerkung}
                        onChange={(e) => setBemerkung(e.target.value)}
                        placeholder="Optional: z. B. Artikel-, Anlieferhinweise, etc."
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDateModal(false)}>
                        Abbrechen
                    </Button>
                    <Button variant="primary" onClick={handleBestellungAbsenden}>
                        Bestellen
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );

}

export default WarenkorbPanel;