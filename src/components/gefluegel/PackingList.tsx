import React, { useState, useCallback } from "react";
import jsPDF from "jspdf";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Tabelle {
  id: number;
  datum: string;        // DD.MM.YYYY
  charge: string;
  postenAnzahl: number;
  mitGewicht: boolean;
  gewichte: string[];   // raw strings – parsed on PDF generation
}

type Toast = { type: "success" | "error"; msg: string } | null;

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */

let nextId = 1;

function leereTabelle(): Tabelle {
  return {
    id: nextId++,
    datum: "",
    charge: "",
    postenAnzahl: 5,
    mitGewicht: false,
    gewichte: Array(5).fill(""),
  };
}

function formatGewicht(val: number): string {
  if (val === Math.floor(val)) return `${Math.floor(val)} kg`;
  return `${val.toFixed(1).replace(".", ",")} kg`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PackingList() {
  const [tabellen, setTabellen] = useState<Tabelle[]>([leereTabelle()]);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  /* -- toast auto-hide ------------------------------------------------ */
  React.useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  /* -- tabellen CRUD -------------------------------------------------- */
  const addTabelle = () => setTabellen((p) => [...p, leereTabelle()]);

  const removeTabelle = (id: number) =>
    setTabellen((p) => p.filter((t) => t.id !== id));

  const updateTabelle = (id: number, patch: Partial<Tabelle>) =>
    setTabellen((p) =>
      p.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...patch };
        // sync gewichte array length with postenAnzahl
        if (patch.postenAnzahl !== undefined) {
          const diff = patch.postenAnzahl - t.gewichte.length;
          if (diff > 0) {
            updated.gewichte = [...t.gewichte, ...Array(diff).fill("")];
          } else if (diff < 0) {
            updated.gewichte = t.gewichte.slice(0, patch.postenAnzahl);
          }
        }
        return updated;
      })
    );

  const updateGewicht = (tabelleId: number, idx: number, val: string) =>
    setTabellen((p) =>
      p.map((t) => {
        if (t.id !== tabelleId) return t;
        const gew = [...t.gewichte];
        gew[idx] = val;
        return { ...t, gewichte: gew };
      })
    );

  /* -- PDF generation ------------------------------------------------- */
  const generatePdf = useCallback(async () => {
    // Validate
    const valid = tabellen.filter((t) => t.datum.trim() !== "");
    if (valid.length === 0) {
      setToast({ type: "error", msg: "Bitte mindestens eine Tabelle mit Schlachtdatum ausfuellen." });
      return;
    }

    setGenerating(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Load briefkopf image
      const img = await loadImage(`${process.env.PUBLIC_URL}/briefkopf.jpg`);

      const startY = 108;
      const colPositions = [22, 116];
      const tabWidth = 85;
      let tablesOnPage = 0;
      let isFirstPage = true;

      for (const tab of valid) {
        if (tablesOnPage >= 2) {
          pdf.addPage();
          tablesOnPage = 0;
        }

        // Draw briefkopf on each new page
        if (tablesOnPage === 0) {
          if (!isFirstPage) {
            // addPage already called above
          }
          pdf.addImage(img, "JPEG", 0, 0, 210, 297);
          isFirstPage = false;
        }

        const col = tablesOnPage % 2;
        const x = colPositions[col];
        let y = startY;

        // Schlachtdatum
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);
        pdf.text(`Schlachtdatum: ${tab.datum}`, x, y + 5);

        // Chargennummer
        let headerOffset = 14;
        if (tab.charge.trim()) {
          pdf.text(`Chargennummer: ${tab.charge}`, x, y + 14);
          headerOffset = 22;
        }

        // Posten table
        const tableY = y + headerOffset;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);

        const colW1 = 35;
        const colW2 = 40;

        for (let p = 0; p < tab.postenAnzahl; p++) {
          const py = tableY + p * 8;

          // Borders
          pdf.setDrawColor(100, 100, 100);
          pdf.setLineWidth(0.3);
          pdf.rect(x, py, colW1, 8);
          pdf.rect(x + colW1, py, colW2, 8);

          // Posten text
          pdf.text(`Posten ${p + 1}`, x + 2, py + 5.5);

          // Gewicht
          if (tab.mitGewicht) {
            const raw = tab.gewichte[p] || "";
            const parsed = parseFloat(raw.replace(",", "."));
            if (!isNaN(parsed) && parsed > 0) {
              pdf.text(formatGewicht(parsed), x + colW1 + 2, py + 5.5);
            }
          }
        }

        tablesOnPage++;
      }

      // First page briefkopf (if only one table, image was already drawn)
      // Save
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      pdf.save(`Packing-List-${dateStr}.pdf`);

      setToast({ type: "success", msg: "PDF wurde erstellt und heruntergeladen." });
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", msg: e?.message ?? "PDF-Erstellung fehlgeschlagen." });
    } finally {
      setGenerating(false);
    }
  }, [tabellen]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 900 }}>
      <h2 className="mb-4">
        <i className="bi bi-box-seam me-2" />
        Packing List Generator
      </h2>

      {/* Toast */}
      {toast && (
        <div className={`alert alert-${toast.type === "success" ? "success" : "danger"} alert-dismissible fade show`}>
          {toast.msg}
          <button type="button" className="btn-close" onClick={() => setToast(null)} />
        </div>
      )}

      {/* Tabellen */}
      {tabellen.map((tab, tIdx) => (
        <div key={tab.id} className="card mb-3 shadow-sm">
          <div className="card-header d-flex justify-content-between align-items-center bg-light">
            <h5 className="mb-0">Tabelle {tIdx + 1}</h5>
            {tabellen.length > 1 && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => removeTabelle(tab.id)}
              >
                <i className="bi bi-trash me-1" />
                Entfernen
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Schlachtdatum</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="TT.MM.JJJJ"
                  value={tab.datum}
                  onChange={(e) => updateTabelle(tab.id, { datum: e.target.value })}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Chargennummer</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="z.B. 12345"
                  value={tab.charge}
                  onChange={(e) => updateTabelle(tab.id, { charge: e.target.value })}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Anzahl Posten</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={20}
                  value={tab.postenAnzahl}
                  onChange={(e) =>
                    updateTabelle(tab.id, {
                      postenAnzahl: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                    })
                  }
                />
              </div>
            </div>

            <div className="form-check mt-3">
              <input
                className="form-check-input"
                type="checkbox"
                id={`gew-${tab.id}`}
                checked={tab.mitGewicht}
                onChange={(e) => updateTabelle(tab.id, { mitGewicht: e.target.checked })}
              />
              <label className="form-check-label" htmlFor={`gew-${tab.id}`}>
                Gewichte eingeben
              </label>
            </div>

            {tab.mitGewicht && (
              <div className="mt-3">
                {Array.from({ length: tab.postenAnzahl }, (_, i) => (
                  <div key={i} className="row g-2 mb-2 align-items-center">
                    <div className="col-auto" style={{ minWidth: 100 }}>
                      <span className="fw-semibold">Posten {i + 1}:</span>
                    </div>
                    <div className="col" style={{ maxWidth: 200 }}>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Gewicht in kg"
                        value={tab.gewichte[i] || ""}
                        onChange={(e) => updateGewicht(tab.id, i, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="d-flex gap-2 mb-4">
        <button className="btn btn-success" onClick={addTabelle}>
          <i className="bi bi-plus-lg me-1" />
          Tabelle hinzufuegen
        </button>
        <button
          className="btn btn-primary"
          onClick={generatePdf}
          disabled={generating}
        >
          {generating ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Erstelle PDF...
            </>
          ) : (
            <>
              <i className="bi bi-file-earmark-pdf me-1" />
              PDF erstellen
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Image loader helper                                                */
/* ------------------------------------------------------------------ */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Briefkopf-Bild konnte nicht geladen werden.`));
    img.src = src;
  });
}
