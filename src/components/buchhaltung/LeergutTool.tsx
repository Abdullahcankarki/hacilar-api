import React, { useState, useEffect, useCallback, useMemo } from "react";
import PdfDropZone from "./shared/PdfDropZone";
import { extractFirstPageText } from "./shared/pdfTextExtract";
import { parseGermanInt } from "./shared/germanNumberUtils";
import {
  getLeergutImports,
  getLeergutLatest,
  createLeergutImport,
  deleteLeergutImport,
  deleteLeergutKunde,
  sendLeergutEmail,
  getLeergutBuchungen,
  uploadLeergutBuchung,
  deleteLeergutBuchung,
} from "../../backend/api";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeergutRow {
  kundennr: string;
  kunde: string;
  adresse: string;
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
  let adresse = "";
  const bestaende: Record<string, number> = {};
  let inLeergut = false;

  // Adresse: Zeilen zwischen "Firma" und "Ihre Kundennummer"
  let firmaFound = false;
  const adressLines: string[] = [];

  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;

    // Adresse sammeln
    if (!kundennr) {
      if (s.startsWith("Firma")) {
        firmaFound = true;
        continue;
      }
      const m = RE_KUNDENNR.exec(s);
      if (m) {
        kunde = m[1].trim();
        kundennr = m[2].trim();
        firmaFound = false;
      } else if (firmaFound) {
        // Zeilen zwischen "Firma" und Kundennummer = Adresse
        if (!s.includes("Sachbearbeiter") && !s.includes("Lieferscheindatum") && !s.includes("DE 1")) {
          adressLines.push(s);
        }
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

  // Adresse zusammenbauen (Firma-Name ist oft erste Zeile)
  adresse = adressLines.join(", ");

  if (!kunde && Object.keys(bestaende).length === 0) return null;
  return { kundennr, kunde, adresse, bestaende };
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
  entries: { kundennr: string; kunde: string; adresse?: string; artikel: string; alterBestand: number }[]
): { rows: LeergutRow[]; artikelColumns: string[] } {
  const kundenMap = new Map<string, LeergutRow>();
  const extraArtikel: string[] = [];

  for (const e of entries) {
    let row = kundenMap.get(e.kundennr);
    if (!row) {
      row = { kundennr: e.kundennr, kunde: e.kunde, adresse: e.adresse || "", bestaende: {} };
      kundenMap.set(e.kundennr, row);
    }
    if (e.adresse && !row.adresse) row.adresse = e.adresse;
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

  // Search & Sort & Filters
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("kundennr");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterKunde, setFilterKunde] = useState("");
  const [filterKundennr, setFilterKundennr] = useState("");
  const [filterArtikel, setFilterArtikel] = useState("");
  const [filterHideZero, setFilterHideZero] = useState(false);
  const [filterOnlyNegativ, setFilterOnlyNegativ] = useState(false);
  const [filterMinBestand, setFilterMinBestand] = useState("");
  const [filterMaxBestand, setFilterMaxBestand] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<LeergutRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Email Modal
  const [emailTarget, setEmailTarget] = useState<LeergutRow | null>(null);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [buchungen, setBuchungen] = useState<{ id: string; filename: string; uploadDatum: string }[]>([]);
  const [buchungUploading, setBuchungUploading] = useState(false);

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

  // Filter helpers
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterKunde) c++;
    if (filterKundennr) c++;
    if (filterArtikel) c++;
    if (filterHideZero) c++;
    if (filterOnlyNegativ) c++;
    if (filterMinBestand) c++;
    if (filterMaxBestand) c++;
    return c;
  }, [filterKunde, filterKundennr, filterArtikel, filterHideZero, filterOnlyNegativ, filterMinBestand, filterMaxBestand]);

  const resetFilters = useCallback(() => {
    setFilterKunde("");
    setFilterKundennr("");
    setFilterArtikel("");
    setFilterHideZero(false);
    setFilterOnlyNegativ(false);
    setFilterMinBestand("");
    setFilterMaxBestand("");
    setSearch("");
  }, []);

  // Delete handler
  const handleDeleteKunde = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLeergutKunde(deleteTarget.kundennr);
      setRows((prev) => prev.filter((r) => r.kundennr !== deleteTarget.kundennr));
      setToast({ type: "success", msg: `${deleteTarget.kunde} gelöscht.` });
      setDeleteTarget(null);
    } catch (err: any) {
      setToast({ type: "error", msg: "Löschen fehlgeschlagen: " + (err?.message || "") });
    } finally { setDeleting(false); }
  }, [deleteTarget]);

  // PDF generieren
  const generateLeergutPdf = useCallback(async (row: LeergutRow): Promise<string> => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Briefkopf laden
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = `${process.env.PUBLIC_URL}/briefkopf.jpg`;
    });
    pdf.addImage(img, "JPEG", 0, 0, 210, 297);

    // Empfänger mit Adresse
    let y = 55;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`An: ${row.kunde}`, 20, y);
    if (row.adresse) {
      const adressParts = row.adresse.split(",").map((s) => s.trim()).filter(Boolean);
      for (const part of adressParts) {
        y += 5;
        pdf.setFontSize(10);
        pdf.text(part, 20, y);
      }
    }

    // Datum
    y += 10;
    const now = new Date();
    const datumStr = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    pdf.text(`Datum: ${datumStr}`, 20, y);

    // Anschreiben
    y += 14;
    pdf.setFontSize(10);
    const lines = [
      "Sehr geehrte Damen und Herren,",
      "",
      "anbei erhalten Sie die Leergutaufstellung für den Zeitraum, in dem",
      "wir Sie beliefert haben. Wir bitten Sie, diese sorgfältig zu prüfen.",
      "",
      "Sollten Abweichungen oder Unstimmigkeiten zu unserer Aufstellung",
      "bestehen, informieren Sie uns bitte umgehend. Falls Ihr Leergutsaldo",
      "mit unserem Saldo übereinstimmt, auch im Falle eines Nullsaldos,",
      "bitten wir Sie, die Aufstellung mit Stempel und Unterschrift versehen",
    ];
    // Frist: 3 Werktage berechnen
    const frist = new Date(now);
    let added = 0;
    while (added < 3) {
      frist.setDate(frist.getDate() + 1);
      const dow = frist.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    const fristStr = frist.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    lines.push(`und bis spätestens ${fristStr} an uns zurückzusenden.`);
    lines.push("");
    lines.push("Für Ihre Unterstützung danken wir Ihnen im Voraus und stehen bei");
    lines.push("Rückfragen gerne zur Verfügung.");
    lines.push("");
    lines.push("Mit freundlichen Grüßen");
    lines.push("Geschäftsleitung");
    lines.push("Hacilar Helal Et Kombinasi");

    for (const line of lines) {
      pdf.text(line, 20, y);
      y += 5;
    }

    // Bestätigungsbox rechts
    pdf.setDrawColor(150);
    pdf.rect(115, 120, 75, 40);
    pdf.setFontSize(8);
    pdf.text("Zur Bestätigung:", 118, 126);
    pdf.text("Firmenstempel, Name und Unterschrift:", 118, 131);

    // Leergut-Tabelle
    y += 8;
    pdf.setFont("helvetica", "bolditalic");
    pdf.setFontSize(11);
    pdf.text("Aktueller Leergut Bestand", 20, y);
    y += 7;

    // Tabellenkopf
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.3);
    pdf.rect(20, y - 4, 80, 7);
    pdf.text("Bezeichnung", 22, y);
    pdf.text("Alter Bestand", 68, y);
    y += 7;

    // Tabellenzeilen
    pdf.setFont("helvetica", "normal");
    const entries = Object.entries(row.bestaende).filter(([, v]) => v !== undefined);
    for (const [artikel, bestand] of entries) {
      pdf.rect(20, y - 4, 80, 6);
      pdf.text(artikel, 22, y);
      pdf.text(String(bestand).replace(/\B(?=(\d{3})+(?!\d))/g, "."), 68, y, { align: "left" });
      y += 6;
    }

    return pdf.output("datauristring").split(",")[1]; // base64
  }, []);

  // Buchungen laden wenn Modal geöffnet wird
  const loadBuchungen = useCallback(async (kundennr: string) => {
    try {
      const data = await getLeergutBuchungen(kundennr);
      setBuchungen(data);
    } catch { setBuchungen([]); }
  }, []);

  // Buchung hochladen
  const handleBuchungUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!emailTarget || !e.target.files) return;
    setBuchungUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
        const base64 = btoa(binary);
        await uploadLeergutBuchung({
          kundennr: emailTarget.kundennr,
          kunde: emailTarget.kunde,
          filename: file.name,
          pdfBase64: base64,
        });
      }
      await loadBuchungen(emailTarget.kundennr);
      setToast({ type: "success", msg: "Buchung(en) hochgeladen." });
    } catch (err: any) {
      setToast({ type: "error", msg: "Upload fehlgeschlagen: " + (err?.message || "") });
    } finally {
      setBuchungUploading(false);
      e.target.value = "";
    }
  }, [emailTarget, loadBuchungen]);

  // Buchung löschen
  const handleDeleteBuchung = useCallback(async (id: string) => {
    try {
      await deleteLeergutBuchung(id);
      setBuchungen((prev) => prev.filter((b) => b.id !== id));
    } catch { /* ignore */ }
  }, []);

  // Email senden
  const handleSendEmail = useCallback(async () => {
    if (!emailTarget || !emailAddr) return;
    setEmailSending(true);
    try {
      const pdfBase64 = await generateLeergutPdf(emailTarget);
      await sendLeergutEmail({
        kundenEmail: emailAddr,
        kundenName: emailTarget.kunde,
        kundennr: emailTarget.kundennr,
        pdfBase64,
      });
      setToast({ type: "success", msg: `E-Mail an ${emailAddr} gesendet (${1 + buchungen.length} Anhänge).` });
      setEmailTarget(null);
      setEmailAddr("");
    } catch (err: any) {
      setToast({ type: "error", msg: "E-Mail fehlgeschlagen: " + (err?.message || "") });
    } finally { setEmailSending(false); }
  }, [emailTarget, emailAddr, generateLeergutPdf, buchungen.length]);

  // PDF herunterladen (ohne E-Mail)
  const handleDownloadPdf = useCallback(async (row: LeergutRow) => {
    try {
      const pdfBase64 = await generateLeergutPdf(row);
      const blob = new Blob([Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      saveAs(blob, `Leergut_${row.kunde.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}.pdf`);
    } catch (err: any) {
      setToast({ type: "error", msg: "PDF-Fehler: " + (err?.message || "") });
    }
  }, [generateLeergutPdf]);

  // Filtered + sorted rows
  const displayRows = useMemo(() => {
    let filtered = rows;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) => r.kunde.toLowerCase().includes(q) || r.kundennr.includes(q)
      );
    }

    // Kunde filter
    if (filterKunde) {
      const q = filterKunde.toLowerCase();
      filtered = filtered.filter((r) => r.kunde.toLowerCase().includes(q));
    }

    // Kundennr filter
    if (filterKundennr) {
      filtered = filtered.filter((r) => r.kundennr.includes(filterKundennr));
    }

    // Artikel filter: nur Kunden zeigen die diesen Artikel haben
    if (filterArtikel) {
      const q = filterArtikel.toLowerCase();
      filtered = filtered.filter((r) =>
        Object.keys(r.bestaende).some((a) => a.toLowerCase().includes(q) && r.bestaende[a] !== 0)
      );
    }

    // Hide zero: Kunden ohne nennenswerte Bestände ausblenden
    if (filterHideZero) {
      filtered = filtered.filter((r) =>
        Object.values(r.bestaende).some((v) => v !== 0)
      );
    }

    // Only negativ: nur Kunden mit mindestens einem negativen Bestand
    if (filterOnlyNegativ) {
      filtered = filtered.filter((r) =>
        Object.values(r.bestaende).some((v) => v < 0)
      );
    }

    // Min/Max Bestand: auf Gesamtbestand über alle Artikel
    if (filterMinBestand) {
      const min = parseInt(filterMinBestand);
      if (!isNaN(min)) {
        filtered = filtered.filter((r) => {
          const total = Object.values(r.bestaende).reduce((s, v) => s + v, 0);
          return total >= min;
        });
      }
    }
    if (filterMaxBestand) {
      const max = parseInt(filterMaxBestand);
      if (!isNaN(max)) {
        filtered = filtered.filter((r) => {
          const total = Object.values(r.bestaende).reduce((s, v) => s + v, 0);
          return total <= max;
        });
      }
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "kundennr") {
        cmp = a.kundennr.localeCompare(b.kundennr);
      } else if (sortKey === "kunde") {
        cmp = a.kunde.localeCompare(b.kunde);
      } else {
        cmp = (a.bestaende[sortKey] || 0) - (b.bestaende[sortKey] || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [rows, search, sortKey, sortDir, filterKunde, filterKundennr, filterArtikel, filterHideZero, filterOnlyNegativ, filterMinBestand, filterMaxBestand]);

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
      const eintraege: { kundennr: string; kunde: string; adresse?: string; artikel: string; alterBestand: number }[] = [];
      for (const row of allRows) {
        for (const [artikel, bestand] of Object.entries(row.bestaende)) {
          eintraege.push({ kundennr: row.kundennr, kunde: row.kunde, adresse: row.adresse, artikel, alterBestand: bestand });
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

      {/* Search + Filter Bar */}
      {rows.length > 0 && (
        <div className="mb-3">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <div className="input-group" style={{ maxWidth: 300 }}>
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input
                type="text"
                className="form-control"
                placeholder="Suche..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="btn btn-outline-secondary" onClick={() => setSearch("")}>
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>

            <button
              className={`btn btn-sm ${showFilters ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <i className="bi bi-funnel me-1" />Filter
              {activeFilterCount > 0 && <span className="badge bg-danger ms-1">{activeFilterCount}</span>}
            </button>

            <button
              className={`btn btn-sm ${filterHideZero ? "btn-warning" : "btn-outline-secondary"}`}
              onClick={() => setFilterHideZero(!filterHideZero)}
            >
              Ohne Nullen
            </button>
            <button
              className={`btn btn-sm ${filterOnlyNegativ ? "btn-danger" : "btn-outline-secondary"}`}
              onClick={() => setFilterOnlyNegativ(!filterOnlyNegativ)}
            >
              Nur Negativ
            </button>

            {activeFilterCount > 0 && (
              <button className="btn btn-sm btn-outline-danger" onClick={resetFilters}>
                <i className="bi bi-x-circle me-1" />Zurucksetzen
              </button>
            )}

            <span className="text-muted small ms-auto">
              {displayRows.length} / {rows.length} Kunden
            </span>
          </div>

          {showFilters && (
            <div className="card mt-2 border-0 shadow-sm">
              <div className="card-body py-3">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Kunde</label>
                    <input type="text" className="form-control form-control-sm" placeholder="Kundenname..."
                      value={filterKunde} onChange={(e) => setFilterKunde(e.target.value)} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Kd.-Nr.</label>
                    <input type="text" className="form-control form-control-sm" placeholder="z.B. 14900"
                      value={filterKundennr} onChange={(e) => setFilterKundennr(e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Artikel</label>
                    <input type="text" className="form-control form-control-sm" placeholder="z.B. E2 Kiste"
                      value={filterArtikel} onChange={(e) => setFilterArtikel(e.target.value)} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Gesamt-Bestand min</label>
                    <input type="number" className="form-control form-control-sm" placeholder="Min"
                      value={filterMinBestand} onChange={(e) => setFilterMinBestand(e.target.value)} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Gesamt-Bestand max</label>
                    <input type="number" className="form-control form-control-sm" placeholder="Max"
                      value={filterMaxBestand} onChange={(e) => setFilterMaxBestand(e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Typ</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" id="lgHideZero" checked={filterHideZero}
                          onChange={(e) => setFilterHideZero(e.target.checked)} />
                        <label className="form-check-label small" htmlFor="lgHideZero">Ohne Null-Bestande</label>
                      </div>
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" id="lgOnlyNeg" checked={filterOnlyNegativ}
                          onChange={(e) => setFilterOnlyNegativ(e.target.checked)} />
                        <label className="form-check-label small" htmlFor="lgOnlyNeg">Nur mit negativen Bestanden</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                <th style={{ position: "sticky", left: 0, zIndex: 2, background: "#212529", width: 80 }}></th>
                <th
                  style={{ position: "sticky", left: 40, zIndex: 2, background: "#212529", cursor: "pointer" }}
                  onClick={() => handleSort("kundennr")}
                >
                  Kd.-Nr. {sortIcon("kundennr")}
                </th>
                <th
                  style={{ position: "sticky", left: 110, zIndex: 2, background: "#212529", minWidth: 200, cursor: "pointer" }}
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
                  <td style={{ position: "sticky", left: 0, background: "#fff", zIndex: 1, whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-sm btn-outline-primary py-0 px-1 me-1"
                      title="E-Mail senden"
                      onClick={() => { setEmailTarget(row); setEmailAddr(""); loadBuchungen(row.kundennr); }}
                    >
                      <i className="bi bi-envelope" style={{ fontSize: "0.75rem" }} />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary py-0 px-1 me-1"
                      title="PDF herunterladen"
                      onClick={() => handleDownloadPdf(row)}
                    >
                      <i className="bi bi-file-earmark-pdf" style={{ fontSize: "0.75rem" }} />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger py-0 px-1"
                      title="Löschen"
                      onClick={() => setDeleteTarget(row)}
                    >
                      <i className="bi bi-trash" style={{ fontSize: "0.75rem" }} />
                    </button>
                  </td>
                  <td style={{ position: "sticky", left: 40, background: "#fff", zIndex: 1 }}>
                    {row.kundennr}
                  </td>
                  <td style={{ position: "sticky", left: 110, background: "#fff", zIndex: 1 }}>
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
                <td style={{ position: "sticky", left: 40, zIndex: 1 }}></td>
                <td style={{ position: "sticky", left: 110, zIndex: 1 }}>Gesamt</td>
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
      {/* Email-Modal */}
      {emailTarget && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => !emailSending && setEmailTarget(null)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg">
              <div className="modal-header border-0 bg-primary text-white rounded-top-4">
                <h5 className="modal-title fw-semibold">
                  <i className="bi bi-envelope me-2" />Leergut-Bestätigung senden
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEmailTarget(null)} disabled={emailSending} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Kunde</label>
                  <div className="form-control-plaintext fw-bold">{emailTarget.kunde} (Kd.-Nr. {emailTarget.kundennr})</div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Bestände</label>
                  <div className="small text-muted">
                    {Object.entries(emailTarget.bestaende)
                      .filter(([, v]) => v !== 0)
                      .map(([k, v]) => (
                        <span key={k} className={`me-3 ${v < 0 ? "text-danger fw-bold" : ""}`}>{k}: {v}</span>
                      ))}
                    {Object.values(emailTarget.bestaende).every((v) => v === 0) && <span>Alle Bestände = 0</span>}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">E-Mail-Adresse *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="kunde@example.com"
                    value={emailAddr}
                    onChange={(e) => setEmailAddr(e.target.value)}
                    autoFocus
                  />
                </div>
                {/* Buchungs-PDFs (Leergutauswertungen) */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Buchungs-PDFs (Leergutauswertungen)
                    <span className="badge bg-secondary ms-2">{buchungen.length}</span>
                  </label>
                  {buchungen.length > 0 && (
                    <div className="mb-2" style={{ maxHeight: 120, overflowY: "auto" }}>
                      {buchungen.map((b) => (
                        <div key={b.id} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                          <small>
                            <i className="bi bi-file-earmark-pdf text-danger me-1" />
                            {b.filename}
                          </small>
                          <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => handleDeleteBuchung(b.id)}>
                            <i className="bi bi-x" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="d-flex align-items-center gap-2">
                    <label className={`btn btn-sm btn-outline-primary ${buchungUploading ? "disabled" : ""}`}>
                      {buchungUploading ? (
                        <><span className="spinner-border spinner-border-sm me-1" />Lade...</>
                      ) : (
                        <><i className="bi bi-plus-lg me-1" />PDF hochladen</>
                      )}
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        className="d-none"
                        onChange={handleBuchungUpload}
                        disabled={buchungUploading}
                      />
                    </label>
                    <span className="text-muted small">Werden automatisch als Anhang mitgesendet</span>
                  </div>
                </div>

                <div className="small text-muted">
                  <i className="bi bi-info-circle me-1" />
                  Anhänge: 1 Leergut-Bestätigung (generiert) + {buchungen.length} Buchungs-PDF{buchungen.length !== 1 ? "s" : ""}.
                  Rücksendefrist: 3 Werktage ab heute.
                </div>
              </div>
              <div className="modal-footer border-0">
                <button
                  className="btn btn-outline-secondary rounded-3"
                  onClick={() => { handleDownloadPdf(emailTarget); }}
                  disabled={emailSending}
                >
                  <i className="bi bi-download me-1" />Nur PDF
                </button>
                <button
                  className="btn btn-primary rounded-3"
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailAddr || !emailAddr.includes("@")}
                >
                  {emailSending ? (
                    <><span className="spinner-border spinner-border-sm me-1" />Sende...</>
                  ) : (
                    <><i className="bi bi-send me-1" />Senden</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lösch-Bestätigung Modal */}
      {deleteTarget && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg">
              <div className="modal-header border-0">
                <h5 className="modal-title fw-semibold">Kunde löschen</h5>
                <button type="button" className="btn-close" onClick={() => setDeleteTarget(null)} disabled={deleting} />
              </div>
              <div className="modal-body">
                <p>
                  Alle Leergut-Einträge von <strong>{deleteTarget.kunde}</strong> (Kd.-Nr. {deleteTarget.kundennr}) dauerhaft löschen?
                </p>
                <div className="text-muted small">
                  Bestände: {Object.entries(deleteTarget.bestaende)
                    .filter(([, v]) => v !== 0)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ") || "keine"}
                </div>
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-outline-secondary rounded-3" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Abbrechen
                </button>
                <button className="btn btn-danger rounded-3" onClick={handleDeleteKunde} disabled={deleting}>
                  {deleting ? <><span className="spinner-border spinner-border-sm me-1" />Lösche...</> : "Ja, löschen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
