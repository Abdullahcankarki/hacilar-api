import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuftragResource, MitarbeiterResource } from "../Resources";
import * as api from "../backend/api";
import { useAuth } from "../providers/Authcontext";

/**
 * Aufträge-Board
 * - Visualisiert alle Aufträge, die gerade "in Bearbeitung" sind, als Board (Kanban-ähnlich)
 * - Lanes nach Kommissionierungs- & Kontroll-Status
 * - CTAs: Übernehmen (Kommissionierung), Kontrollieren (Kontrolle)
 * - Bootstrap + Cartzilla UI
 *
 * Voraussetzungen/Annahmen:
 * - `api.getAllAuftraege(params)` liefert eine Liste von Aufträgen (Array<AuftragResource>)
 * - `api.updateAuftrag(id, patch)` aktualisiert einen Auftrag
 * - Es gibt einen Auth-Context/Hook `useAuth()` der `user` liefert (id, role[]). Falls nicht vorhanden, kannst du
 *   die Zeile mit `useAuth()` gegen deine eigene User-Quelle tauschen oder `user` als Prop injizieren.
 */

// --- Hilfsfunktionen/Typen ---

type KomStatus = "offen" | "gestartet" | "fertig";
type KontrollStatus = "offen" | "geprüft" | "in Kontrolle";

const K_STATUS_BADGE: Record<KomStatus, string> = {
  offen: "bg-secondary",
  gestartet: "bg-info",
  fertig: "bg-success",
};

const KO_STATUS_BADGE: Record<Exclude<KontrollStatus, "in Kontrolle">, string> = {
  offen: "bg-secondary",
  geprüft: "bg-success",
};


const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("de-DE") : "—");

// Zeigt je nach Status den passenden Zeitstempel an
function getFortschrittInfo(a: any): { label: string; iso?: string } {
  const kommi: KomStatus = a.kommissioniertStatus as KomStatus;
  const kontrolle: KontrollStatus = a.kontrolliertStatus as KontrollStatus;

  if (kommi === "gestartet") {
    return { label: "Kommissionierung angefangen", iso: a.kommissioniertStartzeit };
  }
  if (kommi === "fertig" && (kontrolle === "offen" || !a.kontrolliertVon)) {
    return { label: "Kommissioniert am", iso: a.kommissioniertEndzeit };
  }
  if (kontrolle === "in Kontrolle") {
    return { label: "Kommissioniert am", iso: a.kommissioniertEndzeit };
  }
  if (kontrolle === "geprüft") {
    return { label: "Geprüft am", iso: a.kontrolliertZeit || a.kommissioniertEndzeit };
  }
  return { label: "Aktualisiert", iso: a.updatedAt };
}

// --- Komponente ---
export default function AuftraegeBoard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<AuftragResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Auto-Refresh alle 20 Sekunden
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getAlleAuftraegeInBearbeitung();
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : (data || []));
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Fehler beim Laden");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 20000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  // Rollenprüfung (kommissionierung/kontrolle/admin)
  const hasRole = (r: string) => (user?.role || []).map(String).map(x => x.toLowerCase()).includes(r);

  const darfUebernehmen = (auftrag: AuftragResource) => {
    return (
      (hasRole("kommissionierung") || hasRole("admin")) &&
      !auftrag.kommissioniertVon && auftrag.kommissioniertStatus !== "gestartet"
    );
  };

  const darfKontrollieren = (auftrag: AuftragResource) => {
    return (
      (hasRole("kontrolle") || hasRole("admin")) &&
      auftrag.kommissioniertStatus === "fertig" &&
      !auftrag.kontrolliertVon
    );
  };

  const handleUebernehmen = async (auftragId: string) => {
    try {
      setLoadingId(auftragId);
      await api.updateAuftrag(auftragId, {
        kommissioniertStatus: "gestartet",
        kommissioniertVon: (user as any)?.id,
        kommissioniertStartzeit: new Date().toISOString(),
      });
      navigate(`/kommissionierung/${auftragId}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleKontrollieren = async (auftragId: string) => {
    try {
      setLoadingId(auftragId);
      await api.updateAuftrag(auftragId, {
        kontrolliertStatus: "in Kontrolle",
        kontrolliertVon: (user as any)?.id,
      } as any);
      navigate(`/kommissionierung/${auftragId}`);
    } finally {
      setLoadingId(null);
    }
  };

  // Lanes / Spalten
  const lanes = useMemo(() => {
    const readyForPick = items.filter(a => (a.kommissioniertStatus as KomStatus) === "offen");
    const picking = items.filter(a => (a.kommissioniertStatus as KomStatus) === "gestartet");
    const readyForControl = items.filter(a => (a.kommissioniertStatus as KomStatus) === "fertig" && (a.kontrolliertStatus as KontrollStatus) === "offen");
    const inControl = items.filter(a => (a.kontrolliertStatus as KontrollStatus) === "in Kontrolle");
    const done = items.filter(a => (a.kontrolliertStatus as KontrollStatus) === "geprüft");
    return [
      { key: "readyPick", title: "Bereit zur Kommissionierung", hint: "kommissioniert: offen", list: readyForPick },
      { key: "picking", title: "Kommissionierung läuft", hint: "kommissioniert: gestartet", list: picking },
      { key: "readyCtrl", title: "Wartet auf Kontrolle", hint: "kommissioniert: fertig · kontrolliert: offen", list: readyForControl },
      { key: "inCtrl", title: "In Kontrolle", hint: "kontrolliert: in Kontrolle", list: inControl },
      { key: "done", title: "Fertig geprüft", hint: "kontrolliert: geprüft", list: done },
    ];
  }, [items]);

  // --- UI ---
  return (
    <div className="container py-3 py-lg-4">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap">
        <div>
          <h2 className="h4 mb-1">Bearbeitungs-Board</h2>
          <div className="text-muted small">Live-Übersicht aller Aufträge in Bearbeitung</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary" onClick={() => window.location.reload()}>
            <i className="ci-reload me-2" /> Aktualisieren
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center" role="alert">
          <i className="ci-close-circle me-2" /> {error}
        </div>
      )}

      {/* Board */}
      <div className="row g-3">
        {lanes.map((lane) => (
          <div className="col-12 col-md-6 col-xl-4" key={lane.key}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-transparent d-flex align-items-center justify-content-between">
                <div>
                  <div className="fw-semibold">{lane.title}</div>
                  <div className="text-muted small">{lane.hint}</div>
                </div>
                <span className="badge bg-dark-subtle text-dark">{lane.list.length}</span>
              </div>
              <div className="card-body p-2" style={{ minHeight: 120 }}>
                {loading && items.length === 0 ? (
                  <div className="d-flex align-items-center justify-content-center py-4">
                    <div className="spinner-border" role="status" />
                  </div>
                ) : lane.list.length === 0 ? (
                  <div className="text-center text-muted py-4 small">Keine Einträge</div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {lane.list.map((a) => (
                      <div key={a.id} className="card border rounded-3 p-2 hover-shadow position-relative">
                        <div className="d-flex align-items-start justify-content-between">
                          <div className="me-2">
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge bg-secondary">{a.auftragsnummer || "—"}</span>
                              {typeof a.gesamtPaletten === "number" && (
                                <span className="badge bg-outline-secondary border">{a.gesamtPaletten} Pal.</span>
                              )}
                            </div>
                            <div className="fw-semibold mt-1">{a.kundeName || "—"}</div>
                            <div className="text-muted small">Lieferdatum: {a.lieferdatum ? new Date(a.lieferdatum).toLocaleDateString("de-DE") : "—"}</div>
                            <div className="d-flex flex-wrap gap-2 mt-1">
                              <span className={cls("badge", K_STATUS_BADGE[(a.kommissioniertStatus as KomStatus) || "offen"]) }>
                                Kommi: {a.kommissioniertStatus || "—"}
                              </span>
                              <span className={cls("badge", (a.kontrolliertStatus as KontrollStatus) === "in Kontrolle" ? "bg-warning" : KO_STATUS_BADGE[(a.kontrolliertStatus as KontrollStatus) || "offen"]) }>
                                Kontrolle: {a.kontrolliertStatus || "—"}
                              </span>
                            </div>
                            {(a.kommissioniertVonName || a.kontrolliertVonName) && (
                              <div className="text-muted small mt-1">
                                {a.kommissioniertVonName && (<span>Kommissioniert von: {a.kommissioniertVonName}</span>)}
                                {a.kommissioniertVonName && a.kontrolliertVonName && <span className="mx-1">·</span>}
                                {a.kontrolliertVonName && (<span>Kontrolliert von: {a.kontrolliertVonName}</span>)}
                              </div>
                            )}
                          </div>
                          <div className="text-end">
                            {(() => {
                              const info = getFortschrittInfo(a);
                              return (
                                <>
                                  <div className="small text-muted">{info.label}</div>
                                  <div className="small">{fmtDateTime(info.iso)}</div>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="d-flex gap-2 mt-2">
                          {/* CTA: Übernehmen */}
                          {darfUebernehmen(a) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              disabled={loadingId === a.id}
                              onClick={() => handleUebernehmen(a.id!)}
                            >
                              {loadingId === a.id ? "Wird übernommen…" : "Übernehmen"}
                            </button>
                          )}

                          {/* CTA: Kontrollieren */}
                          {darfKontrollieren(a) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-warning"
                              disabled={loadingId === a.id}
                              onClick={() => handleKontrollieren(a.id!)}
                            >
                              {loadingId === a.id ? "Wird geprüft…" : "Kontrollieren"}
                            </button>
                          )}

                          {/* Details */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary ms-auto"
                            onClick={() => navigate(`/kommissionierung/${a.id}`)}
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
