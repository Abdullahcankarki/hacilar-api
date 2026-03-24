import React, { useState, useEffect, useCallback, useMemo } from "react";
import PdfDropZone from "./shared/PdfDropZone";
import { extractFirstPageText } from "./shared/pdfTextExtract";
import { parseGermanInt } from "./shared/germanNumberUtils";
import {
  getLeergutImports,
  getLeergutLatest,
  createLeergutImport,
  deleteLeergutImport,
} from "../../backend/api";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeergutRow {
  kundennr: string;
  kunde: string;
  bestaende: Record<string, number>;
}

type Toast = { type: "success" | "error"; msg: string } | null;
type SortKey = "kundennr" | "kunde" | string; // string = artikelname
type SortDir = "asc" | "desc";

/* ------------------------------------------------------------------ */
/*  Parsing                                                            */
/* ------------------------------------------------------------------ */

const ARTIKEL_ORDER = [
  "H1 Palette",
  "E2 Kiste",
  "E1 Kiste",
  "Euro Palette",
  "Euro Haken",
  "Big Box",
  "Körbe",
];

const RE_KUNDENNR = /^(.+?)\s+Ihre Kundennummer:\s*(\d+)/;
const RE_LEERGUT = /^(.+?)\s+([-\d.]+)\s+[-\d.]+\s*$/;

function parseSinglePdf(lines: string[]): LeergutRow | null {
  let kundennr = "";
  let kunde = "";
  const bestaende: Record<string, number> = {};
  let inLeergut = false;

  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;

    if (!kundennr) {
      const m = RE_KUNDENNR.exec(s);
      if (m) {
        kunde = m[1].trim();
        kundennr = m[2].trim();
      }
    }

    if (s.includes("Bezeichnung Alter Bestand") || s.includes("Bezeichnung  Alter Bestand")) {
      inLeergut = true;
      continue;
    }

    if (inLeergut) {
      if (s.includes("Unterschrift") || s.includes("NETTOBETRAG")) break;
      const m = RE_LEERGUT.exec(s);
      if (m) {
        const artikel = m[1].trim();
        try {
          bestaende[artikel] = parseGermanInt(m[2]);
        } catch {
          bestaende[artikel] = 0;
        }
      }
    }
  }

  if (!kunde && Object.keys(bestaende).length === 0) return null;
  return { kundennr, kunde, bestaende };
}

/* ------------------------------------------------------------------ */
/*  Excel Export                                                        */
/* ------------------------------------------------------------------ */

async function exportExcel(rows: LeergutRow[], artikelColumns: string[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Leergut Alter Bestand");

  const headers = ["Kd.-Nr.", "Kunde", ...artikelColumns];
  const colWidths = [10, 40, ...artikelColumns.map(() => 14)];

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  });
  ws.columns = colWidths.map((w) => ({ width: w }));
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  for (const row of rows) {
    const values = [row.kundennr, row.kunde, ...artikelColumns.map((a) => row.bestaende[a] ?? "")];
    const dataRow = ws.addRow(values);
    dataRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
      if (colNumber >= 3) {
        cell.alignment = { horizontal: "right" };
        const val = typeof cell.value === "number" ? cell.value : 0;
        if (val < 0) cell.font = { color: { argb: "FFC00000" }, bold: true };
        else if (val === 0 || cell.value === "") cell.font = { color: { argb: "FFAAAAAA" } };
      }
    });
  }

  const sumValues = ["", "Gesamt", ...artikelColumns.map((a) => rows.reduce((s, r) => s + (r.bestaende[a] || 0), 0))];
  const sumRow = ws.addRow(sumValues);
  sumRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
    cell.font = { bold: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  });

  const buf = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  saveAs(new Blob([buf]), `leergut_${today}.xlsx`);
}

/* ------------------------------------------------------------------ */
/*  Pivot                                                              */
/* ------------------------------------------------------------------ */

function pivotEntries(
  entries: { kundennr: string; kunde: string; artikel: string; alterBestand: number }[]
): { rows: LeergutRow[]; artikelColumns: string[] } {
  const kundenMap = new Map<string, LeergutRow>();
  const extraArtikel: string[] = [];

  for (const e of entries) {
    let row = kundenMap.get(e.kundennr);
    if (!row) {
      row = { kundennr: e.kundennr, kunde: e.kunde, bestaende: {} };
      kundenMap.set(e.kundennr, row);
    }
    row.bestaende[e.artikel] = e.alterBestand;

    if (!ARTIKEL_ORDER.includes(e.artikel) && !extraArtikel.includes(e.artikel)) {
      extraArtikel.push(e.artikel);
    }
  }

  const rows = Array.from(kundenMap.values()).sort((a, b) => a.kundennr.localeCompare(b.kundennr));
  return { rows, artikelColumns: [...ARTIKEL_ORDER, ...extraArtikel] };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LeergutTool() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Data
  const [rows, setRows] = useState<LeergutRow[]>([]);
  const [artikelColumns, setArtikelColumns] = useState<string[]>(ARTIKEL_ORDER);

  // Upload
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [saving, setSaving] = useState(false);

  // Search & Sort
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("kundennr");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeergutLatest();
      const { rows: r, artikelColumns: c } = pivotEntries(data);
      setRows(r);
      setArtikelColumns(c.length > 0 ? c : ARTIKEL_ORDER);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered + sorted rows
  const displayRows = useMemo(() => {
    let filtered = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = rows.filter(
        (r) => r.kunde.toLowerCase().includes(q) || r.kundennr.includes(q)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "kundennr") {
        cmp = a.kundennr.localeCompare(b.kundennr);
      } else if (sortKey === "kunde") {
        cmp = a.kunde.localeCompare(b.kunde);
      } else {
        // Artikel-Spalte
        cmp = (a.bestaende[sortKey] || 0) - (b.bestaende[sortKey] || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [rows, search, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortDir("asc");
      }
      return key;
    });
  }, []);

  const sortIcon = (key: string) => {
    if (sortKey !== key) return <i className="bi bi-arrow-down-up text-muted ms-1" style={{ fontSize: "0.7em" }} />;
    return sortDir === "asc"
      ? <i className="bi bi-sort-up ms-1" style={{ fontSize: "0.7em" }} />
      : <i className="bi bi-sort-down ms-1" style={{ fontSize: "0.7em" }} />;
  };

  // File handling
  const handleFilesSelected = useCallback((newFiles: File[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...newFiles.filter((f) => !existing.has(f.name))];
    });
  }, []);

  const removeFile = useCallback((name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }, []);

  // Parse + merge + save
  const handleImport = useCallback(async () => {
    if (files.length === 0) return;
    setParsing(true);
    setProgress({ current: 0, total: files.length });

    // Start with existing data as base
    const merged = new Map<string, LeergutRow>();
    for (const r of rows) {
      merged.set(r.kundennr, { ...r, bestaende: { ...r.bestaende } });
    }

    const extraArtikel: string[] = [];

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      try {
        const lines = await extractFirstPageText(files[i]);
        const row = parseSinglePdf(lines);
        if (row) {
          // Upsert: replace existing customer or add new
          merged.set(row.kundennr, row);
          for (const art of Object.keys(row.bestaende)) {
            if (!ARTIKEL_ORDER.includes(art) && !extraArtikel.includes(art)) {
              extraArtikel.push(art);
            }
          }
        }
      } catch (err) {
        console.error("PDF parse error:", files[i].name, err);
      }
    }

    setParsing(false);

    const allRows = Array.from(merged.values()).sort((a, b) =>
      a.kundennr.localeCompare(b.kundennr)
    );

    if (allRows.length === 0) {
      setToast({ type: "error", msg: "Keine Leergut-Daten gefunden." });
      return;
    }

    // Save to backend
    setSaving(true);
    try {
      // Delete all existing imports
      const existingImports = await getLeergutImports();
      for (const imp of existingImports) {
        try { await deleteLeergutImport(imp.id); } catch { /* ignore */ }
      }

      // Create new single import with merged data
      const eintraege: { kundennr: string; kunde: string; artikel: string; alterBestand: number }[] = [];
      for (const row of allRows) {
        for (const [artikel, bestand] of Object.entries(row.bestaende)) {
          eintraege.push({ kundennr: row.kundennr, kunde: row.kunde, artikel, alterBestand: bestand });
        }
      }
      await createLeergutImport({ anzahlDateien: files.length, eintraege });

      setToast({ type: "success", msg: `${allRows.length} Kunden aktualisiert.` });
      setShowUpload(false);
      setFiles([]);
      loadData();
    } catch (err: any) {
      setToast({ type: "error", msg: "Speichern fehlgeschlagen: " + (err?.message || "") });
    } finally {
      setSaving(false);
    }
  }, [files, rows, loadData]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1400 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          <i className="bi bi-box2 me-2" />
          Leergut Auswertung
        </h2>
        <div className="d-flex gap-2">
          {rows.length > 0 && (
            <button
              className="btn btn-outline-success"
              onClick={() => exportExcel(displayRows, artikelColumns)}
            >
              <i className="bi bi-file-earmark-excel me-1" />
              Excel
            </button>
          )}
          <button
            className={`btn ${showUpload ? "btn-outline-secondary" : "btn-primary"}`}
            onClick={() => {
              setShowUpload(!showUpload);
              setFiles([]);
            }}
          >
            {showUpload ? (
              <><i className="bi bi-x-lg me-1" />Abbrechen</>
            ) : (
              <><i className="bi bi-cloud-arrow-up me-1" />PDFs hochladen</>
            )}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`alert alert-${toast.type === "success" ? "success" : "danger"} alert-dismissible fade show`}>
          {toast.msg}
          <button type="button" className="btn-close" onClick={() => setToast(null)} />
        </div>
      )}

      {/* Upload area */}
      {showUpload && (
        <div className="card mb-4 border-primary">
          <div className="card-body">
            <PdfDropZone
              onFilesSelected={handleFilesSelected}
              multiple
              label="Leergut-PDFs hier ablegen — bestehende Kunden werden aktualisiert"
            />

            {files.length > 0 && (
              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-semibold">{files.length} Dateien</span>
                  <button
                    className="btn btn-primary"
                    onClick={handleImport}
                    disabled={parsing || saving}
                  >
                    {parsing ? (
                      <><span className="spinner-border spinner-border-sm me-1" />Verarbeite {progress.current}/{progress.total}...</>
                    ) : saving ? (
                      <><span className="spinner-border spinner-border-sm me-1" />Speichere...</>
                    ) : (
                      <><i className="bi bi-arrow-repeat me-1" />Importieren &amp; Aktualisieren</>
                    )}
                  </button>
                </div>
                <div style={{ maxHeight: 150, overflowY: "auto" }}>
                  {files.map((f) => (
                    <div key={f.name} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                      <small>
                        <i className="bi bi-file-earmark-pdf text-danger me-1" />
                        {f.name}
                      </small>
                      <button className="btn btn-sm btn-outline-danger py-0" onClick={() => removeFile(f.name)}>
                        <i className="bi bi-x" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      {rows.length > 0 && (
        <div className="mb-3">
          <div className="input-group" style={{ maxWidth: 400 }}>
            <span className="input-group-text"><i className="bi bi-search" /></span>
            <input
              type="text"
              className="form-control"
              placeholder="Kunde oder Kundennr. suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="btn btn-outline-secondary" onClick={() => setSearch("")}>
                <i className="bi bi-x-lg" />
              </button>
            )}
          </div>
          {search && (
            <small className="text-muted mt-1 d-block">
              {displayRows.length} von {rows.length} Kunden
            </small>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      ) : rows.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-hover table-sm table-bordered align-middle">
            <thead className="table-dark">
              <tr>
                <th
                  style={{ position: "sticky", left: 0, zIndex: 2, background: "#212529", cursor: "pointer" }}
                  onClick={() => handleSort("kundennr")}
                >
                  Kd.-Nr. {sortIcon("kundennr")}
                </th>
                <th
                  style={{ position: "sticky", left: 70, zIndex: 2, background: "#212529", minWidth: 200, cursor: "pointer" }}
                  onClick={() => handleSort("kunde")}
                >
                  Kunde {sortIcon("kunde")}
                </th>
                {artikelColumns.map((col) => (
                  <th
                    key={col}
                    className="text-center"
                    style={{ minWidth: 90, cursor: "pointer" }}
                    onClick={() => handleSort(col)}
                  >
                    {col} {sortIcon(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr key={i}>
                  <td style={{ position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>
                    {row.kundennr}
                  </td>
                  <td style={{ position: "sticky", left: 70, background: "#fff", zIndex: 1 }}>
                    {row.kunde}
                  </td>
                  {artikelColumns.map((col) => {
                    const val = row.bestaende[col];
                    return (
                      <td
                        key={col}
                        className="text-end"
                        style={{
                          color: val === undefined || val === 0 ? "#aaa" : val < 0 ? "#c00000" : undefined,
                          fontWeight: val !== undefined && val < 0 ? "bold" : undefined,
                        }}
                      >
                        {val !== undefined ? val : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-info fw-bold">
                <td style={{ position: "sticky", left: 0, zIndex: 1 }}></td>
                <td style={{ position: "sticky", left: 70, zIndex: 1 }}>Gesamt</td>
                {artikelColumns.map((col) => {
                  const sum = displayRows.reduce((s, r) => s + (r.bestaende[col] || 0), 0);
                  return (
                    <td key={col} className="text-end">{sum}</td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox" style={{ fontSize: 48 }} />
            <p className="mt-2">Noch keine Daten vorhanden. Laden Sie PDFs hoch.</p>
          </div>
        )
      )}
    </div>
  );
}
