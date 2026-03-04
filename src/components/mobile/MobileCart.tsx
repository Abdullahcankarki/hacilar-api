import React, { useEffect, useMemo, useRef, useState, useId } from 'react';
import { ArtikelPositionResource, ArtikelResource, RegionRuleResource } from '@/Resources';
import { getAllRegionRules } from '@/backend/api';
import { fmtEUR, berechneGesamtgewicht, berechneGesamtpreis } from '@/utils/cartHelpers';
import { isDateAllowed, nextAllowedDate, ZONE } from '@/utils/deliveryRules';
import { getImageUrl } from '@/utils/imageUtils';
import fallbackImage from '@/Cartzilla/assets/img/shop/grocery/10.png';
import flatpickr from 'flatpickr';
import { German } from 'flatpickr/dist/l10n/de.js';
import { DateTime } from 'luxon';
import { Modal, Form, Button } from 'react-bootstrap';

type Props = {
  show: boolean;
  onClose: () => void;
  cart: ArtikelPositionResource[];
  articles: ArtikelResource[];
  kundeRegion: string | null;
  onQuantityChange: (index: number, qty: number) => void;
  onEinheitChange: (index: number, einheit: ArtikelPositionResource['einheit']) => void;
  onRemove: (index: number) => void;
  onSubmit: (lieferdatum: string, bemerkung: string) => void;
  submitLoading?: boolean;
};

const MobileCart: React.FC<Props> = ({
  show, onClose, cart, articles, kundeRegion,
  onQuantityChange, onEinheitChange, onRemove, onSubmit, submitLoading
}) => {
  const [showDateModal, setShowDateModal] = useState(false);
  const [lieferdatum, setLieferdatum] = useState('');
  const [bemerkung, setBemerkung] = useState('');
  const [fetchedRule, setFetchedRule] = useState<RegionRuleResource | null>(null);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!kundeRegion) { setFetchedRule(null); return; }
    setRuleLoading(true);
    (async () => {
      try {
        const res = await getAllRegionRules({ region: kundeRegion, active: true, limit: 1, page: 1, sortBy: 'updatedAt:desc' });
        if (!cancelled) setFetchedRule(res.items?.length ? res.items[0] : null);
      } catch { if (!cancelled) setFetchedRule(null); }
      finally { if (!cancelled) setRuleLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [kundeRegion]);

  const rule = useMemo<RegionRuleResource>(() => {
    if (fetchedRule) return fetchedRule;
    return { region: kundeRegion ?? 'UNBEKANNT', allowedWeekdays: [1, 2, 3, 4, 5, 6], orderCutoff: undefined, exceptionDates: [], isActive: true } as RegionRuleResource;
  }, [fetchedRule, kundeRegion]);

  const nextAvail = useMemo(() => nextAllowedDate(new Date(), rule), [rule]);

  const artikelById = useMemo(() => {
    const m = new Map<string, ArtikelResource>();
    for (const a of articles) m.set(a.id, a);
    return m;
  }, [articles]);

  const gesamtpreis = cart.reduce((sum, item) => sum + berechneGesamtpreis(item, artikelById.get(item.artikel)), 0);

  useEffect(() => {
    if (showDateModal && !ruleLoading && !lieferdatum && nextAvail) {
      const iso = DateTime.fromJSDate(nextAvail).setZone(ZONE).toISODate();
      if (iso) setLieferdatum(iso);
    }
    if (showDateModal) setDateError(null);
  }, [showDateModal, ruleLoading, nextAvail, lieferdatum]);

  useEffect(() => { if (dateError) setDateError(null); }, [lieferdatum]);

  useEffect(() => {
    if (!showDateModal || ruleLoading) return;
    const el = dateInputRef.current;
    if (!el) return;
    const defaultIso = lieferdatum || (nextAvail ? DateTime.fromJSDate(nextAvail).setZone(ZONE).toISODate() : undefined);
    if (fpRef.current) { try { fpRef.current.destroy(); } catch {} fpRef.current = null; }
    fpRef.current = flatpickr(el, {
      altInput: true, altFormat: 'd.m.Y', dateFormat: 'Y-m-d', locale: German,
      defaultDate: defaultIso, minDate: 'today',
      disable: [(d: Date) => !isDateAllowed(d, rule).ok],
      onChange: (_, dateStr) => setLieferdatum(dateStr)
    });
    if (defaultIso && fpRef.current) fpRef.current.setDate(defaultIso, true);
    return () => { if (fpRef.current) { try { fpRef.current.destroy(); } catch {} fpRef.current = null; } };
  }, [showDateModal, ruleLoading, rule, nextAvail]);

  const handleSubmit = () => {
    if (!lieferdatum) { setDateError('Bitte ein Lieferdatum wählen.'); return; }
    if (ruleLoading) { setDateError('Lieferregel wird geladen...'); return; }
    const parsed = DateTime.fromISO(lieferdatum, { zone: ZONE }).set({ hour: 15, minute: 0, second: 0, millisecond: 0 });
    if (!parsed.isValid || !isDateAllowed(parsed.toJSDate(), rule).ok) {
      setDateError('Dieses Datum ist nicht erlaubt.'); return;
    }
    setDateError(null);
    setShowDateModal(false);
    onSubmit(parsed.toISO()!, bemerkung);
  };

  const lieferId = useId();

  if (!show) return null;

  return (
    <>
      <div className="ms-sheet-backdrop" onClick={onClose} />
      <div className="ms-sheet" style={{ maxHeight: '90vh' }}>
        <div className="ms-sheet-handle" />
        <div className="ms-sheet-header">
          <h3 className="ms-sheet-title">Warenkorb ({cart.length})</h3>
          <button className="ms-sheet-close" onClick={onClose}>&times;</button>
        </div>

        <div className="ms-sheet-body">
          {cart.length === 0 ? (
            <div className="ms-empty">
              <div className="ms-empty-icon">🛒</div>
              <p>Dein Warenkorb ist leer</p>
            </div>
          ) : (
            cart.map((item, index) => {
              const artikel = artikelById.get(item.artikel);
              const gewicht = berechneGesamtgewicht(item, artikel);
              const imgUrl = artikel ? getImageUrl(artikel.bildUrl, fallbackImage) : fallbackImage;
              return (
                <div className="ms-cart-item" key={index}>
                  <img src={imgUrl} alt={item.artikelName} className="ms-cart-img" />
                  <div className="ms-cart-info">
                    <p className="ms-cart-name">{item.artikelName}</p>
                    <p className="ms-cart-detail">
                      {fmtEUR.format(item.einzelpreis ?? 0)} &middot; {gewicht.toFixed(2)} kg
                    </p>
                    <div className="ms-cart-controls">
                      <button className="ms-qty-btn" onClick={() => onQuantityChange(index, Math.max(0.5, (item.menge || 1) - 0.5))}>-</button>
                      <span className="ms-qty-val">{item.menge}</span>
                      <button className="ms-qty-btn" onClick={() => onQuantityChange(index, (item.menge || 1) + 0.5)}>+</button>
                      <select
                        value={item.einheit}
                        onChange={e => onEinheitChange(index, e.target.value as any)}
                        className="ms-sort-select"
                        style={{ marginLeft: '4px', padding: '4px 6px', fontSize: '0.78rem' }}
                      >
                        <option value="kg">kg</option>
                        <option value="stück">Stk</option>
                        <option value="kiste">Kiste</option>
                        <option value="karton">Kart.</option>
                      </select>
                      <button className="ms-cart-delete" onClick={() => onRemove(index)}>
                        <i className="ci-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <div className="ms-sheet-footer">
            <div className="ms-cart-total">
              <span>Gesamt</span>
              <span>{fmtEUR.format(gesamtpreis)}</span>
            </div>
            <button className="ms-btn-primary" onClick={() => setShowDateModal(true)}>
              Bestellen ({fmtEUR.format(gesamtpreis)})
            </button>
          </div>
        )}
      </div>

      {/* Lieferdatum Modal */}
      <Modal show={showDateModal} onHide={() => setShowDateModal(false)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}>
        <Modal.Header closeButton>
          <Modal.Title>Lieferdatum</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label htmlFor={lieferId}>Lieferdatum</Form.Label>
          <div className="position-relative">
            <input id={lieferId} ref={dateInputRef} className="form-control pe-5" type="text" placeholder="Datum wählen" value={lieferdatum} onChange={() => {}} />
            <i className="ci-calendar position-absolute top-50 end-0 translate-middle-y me-3" style={{ pointerEvents: 'none' }} />
          </div>
          {dateError && <div className="invalid-feedback d-block">{dateError}</div>}
          <div className="small text-muted mt-2">
            {nextAvail
              ? <>Nächster Termin: <strong>{DateTime.fromJSDate(nextAvail).setZone(ZONE).toFormat('dd.MM.yyyy')}</strong></>
              : 'Kein Termin in den nächsten 90 Tagen verfügbar.'}
          </div>
          {ruleLoading && <div className="small text-muted">Lieferzeiten werden geladen...</div>}
          <Form.Label className="mt-4">Bemerkung</Form.Label>
          <Form.Control as="textarea" rows={3} value={bemerkung} onChange={e => setBemerkung(e.target.value)} placeholder="Optional: Hinweise..." />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDateModal(false)}>Abbrechen</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!!dateError || !lieferdatum || ruleLoading || submitLoading}>
            {submitLoading ? <><span className="spinner-border spinner-border-sm me-2" />Senden...</> : 'Bestellen'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default MobileCart;
