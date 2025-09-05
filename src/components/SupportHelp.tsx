import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * SupportHelp.tsx — Cartzilla x Bootstrap styled Help & Support hub
 *
 * Features
 * - Searchable FAQ (accordion), category chips, and quick links
 * - Polished contact form (to info@hacilar.eu by default) with validation
 * - Success/Error Toasts, Loading state, and optional file attachment
 * - Accessible markup (labels, aria-controls, live regions)
 * - Drop-in: minimal dependencies (Bootstrap 5 CSS/JS expected globally)
 *
 * Usage
 * <SupportHelp
 *   faqs={[{ id: 'acc1', category: 'Bestellungen', q: 'Wie storniere ich eine Bestellung?', a: '…' }]} 
 *   onSubmit={async (payload) => api.sendTicket(payload)}
 * />
 */

export type FaqItem = {
  id: string;
  category: string;
  q: string;
  a: string | React.ReactNode;
  updatedAt?: string; // ISO date
};

export type SupportPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: string;
  orderNumber?: string;
  attachment?: File | null;
};

export type SupportHelpProps = {
  faqs?: FaqItem[];
  onSubmit?: (payload: SupportPayload) => Promise<void>; // optional custom handler
  brandColorHex?: string; // default #3edbb7
};

const BRAND_DEFAULT = "#3edbb7"; // Minzgrün (project branding)

const categoriesFromFaqs = (faqs: FaqItem[] = []) => {
  const set = new Set<string>();
  faqs.forEach((f) => set.add(f.category));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;

const SupportHelp: React.FC<SupportHelpProps> = ({ faqs = DEFAULT_FAQS, onSubmit, brandColorHex = BRAND_DEFAULT }) => {
  const navigate = useNavigate();
  const [activeCat, setActiveCat] = useState<string>("Alle");
  const [query, setQuery] = useState("");

  // Form state
  const [form, setForm] = useState<SupportPayload>({
    name: "",
    email: "",
    subject: "",
    message: "",
    category: "Allgemein",
    orderNumber: "",
    attachment: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const cats = useMemo(() => ["Alle", ...categoriesFromFaqs(faqs)], [faqs]);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((f) => {
      const matchCat = activeCat === "Alle" || f.category === activeCat;
      const hay = `${f.q} ${typeof f.a === 'string' ? f.a : ''} ${f.category}`.toLowerCase();
      const matchQuery = q === "" || hay.includes(q);
      return matchCat && matchQuery;
    });
  }, [faqs, activeCat, query]);

  const valid = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Pflichtfeld";
    if (!emailRegex.test(form.email)) errs.email = "Ungültige E‑Mail";
    if (!form.subject.trim()) errs.subject = "Pflichtfeld";
    if (!form.message.trim()) errs.message = "Pflichtfeld";
    return { ok: Object.keys(errs).length === 0, errs } as const;
  }, [form]);

  const resetToastLater = () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid.ok) {
      setToast({ type: "error", msg: "Bitte prüfe die rot markierten Felder." });
      resetToastLater();
      return;
    }

    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(form);
      } else {
        // Fallback: open mailto draft (keine Hintergrund-Requests nötig)
        const body = encodeURIComponent(
          `Kategorie: ${form.category}\nBestellnummer: ${form.orderNumber || '-'}\n\n${form.message}\n\n— ${form.name}`
        );
        const subject = encodeURIComponent(form.subject);
        window.location.href = `mailto:info@hacilar.eu?subject=${subject}&body=${body}`;
      }
      setToast({ type: "success", msg: "Nachricht gesendet. Wir melden uns zeitnah!" });
      setForm({ name: "", email: "", subject: "", message: "", category: "Allgemein", orderNumber: "", attachment: null });
    } catch (err) {
      console.error(err);
      setToast({ type: "error", msg: "Senden fehlgeschlagen. Bitte später erneut versuchen." });
    } finally {
      setSubmitting(false);
      resetToastLater();
    }
  };

  return (
    <div className="container py-4 py-lg-5" style={{ maxWidth: 1200 }}>
      {/* Inline style token for brand color to keep CSS scoped */}
      <style>{`
        .cz-brand { color: ${brandColorHex}; }
        .cz-bg { background: ${brandColorHex}; }
        .cz-btn-brand { background: ${brandColorHex}; border-color: ${brandColorHex}; }
        .cz-btn-brand:hover { filter: brightness(0.92); }
        .cz-chip { border: 1px solid #e5e7eb; }
        .cz-chip.active, .cz-chip:hover { border-color: ${brandColorHex}; color: #0f172a; box-shadow: 0 1px 0 rgba(16,24,40,.04), 0 1px 2px rgba(16,24,40,.06); }
        .cz-card { border-radius: 1rem; }
        .cz-section-title { font-weight: 700; letter-spacing: .2px; }
        .cz-input.is-invalid { border-color: #dc3545; }
        .cz-badge { background: rgba(62,219,183,.15); color: #0f766e; }
      `}</style>

      {/* Header */}
      <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-3 mb-4">
        <div>
          <div className="mb-2">
            <button
              type="button"
              className="btn btn-link p-0 text-decoration-none d-inline-flex align-items-center"
              onClick={() => navigate('/login')}
            >
              <BackIcon className="me-1" /> Zum Login
            </button>
          </div>
          <h1 className="h3 mb-1 cz-section-title">Hilfe & Support</h1>
          <p className="text-muted mb-0">Finde Antworten – oder kontaktiere uns direkt. Wir sind für dich da.</p>
        </div>
        <div className="ms-lg-auto w-100 w-lg-auto" style={{ maxWidth: 420 }}>
          <div className="input-group">
            <span className="input-group-text bg-white"><SearchIcon /></span>
            <input
              className="form-control"
              placeholder="Suche in FAQs (z. B. Rechnung, Lieferung, Konto)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="FAQ durchsuchen"
            />
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="row g-4">
        {/* Left: FAQ & categories */}
        <div className="col-12 col-lg-7">
          <div className="card shadow-sm cz-card">
            <div className="card-body p-3 p-lg-4">
              <div className="d-flex flex-wrap gap-2 mb-3">
                {cats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`btn btn-sm bg-white cz-chip ${activeCat === c ? 'active' : ''}`}
                    onClick={() => setActiveCat(c)}
                    aria-pressed={activeCat === c}
                    aria-label={`Kategorie ${c}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="d-flex align-items-center justify-content-between mb-2">
                <h2 className="h6 mb-0">Häufige Fragen</h2>
                <span className="badge rounded-pill cz-badge">{filteredFaqs.length} Ergebnisse</span>
              </div>

              <div className="accordion" id="faqAccordion">
                {filteredFaqs.map((f, idx) => {
                  const headingId = `faq-h-${f.id}`;
                  const collapseId = `faq-c-${f.id}`;
                  return (
                    <div className="accordion-item" key={f.id}>
                      <h2 className="accordion-header" id={headingId}>
                        <button className={`accordion-button ${idx !== 0 ? 'collapsed' : ''}`} type="button" data-bs-toggle="collapse" data-bs-target={`#${collapseId}`} aria-expanded={idx === 0} aria-controls={collapseId}>
                          <span className="me-2 badge bg-light text-dark border">{f.category}</span>
                          {f.q}
                        </button>
                      </h2>
                      <div id={collapseId} className={`accordion-collapse collapse ${idx === 0 ? 'show' : ''}`} aria-labelledby={headingId} data-bs-parent="#faqAccordion">
                        <div className="accordion-body">
                          {typeof f.a === 'string' ? <p className="mb-2">{f.a}</p> : f.a}
                          {f.updatedAt && (
                            <small className="text-muted">Aktualisiert am {new Date(f.updatedAt).toLocaleDateString()}</small>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredFaqs.length === 0 && (
                  <div className="text-center py-4">
                    <p className="mb-1">Keine passenden Antworten gefunden.</p>
                    <button className="btn btn-sm cz-btn-brand text-white" onClick={() => document.getElementById('support-form')?.scrollIntoView({ behavior: 'smooth' })}>
                      Frage an den Support senden
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Contact card */}
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm cz-card mb-4">
            <div className="card-body p-3 p-lg-4">
              <h2 className="h6 mb-3">Kontakt aufnehmen</h2>
              <ul className="list-unstyled small text-muted mb-3">
                <li className="mb-1"><strong>E-Mail:</strong> <a href="mailto:info@hacilar.eu">info@hacilar.eu</a></li>
                <li className="mb-1"><strong>Support-Zeiten:</strong> Mo–Fr, 09:00–17:00 (CET)</li>
                <li className="mb-0"><strong>Antwortzeit:</strong> i. d. R. innerhalb eines Werktags</li>
              </ul>

              <form id="support-form" noValidate onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-12 col-sm-6">
                    <div className="form-floating">
                      <input
                        type="text"
                        className={`form-control cz-input ${!form.name && toast?.type === 'error' ? 'is-invalid' : ''}`}
                        id="sfName"
                        placeholder="Ihr Name"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        required
                      />
                      <label htmlFor="sfName">Name *</label>
                    </div>
                  </div>
                  <div className="col-12 col-sm-6">
                    <div className="form-floating">
                      <input
                        type="email"
                        className={`form-control cz-input ${(!emailRegex.test(form.email) && toast?.type === 'error') ? 'is-invalid' : ''}`}
                        id="sfEmail"
                        placeholder="name@firma.de"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        required
                      />
                      <label htmlFor="sfEmail">E‑Mail *</label>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6">
                    <div className="form-floating">
                      <select
                        id="sfCategory"
                        className="form-select"
                        value={form.category}
                        onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      >
                        {cats.filter((c) => c !== 'Alle').map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="Allgemein">Allgemein</option>
                      </select>
                      <label htmlFor="sfCategory">Kategorie</label>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6">
                    <div className="form-floating">
                      <input
                        type="text"
                        className="form-control"
                        id="sfOrder"
                        placeholder="Bestellnummer (optional)"
                        value={form.orderNumber}
                        onChange={(e) => setForm((p) => ({ ...p, orderNumber: e.target.value }))}
                      />
                      <label htmlFor="sfOrder">Bestellnummer (optional)</label>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="form-floating">
                      <input
                        type="text"
                        className={`form-control cz-input ${!form.subject && toast?.type === 'error' ? 'is-invalid' : ''}`}
                        id="sfSubject"
                        placeholder="Betreff"
                        value={form.subject}
                        onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                        required
                      />
                      <label htmlFor="sfSubject">Betreff *</label>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="form-floating">
                      <textarea
                        className={`form-control cz-input ${!form.message && toast?.type === 'error' ? 'is-invalid' : ''}`}
                        placeholder="Ihre Nachricht"
                        id="sfMessage"
                        style={{ height: 140 }}
                        value={form.message}
                        onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                        required
                      />
                      <label htmlFor="sfMessage">Nachricht *</label>
                    </div>
                  </div>

                  <div className="col-12">
                    <label htmlFor="sfFile" className="form-label small text-muted">Anhang (optional)</label>
                    <input
                      className="form-control"
                      type="file"
                      id="sfFile"
                      onChange={(e) => setForm((p) => ({ ...p, attachment: e.target.files?.[0] || null }))}
                    />
                    <div className="form-text">Z. B. Screenshot oder PDF (max. 10 MB).</div>
                  </div>

                  <div className="col-12 d-grid d-sm-flex gap-2 mt-1">
                    <button type="submit" className="btn cz-btn-brand text-white px-4" disabled={submitting}>
                      {submitting ? (
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      ) : (
                        <SendIcon className="me-2" />
                      )}
                      Absenden
                    </button>
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setForm({ name: "", email: "", subject: "", message: "", category: "Allgemein", orderNumber: "", attachment: null })}>
                      Zurücksetzen
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Quick links / tips */}
          <div className="card shadow-sm cz-card">
            <div className="card-body p-3 p-lg-4">
              <h2 className="h6 mb-3">Schnellzugriff</h2>
              <div className="list-group list-group-flush">
                <a className="list-group-item list-group-item-action d-flex align-items-center" href="#" onClick={(e) => e.preventDefault()}>
                  <DocIcon className="me-2" /> Handbuch & Leitfäden (PDF)
                </a>
                <a className="list-group-item list-group-item-action d-flex align-items-center" href="#" onClick={(e) => e.preventDefault()}>
                  <StatusIcon className="me-2" /> Systemstatus & Wartungen
                </a>
                <a className="list-group-item list-group-item-action d-flex align-items-center" href="#" onClick={(e) => e.preventDefault()}>
                  <ChatIcon className="me-2" /> Feature anfragen
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }} aria-live="assertive" aria-atomic="true">
        {toast && (
          <div className={`toast show align-items-center text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
            <div className="d-flex">
              <div className="toast-body">{toast.msg}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" aria-label="Close" onClick={() => setToast(null)}></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ——— Icons (inline SVG, Cartzilla-friendly) ———
const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    <path d="M21 21l-3.8-3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="10.5" cy="10.5" r="7.5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const SendIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
  </svg>
);

const BackIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DocIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" />
    <path d="M8 13h8M8 17h8M8 9h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const StatusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    <path d="M4 14l4 4L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChatIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M7 8h10M7 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ——— Demo data ———
const DEFAULT_FAQS: FaqItem[] = [
  {
    id: "faq-1",
    category: "Bestellungen",
    q: "Wie storniere ich eine Bestellung?",
    a: "Sende uns die Auftragsnummer und den Stornowunsch. Wenn noch nicht kommissioniert, stornieren wir umgehend.",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "faq-2",
    category: "Lieferung",
    q: "Wann wird meine Lieferung zugestellt?",
    a: "In der Regel am gewählten Liefertag zwischen 08–16 Uhr. Abweichungen teilen wir per E‑Mail mit.",
  },
  {
    id: "faq-3",
    category: "Rechnung",
    q: "Wo finde ich meine Rechnungen?",
    a: "Im Kundenkonto unter ›Rechnungen‹. Auf Wunsch senden wir sie auch per E‑Mail zu.",
  },
  {
    id: "faq-4",
    category: "Konto",
    q: "Wie ändere ich mein Passwort?",
    a: "Im Profilbereich ›Sicherheit‹ kannst du dein Passwort jederzeit ändern.",
  },
];

export default SupportHelp;
