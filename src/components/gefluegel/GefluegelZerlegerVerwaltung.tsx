import React, { useEffect, useMemo, useState } from "react";
import {
  getAllGefluegelZerleger,
  createGefluegelZerleger,
  updateGefluegelZerleger,
  deleteGefluegelZerleger,
} from "../../backend/api";
import { GefluegelZerlegerResource, ZerlegerKategorie } from "../../Resources";

type Toast = { type: "success" | "error"; msg: string } | null;

export default function GefluegelZerlegerVerwaltung() {
  const [items, setItems] = useState<GefluegelZerlegerResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GefluegelZerlegerResource | null>(null);
  const [formName, setFormName] = useState("");
  const [formAktiv, setFormAktiv] = useState(true);
  const [formKategorien, setFormKategorien] = useState<ZerlegerKategorie[]>(["haehnchen"]);
  const [formReihenfolge, setFormReihenfolge] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState<GefluegelZerlegerResource | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItems(await getAllGefluegelZerleger());
      } catch (e: any) {
        setToast({ type: "error", msg: e?.message ?? "Laden fehlgeschlagen" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((z) => (onlyActive ? z.aktiv : true))
      .filter((z) => (q ? z.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name));
  }, [items, query, onlyActive]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormAktiv(true);
    setFormKategorien(["haehnchen"]);
    setFormReihenfolge(items.length);
    setShowModal(true);
  };

  const openEdit = (z: GefluegelZerlegerResource) => {
    setEditing(z);
    setFormName(z.name);
    setFormAktiv(z.aktiv);
    setFormKategorien(z.kategorien ?? ["haehnchen"]);
    setFormReihenfolge(z.reihenfolge);
    setShowModal(true);
  };

  const toggleKategorie = (kat: ZerlegerKategorie) => {
    setFormKategorien((prev) =>
      prev.includes(kat) ? prev.filter((k) => k !== kat) : [...prev, kat]
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      if (editing?.id) {
        const saved = await updateGefluegelZerleger(editing.id, {
          name: formName.trim(),
          kategorien: formKategorien,
          aktiv: formAktiv,
          reihenfolge: formReihenfolge,
        });
        setItems((prev) =>
          prev.map((x) => (x.id === editing.id ? saved : x))
        );
        setToast({ type: "success", msg: "Zerleger aktualisiert" });
      } else {
        const saved = await createGefluegelZerleger({
          name: formName.trim(),
          kategorien: formKategorien,
          aktiv: formAktiv,
          reihenfolge: formReihenfolge,
        });
        setItems((prev) => [...prev, saved]);
        setToast({ type: "success", msg: "Zerleger angelegt" });
      }
      setShowModal(false);
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Speichern fehlgeschlagen" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting?.id) return;
    setSubmitting(true);
    try {
      await deleteGefluegelZerleger(deleting.id);
      setItems((prev) => prev.filter((x) => x.id !== deleting.id));
      setDeleting(null);
      setToast({ type: "success", msg: "Zerleger gelöscht" });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Löschen fehlgeschlagen" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="container my-4 text-center">
        <div className="spinner-border" />
      </div>
    );

  return (
    <div className="container my-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Geflügel-Zerleger</h4>
        <button className="btn btn-dark rounded-3" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" /> Neuer Zerleger
        </button>
      </div>

      {/* Filter */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-md-8">
              <div className="input-group">
                <span className="input-group-text bg-light border-0">
                  <i className="bi bi-search" />
                </span>
                <input
                  className="form-control border-0"
                  placeholder="Suche nach Name…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                />
                <label className="form-check-label">nur Aktive</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-muted text-center py-5">Keine Zerleger gefunden.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Kategorien</th>
                <th>Status</th>
                <th style={{ width: 140 }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((z) => (
                <tr key={z.id}>
                  <td className="text-muted">{z.reihenfolge}</td>
                  <td className="fw-medium">{z.name}</td>
                  <td>
                    {(z.kategorien ?? ["haehnchen"]).map((k) => (
                      <span key={k} className="badge bg-info me-1">
                        {k === "haehnchen" ? "Hähnchen" : k === "pute_fluegel" ? "Pute Flügel" : "Pute Keule"}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        z.aktiv ? "bg-success" : "bg-secondary"
                      }`}
                    >
                      {z.aktiv ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-outline-secondary btn-sm rounded-3 me-1"
                      onClick={() => openEdit(z)}
                    >
                      <i className="bi bi-pencil-square" />
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm rounded-3"
                      onClick={() => setDeleting(z)}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 rounded-4 shadow-lg">
              <div className="modal-header border-0">
                <h5 className="modal-title fw-semibold">
                  {editing ? "Zerleger bearbeiten" : "Neuer Zerleger"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Name *</label>
                  <input
                    className="form-control"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Kategorien</label>
                  <div>
                    {([
                      ["haehnchen", "Hähnchen"],
                      ["pute_fluegel", "Pute Flügel"],
                      ["pute_keule", "Pute Keule"],
                    ] as [ZerlegerKategorie, string][]).map(([kat, label]) => (
                      <div className="form-check form-check-inline" key={kat}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`kat-${kat}`}
                          checked={formKategorien.includes(kat)}
                          onChange={() => toggleKategorie(kat)}
                        />
                        <label className="form-check-label" htmlFor={`kat-${kat}`}>
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Reihenfolge</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formReihenfolge}
                    onChange={(e) => setFormReihenfolge(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={formAktiv}
                    onChange={(e) => setFormAktiv(e.target.checked)}
                  />
                  <label className="form-check-label">Aktiv</label>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button
                  className="btn btn-outline-secondary rounded-3"
                  onClick={() => setShowModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-dark rounded-3"
                  disabled={submitting || !formName.trim()}
                  onClick={handleSave}
                >
                  {submitting ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleting && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setDeleting(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 rounded-4 shadow-lg">
              <div className="modal-header border-0">
                <h5 className="modal-title fw-semibold">Löschen bestätigen</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeleting(null)}
                />
              </div>
              <div className="modal-body">
                <p>
                  Möchten Sie <strong>{deleting.name}</strong> dauerhaft löschen?
                </p>
              </div>
              <div className="modal-footer border-0">
                <button
                  className="btn btn-outline-secondary rounded-3"
                  onClick={() => setDeleting(null)}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-danger rounded-3"
                  disabled={submitting}
                  onClick={handleDelete}
                >
                  {submitting ? "Lösche…" : "Ja, löschen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`position-fixed bottom-0 end-0 m-3 p-3 rounded-3 text-white ${
            toast.type === "success" ? "bg-success" : "bg-danger"
          }`}
          style={{ zIndex: 9999 }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
