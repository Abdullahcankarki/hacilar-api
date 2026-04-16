import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getAllGefluegelZerleger,
  createGefluegelZerleger,
  updateGefluegelZerleger,
  deleteGefluegelZerleger,
} from "../../backend/api";
import { GefluegelZerlegerResource, ZerlegerKategorie } from "../../Resources";

type Toast = { type: "success" | "error"; msg: string } | null;
type Filter = "alle" | ZerlegerKategorie;

const KATEGORIE_OPTIONEN: [ZerlegerKategorie, string][] = [
  ["haehnchen", "Hähnchen"],
  ["pute_fluegel", "Pute Flügel"],
  ["pute_keule", "Pute Keule"],
  ["ganz_haehnchen", "Ganz Hähnchen"],
  ["brust", "Brust"],
];

const KATEGORIE_LABEL: Record<ZerlegerKategorie, string> = {
  haehnchen: "Hähnchen",
  pute_fluegel: "Pute Flügel",
  pute_keule: "Pute Keule",
  ganz_haehnchen: "Ganz Hähnchen",
  brust: "Brust",
};

function SortableRow({
  z,
  onEdit,
  onDelete,
}: {
  z: GefluegelZerlegerResource;
  onEdit: (z: GefluegelZerlegerResource) => void;
  onDelete: (z: GefluegelZerlegerResource) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: z.id!,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "#f8f9fa" : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ width: 40 }}>
        <span
          {...attributes}
          {...listeners}
          className="text-muted"
          style={{ cursor: "grab", userSelect: "none" }}
          title="Ziehen zum Sortieren"
        >
          <i className="bi bi-grip-vertical" />
        </span>
      </td>
      <td className="text-muted small">{z.reihenfolge}</td>
      <td className="fw-medium">{z.name}</td>
      <td>
        {(z.kategorien ?? []).map((k) => (
          <span key={k} className="badge bg-info me-1">
            {KATEGORIE_LABEL[k]}
          </span>
        ))}
      </td>
      <td>
        <span className={`badge ${z.aktiv ? "bg-success" : "bg-secondary"}`}>
          {z.aktiv ? "Aktiv" : "Inaktiv"}
        </span>
      </td>
      <td>
        <button
          className="btn btn-outline-secondary btn-sm rounded-3 me-1"
          onClick={() => onEdit(z)}
        >
          <i className="bi bi-pencil-square" />
        </button>
        <button
          className="btn btn-outline-danger btn-sm rounded-3"
          onClick={() => onDelete(z)}
        >
          <i className="bi bi-trash" />
        </button>
      </td>
    </tr>
  );
}

export default function GefluegelZerlegerVerwaltung() {
  const [items, setItems] = useState<GefluegelZerlegerResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [filter, setFilter] = useState<Filter>("alle");
  const [toast, setToast] = useState<Toast>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GefluegelZerlegerResource | null>(null);
  const [formName, setFormName] = useState("");
  const [formAktiv, setFormAktiv] = useState(true);
  const [formKategorien, setFormKategorien] = useState<ZerlegerKategorie[]>(["haehnchen"]);
  const [formReihenfolge, setFormReihenfolge] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [deleting, setDeleting] = useState<GefluegelZerlegerResource | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
      .filter((z) => (filter === "alle" ? true : (z.kategorien ?? []).includes(filter)))
      .filter((z) => (q ? z.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name));
  }, [items, query, onlyActive, filter]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormAktiv(true);
    setFormKategorien(filter === "alle" ? ["haehnchen"] : [filter]);
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
        setItems((prev) => prev.map((x) => (x.id === editing.id ? saved : x)));
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = filtered.findIndex((z) => z.id === active.id);
    const newIdx = filtered.findIndex((z) => z.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    // Neue Reihenfolge der gefilterten Liste
    const reordered = arrayMove(filtered, oldIdx, newIdx);
    // Die bisherigen reihenfolge-Werte der gefilterten Items
    // in aufsteigender Reihenfolge den neuen Positionen zuweisen.
    const positions = filtered
      .map((z) => z.reihenfolge)
      .sort((a, b) => a - b);
    const updates = reordered.map((z, i) => ({ id: z.id!, newReihenfolge: positions[i] }));

    // Optimistic update
    setItems((prev) =>
      prev.map((z) => {
        const u = updates.find((u) => u.id === z.id);
        return u ? { ...z, reihenfolge: u.newReihenfolge } : z;
      })
    );

    // Nur geänderte Items persistieren
    const changed = updates.filter((u) => {
      const orig = items.find((i) => i.id === u.id);
      return orig && orig.reihenfolge !== u.newReihenfolge;
    });

    try {
      await Promise.all(
        changed.map((u) =>
          updateGefluegelZerleger(u.id, { reihenfolge: u.newReihenfolge })
        )
      );
      setToast({ type: "success", msg: "Reihenfolge aktualisiert" });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Reihenfolge speichern fehlgeschlagen" });
      // Rollback
      try {
        setItems(await getAllGefluegelZerleger());
      } catch { /* ignore */ }
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
            <div className="col-md-5">
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
              <select
                className="form-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
              >
                <option value="alle">Alle Kategorien</option>
                {KATEGORIE_OPTIONEN.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
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
          {filter !== "alle" && (
            <div className="text-muted small mt-2">
              <i className="bi bi-info-circle me-1" />
              Sortierung per Drag &amp; Drop innerhalb der gewählten Kategorie.
            </div>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-muted text-center py-5">Keine Zerleger gefunden.</div>
      ) : (
        <div className="table-responsive">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>#</th>
                  <th>Name</th>
                  <th>Kategorien</th>
                  <th>Status</th>
                  <th style={{ width: 140 }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                <SortableContext
                  items={filtered.map((z) => z.id!)}
                  strategy={verticalListSortingStrategy}
                >
                  {filtered.map((z) => (
                    <SortableRow
                      key={z.id}
                      z={z}
                      onEdit={openEdit}
                      onDelete={setDeleting}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
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
                    {KATEGORIE_OPTIONEN.map(([kat, label]) => (
                      <div className="form-check" key={kat}>
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
