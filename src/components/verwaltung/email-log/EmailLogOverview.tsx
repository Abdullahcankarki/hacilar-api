import React, { useEffect, useState } from "react";
import { getGlobalEmailLogs, downloadEmailLogPdf } from "@/backend/api";
import { GlobalEmailLogResource } from "@/Resources";

type FetchState = "idle" | "loading" | "success" | "error";
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const typLabels: Record<string, string> = {
  auftragsbestaetigung: "Auftragsbestätigung",
  fehlmengen: "Fehlmengen",
  lieferschein: "Lieferschein",
  angebot: "Angebot",
};

const typBadge: Record<string, string> = {
  auftragsbestaetigung: "bg-primary",
  fehlmengen: "bg-warning text-dark",
  lieferschein: "bg-info text-dark",
  angebot: "bg-success",
};

async function downloadPdf(logId: string, filename?: string) {
  const result = await downloadEmailLogPdf(logId);
  if (!result || !result.base64) return;

  // Base64 → Binary → Blob → Download
  const byteChars = atob(result.base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename || filename || "beleg.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function EmailLogOverview() {
  const [items, setItems] = useState<GlobalEmailLogResource[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<FetchState>("idle");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Filter
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search, 350);
  const [typFilter, setTypFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("loading");
      try {
        const res = await getGlobalEmailLogs({
          page,
          limit,
          typ: typFilter || undefined,
          status: statusFilter || undefined,
          search: dSearch || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        });
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setState("success");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [page, limit, dSearch, typFilter, statusFilter, dateFrom, dateTo]);

  const pages = Math.ceil(total / limit) || 1;

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-0">E-Mail-Protokoll</h4>
          <div className="text-muted small">Alle versendeten E-Mails auf einen Blick.</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label small text-muted">Suche</label>
              <input
                className="form-control"
                placeholder="Empfänger, Kunde, Auftrag…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted">Typ</label>
              <select className="form-select" value={typFilter} onChange={(e) => { setTypFilter(e.target.value); setPage(1); }}>
                <option value="">Alle</option>
                <option value="auftragsbestaetigung">Auftragsbestätigung</option>
                <option value="fehlmengen">Fehlmengen</option>
                <option value="lieferschein">Lieferschein</option>
                <option value="angebot">Angebot</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted">Status</label>
              <select className="form-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">Alle</option>
                <option value="gesendet">Gesendet</option>
                <option value="fehlgeschlagen">Fehlgeschlagen</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted">Von</label>
              <input type="date" className="form-control" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted">Bis</label>
              <input type="date" className="form-control" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </div>
            <div className="col-md-1 d-flex align-items-end">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => { setSearch(""); setTypFilter(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); setPage(1); }}
                title="Filter zurücksetzen"
              >
                <i className="ci-close" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 160 }}>Datum</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 160 }}>Typ</th>
                <th>Empfänger</th>
                <th>Kunde</th>
                <th style={{ width: 130 }}>Auftrag-Nr.</th>
                <th>Betreff</th>
                <th style={{ width: 70 }} className="text-center">Beleg</th>
              </tr>
            </thead>
            <tbody>
              {state === "loading" && items.length === 0 && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}><span className="placeholder-glow"><span className="placeholder col-8" /></span></td>
                    ))}
                  </tr>
                ))
              )}
              {state === "success" && items.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted py-4">Keine E-Mail-Logs gefunden.</td></tr>
              )}
              {state === "error" && (
                <tr><td colSpan={8} className="text-center text-danger py-4">Fehler beim Laden der Daten.</td></tr>
              )}
              {items.map((log) => (
                <tr key={log.id}>
                  <td className="small">
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleString("de-DE", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "–"}
                  </td>
                  <td>
                    <span className={cx("badge", log.status === "gesendet" ? "bg-success" : "bg-danger")}>
                      {log.status === "gesendet" ? "Gesendet" : "Fehler"}
                    </span>
                  </td>
                  <td>
                    <span className={cx("badge", typBadge[log.typ] || "bg-secondary")}>
                      {typLabels[log.typ] || log.typ}
                    </span>
                  </td>
                  <td className="small">{log.empfaenger?.join(", ") || "–"}</td>
                  <td className="small">{log.kundenName || "–"}</td>
                  <td className="small fw-semibold">{log.auftragNummer || "–"}</td>
                  <td className="small text-truncate" style={{ maxWidth: 250 }} title={log.betreff}>
                    {log.betreff || "–"}
                  </td>
                  <td className="text-center">
                    {log.hasPdf ? (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        title={`${log.pdfFilename || "PDF"} herunterladen`}
                        onClick={() => downloadPdf(log.id!, log.pdfFilename)}
                      >
                        <i className="ci-download" />
                      </button>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="card-footer d-flex justify-content-between align-items-center">
          <div className="small text-muted">
            {total} Einträge · Seite {page} von {pages}
          </div>
          <div className="d-flex gap-2 align-items-center">
            <select
              className="form-select form-select-sm"
              style={{ width: 80 }}
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <i className="ci-arrow-left" />
            </button>
            <button className="btn btn-sm btn-outline-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              <i className="ci-arrow-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
