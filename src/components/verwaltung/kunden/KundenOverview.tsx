// frontend/src/components/KundenOverview.tsx
import React, { useEffect, useMemo, useState } from "react";
import { KundeResource } from "@/Resources";
import { getAllKunden, deleteKunde, updateKunde, approveKunde, createKunde } from "@/backend/api";
import { useNavigate } from "react-router-dom";

type FetchState = "idle" | "loading" | "success" | "error";
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// Adresse compose/parse helpers
function composeAdresse(street: string, plz: string, ort: string) {
  const s = street.trim();
  const p = plz.trim();
  const o = ort.trim();
  if (!s && !p && !o) return "";
  if (!p && !o) return s;
  return `${s}${s ? ", " : ""}${p}${p && o ? " " : ""}${o}`.trim();
}

function parseAdresse(adresse?: string): { street: string; plz: string; ort: string } {
  const raw = (adresse || "").trim();
  if (!raw) return { street: "", plz: "", ort: "" };

  // Common format: "Straße 1, 12345 Ort"
  const parts = raw.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const street = parts[0];
    const rest = parts.slice(1).join(", ");
    const m = rest.match(/^(\d{4,5})\s+(.*)$/); // allow 4-5 digits
    if (m) return { street, plz: m[1], ort: m[2] };
    return { street, plz: "", ort: rest };
  }

  // Try to detect "... 12345 Ort" at the end
  const m2 = raw.match(/^(.*?)(?:\s|,)+(\d{4,5})\s+(.*)$/);
  if (m2) return { street: m2[1].trim(), plz: m2[2], ort: m2[3].trim() };

  return { street: raw, plz: "", ort: "" };
}

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

/* ---------------------- Confirm Modal ---------------------- */
const ConfirmModal: React.FC<{
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}> = ({ title = "Löschen bestätigen", message, confirmText = "Löschen", cancelText = "Abbrechen", onConfirm, onCancel, busy }) => (
  <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(30,33,37,.6)" }}>
    <div className="modal-dialog modal-dialog-centered" role="document">
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">{title}</h5>
          <button type="button" className="btn-close" onClick={onCancel} />
        </div>
        <div className="modal-body">
          <div className="d-flex align-items-start">
            <i className="ci-trash fs-4 me-3 text-danger" />
            <div>{message}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline-secondary" onClick={onCancel} disabled={!!busy}>{cancelText}</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={!!busy}>
            {busy && <span className="spinner-border spinner-border-sm me-2" />} {confirmText}
          </button>
        </div>
      </div>
    </div>
  </div>
);

const CreateKundeModal: React.FC<{
  onCancel: () => void;
  onSaved: (created: KundeResource) => void;
}> = ({ onCancel, onSaved }) => {
  const [busy, setBusy] = useState(false);

  // Stammdaten
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [kundenNummer, setKundenNummer] = useState("");
  const [region, setRegion] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [adresseStrasse, setAdresseStrasse] = useState("");
  const [adressePlz, setAdressePlz] = useState("");
  const [adresseOrt, setAdresseOrt] = useState("");
  const [telefon, setTelefon] = useState("");

  // Zugang
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  // Firmendaten
  const [ustId, setUstId] = useState("");
  const [handelsregisterNr, setHandelsregisterNr] = useState("");
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [lieferzeit, setLieferzeit] = useState<string[]>([]);
  const [website, setWebsite] = useState("");

  const [lieferStart, setLieferStart] = useState<string>("");
  const [lieferEnde, setLieferEnde] = useState<string>("");

  const timeOptions = [
    "00:00",
    "01:00",
    "02:00",
    "03:00",
    "04:00",
    "05:00",
    "06:00",
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
    "22:00",
    "23:00",
    "24:00",
  ];

  // E-Mail Empfänger (Workflows)
  const [emailRechnung, setEmailRechnung] = useState("");
  const [emailLieferschein, setEmailLieferschein] = useState("");
  const [emailBuchhaltung, setEmailBuchhaltung] = useState("");
  const [emailSpedition, setEmailSpedition] = useState("");

  // Datei-URLs (falls bereits vorhanden)
  const [gewerbeDateiUrl, setGewerbeDateiUrl] = useState("");
  const [zusatzDateiUrl, setZusatzDateiUrl] = useState("");

  const [error, setError] = useState<string>("");

  const nameInvalid = !name.trim();
  const emailInvalid = !email.trim();
  const passwordTooShort = password.length > 0 && password.trim().length < 6;
  const passwordMismatch = password2.length > 0 && password.trim() !== password2.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const p1 = password.trim();
      const p2 = password2.trim();
      if (!name.trim()) throw new Error("Name ist erforderlich");
      if (!email.trim()) throw new Error("E‑Mail ist erforderlich");
      if (p1.length < 6) {
        throw new Error("Passwort muss mindestens 6 Zeichen haben");
      }
      if (p1 !== p2) {
        throw new Error("Passwörter stimmen nicht überein");
      }

      const payload: Partial<KundeResource> = {
        name: name.trim(),
        email: email.trim(),
        password: p1,

        kundenNummer: kundenNummer.trim() || undefined,
        region: region.trim() || undefined,
        kategorie: kategorie.trim() || undefined,
        adresse: composeAdresse(adresseStrasse, adressePlz, adresseOrt).trim() || undefined,
        telefon: telefon.trim() || undefined,

        ustId: ustId.trim() || undefined,
        handelsregisterNr: handelsregisterNr.trim() || undefined,
        ansprechpartner: ansprechpartner.trim() || undefined,
        lieferzeit: lieferzeit.length ? lieferzeit.join(", ") : undefined,
        website: website.trim() || undefined,

        emailRechnung: emailRechnung.trim() || undefined,
        emailLieferschein: emailLieferschein.trim() || undefined,
        emailBuchhaltung: emailBuchhaltung.trim() || undefined,
        emailSpedition: emailSpedition.trim() || undefined,

        gewerbeDateiUrl: gewerbeDateiUrl.trim() || undefined,
        zusatzDateiUrl: zusatzDateiUrl.trim() || undefined,
      };

      const created = await createKunde(payload as any);
      onSaved(created);
    } catch (err: any) {
      setError(err?.message || "Erstellung fehlgeschlagen");
    } finally { setBusy(false); }
  }

  function addLieferzeitWindow() {
    if (!lieferStart || !lieferEnde) return;

    if (lieferEnde <= lieferStart) {
      setError("Endzeit muss nach der Startzeit liegen");
      return;
    }

    const window = `${lieferStart}–${lieferEnde}`;
    setLieferzeit((prev) => Array.from(new Set([...prev, window])));
    setLieferStart("");
    setLieferEnde("");
  }

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(30,33,37,.6)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <div className="d-flex align-items-center gap-2">
              <i className="ci-user fs-4" />
              <div>
                <h5 className="modal-title mb-0">Neuen Kunden anlegen</h5>
                <div className="small opacity-75">Bitte Stammdaten + Passwort vergeben</div>
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                {/* Stammdaten */}
                <div className="col-12">
                  <div className="card border-0 bg-secondary-subtle">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="fw-semibold"><i className="ci-file me-2" />Stammdaten</div>
                        <span className="badge bg-light text-dark">Pflichtfelder: Name, E‑Mail, Passwort</span>
                      </div>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Name</label>
                          <input
                            className={cx("form-control", nameInvalid && "is-invalid")}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                          {nameInvalid && <div className="invalid-feedback">Name ist erforderlich.</div>}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Kundennummer</label>
                          <input className="form-control" value={kundenNummer} onChange={(e) => setKundenNummer(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">E‑Mail</label>
                          <input
                            type="email"
                            className={cx("form-control", emailInvalid && "is-invalid")}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                          {emailInvalid && <div className="invalid-feedback">E‑Mail ist erforderlich.</div>}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Telefon</label>
                          <input className="form-control" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Region</label>
                          <input className="form-control" value={region} onChange={(e) => setRegion(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Kategorie</label>
                          <input className="form-control" value={kategorie} onChange={(e) => setKategorie(e.target.value)} />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Adresse</label>
                          <div className="row g-2">
                            <div className="col-md-6">
                              <input
                                className="form-control"
                                placeholder="Straße + Hausnummer"
                                value={adresseStrasse}
                                onChange={(e) => setAdresseStrasse(e.target.value)}
                              />
                            </div>
                            <div className="col-md-3">
                              <input
                                className="form-control"
                                placeholder="PLZ"
                                value={adressePlz}
                                onChange={(e) => setAdressePlz(e.target.value)}
                              />
                            </div>
                            <div className="col-md-3">
                              <input
                                className="form-control"
                                placeholder="Ort"
                                value={adresseOrt}
                                onChange={(e) => setAdresseOrt(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="form-text">Wird beim Speichern als ein Feld gespeichert.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Zugang */}
                <div className="col-12">
                  <div className="card border-0">
                    <div className="card-body p-0">
                      <div className="fw-semibold"><i className="ci-shield me-2" />Zugang</div>
                      <div className="mt-3 p-3 rounded-3 bg-secondary-subtle">
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label">Passwort</label>
                            <input
                              type="password"
                              className={cx("form-control", passwordTooShort && "is-invalid")}
                              placeholder="Mindestens 6 Zeichen"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              autoComplete="new-password"
                              required
                            />
                            {passwordTooShort && <div className="invalid-feedback">Mindestens 6 Zeichen erforderlich.</div>}
                            <div className="form-text">Tipp: Verwende Groß-/Kleinschreibung & Zahlen.</div>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Passwort wiederholen</label>
                            <input
                              type="password"
                              className={cx("form-control", passwordMismatch && "is-invalid")}
                              placeholder="Bitte wiederholen"
                              value={password2}
                              onChange={(e) => setPassword2(e.target.value)}
                              autoComplete="new-password"
                              required
                            />
                            {passwordMismatch && <div className="invalid-feedback">Passwörter stimmen nicht überein.</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Firmendaten */}
                <div className="col-12">
                  <div className="card border-0">
                    <div className="card-body p-0">
                      <div className="fw-semibold"><i className="ci-briefcase me-2" />Firmendaten</div>
                      <div className="row g-3 mt-1">
                        <div className="col-md-6">
                          <label className="form-label">USt‑IdNr.</label>
                          <input className="form-control" value={ustId} onChange={(e) => setUstId(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Handelsregister‑Nr.</label>
                          <input className="form-control" value={handelsregisterNr} onChange={(e) => setHandelsregisterNr(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Ansprechpartner</label>
                          <input className="form-control" value={ansprechpartner} onChange={(e) => setAnsprechpartner(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Lieferzeit (Zeitfenster)</label>

                          <div className="row g-2">
                            <div className="col-5">
                              <select
                                className="form-select"
                                value={lieferStart}
                                onChange={(e) => { setLieferStart(e.target.value); setError(""); }}
                              >
                                <option value="">Start</option>
                                {timeOptions.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>

                            <div className="col-5">
                              <select
                                className="form-select"
                                value={lieferEnde}
                                onChange={(e) => { setLieferEnde(e.target.value); setError(""); }}
                              >
                                <option value="">Ende</option>
                                {timeOptions
                                  .filter((t) => !lieferStart || t > lieferStart)
                                  .map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                              </select>
                            </div>

                            <div className="col-2 d-grid">
                              <button
                                type="button"
                                className="btn btn-outline-dark"
                                onClick={addLieferzeitWindow}
                                disabled={!lieferStart || !lieferEnde}
                                title="Zeitfenster hinzufügen"
                              >
                                <i className="ci-plus" />
                              </button>
                            </div>
                          </div>

                          {lieferzeit.length > 0 && (
                            <div className="mt-2 d-flex flex-wrap gap-2">
                              {lieferzeit.map((lz) => (
                                <span key={lz} className="badge bg-light text-dark border">
                                  {lz}
                                  <button
                                    type="button"
                                    className="btn btn-sm p-0 ms-2"
                                    style={{ lineHeight: 1 }}
                                    aria-label="Entfernen"
                                    onClick={() => setLieferzeit((prev) => prev.filter((x) => x !== lz))}
                                  >
                                    <i className="ci-close" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {lieferzeit.length > 0 && (
                            <div className="mt-2">
                              <button type="button" className="btn btn-link p-0 small" onClick={() => setLieferzeit([])}>
                                Auswahl löschen
                              </button>
                            </div>
                          )}

                          <div className="form-text">Optional – Start & Ende auswählen und mit + hinzufügen. Mehrere Zeitfenster möglich.</div>
                        </div>
                        <div className="col-12">
                          <label className="form-label">Website</label>
                          <input className="form-control" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workflow E-Mails */}
                <div className="col-12">
                  <div className="card border-0">
                    <div className="card-body p-0">
                      <div className="fw-semibold"><i className="ci-mail me-2" />E‑Mail‑Empfänger (Workflows)</div>
                      <div className="row g-3 mt-1">
                        <div className="col-md-6">
                          <label className="form-label">Rechnung</label>
                          <input type="email" className="form-control" value={emailRechnung} onChange={(e) => setEmailRechnung(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Lieferschein</label>
                          <input type="email" className="form-control" value={emailLieferschein} onChange={(e) => setEmailLieferschein(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Buchhaltung</label>
                          <input type="email" className="form-control" value={emailBuchhaltung} onChange={(e) => setEmailBuchhaltung(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Spedition</label>
                          <input type="email" className="form-control" value={emailSpedition} onChange={(e) => setEmailSpedition(e.target.value)} />
                        </div>
                      </div>
                      <div className="form-text">Optional – falls abweichende Empfänger genutzt werden.</div>
                    </div>
                  </div>
                </div>

                {/* Datei-Links */}
                <div className="col-12">
                  <div className="card border-0">
                    <div className="card-body p-0">
                      <div className="fw-semibold"><i className="ci-attachment me-2" />Dateien (URLs)</div>
                      <div className="row g-3 mt-1">
                        <div className="col-md-6">
                          <label className="form-label">Gewerbe‑Datei URL</label>
                          <input className="form-control" value={gewerbeDateiUrl} onChange={(e) => setGewerbeDateiUrl(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Zusatz‑Datei URL</label>
                          <input className="form-control" value={zusatzDateiUrl} onChange={(e) => setZusatzDateiUrl(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {error && (
                <div className="px-1">
                  <div className="alert alert-danger mb-0"><i className="ci-close-circle me-2" />{error}</div>
                </div>
              )}
              <div className="modal-footer mt-3">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
                <button type="submit" className="btn btn-success" disabled={busy}>
                  {busy && <span className="spinner-border spinner-border-sm me-2" />} Anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};


const EditKundeModal: React.FC<{
  initial: KundeResource;
  onCancel: () => void;
  onSaved: (updated: KundeResource) => void;
}> = ({ initial, onCancel, onSaved }) => {
  const [busy, setBusy] = useState(false);

  // Stammdaten
  const [name, setName] = useState(initial.name || "");
  const [email, setEmail] = useState(initial.email || "");
  const [kundenNummer, setKundenNummer] = useState(initial.kundenNummer || "");
  const [region, setRegion] = useState(initial.region || "");
  const [telefon, setTelefon] = useState(initial.telefon || "");
  const _parsedAdresse = useMemo(() => parseAdresse(initial.adresse), [initial.adresse]);
  const [adresseStrasse, setAdresseStrasse] = useState(_parsedAdresse.street);
  const [adressePlz, setAdressePlz] = useState(_parsedAdresse.plz);
  const [adresseOrt, setAdresseOrt] = useState(_parsedAdresse.ort);
  const [kategorie, setKategorie] = useState(initial.kategorie || "");

  // Firmendaten
  const [ustId, setUstId] = useState(initial.ustId || "");
  const [handelsregisterNr, setHandelsregisterNr] = useState(initial.handelsregisterNr || "");
  const [ansprechpartner, setAnsprechpartner] = useState(initial.ansprechpartner || "");
  const [website, setWebsite] = useState(initial.website || "");

  // Lieferzeit (Backend: kommagetrennte Liste)
  const [lieferzeit, setLieferzeit] = useState<string[]>(
    (initial.lieferzeit || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  );
  const [lieferStart, setLieferStart] = useState<string>("");
  const [lieferEnde, setLieferEnde] = useState<string>("");

  const timeOptions = [
    "00:00",
    "01:00",
    "02:00",
    "03:00",
    "04:00",
    "05:00",
    "06:00",
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
    "22:00",
    "23:00",
    "24:00",
  ];

  // E-Mail Empfänger (Workflows)
  const [emailRechnung, setEmailRechnung] = useState(initial.emailRechnung || "");
  const [emailLieferschein, setEmailLieferschein] = useState(initial.emailLieferschein || "");
  const [emailBuchhaltung, setEmailBuchhaltung] = useState(initial.emailBuchhaltung || "");
  const [emailSpedition, setEmailSpedition] = useState(initial.emailSpedition || "");

  // Datei-URLs
  const [gewerbeDateiUrl, setGewerbeDateiUrl] = useState(initial.gewerbeDateiUrl || "");
  const [zusatzDateiUrl, setZusatzDateiUrl] = useState(initial.zusatzDateiUrl || "");

  // Sicherheit
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [changePassword, setChangePassword] = useState(false);

  const [error, setError] = useState<string>("");

  const nameInvalid = !name.trim();
  const emailInvalid = !email.trim();
  const passwordTooShort = changePassword && password.length > 0 && password.trim().length < 6;
  const passwordMismatch = changePassword && password2.length > 0 && password.trim() !== password2.trim();

  function addLieferzeitWindow() {
    if (!lieferStart || !lieferEnde) return;

    if (lieferEnde <= lieferStart) {
      setError("Endzeit muss nach der Startzeit liegen");
      return;
    }

    const window = `${lieferStart}–${lieferEnde}`;
    setLieferzeit((prev) => Array.from(new Set([...prev, window])));
    setLieferStart("");
    setLieferEnde("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (!name.trim()) throw new Error("Name ist erforderlich");
      if (!email.trim()) throw new Error("E‑Mail ist erforderlich");
      const payload: Partial<KundeResource> & { password?: string } = {
        // Stammdaten
        name: name.trim(),
        email: email.trim(),
        kundenNummer: kundenNummer.trim() || undefined,
        region: region.trim() || undefined,
        telefon: telefon.trim() || undefined,
        adresse: composeAdresse(adresseStrasse, adressePlz, adresseOrt).trim() || undefined,
        kategorie: kategorie.trim() || undefined,

        // Firmendaten
        ustId: ustId.trim() || undefined,
        handelsregisterNr: handelsregisterNr.trim() || undefined,
        ansprechpartner: ansprechpartner.trim() || undefined,
        website: website.trim() || undefined,
        lieferzeit: lieferzeit.length ? lieferzeit.join(", ") : undefined,

        // Workflows
        emailRechnung: emailRechnung.trim() || undefined,
        emailLieferschein: emailLieferschein.trim() || undefined,
        emailBuchhaltung: emailBuchhaltung.trim() || undefined,
        emailSpedition: emailSpedition.trim() || undefined,

        // Dateien
        gewerbeDateiUrl: gewerbeDateiUrl.trim() || undefined,
        zusatzDateiUrl: zusatzDateiUrl.trim() || undefined,
      };

      // Passwort nur senden, wenn es geändert werden soll
      const p1 = password.trim();
      const p2 = password2.trim();
      if (changePassword) {
        if (p1.length < 6) {
          throw new Error("Passwort muss mindestens 6 Zeichen haben");
        }
        if (p1 !== p2) {
          throw new Error("Passwörter stimmen nicht überein");
        }
        payload.password = p1;
      }

      const updated = await updateKunde(initial.id!, payload);
      onSaved(updated);
      setPassword("");
      setPassword2("");
      setChangePassword(false);
    } catch (err: any) {
      setError(err?.message || "Aktualisierung fehlgeschlagen");
    } finally { setBusy(false); }
  }

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(30,33,37,.6)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <div className="d-flex align-items-center gap-2">
              <i className="ci-user fs-4" />
              <div>
                <h5 className="modal-title mb-0">Kunde bearbeiten</h5>
                <div className="small opacity-75">{initial.name || initial.email || initial.kundenNummer || "—"}</div>
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                {/* Stammdaten */}
                <div className="col-12">
                  <div className="card border-0 bg-secondary-subtle">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="fw-semibold"><i className="ci-file me-2" />Stammdaten</div>
                        <span className="badge bg-light text-dark">Pflichtfelder: Name, E‑Mail</span>
                      </div>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Name</label>
                          <input
                            className={cx("form-control", nameInvalid && "is-invalid")}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                          {nameInvalid && <div className="invalid-feedback">Name ist erforderlich.</div>}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Kundennummer</label>
                          <input className="form-control" value={kundenNummer} onChange={(e) => setKundenNummer(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">E‑Mail</label>
                          <input
                            type="email"
                            className={cx("form-control", emailInvalid && "is-invalid")}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                          {emailInvalid && <div className="invalid-feedback">E‑Mail ist erforderlich.</div>}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Telefon</label>
                          <input className="form-control" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Region</label>
                          <input className="form-control" value={region} onChange={(e) => setRegion(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Kategorie</label>
                          <input className="form-control" value={kategorie} onChange={(e) => setKategorie(e.target.value)} />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Adresse</label>
                          <div className="row g-2">
                            <div className="col-md-6">
                              <input
                                className="form-control"
                                placeholder="Straße + Hausnummer"
                                value={adresseStrasse}
                                onChange={(e) => setAdresseStrasse(e.target.value)}
                              />
                            </div>
                            <div className="col-md-3">
                              <input
                                className="form-control"
                                placeholder="PLZ"
                                value={adressePlz}
                                onChange={(e) => setAdressePlz(e.target.value)}
                              />
                            </div>
                            <div className="col-md-3">
                              <input
                                className="form-control"
                                placeholder="Ort"
                                value={adresseOrt}
                                onChange={(e) => setAdresseOrt(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="form-text">Wird beim Speichern als ein Feld gespeichert.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Firmendaten */}
                <div className="col-12">
                  <div className="card border-0">
                    <div className="card-body p-0">
                      <div className="fw-semibold"><i className="ci-briefcase me-2" />Firmendaten</div>
                      <div className="row g-3 mt-1">
                        <div className="col-md-6">
                          <label className="form-label">USt‑IdNr.</label>
                          <input className="form-control" value={ustId} onChange={(e) => setUstId(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Handelsregister‑Nr.</label>
                          <input className="form-control" value={handelsregisterNr} onChange={(e) => setHandelsregisterNr(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Ansprechpartner</label>
                          <input className="form-control" value={ansprechpartner} onChange={(e) => setAnsprechpartner(e.target.value)} />
                        </div>

                        <div className="col-md-6">
                          <label className="form-label">Lieferzeit (Zeitfenster)</label>

                          <div className="row g-2">
                            <div className="col-5">
                              <select
                                className="form-select"
                                value={lieferStart}
                                onChange={(e) => { setLieferStart(e.target.value); setError(""); }}
                              >
                                <option value="">Start</option>
                                {timeOptions.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>

                            <div className="col-5">
                              <select
                                className="form-select"
                                value={lieferEnde}
                                onChange={(e) => { setLieferEnde(e.target.value); setError(""); }}
                              >
                                <option value="">Ende</option>
                                {timeOptions
                                  .filter((t) => !lieferStart || t > lieferStart)
                                  .map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                              </select>
                            </div>

                            <div className="col-2 d-grid">
                              <button
                                type="button"
                                className="btn btn-outline-dark"
                                onClick={addLieferzeitWindow}
                                disabled={!lieferStart || !lieferEnde}
                                title="Zeitfenster hinzufügen"
                              >
                                <i className="ci-plus" />
                              </button>
                            </div>
                          </div>

                          {lieferzeit.length > 0 && (
                            <div className="mt-2 d-flex flex-wrap gap-2">
                              {lieferzeit.map((lz) => (
                                <span key={lz} className="badge bg-light text-dark border">
                                  {lz}
                                  <button
                                    type="button"
                                    className="btn btn-sm p-0 ms-2"
                                    style={{ lineHeight: 1 }}
                                    aria-label="Entfernen"
                                    onClick={() => setLieferzeit((prev) => prev.filter((x) => x !== lz))}
                                  >
                                    <i className="ci-close" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {lieferzeit.length > 0 && (
                            <div className="mt-2">
                              <button type="button" className="btn btn-link p-0 small" onClick={() => setLieferzeit([])}>
                                Auswahl löschen
                              </button>
                            </div>
                          )}

                          <div className="form-text">Optional – Start & Ende auswählen und mit + hinzufügen. Mehrere Zeitfenster möglich.</div>
                        </div>

                        <div className="col-12">
                          <label className="form-label">Website</label>
                          <input className="form-control" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workflow E-Mails */}
                <div className="col-12">
                  <div className="card border-0">
                    <div className="card-body p-0">
                      <div className="fw-semibold"><i className="ci-mail me-2" />E‑Mail‑Empfänger (Workflows)</div>
                      <div className="row g-3 mt-1">
                        <div className="col-md-6">
                          <label className="form-label">Rechnung</label>
                          <input type="email" className="form-control" value={emailRechnung} onChange={(e) => setEmailRechnung(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Lieferschein</label>
                          <input type="email" className="form-control" value={emailLieferschein} onChange={(e) => setEmailLieferschein(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Buchhaltung</label>
                          <input type="email" className="form-control" value={emailBuchhaltung} onChange={(e) => setEmailBuchhaltung(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Spedition</label>
                          <input type="email" className="form-control" value={emailSpedition} onChange={(e) => setEmailSpedition(e.target.value)} />
                        </div>
                      </div>
                      <div className="form-text">Optional – falls abweichende Empfänger genutzt werden.</div>
                    </div>
                  </div>
                </div>

                {/* Datei-Links */}
                <div className="col-12">
                  <div className="card border-0">
                    <div className="card-body p-0">
                      <div className="fw-semibold"><i className="ci-attachment me-2" />Dateien (URLs)</div>
                      <div className="row g-3 mt-1">
                        <div className="col-md-6">
                          <label className="form-label">Gewerbe‑Datei URL</label>
                          <input className="form-control" value={gewerbeDateiUrl} onChange={(e) => setGewerbeDateiUrl(e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Zusatz‑Datei URL</label>
                          <input className="form-control" value={zusatzDateiUrl} onChange={(e) => setZusatzDateiUrl(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sicherheit */}
                <div className="col-12">
                  <div className="card border-0">
                    <div className="card-body p-0">
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="fw-semibold"><i className="ci-shield me-2" />Sicherheit</div>
                        <div className="form-check form-switch m-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="changePasswordSwitch"
                            checked={changePassword}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setChangePassword(on);
                              if (!on) {
                                setPassword("");
                                setPassword2("");
                              }
                            }}
                          />
                          <label className="form-check-label" htmlFor="changePasswordSwitch">Passwort ändern</label>
                        </div>
                      </div>

                      {changePassword && (
                        <div className="mt-3 p-3 rounded-3 bg-secondary-subtle">
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label">Neues Passwort</label>
                              <input
                                type="password"
                                className={cx("form-control", passwordTooShort && "is-invalid")}
                                placeholder="Mindestens 6 Zeichen"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                              />
                              {passwordTooShort && <div className="invalid-feedback">Mindestens 6 Zeichen erforderlich.</div>}
                              <div className="form-text">Tipp: Verwende Groß-/Kleinschreibung & Zahlen.</div>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">Neues Passwort wiederholen</label>
                              <input
                                type="password"
                                className={cx("form-control", passwordMismatch && "is-invalid")}
                                placeholder="Bitte wiederholen"
                                value={password2}
                                onChange={(e) => setPassword2(e.target.value)}
                                autoComplete="new-password"
                              />
                              {passwordMismatch && <div className="invalid-feedback">Passwörter stimmen nicht überein.</div>}
                            </div>
                          </div>
                        </div>
                      )}

                      {!changePassword && (
                        <div className="mt-2 text-muted small">Passwort bleibt unverändert.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {error && (
                <div className="px-1">
                  <div className="alert alert-danger mb-0"><i className="ci-close-circle me-2" />{error}</div>
                </div>
              )}
              <div className="modal-footer mt-3">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
                <button type="submit" className="btn btn-success" disabled={busy}>
                  {busy && <span className="spinner-border spinner-border-sm me-2" />} Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------------- Hauptkomponente ---------------------- */
const KundenOverview: React.FC = () => {
  const navigate = useNavigate();
  // Daten
  const [items, setItems] = useState<KundeResource[]>([]);
  const [total, setTotal] = useState(0);

  // UI-State
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string>("");

  // Filter & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search, 350);
  const [region, setRegion] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [isApproved, setIsApproved] = useState<"all" | "1" | "0">("all");
  const [sortBy, setSortBy] = useState<string>("-createdAt");

  // Delete-Confirm
  const [confirmItem, setConfirmItem] = useState<KundeResource | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Edit-Modal
  const [editItem, setEditItem] = useState<KundeResource | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2700);
  };

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function load() {
    setState("loading"); setError("");
    try {
      const resp = await getAllKunden({
        page, limit,
        search: dSearch || undefined,
        region: region.trim() || undefined,
        kategorie: kategorie.trim() || undefined,
        isApproved: isApproved === "all" ? undefined : isApproved === "1",
        sortBy,
      });
      setItems(resp.items);
      setTotal(resp.total);
      setState("success");
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Laden");
      setState("error");
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [dSearch, region, kategorie, isApproved, page, limit, sortBy]);

  /* ----------- Delete Flow ----------- */
  function requestDelete(item: KundeResource) {
    setConfirmItem(item);
  }
  async function doConfirmDelete() {
    if (!confirmItem?.id) return;
    setConfirmBusy(true);
    try {
      await deleteKunde(confirmItem.id);
      setConfirmItem(null);
      showToast("success", "Kunde gelöscht");
      // Optimistisch aktualisieren
      setItems(prev => prev.filter(x => x.id !== confirmItem.id));
      setTotal(t => Math.max(0, t - 1));
    } catch (e: any) {
      showToast("error", e?.message ?? "Löschen fehlgeschlagen");
    } finally {
      setConfirmBusy(false);
    }
  }

  /* ----------- UI Helpers ----------- */
  const emptyState = state === "success" && items.length === 0;
  const loadingState = state === "loading";

  // Regionsliste aus Items (für Filter)
  const regionOptions = useMemo(() => {
    const s = new Set<string>();
    items.forEach((k) => k.region && s.add(k.region));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const kategorieOptions = useMemo(() => {
    const s = new Set<string>();
    items.forEach((k) => k.kategorie && s.add(k.kategorie));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="h4 mb-1">Kunden</h2>
          <div className="text-muted small">
            {state === "loading" ? "Lade Kunden…" : `${total} Einträge gesamt`}
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-dark rounded-3" onClick={() => setCreateOpen(true)}>
            <i className="ci-plus me-2" /> Kunde erstellen
          </button>
        </div>
      </div>


      {/* Filters (Cartzilla/Bootstrap form row) */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Suche</label>
              <div className="position-relative">
                <input
                  className="form-control"
                  placeholder="z. B. Müller, 10023, Gastro…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                <span className="position-absolute top-50 end-0 translate-middle-y pe-3 text-muted">
                  <i className="ci-search" />
                </span>
              </div>
            </div>

            <div className="col-md-2">
              <label className="form-label">Region</label>
              <select
                className="form-select"
                value={region}
                onChange={(e) => { setRegion(e.target.value); setPage(1); }}
              >
                <option value="">Alle Regionen</option>
                {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label">Kategorie</label>
              <select
                className="form-select"
                value={kategorie}
                onChange={(e) => { setKategorie(e.target.value); setPage(1); }}
              >
                <option value="">Alle Kategorien</option>
                {kategorieOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={isApproved}
                onChange={(e) => { setIsApproved(e.target.value as any); setPage(1); }}
              >
                <option value="all">Alle</option>
                <option value="1">Freigeschaltet</option>
                <option value="0">Gesperrt</option>
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label">Sortierung</label>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                title="Sortierung"
              >
                <option value="-createdAt">Neueste zuerst</option>
                <option value="createdAt">Älteste zuerst</option>
                <option value="name">Name A–Z</option>
                <option value="-name">Name Z–A</option>
                <option value="region">Region A–Z</option>
                <option value="-region">Region Z–A</option>
                <option value="kategorie">Kategorie A–Z</option>
                <option value="-kategorie">Kategorie Z–A</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table/Card */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Name</th>
                <th>E‑Mail</th>
                <th>Kundennr.</th>
                <th>Region</th>
                <th>Kategorie</th>
                <th>Status</th>
                <th style={{ width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {loadingState && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={7}>
                    <div className="placeholder-glow py-3">
                      <span className="placeholder col-12" style={{ height: 18, display: "block" }}></span>
                    </div>
                  </td>
                </tr>
              ))}
              {state === "error" && (
                <tr>
                  <td colSpan={7} className="py-5">
                    <div className="alert alert-danger mb-0">
                      <i className="ci-close-circle me-2" />
                      {error || "Fehler beim Laden"}
                    </div>
                  </td>
                </tr>
              )}
              {emptyState && (
                <tr>
                  <td colSpan={7} className="py-5 text-center text-muted">
                    Keine Kunden gefunden.
                  </td>
                </tr>
              )}
              {state === "success" && items.map(k => (
                <tr key={k.id} onClick={() => navigate(`/kunden/${k.id}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="ratio ratio-1x1 bg-secondary-subtle rounded-circle" style={{ width: 28 }}>
                      <i className="ci-user text-secondary d-flex align-items-center justify-content-center" />
                    </div>
                  </td>
                  <td className="fw-semibold">{k.name || "—"}</td>
                  <td>{k.email || <span className="text-muted">—</span>}</td>
                  <td>{k.kundenNummer || <span className="text-muted">—</span>}</td>
                  <td>{k.region || <span className="text-muted">—</span>}</td>
                  <td>{k.kategorie || <span className="text-muted">—</span>}</td>
                  <td>
                    {k.isApproved
                      ? <span className="badge bg-success">freigeschaltet</span>
                      : <span className="badge bg-secondary">gesperrt</span>}
                  </td>
                  <td className="text-end">
                    <div className="btn-group">
                      <button className="btn btn-sm btn-outline-secondary" title="Bearbeiten" onClick={(e) => { e.stopPropagation(); setEditItem(k); }}>
                        <i className="ci-edit me-1" /> Bearbeiten
                      </button>
                      <button
                        className={"btn btn-sm " + (k.isApproved ? "btn-outline-warning" : "btn-outline-success")}
                        title={k.isApproved ? "Sperren" : "Freischalten"}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const updated = await approveKunde(k.id!, !k.isApproved);
                            setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
                            showToast("success", updated.isApproved ? "Kunde freigeschaltet" : "Kunde gesperrt");
                          } catch (err: any) {
                            showToast("error", err?.message || "Aktion fehlgeschlagen");
                          }
                        }}
                      >
                        <i className={k.isApproved ? "ci-lock me-1" : "ci-unlock me-1"} /> {k.isApproved ? "Sperren" : "Freischalten"}
                      </button>
                      <button className="btn btn-sm btn-outline-danger" title="Löschen" onClick={(e) => { e.stopPropagation(); requestDelete(k); }}>
                        <i className="ci-trash me-1" /> Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="card-footer d-flex align-items-center justify-content-between">
          <small className="text-muted">Seite {page} / {pages} — {total.toLocaleString()} Einträge</small>
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group">
              <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <i className="ci-arrow-left me-1" /> Zurück
              </button>
              <button className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                Weiter <i className="ci-arrow-right ms-1" />
              </button>
            </div>
            <select className="form-select form-select-sm" style={{ width: 140 }} value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}>
              {[10, 12, 24, 48, 100].map(n => <option key={n} value={n}>{n}/Seite</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {
        confirmItem && (
          <ConfirmModal
            title="Kunde löschen?"
            message={<>
              Möchtest du <strong>„{confirmItem.name || confirmItem.email || confirmItem.kundenNummer}”</strong> wirklich löschen?
              <div className="text-muted small mt-2">Dieser Vorgang kann nicht rückgängig gemacht werden.</div>
            </>}
            confirmText="Ja, löschen"
            onConfirm={doConfirmDelete}
            onCancel={() => { if (!confirmBusy) setConfirmItem(null); }}
            busy={confirmBusy}
          />
        )
      }

      {
        editItem && (
          <EditKundeModal
            initial={editItem}
            onCancel={() => setEditItem(null)}
            onSaved={(upd) => {
              setItems(prev => prev.map(x => x.id === upd.id ? upd : x));
              setEditItem(null);
              showToast("success", "Kunde aktualisiert");
            }}
          />
        )
      }

      {
        createOpen && (
          <CreateKundeModal
            onCancel={() => setCreateOpen(false)}
            onSaved={(created) => {
              setItems(prev => [created, ...prev]);   // oben einfügen
              setTotal(t => t + 1);
              setCreateOpen(false);
              showToast("success", "Kunde erstellt");
            }}
          />
        )
      }

      {/* Toast */}
      {
        toast && (
          <div className={cx(
            "toast align-items-center text-bg-" + (toast.type === "success" ? "success" : "danger"),
            "border-0 position-fixed bottom-0 end-0 m-3 show"
          )} role="alert">
            <div className="d-flex">
              <div className="toast-body">{toast.msg}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} />
            </div>
          </div>
        )
      }
    </div >
  );
};

export default KundenOverview;