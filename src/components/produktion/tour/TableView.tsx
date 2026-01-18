import React, { useEffect, useMemo, useState } from 'react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Local tiny cx helper (avoids extra deps)
function cx(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(' ');
}

export type CompactTableHelpers = {
  fmtDate: (v: any) => string;
  formatRegion?: (region: string) => string;
  renderFahrzeugLabel?: (fahrzeug: any) => string;
  statusBadge?: (status: string) => string; // returns bootstrap variant name, e.g. "success"
  stopStatusLabel?: (status: string) => string;
  stopStatusVariant?: (status: string) => string; // returns bootstrap variant name
};

export type CompactToursTableProps<TTour = any, TStop = any> = {
  tours: TTour[];
  stopsByTour: Record<string, TStop[]>;

  // lookup maps (optional)
  fahrzeuge?: Record<string, any>;
  fahrer?: Record<string, any>;
  vorlagen?: Record<string, any>;

  // field accessors
  getTourId: (t: TTour) => string;
  getTourDate: (t: TTour) => any;
  getTourName: (t: TTour) => string;
  getTourRegion?: (t: TTour) => string;
  getTourStatus: (t: TTour) => string;
  getTourMaxKg?: (t: TTour) => number | undefined;
  getTourBelegtKg?: (t: TTour) => number | undefined;
  getTourFahrzeugId?: (t: TTour) => string | undefined;
  getTourFahrerId?: (t: TTour) => string | undefined;
  getTourVorlageId?: (t: TTour) => string | undefined;
  getTourOverCapacityFlag?: (t: TTour) => boolean | undefined;
  getTourPendingDeletionUntil?: (t: TTour) => number | undefined;

  // stop accessors
  getStopId: (s: TStop) => string;
  getStopKundeName?: (s: TStop) => string | undefined;
  getStopKundeId?: (s: TStop) => string | undefined;
  getStopAdresse?: (s: TStop) => string | undefined;
  getStopStatus: (s: TStop) => string;
  getStopGewichtKg?: (s: TStop) => number | undefined;

  // UI behavior
  editable?: boolean;
  onEdit?: (t: TTour) => void;
  onDelete?: (t: TTour) => void;
  onOpenStop?: (s: TStop) => void;

  // optional DnD callbacks (handled by parent, e.g. TourManager)
  onReorderStops?: (tourId: string, orderedStopIds: string[]) => Promise<void> | void;
  onMoveStop?: (stopId: string, payload: { toTourId: string; targetIndex: number }) => Promise<void> | void;

  helpers: CompactTableHelpers;
};


function DefaultPendingCountdown({ until }: { until: number }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const ms = Math.max(0, until - now);
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (
    <span className="badge text-bg-warning">
      Löschen in {String(m).padStart(2, '0')}:{String(r).padStart(2, '0')}
    </span>
  );
}

function TourDropZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} data-tour-container-id={id}>
      {children}
    </div>
  );
}

function SortableStopRow<TStop>({
  stop,
  getStopId,
  children,
}: {
  stop: TStop;
  getStopId: (s: TStop) => string;
  children: React.ReactNode;
}) {
  const id = getStopId(stop);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    cursor: 'grab',
  };

  return (
    <tr ref={setNodeRef as any} style={style} {...attributes} {...listeners}>
      {children}
    </tr>
  );
}

export const CompactToursTable = <TTour, TStop,>(props: CompactToursTableProps<TTour, TStop>) => {
  const {
    tours,
    stopsByTour,
    fahrzeuge,
    fahrer,
    vorlagen,
    editable,
    onEdit,
    onDelete,
    onOpenStop,
    onReorderStops,
    onMoveStop,
    helpers,

    getTourId,
    getTourDate,
    getTourName,
    getTourRegion,
    getTourStatus,
    getTourMaxKg,
    getTourBelegtKg,
    getTourFahrzeugId,
    getTourFahrerId,
    getTourVorlageId,
    getTourOverCapacityFlag,
    getTourPendingDeletionUntil,

    getStopId,
    getStopKundeName,
    getStopKundeId,
    getStopAdresse,
    getStopStatus,
    getStopGewichtKg,
  } = props;

  const rows = useMemo(() => tours || [], [tours]);
  const enableDnd = true;
  const showActions = !!onEdit || !!onDelete;

  const [localStopsByTour, setLocalStopsByTour] = useState<Record<string, TStop[]>>(stopsByTour || {});
  useEffect(() => {
    setLocalStopsByTour(stopsByTour || {});
  }, [stopsByTour]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  const [activeStop, setActiveStop] = useState<TStop | null>(null);

  const findStopById = (stopId: string): { tourId: string; stop: TStop } | null => {
    for (const tid of Object.keys(localStopsByTour)) {
      const s = (localStopsByTour[tid] || []).find((x) => getStopId(x) === stopId);
      if (s) return { tourId: tid, stop: s };
    }
    return null;
  };

  const isStopId = (id: string) => {
    return Object.values(localStopsByTour).some((list) => (list || []).some((s) => getStopId(s) === id));
  };

  const onDragStart = (e: any) => {
    const stopId = e.active?.id as string | undefined;
    if (!stopId) return;
    const found = findStopById(stopId);
    if (found) setActiveStop(found.stop);
  };

  const onDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveStop(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const found = findStopById(activeId);
    if (!found) return;

    const fromTourId = found.tourId;
    const fromList = [...(localStopsByTour[fromTourId] || [])];
    const activeIndex = fromList.findIndex((s) => getStopId(s) === activeId);
    if (activeIndex < 0) return;

    const overIsStop = isStopId(overId);
    const toTourId = overIsStop
      ? (findStopById(overId)?.tourId || fromTourId)
      : overId; // tour container id

    if (!toTourId) return;

    if (fromTourId === toTourId) {
      const toIndex = overIsStop
        ? (localStopsByTour[toTourId] || []).findIndex((s) => getStopId(s) === overId)
        : fromList.length - 1;

      const safeToIndex = toIndex < 0 ? fromList.length - 1 : toIndex;
      if (safeToIndex === activeIndex) return;

      const newList = arrayMove(fromList, activeIndex, safeToIndex);
      setLocalStopsByTour((prev) => ({ ...prev, [fromTourId]: newList }));

      const orderedIds = newList.map((s) => getStopId(s));
      if (onReorderStops) {
        try {
          await onReorderStops(fromTourId, orderedIds);
        } catch {
          // rollback to props state
          setLocalStopsByTour(stopsByTour || {});
        }
      }
      return;
    }

    // Move across tours
    const toListOrig = [...(localStopsByTour[toTourId] || [])];
    const rawToIndex = overIsStop ? toListOrig.findIndex((s) => getStopId(s) === overId) : toListOrig.length;
    const targetIndex = rawToIndex < 0 ? toListOrig.length : rawToIndex;

    const [moved] = fromList.splice(activeIndex, 1);
    const newFrom = fromList;
    const newTo = [...toListOrig.slice(0, targetIndex), moved, ...toListOrig.slice(targetIndex)];

    setLocalStopsByTour((prev) => ({ ...prev, [fromTourId]: newFrom, [toTourId]: newTo }));

    if (onMoveStop) {
      try {
        await onMoveStop(activeId, { toTourId, targetIndex });
      } catch {
        setLocalStopsByTour(stopsByTour || {});
      }
    } else if (onReorderStops) {
      // fallback: reorder callbacks for both lists
      try {
        await onReorderStops(fromTourId, newFrom.map((s) => getStopId(s)));
        await onReorderStops(toTourId, newTo.map((s) => getStopId(s)));
      } catch {
        setLocalStopsByTour(stopsByTour || {});
      }
    }
  };

  const weekdayTop = useMemo(
    () => [
      { key: 'mo', label: 'Montag' },
      { key: 'di', label: 'Dienstag' },
      { key: 'mi', label: 'Mittwoch' },
      { key: 'do', label: 'Donnerstag' },
    ],
    []
  );

  const weekdayBottom = useMemo(
    () => [
      { key: 'fr', label: 'Freitag' },
      { key: 'sa', label: 'Samstag' },
      { key: 'so', label: 'Sonntag' },
    ],
    []
  );

  const weekdayKeyFromDate = (v: any): string => {
    if (!v) return 'mo';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return 'mo';
    // JS: 0=Sun..6=Sat → map to mo..so
    const day = d.getDay();
    switch (day) {
      case 1:
        return 'mo';
      case 2:
        return 'di';
      case 3:
        return 'mi';
      case 4:
        return 'do';
      case 5:
        return 'fr';
      case 6:
        return 'sa';
      case 0:
      default:
        return 'so';
    }
  };

  const toursByWeekday = useMemo(() => {
    const map: Record<string, TTour[]> = { mo: [], di: [], mi: [], do: [], fr: [], sa: [], so: [] };
    for (const t of rows) {
      const key = weekdayKeyFromDate(getTourDate(t));
      (map[key] ||= []).push(t);
    }
    // Sort within day by date (earlier first)
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const da = new Date(getTourDate(a) as any).getTime();
        const db = new Date(getTourDate(b) as any).getTime();
        return (Number.isFinite(da) ? da : 0) - (Number.isFinite(db) ? db : 0);
      });
    }
    return map;
  }, [rows, getTourDate]);

  const formatRegion = helpers.formatRegion || ((r: string) => r);
  const statusBadge = helpers.statusBadge || (() => 'secondary');
  const stopStatusVariant = helpers.stopStatusVariant || (() => 'secondary');
  const stopStatusLabel = helpers.stopStatusLabel || ((s: string) => s);

  const fmtShortDate = (v: any) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="p-2">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="fw-semibold" style={{ fontSize: 13 }}>
            Touren
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            {rows.length} gesamt
          </div>
        </div>

        <style>{`
          .weekday-grid {
            display: grid;
            gap: .5rem;
            grid-template-columns: 1fr;
          }
          @media (min-width: 992px) {
            .weekday-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); }
          }
          @media (min-width: 768px) and (max-width: 991.98px) {
            .weekday-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          .weekday-col {
            border: 1px solid rgba(0,0,0,.08);
            border-radius: .75rem;
            overflow: hidden;
            background: #fff;
            min-height: 120px;
          }
          .weekday-col-header {
            background: rgba(0,0,0,.035);
            border-bottom: 1px solid rgba(0,0,0,.08);
            padding: .45rem .6rem;
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: .5rem;
            font-size: 12px;
            font-weight: 700;
          }
          .weekday-col-header .sub {
            font-weight: 600;
            color: rgba(0,0,0,.55);
            font-size: 11px;
          }
          .weekday-col-body {
            padding: .35rem .4rem;
            display: flex;
            flex-direction: column;
            gap: .4rem;
          }
          .tour-block {
            border: none;
            border-radius: 0;
            background: #fff;
          }
          .tour-title {
            padding: .35rem .4rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: .5rem;
            background: transparent;
            border-bottom: none;
          }
          .tour-title .name {
            font-weight: 700;
            font-size: 12px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .tour-stops {
            font-size: 11px;
          }
          .tour-stops td { padding-top: .18rem; padding-bottom: .18rem; }
          .kg-badge {
            display: inline-block;
            padding: .1rem .35rem;
            border: 1px solid rgba(0,0,0,.12);
            border-radius: .4rem;
            background: rgba(0,0,0,.02);
            font-variant-numeric: tabular-nums;
          }
        `}</style>

        {/* Content */}
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <>
            {/* Top row: Montag – Donnerstag */}
            <div className="weekday-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
              {weekdayTop.map((w) => {
                const list = (toursByWeekday[w.key] || []) as TTour[];
                return (
                  <div key={w.key} className="weekday-col">
                    <div className="weekday-col-header">
                      <div>
                        <span>{w.label}</span>
                        <span className="sub ms-2">{list.length ? fmtShortDate(getTourDate(list[0])) : ''}</span>
                      </div>
                      <span className="sub">{list.length}</span>
                    </div>
                    <div className="weekday-col-body">
                      {list.map((t) => {
                        const id = getTourId(t);
                        const name = getTourName(t);
                        const stops = (localStopsByTour[id] || stopsByTour[id] || []) as TStop[];
                        return (
                          <TourDropZone id={id} key={id}>
                            <div className="tour-block">
                              <div className="tour-title" onClick={(e) => e.stopPropagation()}>
                                <div className="name">{name}</div>
                                {showActions ? (
                                  <div className="btn-group btn-group-sm">
                                    {onEdit ? (
                                      <button className="btn btn-outline-secondary" onClick={() => onEdit?.(t)} title="Bearbeiten">
                                        <i className="ci-edit" />
                                      </button>
                                    ) : null}
                                    {onDelete ? (
                                      <button className="btn btn-outline-danger" onClick={() => onDelete?.(t)} title="Löschen">
                                        <i className="ci-trash" />
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              <div className="table-responsive tour-stops">
                                <table className="table table-sm table-hover align-middle mb-0 border-0">
                                  <tbody>
                                    <SortableContext items={stops.map((x) => getStopId(x))} strategy={verticalListSortingStrategy}>
                                      {stops.map((s) => {
                                        const sid = getStopId(s);
                                        const kName =
                                          getStopKundeName?.(s) ||
                                          (getStopKundeId?.(s) ? `Kunde #${getStopKundeId?.(s)}` : 'Kunde');
                                        const st = getStopStatus(s);
                                        const kg = getStopGewichtKg?.(s);
                                        return (
                                          <SortableStopRow stop={s} getStopId={getStopId} key={sid}>
                                            <td
                                              className="py-1"
                                              onClick={() => onOpenStop?.(s)}
                                              style={{ cursor: onOpenStop ? 'pointer' : 'default' }}
                                            >
                                              <div className="fw-semibold" style={{ fontSize: 11 }}>{kName}</div>
                                            </td>
                                            <td className="text-center py-1" style={{ width: 84 }}>
                                              <span className={`badge text-bg-${stopStatusVariant(String(st))}`}>{stopStatusLabel(String(st))}</span>
                                            </td>
                                            <td className="text-end py-1" style={{ width: 70 }}>
                                              <span className="kg-badge">{typeof kg === 'number' ? Number(kg).toFixed(1) : '—'}</span>
                                            </td>
                                          </SortableStopRow>
                                        );
                                      })}
                                    </SortableContext>

                                    {!stops.length && (
                                      <tr><td colSpan={3} className="text-center text-muted py-2">—</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </TourDropZone>
                        );
                      })}
                      {!list.length && <div className="text-muted" style={{ fontSize: 12 }}>—</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom row: Freitag – Sonntag */}
            <div className="weekday-grid mt-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {weekdayBottom.map((w) => {
                const list = (toursByWeekday[w.key] || []) as TTour[];
                return (
                  <div key={w.key} className="weekday-col">
                    <div className="weekday-col-header">
                      <div>
                        <span>{w.label}</span>
                        <span className="sub ms-2">{list.length ? fmtShortDate(getTourDate(list[0])) : ''}</span>
                      </div>
                      <span className="sub">{list.length}</span>
                    </div>
                    <div className="weekday-col-body">
                      {list.map((t) => {
                        const id = getTourId(t);
                        const name = getTourName(t);
                        const stops = (localStopsByTour[id] || stopsByTour[id] || []) as TStop[];
                        return (
                          <TourDropZone id={id} key={id}>
                            <div className="tour-block">
                              <div className="tour-title" onClick={(e) => e.stopPropagation()}>
                                <div className="name">{name}</div>
                                {showActions ? (
                                  <div className="btn-group btn-group-sm">
                                    {onEdit ? (
                                      <button className="btn btn-outline-secondary" onClick={() => onEdit?.(t)} title="Bearbeiten">
                                        <i className="ci-edit" />
                                      </button>
                                    ) : null}
                                    {onDelete ? (
                                      <button className="btn btn-outline-danger" onClick={() => onDelete?.(t)} title="Löschen">
                                        <i className="ci-trash" />
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              <div className="table-responsive tour-stops">
                                <table className="table table-sm table-hover align-middle mb-0 border-0">
                                  <tbody>
                                    <SortableContext items={stops.map((x) => getStopId(x))} strategy={verticalListSortingStrategy}>
                                      {stops.map((s) => {
                                        const sid = getStopId(s);
                                        const kName =
                                          getStopKundeName?.(s) ||
                                          (getStopKundeId?.(s) ? `Kunde #${getStopKundeId?.(s)}` : 'Kunde');
                                        const st = getStopStatus(s);
                                        const kg = getStopGewichtKg?.(s);
                                        return (
                                          <SortableStopRow stop={s} getStopId={getStopId} key={sid}>
                                            <td
                                              className="py-1"
                                              onClick={() => onOpenStop?.(s)}
                                              style={{ cursor: onOpenStop ? 'pointer' : 'default' }}
                                            >
                                              <div className="fw-semibold" style={{ fontSize: 11 }}>{kName}</div>
                                            </td>
                                            <td className="text-center py-1" style={{ width: 84 }}>
                                              <span className={`badge text-bg-${stopStatusVariant(String(st))}`}>{stopStatusLabel(String(st))}</span>
                                            </td>
                                            <td className="text-end py-1" style={{ width: 70 }}>
                                              <span className="kg-badge">{typeof kg === 'number' ? Number(kg).toFixed(1) : '—'}</span>
                                            </td>
                                          </SortableStopRow>
                                        );
                                      })}
                                    </SortableContext>

                                    {!stops.length && (
                                      <tr><td colSpan={3} className="text-center text-muted py-2">—</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </TourDropZone>
                        );
                      })}
                      {!list.length && <div className="text-muted" style={{ fontSize: 12 }}>—</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
              {activeStop ? (
                <div className="border bg-white shadow-sm rounded-2 px-2 py-1" style={{ fontSize: 12 }}>
                  <div className="fw-semibold">
                    {getStopKundeName?.(activeStop) ||
                      (getStopKundeId?.(activeStop) ? `Kunde #${getStopKundeId?.(activeStop)}` : 'Kunde')}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </>
        </DndContext>
        {!rows.length && (
          <div className="col-12">
            <div className="text-center text-muted py-4">Keine Touren gefunden.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompactToursTable;
