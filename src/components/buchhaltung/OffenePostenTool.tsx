import React, { useState, useEffect, useCallback, useMemo } from "react";
import PdfDropZone from "./shared/PdfDropZone";
import { extractPdfText } from "./shared/pdfTextExtract";
import { parseGermanFloat } from "./shared/germanNumberUtils";
import {
  getOffenePostenImports,
  getOffenePostenLatest,
  createOffenePostenImport,
  deleteOffenePostenImport,
} from "../../backend/api";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ParsedPosten {
  kontonr: string;
  kunde: string;
  buchNr: string;
  datum: string; // DD.MM.YYYY
  reNr: string;
  betrag: number;
  tageOffen: number;
  mahndatum?: string;
  stufe: string;
}

type Toast = { type: "success" | "error"; msg: string } | null;
type SortKey = "kontonr" | "kunde" | "datum" | "reNr" | "betrag" | "tageOffen";
type SortDir = "asc" | "desc";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Severity-Klasse basierend auf Tage offen */
function severityClass(tage: number): string {
  if (tage >= 60) return "table-danger";
  if (tage >= 30) return "table-warning";
  if (tage >= 14) return "table-warning";
  return "";
}

function severityBadge(tage: number): React.ReactNode {
  if (tage >= 60) return <span className="badge bg-danger">{tage} Tage</span>;
  if (tage >= 30) return <span className="badge bg-warning text-dark">{tage} Tage</span>;
  if (tage >= 14) return <span className="badge bg-warning text-dark">{tage} Tage</span>;
  return <span className="badge bg-secondary">{tage} Tage</span>;
}

/** Nur Kundenname extrahieren (Adressen entfernen) */
function cleanKundeName(name: string): string {
  // Format: "Firmenname, PLZ Ort, Strasse Nr" oder "Firmenname, Ort, ..."
  // Alles ab dem ersten Komma abschneiden
  const commaIdx = name.indexOf(",");
  if (commaIdx > 0) return name.substring(0, commaIdx).trim();

  // Fallback: vor PLZ (4-5 stellig gefolgt von Stadtname)
  let m = name.match(/^(.+?)\s+\d{4,5}\s+[A-ZÄÖÜ]/);
  if (m) return m[1].trim();

  // Fallback: vor Strassenname
  m = name.match(/^(.+?)\s+(?:[A-ZÄÖÜ][a-zäöüß]*(?:str\.|stra[sß]e|weg|platz|allee|gasse|ring|damm))\b/i);
  if (m) return m[1].trim();

  return name.trim();
}

/* ------------------------------------------------------------------ */
/*  Parsing                                                            */
/* ------------------------------------------------------------------ */

// Transaktion: BuchNr Datum ReNr [/n] [nnnn] Betrag [Mahndatum] [Stufe]
// Betrag kann negativ sein (mit -)
const RE_TRANS = /^\s*(\d+)\s+(\d{2}\.\d{2}\.\d{4})\s+(\d+)(\s*\/\d+)?(?:\s+\d{3,5})?\s+([-\d.]+,\d+)\s*(?:(\d{2}\.\d{2}\.\d{4})\s+)?(\d+)?\s*$/;
// Restbetrag-Zeile
const RE_RESTBETRAG = /^\s*(\d+)\s+Restbetrag\s+([-\d.]+,\d+)\s*$/;
// Kunden-Header: 5-stellige Kontonr + Name (auch über Seitenumbrüche wiederholt)
const RE_KUNDE = /^\s*(\d{5})\s+(.+)$/;
// "Offene Posten" Summenzeile pro Kunde
const RE_OP_SUMME = /^\s*Offene Posten\s+([-\d.]+,\d+)/;

const SKIP_PATTERNS = [
  /^Offene Posten$/,
  /^Hacilar GmbH/,
  /^Mandant\s+HACI/,
  /^Jahr\s+\d{4}/,
  /^WinLine Edition/,
  /^Buch\.Nr\./,
  /^FW\s+FW-Skonto/,
  /^Offene Fakturen/,
  /^-\s+Teilzahlung/,
  /^-\s+Skontosumme/,
  /^-\s+FW-Differenzen/,
  /^G\.\s+Faktura/,
  /^G\.\s+Zahlungen/,
  /^G\.\s+Skontobetr/,
  /^G\.\s+FW-Diff/,
  /^FIBU-Ums/,
  /^durchschn\./,
  /^Saldo\s+EUR/,
  /^Seite\s+\d/,
  /^Datum\s+\d{2}\.\d{2}\.\d{4}/,
  /^Haben\s/,
  /^Soll\s/,
  /^-\s+Haben/,
];

function shouldSkip(line: string): boolean {
  const s = line.trim();
  if (!s) return true;
  return SKIP_PATTERNS.some((p) => p.test(s));
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

function parsePdf(lines: string[]): {
  reportDate: Date;
  posten: ParsedPosten[];
} {
  // Berichtsdatum ermitteln
  let reportDate: Date | null = null;
  for (const line of lines) {
    const m = line.match(/Datum\s+(\d{2}\.\d{2}\.\d{4})/);
    if (m) { reportDate = parseDate(m[1]); break; }
  }
  if (!reportDate) reportDate = new Date();

  interface Booking {
    kontonr: string;
    kunde: string;
    buchNr: string;
    datum: Date | null;
    reNr: string;
    teilzahlung: boolean;
    betrag: number;
    mahndatum: Date | null;
    stufe: string;
  }

  const bookings: Booking[] = [];
  const restbetraege = new Map<string, number>();
  // Offene-Posten-Summe pro Kontonr (vom PDF selbst berechnet)
  const opSummen = new Map<string, number>();
  let currentKontonr = "";
  let currentKunde = "";

  for (const line of lines) {
    const s = line.trim();
    if (shouldSkip(s)) continue;

    // Restbetrag
    let m = RE_RESTBETRAG.exec(s);
    if (m) { restbetraege.set(m[1], parseGermanFloat(m[2])); continue; }

    // Offene Posten Summe (Validierung)
    m = RE_OP_SUMME.exec(s);
    if (m && currentKontonr) {
      opSummen.set(currentKontonr, parseGermanFloat(m[1]));
      continue;
    }

    // Transaktion
    m = RE_TRANS.exec(s);
    if (m) {
      bookings.push({
        kontonr: currentKontonr,
        kunde: currentKunde,
        buchNr: m[1],
        datum: parseDate(m[2]),
        reNr: m[3],
        teilzahlung: !!m[4]?.trim(),
        betrag: parseGermanFloat(m[5]),
        mahndatum: m[6] ? parseDate(m[6]) : null,
        stufe: m[7] || "0",
      });
      continue;
    }

    // Kunden-Header (verschiedene Formate)
    m = RE_KUNDE.exec(s);
    if (m) {
      // Prüfe dass es kein Transaktions-Zeilen-Fragment ist
      // Kunden-Header hat typischerweise Firmenname nach der Kontonr
      const rest = m[2].trim();
      if (rest && !/^\d{2}\.\d{2}\.\d{4}/.test(rest) && !/^Restbetrag/.test(rest)) {
        currentKontonr = m[1];
        currentKunde = cleanKundeName(rest);
      }
    }
  }

  // Restbeträge anwenden: ersetze Betrag der Hauptbuchung
  for (const b of bookings) {
    if (restbetraege.has(b.reNr)) {
      b.betrag = restbetraege.get(b.reNr)!;
    }
  }

  // Alle Nicht-Teilzahlungen behalten (auch negative = Gutschriften)
  // Teilzahlungen (/1, /2 etc.) wurden schon durch Restbetrag berücksichtigt
  const filtered = bookings.filter(
    (b) => b.datum !== null && !b.teilzahlung
  );

  // Sortieren
  filtered.sort((a, b) => {
    if (a.kontonr !== b.kontonr) return a.kontonr.localeCompare(b.kontonr);
    return (a.datum?.getTime() || 0) - (b.datum?.getTime() || 0);
  });

  const posten: ParsedPosten[] = filtered.map((b) => ({
    kontonr: b.kontonr,
    kunde: b.kunde,
    buchNr: b.buchNr,
    datum: b.datum!.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }),
    reNr: b.reNr,
    betrag: b.betrag,
    tageOffen: Math.floor((reportDate!.getTime() - b.datum!.getTime()) / (1000 * 60 * 60 * 24)),
    mahndatum: b.mahndatum
      ? b.mahndatum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
      : undefined,
    stufe: b.stufe,
  }));

  // Debug: Log Validierung gegen PDF-Summen
  const kundenSummen = new Map<string, number>();
  for (const p of posten) {
    kundenSummen.set(p.kontonr, (kundenSummen.get(p.kontonr) || 0) + p.betrag);
  }
  for (const [konto, expected] of Array.from(opSummen.entries())) {
    const actual = kundenSummen.get(konto) ?? 0;
    if (Math.abs(actual - expected) > 1) {
      console.warn(`OP Parser: ${konto} Abweichung: PDF=${expected.toFixed(2)} Parser=${actual.toFixed(2)} Diff=${(actual - expected).toFixed(2)}`);
    }
  }

  return { reportDate, posten };
}

/* ------------------------------------------------------------------ */
/*  Excel Export                                                        */
/* ------------------------------------------------------------------ */

async function exportExcel(posten: ParsedPosten[], berichtsDatum: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Offene Posten 2026");

  const headers = ["Kontonr.", "Kunde", "Datum", "Re.-Nr.", "Betrag (EUR)", "Tage offen"];
  const colWidths = [12, 45, 14, 12, 16, 14];

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.columns = colWidths.map((w) => ({ width: w }));
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const p of posten) {
    const row = ws.addRow([p.kontonr, p.kunde, p.datum, p.reNr, p.betrag, p.tageOffen]);
    row.getCell(5).numFmt = '#,##0.00 "EUR"';
    row.getCell(5).alignment = { horizontal: "right" };
    row.getCell(6).alignment = { horizontal: "center" };
    if (p.tageOffen >= 60) {
      row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF9999" } };
    } else if (p.tageOffen >= 30) {
      row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFD699" } };
    } else if (p.tageOffen >= 14) {
      row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFCC" } };
    }
  }

  const sumRow = ws.addRow(["", "", "", "Gesamt:", posten.reduce((s, p) => s + p.betrag, 0), `${posten.length} Posten`]);
  sumRow.getCell(4).font = { bold: true };
  sumRow.getCell(5).font = { bold: true };
  sumRow.getCell(5).numFmt = '#,##0.00 "EUR"';
  sumRow.getCell(5).alignment = { horizontal: "right" };
  sumRow.getCell(6).font = { bold: true };
  sumRow.getCell(6).alignment = { horizontal: "center" };

  const buf = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  saveAs(new Blob([buf]), `offene_posten_2026_${today}.xlsx`);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OffenePostenTool() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Data
  const [posten, setPosten] = useState<ParsedPosten[]>([]);
  const [berichtsDatum, setBerichtsDatum] = useState<Date | null>(null);

  // Upload
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedPosten, setParsedPosten] = useState<ParsedPosten[]>([]);
  const [parsedBerichtsDatum, setParsedBerichtsDatum] = useState<Date | null>(null);

  // Search & Sort & Filters
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tageOffen");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filterHideGutschriften, setFilterHideGutschriften] = useState(false);
  const [filterOnlyGutschriften, setFilterOnlyGutschriften] = useState(false);
  const [filterMinBetrag, setFilterMinBetrag] = useState("");
  const [filterMaxBetrag, setFilterMaxBetrag] = useState("");
  const [filterMinTage, setFilterMinTage] = useState("");
  const [filterMaxTage, setFilterMaxTage] = useState("");
  const [filterDatumVon, setFilterDatumVon] = useState("");
  const [filterDatumBis, setFilterDatumBis] = useState("");
  const [filterKunde, setFilterKunde] = useState("");
  const [filterKontonr, setFilterKontonr] = useState("");

  // Expanded customers
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Toast
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOffenePostenLatest();
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      setPosten(
        data.map((d: any) => {
          const datumDate = new Date(d.datum);
          const tageOffen = Math.floor((now.getTime() - datumDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            kontonr: d.kontonr,
            kunde: cleanKundeName(d.kunde),
            buchNr: d.buchNr,
            datum: datumDate.toLocaleDateString("de-DE"),
            reNr: d.reNr,
            betrag: d.betrag,
            tageOffen,
            mahndatum: d.mahndatum ? new Date(d.mahndatum).toLocaleDateString("de-DE") : undefined,
            stufe: d.stufe,
          };
        })
      );
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Parse date string DD.MM.YYYY to sortable number
  const dateSortValue = useCallback((d: string): number => {
    const parts = d.split(".");
    if (parts.length !== 3) return 0;
    return parseInt(parts[2]) * 10000 + parseInt(parts[1]) * 100 + parseInt(parts[0]);
  }, []);

  // Helper: parse DD.MM.YYYY to Date
  const parseDatumStr = useCallback((d: string): Date | null => {
    const parts = d.split(".");
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }, []);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterHideGutschriften) count++;
    if (filterOnlyGutschriften) count++;
    if (filterMinBetrag) count++;
    if (filterMaxBetrag) count++;
    if (filterMinTage) count++;
    if (filterMaxTage) count++;
    if (filterDatumVon) count++;
    if (filterDatumBis) count++;
    if (filterKunde) count++;
    if (filterKontonr) count++;
    return count;
  }, [filterHideGutschriften, filterOnlyGutschriften, filterMinBetrag, filterMaxBetrag, filterMinTage, filterMaxTage, filterDatumVon, filterDatumBis, filterKunde, filterKontonr]);

  const resetFilters = useCallback(() => {
    setFilterHideGutschriften(false);
    setFilterOnlyGutschriften(false);
    setFilterMinBetrag("");
    setFilterMaxBetrag("");
    setFilterMinTage("");
    setFilterMaxTage("");
    setFilterDatumVon("");
    setFilterDatumBis("");
    setFilterKunde("");
    setFilterKontonr("");
    setSearch("");
  }, []);

  // Filtered + sorted
  const displayPosten = useMemo(() => {
    const source = showUpload && parsedPosten.length > 0 ? parsedPosten : posten;
    let filtered = source;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.kunde.toLowerCase().includes(q) ||
          p.kontonr.includes(q) ||
          p.reNr.includes(q)
      );
    }

    // Gutschriften filter
    if (filterHideGutschriften) {
      filtered = filtered.filter((p) => p.betrag >= 0);
    }
    if (filterOnlyGutschriften) {
      filtered = filtered.filter((p) => p.betrag < 0);
    }

    // Betrag range
    if (filterMinBetrag) {
      const min = parseFloat(filterMinBetrag.replace(",", "."));
      if (!isNaN(min)) filtered = filtered.filter((p) => p.betrag >= min);
    }
    if (filterMaxBetrag) {
      const max = parseFloat(filterMaxBetrag.replace(",", "."));
      if (!isNaN(max)) filtered = filtered.filter((p) => p.betrag <= max);
    }

    // Tage offen range
    if (filterMinTage) {
      const min = parseInt(filterMinTage);
      if (!isNaN(min)) filtered = filtered.filter((p) => p.tageOffen >= min);
    }
    if (filterMaxTage) {
      const max = parseInt(filterMaxTage);
      if (!isNaN(max)) filtered = filtered.filter((p) => p.tageOffen <= max);
    }

    // Datum range
    if (filterDatumVon) {
      const von = new Date(filterDatumVon + "T00:00:00");
      filtered = filtered.filter((p) => {
        const d = parseDatumStr(p.datum);
        return d && d >= von;
      });
    }
    if (filterDatumBis) {
      const bis = new Date(filterDatumBis + "T23:59:59");
      filtered = filtered.filter((p) => {
        const d = parseDatumStr(p.datum);
        return d && d <= bis;
      });
    }

    // Kunde filter (separate from search - exact dropdown style)
    if (filterKunde) {
      const q = filterKunde.toLowerCase();
      filtered = filtered.filter((p) => p.kunde.toLowerCase().includes(q));
    }

    // Kontonr filter
    if (filterKontonr) {
      filtered = filtered.filter((p) => p.kontonr.includes(filterKontonr));
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "kontonr": cmp = a.kontonr.localeCompare(b.kontonr); break;
        case "kunde": cmp = a.kunde.localeCompare(b.kunde); break;
        case "datum": cmp = dateSortValue(a.datum) - dateSortValue(b.datum); break;
        case "reNr": cmp = a.reNr.localeCompare(b.reNr); break;
        case "betrag": cmp = a.betrag - b.betrag; break;
        case "tageOffen": cmp = a.tageOffen - b.tageOffen; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [posten, parsedPosten, showUpload, search, sortKey, sortDir, dateSortValue, parseDatumStr, filterHideGutschriften, filterOnlyGutschriften, filterMinBetrag, filterMaxBetrag, filterMinTage, filterMaxTage, filterDatumVon, filterDatumBis, filterKunde, filterKontonr]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else setSortDir(key === "tageOffen" || key === "betrag" ? "desc" : "asc");
      return key;
    });
  }, []);

  const sortIcon = (key: string) => {
    if (sortKey !== key) return <i className="bi bi-arrow-down-up text-muted ms-1" style={{ fontSize: "0.7em" }} />;
    return sortDir === "asc"
      ? <i className="bi bi-sort-up ms-1" style={{ fontSize: "0.7em" }} />
      : <i className="bi bi-sort-down ms-1" style={{ fontSize: "0.7em" }} />;
  };

  // Grouped by customer
  interface KundenGruppe {
    kontonr: string;
    kunde: string;
    posten: ParsedPosten[];
    gesamtBetrag: number;
    maxTage: number;
    anzahl: number;
  }

  const kundenGruppen = useMemo((): KundenGruppe[] => {
    const map = new Map<string, KundenGruppe>();
    for (const p of displayPosten) {
      let g = map.get(p.kontonr);
      if (!g) {
        g = { kontonr: p.kontonr, kunde: p.kunde, posten: [], gesamtBetrag: 0, maxTage: 0, anzahl: 0 };
        map.set(p.kontonr, g);
      }
      g.posten.push(p);
      g.gesamtBetrag += p.betrag;
      g.maxTage = Math.max(g.maxTage, p.tageOffen);
      g.anzahl++;
    }
    const groups = Array.from(map.values());
    // Sort groups by max tageOffen desc (most critical first)
    groups.sort((a, b) => b.maxTage - a.maxTage);
    return groups;
  }, [displayPosten]);

  const toggleExpand = useCallback((kontonr: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(kontonr)) next.delete(kontonr);
      else next.add(kontonr);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(kundenGruppen.map((g) => g.kontonr)));
  }, [kundenGruppen]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  // Summary stats
  const stats = useMemo(() => {
    const source = displayPosten;
    const gesamtBetrag = source.reduce((s, p) => s + p.betrag, 0);
    const kundenSet = new Set(source.map((p) => p.kontonr));
    const maxTage = source.length > 0 ? Math.max(...source.map((p) => p.tageOffen)) : 0;
    const kritisch = source.filter((p) => p.tageOffen >= 30).length;
    return { gesamtBetrag, anzahlKunden: kundenSet.size, maxTage, kritisch, gesamt: source.length };
  }, [displayPosten]);

  // Upload handlers
  const handleFileDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploadFile(file);
    setParsing(true);
    try {
      const lines = await extractPdfText(file);
      const result = parsePdf(lines);
      setParsedPosten(result.posten);
      setParsedBerichtsDatum(result.reportDate);
      if (result.posten.length === 0) {
        setToast({ type: "error", msg: "Keine passenden Posten im PDF gefunden." });
      }
    } catch (err: any) {
      setToast({ type: "error", msg: "PDF konnte nicht gelesen werden: " + (err?.message || "") });
    } finally { setParsing(false); }
  }, []);

  const handleSave = useCallback(async () => {
    if (!parsedBerichtsDatum || parsedPosten.length === 0) return;
    setSaving(true);
    try {
      // Delete all existing imports first
      const existingImports = await getOffenePostenImports();
      for (const imp of existingImports) {
        try { await deleteOffenePostenImport(imp.id); } catch { /* ignore */ }
      }

      await createOffenePostenImport({
        berichtsDatum: parsedBerichtsDatum.toISOString(),
        dateiname: uploadFile?.name || "Offene-Posten.PDF",
        posten: parsedPosten.map((p) => {
          const parts = p.datum.split(".");
          const isoDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).toISOString();
          return {
            kontonr: p.kontonr,
            kunde: p.kunde,
            buchNr: p.buchNr,
            datum: isoDate,
            reNr: p.reNr,
            betrag: p.betrag,
            tageOffen: p.tageOffen,
            mahndatum: p.mahndatum
              ? (() => { const mp = p.mahndatum!.split("."); return new Date(parseInt(mp[2]), parseInt(mp[1]) - 1, parseInt(mp[0])).toISOString(); })()
              : undefined,
            stufe: p.stufe,
          };
        }),
      });
      setToast({ type: "success", msg: `${parsedPosten.length} Posten gespeichert.` });
      setShowUpload(false);
      setParsedPosten([]);
      setUploadFile(null);
      loadData();
    } catch (err: any) {
      setToast({ type: "error", msg: "Speichern fehlgeschlagen: " + (err?.message || "") });
    } finally { setSaving(false); }
  }, [parsedBerichtsDatum, parsedPosten, uploadFile, loadData]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1400 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          <i className="bi bi-receipt me-2" />
          Offene Posten
        </h2>
        <div className="d-flex gap-2">
          {displayPosten.length > 0 && (
            <button
              className="btn btn-outline-success"
              onClick={() => exportExcel(displayPosten, berichtsDatum?.toISOString() || new Date().toISOString())}
            >
              <i className="bi bi-file-earmark-excel me-1" />
              Excel
            </button>
          )}
          <button
            className={`btn ${showUpload ? "btn-outline-secondary" : "btn-primary"}`}
            onClick={() => {
              setShowUpload(!showUpload);
              setParsedPosten([]);
              setUploadFile(null);
            }}
          >
            {showUpload ? (
              <><i className="bi bi-x-lg me-1" />Abbrechen</>
            ) : (
              <><i className="bi bi-cloud-arrow-up me-1" />PDF hochladen</>
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

      {/* Upload */}
      {showUpload && (
        <div className="card mb-4 border-primary">
          <div className="card-body">
            {!uploadFile && !parsing && (
              <PdfDropZone onFilesSelected={handleFileDrop} label="Offene-Posten PDF hier ablegen" />
            )}
            {parsing && (
              <div className="text-center py-3">
                <div className="spinner-border text-primary" />
                <p className="mt-2 mb-0">PDF wird verarbeitet...</p>
              </div>
            )}
            {uploadFile && !parsing && (
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <i className="bi bi-file-earmark-pdf text-danger me-2" />
                  <strong>{uploadFile.name}</strong>
                  <span className="text-muted ms-2">
                    — {parsedPosten.length} Posten gefunden
                    {parsedBerichtsDatum && <>, Berichtsdatum: {parsedBerichtsDatum.toLocaleDateString("de-DE")}</>}
                  </span>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-success" onClick={handleSave} disabled={saving || parsedPosten.length === 0}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-1" />Speichere...</> : <><i className="bi bi-check-lg me-1" />Speichern</>}
                  </button>
                  <button className="btn btn-outline-secondary" onClick={() => { setUploadFile(null); setParsedPosten([]); }}>
                    Andere Datei
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && displayPosten.length > 0 && (
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="card text-center">
              <div className="card-body py-2">
                <div className="text-muted small">Gesamtbetrag</div>
                <div className="fs-5 fw-bold text-primary">
                  {stats.gesamtBetrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card text-center">
              <div className="card-body py-2">
                <div className="text-muted small">Posten / Kunden</div>
                <div className="fs-5 fw-bold">{stats.gesamt} / {stats.anzahlKunden}</div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card text-center">
              <div className="card-body py-2">
                <div className="text-muted small">Aeltester Posten</div>
                <div className={`fs-5 fw-bold ${stats.maxTage >= 60 ? "text-danger" : stats.maxTage >= 30 ? "text-warning" : ""}`}>
                  {stats.maxTage} Tage
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card text-center">
              <div className="card-body py-2">
                <div className="text-muted small">Kritisch (30+ Tage)</div>
                <div className={`fs-5 fw-bold ${stats.kritisch > 0 ? "text-danger" : "text-success"}`}>
                  {stats.kritisch}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter Bar */}
      {(posten.length > 0 || parsedPosten.length > 0) && (
        <div className="mb-3">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            {/* Schnellsuche */}
            <div className="input-group" style={{ maxWidth: 350 }}>
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

            {/* Filter Toggle */}
            <button
              className={`btn btn-sm ${showFilters ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <i className="bi bi-funnel me-1" />
              Filter
              {activeFilterCount > 0 && (
                <span className="badge bg-danger ms-1">{activeFilterCount}</span>
              )}
            </button>

            {/* Quick-Filter Buttons */}
            <button
              className={`btn btn-sm ${filterHideGutschriften ? "btn-warning" : "btn-outline-secondary"}`}
              onClick={() => { setFilterHideGutschriften(!filterHideGutschriften); setFilterOnlyGutschriften(false); }}
              title="Gutschriften (negative Betraege) ausblenden"
            >
              Ohne Gutschriften
            </button>
            <button
              className={`btn btn-sm ${filterMinTage === "30" && !filterMaxTage ? "btn-danger" : "btn-outline-secondary"}`}
              onClick={() => {
                if (filterMinTage === "30" && !filterMaxTage) { setFilterMinTage(""); }
                else { setFilterMinTage("30"); setFilterMaxTage(""); }
              }}
              title="Nur Posten die 30+ Tage offen sind"
            >
              30+ Tage
            </button>
            <button
              className={`btn btn-sm ${filterMinTage === "60" && !filterMaxTage ? "btn-danger" : "btn-outline-secondary"}`}
              onClick={() => {
                if (filterMinTage === "60" && !filterMaxTage) { setFilterMinTage(""); }
                else { setFilterMinTage("60"); setFilterMaxTage(""); }
              }}
            >
              60+ Tage
            </button>
            <button
              className={`btn btn-sm ${filterMinTage === "90" && !filterMaxTage ? "btn-danger" : "btn-outline-secondary"}`}
              onClick={() => {
                if (filterMinTage === "90" && !filterMaxTage) { setFilterMinTage(""); }
                else { setFilterMinTage("90"); setFilterMaxTage(""); }
              }}
            >
              90+ Tage
            </button>

            {activeFilterCount > 0 && (
              <button className="btn btn-sm btn-outline-danger" onClick={resetFilters}>
                <i className="bi bi-x-circle me-1" />Alle Filter zurucksetzen
              </button>
            )}

            {/* Result count */}
            <span className="text-muted small ms-auto">
              {displayPosten.length} Posten angezeigt
            </span>
          </div>

          {/* Erweiterte Filter (aufklappbar) */}
          {showFilters && (
            <div className="card mt-2 border-0 shadow-sm">
              <div className="card-body py-3">
                <div className="row g-3">
                  {/* Kunde */}
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Kunde</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Kundenname..."
                      value={filterKunde}
                      onChange={(e) => setFilterKunde(e.target.value)}
                    />
                  </div>
                  {/* Kontonr */}
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Kontonr.</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="z.B. 15300"
                      value={filterKontonr}
                      onChange={(e) => setFilterKontonr(e.target.value)}
                    />
                  </div>
                  {/* Betrag von-bis */}
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Betrag von</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Min EUR"
                      value={filterMinBetrag}
                      onChange={(e) => setFilterMinBetrag(e.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Betrag bis</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Max EUR"
                      value={filterMaxBetrag}
                      onChange={(e) => setFilterMaxBetrag(e.target.value)}
                    />
                  </div>
                  {/* Typ */}
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Typ</label>
                    <div className="d-flex gap-2">
                      <div className="form-check form-check-inline">
                        <input className="form-check-input" type="checkbox" id="fHideGS" checked={filterHideGutschriften}
                          onChange={(e) => { setFilterHideGutschriften(e.target.checked); if (e.target.checked) setFilterOnlyGutschriften(false); }} />
                        <label className="form-check-label small" htmlFor="fHideGS">Ohne Gutschriften</label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input className="form-check-input" type="checkbox" id="fOnlyGS" checked={filterOnlyGutschriften}
                          onChange={(e) => { setFilterOnlyGutschriften(e.target.checked); if (e.target.checked) setFilterHideGutschriften(false); }} />
                        <label className="form-check-label small" htmlFor="fOnlyGS">Nur Gutschriften</label>
                      </div>
                    </div>
                  </div>
                  {/* Tage offen von-bis */}
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Tage offen von</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      placeholder="Min"
                      value={filterMinTage}
                      onChange={(e) => setFilterMinTage(e.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Tage offen bis</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      placeholder="Max"
                      value={filterMaxTage}
                      onChange={(e) => setFilterMaxTage(e.target.value)}
                    />
                  </div>
                  {/* Datum von-bis */}
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Datum von</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={filterDatumVon}
                      onChange={(e) => setFilterDatumVon(e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Datum bis</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={filterDatumBis}
                      onChange={(e) => setFilterDatumBis(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : kundenGruppen.length > 0 ? (
        <>
          <div className="d-flex gap-2 mb-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={expandAll}>
              <i className="bi bi-arrows-expand me-1" />Alle aufklappen
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={collapseAll}>
              <i className="bi bi-arrows-collapse me-1" />Alle zuklappen
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead className="table-dark">
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("kontonr")}>
                    Kontonr. {sortIcon("kontonr")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("kunde")}>
                    Kunde {sortIcon("kunde")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("datum")}>
                    Datum {sortIcon("datum")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("reNr")}>
                    Re.-Nr. {sortIcon("reNr")}
                  </th>
                  <th className="text-end" style={{ cursor: "pointer" }} onClick={() => handleSort("betrag")}>
                    Betrag (EUR) {sortIcon("betrag")}
                  </th>
                  <th className="text-center" style={{ cursor: "pointer" }} onClick={() => handleSort("tageOffen")}>
                    Tage offen {sortIcon("tageOffen")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {kundenGruppen.map((g) => {
                  const isOpen = expanded.has(g.kontonr);
                  return (
                    <React.Fragment key={g.kontonr}>
                      {/* Kunden-Header-Zeile */}
                      <tr
                        className={severityClass(g.maxTage)}
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleExpand(g.kontonr)}
                      >
                        <td className="text-center">
                          <i className={`bi ${isOpen ? "bi-chevron-down" : "bi-chevron-right"}`} />
                        </td>
                        <td className="fw-bold">{g.kontonr}</td>
                        <td className="fw-bold">{g.kunde}</td>
                        <td className="text-muted">{g.anzahl} Posten</td>
                        <td></td>
                        <td className="text-end fw-bold">
                          {g.gesamtBetrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                        </td>
                        <td className="text-center">{severityBadge(g.maxTage)}</td>
                      </tr>
                      {/* Einzelposten (nur wenn aufgeklappt) */}
                      {isOpen && g.posten.map((p, i) => (
                        <tr key={i} style={{ backgroundColor: "#f8f9fa" }}>
                          <td></td>
                          <td className="text-muted ps-3">{p.kontonr}</td>
                          <td className="ps-3">{p.kunde}</td>
                          <td>{p.datum}</td>
                          <td>{p.reNr}</td>
                          <td className="text-end">
                            {p.betrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                          </td>
                          <td className="text-center">{severityBadge(p.tageOffen)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="table-secondary fw-bold">
                  <td></td>
                  <td colSpan={4} className="text-end">Gesamt:</td>
                  <td className="text-end">
                    {stats.gesamtBetrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                  </td>
                  <td className="text-center">{stats.gesamt} Posten</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        !showUpload && !loading && (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox" style={{ fontSize: 48 }} />
            <p className="mt-2">Noch keine Daten vorhanden. Laden Sie ein PDF hoch.</p>
          </div>
        )
      )}
    </div>
  );
}
