import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  getAllGefluegelLieferanten,
  getAllGefluegelZerleger,
  getGefluegelEintraegeRange,
} from "../../backend/api";
import {
  GefluegelLieferantResource,
  GefluegelZerlegerResource,
  GefluegelEintragResource,
} from "../../Resources";

type Mode = "woche" | "monat";

interface Props {
  mode: Mode;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Samstag der Woche (Sa–Fr) */
function getSaturday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=So,1=Mo,...,6=Sa
  // Wir wollen den Samstag VOR oder gleich dem aktuellen Tag
  const diff = day >= 6 ? 0 : -(day + 1); // Sa=0 zurück, So=-1, Mo=-2, ...Fr=-6
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function getWeekNumber(d: Date): number {
  const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function calcProzent(kisten: number, kg: number, kistenGewichtKg: number): number | null {
  if (!kisten || kisten === 0) return null;
  return kg / (kisten * kistenGewichtKg);
}

function calcEkNachZerlegung(
  kisten: number,
  kg: number,
  ekProKg: number,
  zerlegungskostenProKiste: number,
  kistenGewichtKg: number
): number | null {
  if (!kg || kg === 0) return null;
  return (kisten * kistenGewichtKg * ekProKg + kisten * zerlegungskostenProKiste) / kg;
}

export default function GefluegelStatistik({ mode }: Props) {
  const [lieferanten, setLieferanten] = useState<GefluegelLieferantResource[]>([]);
  const [zerleger, setZerleger] = useState<GefluegelZerlegerResource[]>([]);
  const [eintraege, setEintraege] = useState<GefluegelEintragResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [vkDurchschnitt, setVkDurchschnitt] = useState(3.3);

  // Verlustanalyse Modal
  const [showVerlust, setShowVerlust] = useState(false);
  const [vaLieferantId, setVaLieferantId] = useState("");
  const [vaProzent, setVaProzent] = useState("68");
  const [vaVkNetto, setVaVkNetto] = useState("3.30");

  // Referenzdatum für Navigation
  const [refDate, setRefDate] = useState(() => new Date());

  const { von, bis, label } = useMemo(() => {
    if (mode === "woche") {
      const saturday = getSaturday(refDate);
      const friday = new Date(saturday);
      friday.setDate(saturday.getDate() + 6);
      const kw = getWeekNumber(saturday);
      return {
        von: formatDate(saturday),
        bis: formatDate(friday),
        label: `KW ${kw} / ${saturday.getFullYear()}  (${saturday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} – ${friday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })})`,
      };
    } else {
      const year = refDate.getFullYear();
      const month = refDate.getMonth();
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      const monthName = first.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      return {
        von: formatDate(first),
        bis: formatDate(last),
        label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      };
    }
  }, [mode, refDate]);

  const navigate = useCallback(
    (dir: number) => {
      setRefDate((prev) => {
        const d = new Date(prev);
        if (mode === "woche") {
          d.setDate(d.getDate() + dir * 7);
        } else {
          d.setMonth(d.getMonth() + dir);
        }
        return d;
      });
    },
    [mode]
  );

  const goToday = () => setRefDate(new Date());

  // Reset refDate when mode changes
  useEffect(() => {
    setRefDate(new Date());
  }, [mode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lief, zerl, eint] = await Promise.all([
        getAllGefluegelLieferanten(),
        getAllGefluegelZerleger(),
        getGefluegelEintraegeRange(von, bis),
      ]);
      setLieferanten(lief);
      setZerleger(zerl);
      setEintraege(eint);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [von, bis]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Im Wochenmodus: Sonntag ausschließen
  const filteredEintraege = useMemo(() => {
    if (mode !== "woche") return eintraege;
    return eintraege.filter((e) => {
      const d = new Date(e.datum + "T00:00:00");
      return d.getDay() !== 0; // 0 = Sonntag
    });
  }, [eintraege, mode]);

  const sonntagEintraege = useMemo(() => {
    if (mode !== "woche") return [];
    return eintraege.filter((e) => {
      const d = new Date(e.datum + "T00:00:00");
      return d.getDay() === 0;
    });
  }, [eintraege, mode]);

  const sonntagSummen = useMemo(() => {
    let kisten = 0, kg = 0;
    const perZerleger: Record<string, { name: string; kisten: number; kg: number }> = {};
    for (const e of sonntagEintraege) {
      kisten += e.kisten;
      kg += e.kg;
      if (!perZerleger[e.zerlegerId]) {
        perZerleger[e.zerlegerId] = { name: e.zerlegerName, kisten: 0, kg: 0 };
      }
      perZerleger[e.zerlegerId].kisten += e.kisten;
      perZerleger[e.zerlegerId].kg += e.kg;
    }
    return { kisten, kg, perZerleger };
  }, [sonntagEintraege]);

  const activeLieferanten = useMemo(
    () => lieferanten.filter((l) => l.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge),
    [lieferanten]
  );

  const activeZerleger = useMemo(
    () => zerleger.filter((z) => z.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name)),
    [zerleger]
  );

  // Summen pro Lieferant
  const lieferantSummen = useMemo(() => {
    const sums: Record<string, { kisten: number; kg: number }> = {};
    for (const l of activeLieferanten) sums[l.id!] = { kisten: 0, kg: 0 };
    for (const e of filteredEintraege) {
      if (sums[e.lieferantId]) {
        sums[e.lieferantId].kisten += e.kisten;
        sums[e.lieferantId].kg += e.kg;
      }
    }
    return sums;
  }, [filteredEintraege, activeLieferanten]);

  // Summen pro Zerleger (gesamt + pro Lieferant)
  const zerlegerSummen = useMemo(() => {
    const sums: Record<string, { total: { kisten: number; kg: number }; perLief: Record<string, { kisten: number; kg: number }> }> = {};
    for (const z of activeZerleger) {
      sums[z.id!] = {
        total: { kisten: 0, kg: 0 },
        perLief: {},
      };
      for (const l of activeLieferanten) {
        sums[z.id!].perLief[l.id!] = { kisten: 0, kg: 0 };
      }
    }
    for (const e of filteredEintraege) {
      if (sums[e.zerlegerId]) {
        sums[e.zerlegerId].total.kisten += e.kisten;
        sums[e.zerlegerId].total.kg += e.kg;
        if (sums[e.zerlegerId].perLief[e.lieferantId]) {
          sums[e.zerlegerId].perLief[e.lieferantId].kisten += e.kisten;
          sums[e.zerlegerId].perLief[e.lieferantId].kg += e.kg;
        }
      }
    }
    return sums;
  }, [filteredEintraege, activeZerleger, activeLieferanten]);

  // Gesamt über alles
  const gesamtKisten = useMemo(() => filteredEintraege.reduce((s, e) => s + e.kisten, 0), [filteredEintraege]);
  const gesamtKg = useMemo(() => filteredEintraege.reduce((s, e) => s + e.kg, 0), [filteredEintraege]);

  // Tage mit Einträgen
  const tageCount = useMemo(() => {
    const dates = new Set(filteredEintraege.map((e) => e.datum));
    return dates.size;
  }, [filteredEintraege]);

  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );

  return (
    <div>
      {/* Navigation */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => navigate(-1)}>
          <i className="bi bi-chevron-left" />
        </button>
        <span className="fw-semibold">{label}</span>
        <button className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => navigate(1)}>
          <i className="bi bi-chevron-right" />
        </button>
        <button className="btn btn-outline-dark btn-sm rounded-3 ms-2" onClick={goToday}>
          {mode === "woche" ? "Diese Woche" : "Dieser Monat"}
        </button>
        <button
          className="btn btn-outline-danger btn-sm rounded-3 ms-auto"
          onClick={() => setShowVerlust(true)}
        >
          Verlustanalyse
        </button>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body text-center">
              <div className="text-muted small">Tage mit Einträgen</div>
              <div className="fs-4 fw-bold">{tageCount}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body text-center">
              <div className="text-muted small">Gesamt Kisten</div>
              <div className="fs-4 fw-bold">{gesamtKisten}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body text-center">
              <div className="text-muted small">Gesamt Kg</div>
              <div className="fs-4 fw-bold">{gesamtKg.toFixed(1)}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body text-center">
              <div className="text-muted small">Einträge</div>
              <div className="fs-4 fw-bold">{eintraege.length}</div>
            </div>
          </div>
        </div>
      </div>

      {filteredEintraege.length === 0 ? (
        <div className="alert alert-info">Keine Einträge im gewählten Zeitraum.</div>
      ) : (
        <>
          {/* Lieferanten-Zusammenfassung */}
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-dark text-white rounded-top-4">
              <h6 className="mb-0">Zusammenfassung pro Lieferant</h6>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-bordered table-hover mb-0" style={{ fontSize: "0.82rem" }}>
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 120 }}>Lieferant</th>
                      <th className="text-center">Kisten</th>
                      <th className="text-center">Kg</th>
                      <th className="text-center">%-IST</th>
                      <th className="text-center">SOLL-%</th>
                      <th className="text-center">EK/Kg</th>
                      <th className="text-center">Zer.Kosten/Kiste</th>
                      <th className="text-center">EK n. Zerlegung</th>
                      <th className="text-center">Verlust-%</th>
                      <th className="text-center">Verlust Kg</th>
                      <th className="text-center">
                        Verlust €{" "}
                        <small className="text-muted fw-normal">
                          (VK:{" "}
                          <input
                            type="number"
                            step="0.1"
                            className="border-0 bg-transparent text-end"
                            style={{ width: 45, fontSize: "0.78rem" }}
                            value={vkDurchschnitt}
                            onChange={(e) => setVkDurchschnitt(parseFloat(e.target.value) || 0)}
                          />
                          €)
                        </small>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLieferanten.map((l) => {
                      const s = lieferantSummen[l.id!];
                      if (!s || s.kisten === 0) return null;
                      const pct = calcProzent(s.kisten, s.kg, l.kistenGewichtKg);
                      const ekNZ = calcEkNachZerlegung(s.kisten, s.kg, l.ekProKg, l.zerlegungskostenProKiste, l.kistenGewichtKg);
                      const isAbove = pct !== null && pct >= l.sollProzent;
                      const verlustPct = pct !== null ? l.sollProzent - pct : null;
                      const sollKg = s.kisten * l.kistenGewichtKg * l.sollProzent;
                      const verlustKg = sollKg - s.kg;
                      const verlustEuro = verlustKg * vkDurchschnitt;

                      return (
                        <tr key={l.id}>
                          <td className="fw-medium">{l.name}</td>
                          <td className="text-center">{s.kisten}</td>
                          <td className="text-center">{s.kg.toFixed(1)}</td>
                          <td className={`text-center fw-bold ${pct !== null ? (isAbove ? "text-success" : "text-danger") : ""}`}>
                            {pct !== null ? (pct * 100).toFixed(2) + "%" : "-"}
                          </td>
                          <td className="text-center">{(l.sollProzent * 100).toFixed(1)}%</td>
                          <td className="text-center">{l.ekProKg.toFixed(2)} €</td>
                          <td className="text-center">{l.zerlegungskostenProKiste.toFixed(2)} €</td>
                          <td className="text-center">{ekNZ !== null ? ekNZ.toFixed(2) + " €" : "-"}</td>
                          <td className={`text-center ${verlustPct !== null && verlustPct > 0 ? "text-danger" : ""}`}>
                            {verlustPct !== null ? (verlustPct > 0 ? "+" : "") + (verlustPct * 100).toFixed(2) + "%" : "-"}
                          </td>
                          <td className={`text-center ${verlustKg > 0 ? "text-danger" : "text-success"}`}>
                            {verlustKg.toFixed(1)} kg
                          </td>
                          <td className={`text-center ${verlustEuro > 0 ? "text-danger" : "text-success"}`}>
                            {verlustEuro.toFixed(2)} €
                          </td>
                        </tr>
                      );
                    })}
                    {/* Gesamt-Zeile */}
                    {(() => {
                      let gKisten = 0, gKg = 0, gSollKg = 0, gEkRaw = 0, gZerKosten = 0;
                      for (const l of activeLieferanten) {
                        const s = lieferantSummen[l.id!];
                        if (!s || s.kisten === 0) continue;
                        gKisten += s.kisten;
                        gKg += s.kg;
                        gSollKg += s.kisten * l.kistenGewichtKg * l.sollProzent;
                        gEkRaw += s.kisten * l.kistenGewichtKg * l.ekProKg;
                        gZerKosten += s.kisten * l.zerlegungskostenProKiste;
                      }
                      const gVerlustKg = gSollKg - gKg;
                      const gVerlustEuro = gVerlustKg * vkDurchschnitt;
                      const gEkNZ = gKg > 0 ? (gEkRaw + gZerKosten) / gKg : null;
                      return (
                        <tr className="table-dark text-white fw-bold">
                          <td>Gesamt</td>
                          <td className="text-center">{gKisten}</td>
                          <td className="text-center">{gKg.toFixed(1)}</td>
                          <td className="text-center">-</td>
                          <td className="text-center">-</td>
                          <td className="text-center">-</td>
                          <td className="text-center">-</td>
                          <td className="text-center">{gEkNZ !== null ? gEkNZ.toFixed(2) + " €" : "-"}</td>
                          <td className="text-center">-</td>
                          <td className={`text-center ${gVerlustKg > 0 ? "text-danger" : ""}`}>
                            {gVerlustKg.toFixed(1)} kg
                          </td>
                          <td className={`text-center ${gVerlustEuro > 0 ? "text-danger" : ""}`}>
                            {gVerlustEuro.toFixed(2)} €
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Zerleger-Zusammenfassung */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-dark text-white rounded-top-4">
              <h6 className="mb-0">Zusammenfassung pro Zerleger</h6>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-bordered table-hover mb-0" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr className="table-light">
                      <th rowSpan={2} className="align-middle" style={{ minWidth: 110 }}>
                        Zerleger
                      </th>
                      <th rowSpan={2} className="text-center align-middle">Kisten ges.</th>
                      <th rowSpan={2} className="text-center align-middle">Kg ges.</th>
                      {activeLieferanten.map((l) => (
                        <th key={l.id} colSpan={3} className="text-center border-start">
                          {l.name}
                        </th>
                      ))}
                    </tr>
                    <tr className="table-secondary">
                      {activeLieferanten.map((l) => (
                        <React.Fragment key={l.id}>
                          <th className="text-center" style={{ minWidth: 50 }}>Kiste</th>
                          <th className="text-center" style={{ minWidth: 55 }}>Kg</th>
                          <th className="text-center" style={{ minWidth: 50 }}>%</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeZerleger
                      .filter((z) => zerlegerSummen[z.id!]?.total.kisten > 0)
                      .map((z) => {
                        const zs = zerlegerSummen[z.id!];
                        return (
                          <tr key={z.id}>
                            <td className="fw-medium">{z.name}</td>
                            <td className="text-center">{zs.total.kisten}</td>
                            <td className="text-center">{zs.total.kg.toFixed(1)}</td>
                            {activeLieferanten.map((l) => {
                              const pl = zs.perLief[l.id!];
                              const pct = pl && pl.kisten > 0 ? calcProzent(pl.kisten, pl.kg, l.kistenGewichtKg) : null;
                              const isAbove = pct !== null && pct >= l.sollProzent;
                              return (
                                <React.Fragment key={l.id}>
                                  <td className="text-center border-start">
                                    {pl && pl.kisten > 0 ? pl.kisten : ""}
                                  </td>
                                  <td className="text-center">
                                    {pl && pl.kg > 0 ? pl.kg.toFixed(1) : ""}
                                  </td>
                                  <td
                                    className={`text-center fw-bold ${pct !== null ? (isAbove ? "text-success" : "text-danger") : ""
                                      }`}
                                  >
                                    {pct !== null ? (pct * 100).toFixed(1) + "%" : ""}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {/* Sonntag-Info */}
                {mode === "woche" && sonntagEintraege.length > 0 && (
                  <div className="card border-0 shadow-sm rounded-4 mb-4">
                    <div className="card-header bg-warning-subtle rounded-top-4 d-flex align-items-center gap-2">
                      <i className="bi bi-info-circle" />
                      <h6 className="mb-0">Sonntag ausgeschlossen</h6>
                    </div>
                    <div className="card-body p-0">
                      <table className="table table-sm table-bordered mb-0" style={{ fontSize: "0.82rem" }}>
                        <thead className="table-light">
                          <tr>
                            <th style={{ minWidth: 120 }}>Zerleger</th>
                            <th className="text-center">Kisten</th>
                            <th className="text-center">Kg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(sonntagSummen.perZerleger)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((z) => (
                              <tr key={z.name}>
                                <td className="fw-medium">{z.name}</td>
                                <td className="text-center">{z.kisten}</td>
                                <td className="text-center">{z.kg.toFixed(1)}</td>
                              </tr>
                            ))}
                          <tr className="table-dark text-white fw-bold">
                            <td>Gesamt</td>
                            <td className="text-center">{sonntagSummen.kisten}</td>
                            <td className="text-center">{sonntagSummen.kg.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </>
      )}

      {/* Verlustanalyse Modal */}
      {showVerlust && (() => {
        const schwelle = parseFloat(vaProzent.replace(",", ".")) / 100;
        const vkNetto = parseFloat(vaVkNetto.replace(",", ".")) || 0;
        const vkBrutto = vkNetto * 1.07;
        const lief = activeLieferanten.find((l) => l.id === vaLieferantId);

        // Berechne Zerleger unter der Schwelle für den gewählten Lieferanten
        const rows: { name: string; kisten: number; kg: number; pctIst: number; sollKg: number; verlustKg: number; verlustEuro: number }[] = [];
        if (lief && !isNaN(schwelle)) {
          for (const z of activeZerleger) {
            const zs = zerlegerSummen[z.id!];
            if (!zs) continue;
            const pl = zs.perLief[lief.id!];
            if (!pl || pl.kisten === 0) continue;
            const pctIst = pl.kg / (pl.kisten * lief.kistenGewichtKg);
            if (pctIst < schwelle) {
              const sollKg = pl.kisten * lief.kistenGewichtKg * schwelle;
              const verlustKg = sollKg - pl.kg;
              const verlustEuro = verlustKg * vkBrutto;
              rows.push({
                name: z.name,
                kisten: pl.kisten,
                kg: pl.kg,
                pctIst,
                sollKg,
                verlustKg,
                verlustEuro,
              });
            }
          }
        }
        rows.sort((a, b) => b.verlustEuro - a.verlustEuro);
        const totalVerlustKg = rows.reduce((s, r) => s + r.verlustKg, 0);
        const totalVerlustEuro = rows.reduce((s, r) => s + r.verlustEuro, 0);

        return (
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowVerlust(false)}
          >
            <div
              className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-content border-0 rounded-4 shadow-lg">
                <div className="modal-header border-0 bg-danger text-white rounded-top-4">
                  <h5 className="modal-title fw-semibold">Verlustanalyse — {label}</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowVerlust(false)}
                  />
                </div>
                <div className="modal-body">
                  {/* Filter Row */}
                  <div className="row g-3 mb-4">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Lieferant</label>
                      <select
                        className="form-select"
                        value={vaLieferantId}
                        onChange={(e) => setVaLieferantId(e.target.value)}
                      >
                        <option value="">— wählen —</option>
                        {activeLieferanten.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Schwelle (%)</label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          value={vaProzent}
                          onChange={(e) => setVaProzent(e.target.value)}
                          placeholder="z.B. 68"
                        />
                        <span className="input-group-text">%</span>
                      </div>
                      <div className="form-text">Alle Zerleger unter diesem Wert</div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">VK-Preis netto</label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          value={vaVkNetto}
                          onChange={(e) => setVaVkNetto(e.target.value)}
                          placeholder="z.B. 3.30"
                        />
                        <span className="input-group-text">€/kg</span>
                      </div>
                      <div className="form-text">
                        Brutto (+ 7% MwSt): <strong>{vkBrutto.toFixed(2)} €</strong>
                      </div>
                    </div>
                  </div>

                  {/* Results */}
                  {!vaLieferantId ? (
                    <div className="text-muted text-center py-3">Bitte Lieferant wählen.</div>
                  ) : rows.length === 0 ? (
                    <div className="alert alert-success mb-0">
                      Alle Zerleger liegen bei oder über {vaProzent}% für {lief?.name}.
                    </div>
                  ) : (
                    <>
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered table-hover mb-0" style={{ fontSize: "0.85rem" }}>
                          <thead className="table-light">
                            <tr>
                              <th>Zerleger</th>
                              <th className="text-end">Kisten</th>
                              <th className="text-end">Kg (IST)</th>
                              <th className="text-end">%-IST</th>
                              <th className="text-end">Kg (SOLL bei {vaProzent}%)</th>
                              <th className="text-end">Verlust Kg</th>
                              <th className="text-end">Verlust € (brutto)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.name}>
                                <td className="fw-medium">{r.name}</td>
                                <td className="text-end">{r.kisten}</td>
                                <td className="text-end">{r.kg.toFixed(1)}</td>
                                <td className="text-end text-danger fw-bold">
                                  {(r.pctIst * 100).toFixed(2)}%
                                </td>
                                <td className="text-end">{r.sollKg.toFixed(1)}</td>
                                <td className="text-end text-danger">{r.verlustKg.toFixed(1)}</td>
                                <td className="text-end text-danger fw-bold">
                                  {r.verlustEuro.toFixed(2)} €
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="table-dark text-white fw-bold">
                            <tr>
                              <td colSpan={5}>Gesamt Verlust</td>
                              <td className="text-end">{totalVerlustKg.toFixed(1)} kg</td>
                              <td className="text-end">{totalVerlustEuro.toFixed(2)} €</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="mt-3 text-muted small">
                        Berechnung: Verlust Kg = (Kisten × {lief?.kistenGewichtKg ?? 10}kg × {vaProzent}%) − Kg IST |
                        Verlust € = Verlust Kg × {vkBrutto.toFixed(2)} € (inkl. 7% MwSt)
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer border-0">
                  <button
                    className="btn btn-outline-secondary rounded-3"
                    onClick={() => setShowVerlust(false)}
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
