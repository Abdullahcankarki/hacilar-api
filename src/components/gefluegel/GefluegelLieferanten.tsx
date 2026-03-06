import React, { useEffect, useMemo, useState } from "react";
import {
  getAllGefluegelLieferanten,
  createGefluegelLieferant,
  updateGefluegelLieferant,
  deleteGefluegelLieferant,
} from "../../backend/api";
import { GefluegelLieferantResource } from "../../Resources";

type Toast = { type: "success" | "error"; msg: string } | null;

const emptyForm: Omit<GefluegelLieferantResource, "id"> = {
  name: "",
  sollProzent: 0.685,
  ekProKg: 0,
  zerlegungskostenProKiste: 1.5,
  kistenGewichtKg: 10,
  aktiv: true,
  reihenfolge: 0,
};

export default function GefluegelLieferanten() {
  const [items, setItems] = useState<GefluegelLieferantResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GefluegelLieferantResource | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState<GefluegelLieferantResource | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItems(await getAllGefluegelLieferanten());
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

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name)),
    [items]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, reihenfolge: items.length });
    setShowModal(true);
  };

  const openEdit = (l: GefluegelLieferantResource) => {
    setEditing(l);
    setForm({
      name: l.name,
      sollProzent: l.sollProzent,
      ekProKg: l.ekProKg,
      zerlegungskostenProKiste: l.zerlegungskostenProKiste,
      kistenGewichtKg: l.kistenGewichtKg,
      aktiv: l.aktiv,
      reihenfolge: l.reihenfolge,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      if (editing?.id) {
        const saved = await updateGefluegelLieferant(editing.id, form);
        setItems((prev) => prev.map((x) => (x.id === editing.id ? saved : x)));
        setToast({ type: "success", msg: "Lieferant aktualisiert" });
      } else {
        const saved = await createGefluegelLieferant(form);
        setItems((prev) => [...prev, saved]);
        setToast({ type: "success", msg: "Lieferant angelegt" });
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
      await deleteGefluegelLieferant(deleting.id);
      setItems((prev) => prev.filter((x) => x.id !== deleting.id));
      setDeleting(null);
      setToast({ type: "success", msg: "Lieferant gelöscht" });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Löschen fehlgeschlagen" });
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (loading)
    return (
      <div className="container my-4 text-center">
        <div className="spinner-border" />
      </div>
    );

  return (
    <div className="container my-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Geflügel-Lieferanten</h4>
        <button className="btn btn-dark rounded-3" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" /> Neuer Lieferant
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-muted text-center py-5">Keine Lieferanten vorhanden.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>SOLL-%</th>
                <th>EK/Kg</th>
                <th>Zer.Kosten/Kiste</th>
                <th>Kg/Kiste</th>
                <th>Status</th>
                <th style={{ width: 140 }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((l, i) => (
                <tr key={l.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td className="fw-medium">{l.name}</td>
                  <td>{(l.sollProzent * 100).toFixed(1)}%</td>
                  <td>{l.ekProKg.toFixed(2)} €</td>
                  <td>{l.zerlegungskostenProKiste.toFixed(2)} €</td>
                  <td>{l.kistenGewichtKg} kg</td>
                  <td>
                    <span className={`badge ${l.aktiv ? "bg-success" : "bg-secondary"}`}>
                      {l.aktiv ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-outline-secondary btn-sm rounded-3 me-1"
                      onClick={() => openEdit(l)}
                    >
                      <i className="bi bi-pencil-square" />
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm rounded-3"
                      onClick={() => setDeleting(l)}
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
                  {editing ? "Lieferant bearbeiten" : "Neuer Lieferant"}
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
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label">SOLL-% *</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        step="0.5"
                        value={parseFloat((form.sollProzent * 100).toFixed(1))}
                        onChange={(e) =>
                          updateField("sollProzent", parseFloat(e.target.value) / 100)
                        }
                      />
                      <span className="input-group-text">%</span>
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label">EK pro Kg *</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        step="0.01"
                        value={form.ekProKg}
                        onChange={(e) =>
                          updateField("ekProKg", parseFloat(e.target.value) || 0)
                        }
                      />
                      <span className="input-group-text">€</span>
                    </div>
                  </div>
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label">Zer.Kosten/Kiste *</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        step="0.1"
                        value={form.zerlegungskostenProKiste}
                        onChange={(e) =>
                          updateField(
                            "zerlegungskostenProKiste",
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                      <span className="input-group-text">€</span>
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Kg pro Kiste</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        step="1"
                        value={form.kistenGewichtKg}
                        onChange={(e) =>
                          updateField("kistenGewichtKg", parseFloat(e.target.value) || 10)
                        }
                      />
                      <span className="input-group-text">kg</span>
                    </div>
                  </div>
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label">Reihenfolge</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.reihenfolge}
                      onChange={(e) =>
                        updateField("reihenfolge", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="col-6 d-flex align-items-end">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={form.aktiv}
                        onChange={(e) => updateField("aktiv", e.target.checked)}
                      />
                      <label className="form-check-label">Aktiv</label>
                    </div>
                  </div>
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
                  disabled={submitting || !form.name.trim()}
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
