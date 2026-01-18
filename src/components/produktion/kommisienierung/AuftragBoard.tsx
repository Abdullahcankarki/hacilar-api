import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuftragResource, TourResource } from "@/Resources";
import * as api from "@/backend/api";
import { useAuth } from "@/providers/Authcontext";

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


function kommiBadgeClass(kommi?: KomStatus) {
  if (kommi === "fertig") return "bg-success";
  if (kommi === "gestartet") return "bg-secondary";
  return "bg-light text-dark";
}

type TableViewProps = {
  items: AuftragResource[];
  toursMap: Record<string, TourResource>;
  tourInfoMap: Record<string, any>;
  onOpen: (a: AuftragResource) => void;
  onUebernehmen: (auftragId: string) => void;
  darfUebernehmen: (a: AuftragResource) => boolean;
  loadingId: string | null;
};

function TableView({ items, toursMap, tourInfoMap, onOpen, onUebernehmen, darfUebernehmen, loadingId }: TableViewProps) {
  const groups = useMemo(() => {
    const map: Record<string, AuftragResource[]> = {};
    for (const a of items || []) {
      const fallbackTid = a.id ? tourInfoMap?.[String(a.id)]?.tourId : undefined;
      const tid = (a.tourId || fallbackTid) ? String(a.tourId || fallbackTid) : "__NO_TOUR__";
      (map[tid] ||= []).push(a);
    }
    // Sort within group by auftragsnummer (fallback id)
    for (const tid of Object.keys(map)) {
      map[tid].sort((x, y) => String(x.auftragsnummer || x.id || "").localeCompare(String(y.auftragsnummer || y.id || "")));
    }
    // Sort groups: tours first, then no-tour
    const orderedKeys = Object.keys(map).sort((a, b) => {
      if (a === "__NO_TOUR__") return 1;
      if (b === "__NO_TOUR__") return -1;

      const ta = toursMap?.[a];
      const tb = toursMap?.[b];

      const da = ta?.datum ? new Date(String((ta as any).datum)).getTime() : NaN;
      const db = tb?.datum ? new Date(String((tb as any).datum)).getTime() : NaN;

      // zuerst Datum
      if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
      if (Number.isFinite(da) && !Number.isFinite(db)) return -1;
      if (!Number.isFinite(da) && Number.isFinite(db)) return 1;

      // dann Region
      const ra = String((ta as any)?.region || "");
      const rb = String((tb as any)?.region || "");
      if (ra && rb && ra !== rb) return ra.localeCompare(rb);

      // fallback: id
      return a.localeCompare(b);
    });
    return orderedKeys.map((key) => ({
      tourId: key,
      list: map[key],
    }));
  }, [items, toursMap, tourInfoMap]);

  const tourLabel = (tourId: string) => {
    if (tourId === "__NO_TOUR__") return "Ohne Tour";
    const t = toursMap?.[tourId];
    const region = String((t as any)?.region || "").trim();
    return region ? `Tour ${region}` : `Tour ${tourId.slice(-6)}`;
  };
  const tourKennzeichen = (list: AuftragResource[]) => {
    const first = list.find((a) => !!tourInfoMap?.[String(a.id)]?.kennzeichen);
    return first ? String(tourInfoMap[String(first.id)]?.kennzeichen || "") : "";
  };

  const tourKg = (list: AuftragResource[]) => {
    const sum = list.reduce((acc, a) => acc + (typeof a.gewicht === "number" ? a.gewicht : 0), 0);
    return Number.isFinite(sum) && sum > 0 ? sum : 0;
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="p-2">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div>
            <div className="fw-semibold" style={{ fontSize: 13 }}>Aufträge nach Tour</div>
            <div className="text-muted" style={{ fontSize: 12 }}>Kompakte Übersicht</div>
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>{items.length} Aufträge</div>
        </div>

        {/* Touren nebeneinander */}
        <div className="row g-2">
          {groups.map((g) => {
            const list = g.list;
            const plate = tourKennzeichen(list);
            const sumKg = tourKg(list);

            return (
              <div className="col-12 col-md-6 col-xl-4" key={g.tourId}>
                <div className="border rounded-2 bg-white h-100" style={{ overflow: "hidden" }}>
                  <div className="px-2 py-2" style={{ background: "rgba(0,0,0,.03)", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-semibold" style={{ fontSize: 12, lineHeight: 1.2 }}>
                          {tourLabel(g.tourId)}
                          {plate ? <span className="text-muted ms-2" style={{ fontWeight: 600 }}>({plate})</span> : null}
                        </div>
                        <div className="text-muted" style={{ fontSize: 11 }}>
                          {list.length} Aufträge{sumKg ? ` · ${sumKg.toFixed(1)} kg` : ""}
                        </div>
                      </div>
                      <span className="badge bg-light text-dark border" style={{ fontSize: 11 }}>
                        {list.length}
                      </span>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: 110 }}>Auftrag</th>
                          <th>Kunde</th>
                          <th className="text-end" style={{ width: 70 }}>Pal.</th>
                          <th style={{ width: 140 }}>Status</th>
                          <th style={{ width: 44 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((a) => {
                          const kommi = (a.kommissioniertStatus as KomStatus) || "offen";
                          return (
                            <tr
                              key={String(a.id)}
                              style={{ cursor: "pointer" }}
                              onClick={() => onOpen(a)}
                            >
                              <td className="fw-semibold" style={{ fontSize: 12 }}>
                                {a.auftragsnummer || a.id || "—"}
                              </td>
                              <td style={{ fontSize: 12 }}>{a.kundeName || "—"}</td>
                              <td className="text-end" style={{ fontSize: 12 }}>
                                {typeof (a as any).gesamtPaletten === "number" ? (a as any).gesamtPaletten : "—"}
                              </td>
                              <td style={{ paddingTop: 6, paddingBottom: 6 }}>
                                <span
                                  className={cls(
                                    "badge",
                                    kommiBadgeClass(kommi),
                                    "d-block w-100 text-center py-2 fw-semibold rounded-2"
                                  )}
                                  style={{ fontSize: 12, letterSpacing: 0.2 }}
                                >
                                  {kommi}
                                </span>
                              </td>
                              <td className="text-end" style={{ width: 44 }}>
                                {darfUebernehmen(a) ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    title="Übernehmen"
                                    disabled={loadingId === String(a.id)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUebernehmen(String(a.id));
                                    }}
                                    style={{ padding: '0.25rem 0.4rem' }}
                                  >
                                    {loadingId === String(a.id) ? (
                                      <span className="spinner-border spinner-border-sm" role="status" />
                                    ) : (
                                      <i className="ci-check" />
                                    )}
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}

                        {!list.length && (
                          <tr>
                            <td colSpan={5} className="text-center text-muted py-4">—</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}

          {!groups.length && (
            <div className="col-12">
              <div className="text-center text-muted py-4">Keine Aufträge gefunden.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type BoardViewProps = {
  items: AuftragResource[];
  onOpen: (a: AuftragResource) => void;
  onUebernehmen: (id: string) => void;
  onKontrollieren: (id: string) => void;
  darfUebernehmen: (a: AuftragResource) => boolean;
  darfKontrollieren: (a: AuftragResource) => boolean;
  loadingId: string | null;
};

function BoardView({
  items,
  onOpen,
  onUebernehmen,
  onKontrollieren,
  darfUebernehmen,
  darfKontrollieren,
  loadingId,
}: BoardViewProps) {
  const lanes = useMemo(() => {
    const offen = items.filter((a) => (a.kommissioniertStatus as KomStatus) !== "gestartet" && (a.kommissioniertStatus as KomStatus) !== "fertig");
    const gestartet = items.filter((a) => (a.kommissioniertStatus as KomStatus) === "gestartet");
    const fertig = items.filter((a) => (a.kommissioniertStatus as KomStatus) === "fertig" && ((a.kontrolliertStatus as KontrollStatus) === "offen" || !a.kontrolliertVon));
    const inKontrolle = items.filter((a) => (a.kontrolliertStatus as KontrollStatus) === "in Kontrolle");
    const geprueft = items.filter((a) => (a.kontrolliertStatus as KontrollStatus) === "geprüft");

    return [
      { key: "offen", title: "Offen", hint: "noch nicht gestartet", items: offen },
      { key: "gestartet", title: "Gestartet", hint: "Kommissionierung läuft", items: gestartet },
      { key: "fertig", title: "Fertig", hint: "bereit für Kontrolle", items: fertig },
      { key: "inkontrolle", title: "In Kontrolle", hint: "Kontrolle läuft", items: inKontrolle },
      { key: "geprueft", title: "Geprüft", hint: "abgeschlossen", items: geprueft },
    ];
  }, [items]);

  return (
    <div className="row g-3">
      {lanes.map((lane) => (
        <div className="col-12 col-md-6 col-xl" key={lane.key}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-light py-2">
              <div className="d-flex align-items-baseline justify-content-between">
                <div className="fw-semibold" style={{ fontSize: 12 }}>{lane.title}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>{lane.items.length}</div>
              </div>
              <div className="text-muted" style={{ fontSize: 11 }}>{lane.hint}</div>
            </div>
            <div className="card-body p-2" style={{ maxHeight: 650, overflow: "auto" }}>
              {lane.items.length ? (
                <div className="d-flex flex-column gap-2">
                  {lane.items.map((a) => {
                    const kommi = (a.kommissioniertStatus as KomStatus) || "offen";
                    const fort = getFortschrittInfo(a as any);
                    const isLoading = loadingId === String(a.id);

                    return (
                      <div
                        key={String(a.id)}
                        className="border rounded-2 p-2"
                      >
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <div style={{ minWidth: 0 }}>
                            <div className="fw-semibold" style={{ fontSize: 12, lineHeight: 1.2 }}>
                              {a.auftragsnummer || a.id}
                            </div>
                            <div className="text-muted" style={{ fontSize: 11 }}>
                              {a.kundeName || "—"}
                              {typeof a.gewicht === "number" ? ` · ${a.gewicht.toFixed(1)} kg` : ""}
                            </div>
                          </div>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => onOpen(a)}
                            title="Öffnen"
                          >
                            <i className="ci-arrow-right" />
                          </button>
                        </div>

                        <div className="d-flex align-items-center justify-content-between mt-2">
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            {fort.label}: {fmtDateTime(fort.iso)}
                          </div>
                          <span className={cls("badge", kommi === "fertig" ? "bg-success" : kommi === "gestartet" ? "bg-secondary" : "bg-light text-dark border")}>
                            {kommi}
                          </span>
                        </div>

                        {(darfUebernehmen(a) || darfKontrollieren(a)) && (
                          <div className="d-flex gap-2 mt-2">
                            {darfUebernehmen(a) && (
                              <button
                                className="btn btn-sm btn-primary flex-grow-1"
                                disabled={isLoading}
                                onClick={() => onUebernehmen(String(a.id))}
                              >
                                {isLoading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="ci-check me-2" />}
                                Übernehmen
                              </button>
                            )}
                            {darfKontrollieren(a) && (
                              <button
                                className="btn btn-sm btn-warning flex-grow-1"
                                disabled={isLoading}
                                onClick={() => onKontrollieren(String(a.id))}
                              >
                                {isLoading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="ci-eye me-2" />}
                                Kontrollieren
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted" style={{ fontSize: 12 }}>—</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Komponente ---
export default function AuftraegeBoard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<AuftragResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showBelade, setShowBelade] = useState(false);
  const [selectedAuftrag, setSelectedAuftrag] = useState<AuftragResource | null>(null);
  const [tourInfos, setTourInfos] = useState<any | null>(null);
  const [tourInfoMap, setTourInfoMap] = useState<Record<string, any>>({});
  const [toursMap, setToursMap] = useState<Record<string, TourResource>>({});
  const [viewMode, setViewMode] = useState<"table" | "board">("table");

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
        // 1) Tourinfos pro Auftrag (für Fallback tourId/Kennzeichen/Reihenfolge)
        let tourInfosMap: Record<string, any> = {};
        try {
          const arr = Array.isArray(data) ? data : (data || []);
          const ids = arr.map((x: any) => x?.id).filter(Boolean);
          if (ids.length) {
            tourInfosMap = (await api.getTourInfosForAuftraege(ids)) || {};
            if (mounted) setTourInfoMap(tourInfosMap);
          } else {
            if (mounted) setTourInfoMap({});
          }
        } catch {
          // Tourinfos sind optional – UI funktioniert auch ohne
          tourInfosMap = {};
          if (mounted) setTourInfoMap({});
        }

        // 2) TourIds aus Auftrag.tourId ODER aus tourInfoMap-Fallback ermitteln
        try {
          const arr = Array.isArray(data) ? data : (data || []);
          const tourIds = Array.from(
            new Set(
              arr
                .map((x: any) => x?.tourId || (x?.id ? tourInfosMap?.[String(x.id)]?.tourId : undefined))
                .filter(Boolean)
                .map((x: any) => String(x))
            )
          );

          if (tourIds.length) {
            const tours = await api.getToursByIds(tourIds);
            const map: Record<string, TourResource> = {};
            for (const t of (tours || [])) {
              if (t?.id) map[String(t.id)] = t;
            }
            if (mounted) setToursMap(map);
          } else {
            if (mounted) setToursMap({});
          }
        } catch {
          if (mounted) setToursMap({});
        }
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

  // --- UI ---
  return (
    <div className="container py-3 py-lg-4">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap">
        <div>
          <h2 className="h4 mb-1">Bearbeitungs-Board</h2>
          <div className="text-muted small">Live-Übersicht aller Aufträge in Bearbeitung</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="btn-group" role="group" aria-label="Ansicht">
            <button
              className={cls("btn", viewMode === "table" ? "btn-dark" : "btn-outline-dark")}
              onClick={() => setViewMode("table")}
              title="Tour-Tabellenansicht"
            >
              <i className="ci-list me-2" /> Touren
            </button>
            <button
              className={cls("btn", viewMode === "board" ? "btn-dark" : "btn-outline-dark")}
              onClick={() => setViewMode("board")}
              title="Boardansicht"
            >
              <i className="ci-layout-grid me-2" /> Board
            </button>
          </div>

          <button className="btn btn-outline-secondary" onClick={() => window.location.reload()}>
            <i className="ci-corner-down-left me-2" /> Aktualisieren
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center" role="alert">
          <i className="ci-close-circle me-2" /> {error}
        </div>
      )}

      {/* Ansicht */}
      {loading && items.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="p-4 d-flex align-items-center justify-content-center">
            <div className="spinner-border" role="status" />
          </div>
        </div>
      ) : viewMode === "table" ? (
        <TableView
          items={items}
          toursMap={toursMap}
          tourInfoMap={tourInfoMap}
          onOpen={(a) => navigate(`/kommissionierung/${a.id}`)}
          onUebernehmen={handleUebernehmen}
          darfUebernehmen={darfUebernehmen}
          loadingId={loadingId}
        />
      ) : (
        <BoardView
          items={items}
          onOpen={(a) => navigate(`/kommissionierung/${a.id}`)}
          onUebernehmen={handleUebernehmen}
          onKontrollieren={handleKontrollieren}
          darfUebernehmen={darfUebernehmen}
          darfKontrollieren={darfKontrollieren}
          loadingId={loadingId}
        />
      )}

      {showBelade && selectedAuftrag && (
        <div className="modal fade show d-block" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Beladeinfos Auftrag {selectedAuftrag.auftragsnummer}</h5>
                <button type="button" className="btn-close" onClick={() => setShowBelade(false)} />
              </div>
              <div className="modal-body">
                <p><strong>Reihenfolge:</strong> {tourInfos?.reihenfolge ?? "nicht bekannt"}</p>
                <p><strong>Fahrzeug-Kennzeichen:</strong> {tourInfos?.kennzeichen ?? "nicht bekannt"}</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBelade(false)}>Schließen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
