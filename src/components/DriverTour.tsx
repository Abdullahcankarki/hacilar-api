import React, { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import SignaturePad from "signature_pad";
import cx from "classnames";
import { DateTime } from "luxon";
import { useAuth } from "../providers/Authcontext";
import {
    TourResource,
    TourStopResource,
    TourStatus,
    StopStatus,
    FehlgrundEnum,
    FahrzeugResource,
} from "../Resources"; // Pfad ggf. anpassen
import { getAllTours, updateTour, listTourStops, updateTourStop, getFahrzeugById } from "../backend/api";
// Optional: Fahrzeug laden (Kennzeichen anzeigen)


// ======= Hilfsfunktionen =======
const ZONE = "Europe/Berlin";
// Gleiche Datumslogik wie im TourManager: hart auf YYYY-MM-DD formatieren
const DATE_FMT_IN = "YYYY-MM-DD";
const toYmd = (d: any) => {
    const p = dayjs(d);
    return p.isValid() ? p.format(DATE_FMT_IN) : "";
};

const todayBerlinISO = () => DateTime.now().setZone(ZONE).toISODate()!;

function googleMapsUrlFromAddress(address?: string) {
    if (!address) return undefined;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

function formatKg(v?: number) {
    if (typeof v !== "number") return "-";
    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(v) + " kg";
}

function formatDateDisplay(input?: string | Date) {
    if (!input) return "-";
    const opts = { zone: ZONE } as const;

    // 1) Striktes Backend-Format YYYY-MM-DD (Europe/Berlin)
    if (typeof input === "string") {
        let dt = DateTime.fromFormat(input, "yyyy-LL-dd", opts);
        if (dt.isValid) return dt.setLocale("de").toFormat("ccc'.' dd'.' LLL'.'");

        // 2) ISO (falls Backend in einigen Fällen ISO mit Zeit liefert)
        dt = DateTime.fromISO(input, opts);
        if (dt.isValid) return dt.setLocale("de").toFormat("ccc'.' dd'.' LLL'.'");

        // 3) Deutsches Format dd.MM.yyyy (Alt-/Manuelle Eingaben)
        dt = DateTime.fromFormat(input, "dd.LL.yyyy", opts);
        if (dt.isValid) return dt.setLocale("de").toFormat("ccc'.' dd'.' LLL'.'");

        // 4) Kompakt yyyyMMdd
        dt = DateTime.fromFormat(input, "yyyyLLdd", opts);
        if (dt.isValid) return dt.setLocale("de").toFormat("ccc'.' dd'.' LLL'.'");

        // 5) Fallback: JS-Date-String
        const js = new Date(input);
        if (!Number.isNaN(js.valueOf())) {
            const p = DateTime.fromJSDate(js, opts);
            if (p.isValid) return p.setLocale("de").toFormat("ccc'.' dd'.' LLL'.'");
        }
        return "-";
    }

    // Date-Objekt
    const dt = DateTime.fromJSDate(input, opts);
    return dt.isValid ? dt.setLocale("de").toFormat("ccc'.' dd'.' LLL'.'") : "-";
}

// ======= Leergut Types (UI) =======
type LeergutRow = { art: string; anzahl: number; gewichtKg?: number };

// Beispiel-Auswahlliste – du kannst sie serverseitig liefern lassen
const LEERGUT_OPTIONS = [
    'korb',
    'e2',
    'e1',
    'h1',
    'e6',
    'big box',
    'karton',
    'euro palette',
    'einwegpalette',
    'haken',
    'tüten',
];

function autoGewichtKgForLeergutArt(art?: string): number | null {
    if (!art) return null;
    const a = art.toString().trim().toLowerCase();
    if (a === 'korb') return 1.5;
    if (a === 'e2') return 2;
    if (a === 'e1') return 1.5;
    if (a === 'h1') return 18;
    if (a === 'e6') return 1.5;
    if (a === 'big box') return 34.5;
    if (a === 'haken') return 1.3;
    if (a === 'tüten') return 0;
    // 'karton', 'euro palette', 'einwegpalette' → manuell
    return null;
}

// Einfaches Bootstrap-Modal ohne jQuery
function Modal({
    show, title, onClose, children, footer,
}: {
    show: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
    if (!show) return null;
    return (
        <>
            <div className="modal d-block" role="dialog" aria-modal="true">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{title}</h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
                        </div>
                        <div className="modal-body">{children}</div>
                        <div className="modal-footer">
                            {footer ?? (
                                <button type="button" className="btn btn-secondary" onClick={onClose}>
                                    Schließen
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop show" onClick={onClose} />
        </>
    );
}

// ======= Komponente =======
export default function DriverTour() {
    const { user } = useAuth(); // liefert LoginResource
    const driverId = user?.id;
    const [loading, setLoading] = useState(true);
    const [tour, setTour] = useState<TourResource | null>(null);
    const [fahrzeug, setFahrzeug] = useState<FahrzeugResource | null>(null);
    const [stops, setStops] = useState<TourStopResource[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: "success" | "danger"; msg: string } | null>(null);

    const [activeStop, setActiveStop] = useState<TourStopResource | null>(null);

    // Signatur
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sigPadRef = useRef<SignaturePad | null>(null);
    const [signedByName, setSignedByName] = useState("");
    const [leergut, setLeergut] = useState<LeergutRow[]>([{ art: "", anzahl: 0, gewichtKg: undefined }]);
    const [fehlgrund, setFehlgrund] = useState<FehlgrundEnum | "" | null>(null);
    const [fehlgrundText, setFehlgrundText] = useState("");

    const [showSigModal, setShowSigModal] = useState(false);
    const [showLeergutModal, setShowLeergutModal] = useState(false);
    const [showFailModal, setShowFailModal] = useState(false);

    const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

    // Heutiges Datum im gleichen Format wie im TourManager
    const dateISO = useMemo(todayBerlinISO, []);
    // UTC/Rand-Fix: wir fragen einen gepufferten Bereich [gestern..morgen] ab und filtern clientseitig exakt auf heute
    const dateFromBuffered = useMemo(() => dayjs().subtract(1, "day").format(DATE_FMT_IN), []);
    const dateToBuffered = useMemo(() => dayjs().add(1, "day").format(DATE_FMT_IN), []);

    // Initial: Tour+Stops laden
    useEffect(() => {
        if (!driverId) return;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                // Hole alle Touren für einen gepufferten Zeitraum und filtere dann exakt auf heute
                const list = await getAllTours({
                    fahrerId: driverId,
                    dateFrom: dateISO,
                    dateTo: dateISO,
                });
                const allRaw = Array.isArray(list) ? list : (list?.items ?? []);
                // 2) Exakt 'heute' in Europe/Istanbul treffen, auch wenn Backend als JS-Date-String liefert
                const todayYmd = dateISO;
                const items = allRaw.filter((x) => toYmd((x as any).datum) === todayYmd);
                // 3) Bevorzuge laufend > geplant > abgeschlossen
                const laufend = items.find(x => x.status === "laufend");
                const geplant = items.find(x => x.status === "geplant");
                const abgeschlossen = items.find(x => x.status === "abgeschlossen");
                const t = geplant || laufend || abgeschlossen || items[0] || null;
                setTour(t);

                // Fahrzeug (Kennzeichen) laden
                setFahrzeug(null);
                if (t?.fahrzeugId) {
                    try {
                        const fz = await getFahrzeugById(t.fahrzeugId);
                        setFahrzeug(fz || null);
                    } catch { }
                }

                if (t?.id) {
                    const s = await listTourStops({ tourId: t.id });
                    s.sort((a, b) => a.position - b.position);
                    setStops(s);
                    const isRunning = t?.status === "laufend";
                    setActiveStop(isRunning ? findNextOpenStop(s) : null);
                } else {
                    // Keine geeignete (nicht-abgeschlossene) Tour gefunden
                    setStops([]);
                    setActiveStop(null);
                }
            } catch (e: any) {
                setError(e.message || "Fehler beim Laden");
            } finally {
                setLoading(false);
            }
        })();
    }, [driverId, dateISO, dateFromBuffered, dateToBuffered]);

    // SignaturePad initialisieren
    useEffect(() => {
        if (!showSigModal) return;
        if (!canvasRef.current) return;
        const pad = new SignaturePad(canvasRef.current, { minWidth: 1.2, maxWidth: 2.5 });
        sigPadRef.current = pad;
        const handleResize = () => resizeCanvas(pad, canvasRef.current!);
        setTimeout(handleResize, 0);
        // nach Resize evtl. vorhandene Signatur einblenden
        setTimeout(() => {
            if (signatureDataUrl) {
                try { pad.fromDataURL(signatureDataUrl); } catch { }
            }
        }, 10);
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            pad.off();
        };
    }, [showSigModal, signatureDataUrl]);

    function resizeCanvas(pad: SignaturePad, canvas: HTMLCanvasElement) {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = 200 * ratio; // feste Höhe, mobil
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(ratio, ratio);
        pad.clear();
    }

    function findNextOpenStop(all: TourStopResource[]) {
        // Reihenfolge: zuerst "unterwegs", sonst nächster mit status != "zugestellt"
        const underway = all.find((s) => s.status === "unterwegs");
        if (underway) return underway;
        return all.find((s) => s.status !== "zugestellt" && s.status !== "fehlgeschlagen" && s.status !== "teilweise") || null;
    }

    async function onStartTour() {
        if (!tour?.id) return;
        try {
            const updatedTour = await updateTour(tour.id, { status: "laufend" as TourStatus });
            setTour(updatedTour);
            // Stops laden
            let s = await listTourStops({ tourId: updatedTour.id! });
            s.sort((a, b) => a.position - b.position);
            // Alle offenen Stops auf "unterwegs" setzen
            const toUnderway = s.filter((x) => x.status !== "zugestellt" && x.status !== "fehlgeschlagen" && x.status !== "teilweise");
            if (toUnderway.length) {
                const patched = await Promise.all(toUnderway.map((x) => updateTourStop(x.id!, { status: "unterwegs" as StopStatus })));
                const patchedMap = new Map(patched.map((p) => [p.id, p] as const));
                s = s.map((x) => patchedMap.get(x.id!) || x);
            }
            setStops(s);
            setActiveStop(findNextOpenStop(s));
            setToast({ type: "success", msg: "Tour gestartet – alle Stops sind jetzt unterwegs." });
        } catch (e: any) {
            setToast({ type: "danger", msg: e.message || "Fehler beim Starten der Tour" });
        }
    }

    function resetProofForms() {
        setSignedByName("");
        setLeergut([{ art: "", anzahl: 0, gewichtKg: undefined }]);
        setFehlgrund(null);
        setFehlgrundText("");
        sigPadRef.current?.clear();
        setSignatureDataUrl(null);
    }

    async function onCompleteStop() {
        if (!activeStop?.id) return;

        // Validierung
        const isFailed = !!fehlgrund;
        if (!isFailed) {
            if (!signedByName || !signatureDataUrl) {
                setToast({ type: "danger", msg: "Bitte Name und Unterschrift erfassen (oder Fehlgrund wählen)." });
                return;
            }
        }

        // Payload bauen
        const payload: Partial<TourStopResource> = {
            status: (isFailed ? "fehlgeschlagen" : "zugestellt") as StopStatus,
            fehlgrund: isFailed
                ? { code: fehlgrund as FehlgrundEnum, text: fehlgrundText || undefined }
                : undefined,
            signedByName: isFailed ? undefined : signedByName,
            // Sende die volle Data-URL; Backend normalisiert ggf. selbst
            signaturPngBase64: isFailed ? undefined : signatureDataUrl || undefined,
            leergutMitnahme:
                leergut
                    .filter((x) => x.art || x.anzahl || x.gewichtKg)
                    .map((x) => ({ art: x.art || "Unbekannt", anzahl: Number(x.anzahl || 0), gewichtKg: x.gewichtKg ? Number(x.gewichtKg) : undefined })) || [],
        };

        try {
            const updated = await updateTourStop(activeStop.id, { ...payload, signTimestampUtc: new Date().toISOString() });
            setStops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            resetProofForms();

            // Nächster Stop
            const next = findNextOpenStop(
                [...stops].map((s) => (s.id === updated.id ? updated : s)).sort((a, b) => a.position - b.position)
            );
            setActiveStop(next);
            setToast({ type: "success", msg: "Stop abgeschlossen" });
        } catch (e: any) {
            setToast({ type: "danger", msg: e.message || "Fehler beim Stop-Abschluss" });
        }
    }

    async function onFinishTour() {
        if (!tour?.id) return;
        try {
            const updated = await updateTour(tour.id, { status: "abgeschlossen" as TourStatus });
            setTour(updated);
            setActiveStop(null);
            setToast({ type: "success", msg: "Tour abgeschlossen" });
        } catch (e: any) {
            setToast({ type: "danger", msg: e.message || "Fehler beim Tour-Abschluss" });
        }
    }

    const currentAddress = useMemo(() => {
        // Adresse kommt über Auftrag -> Kunde. Da TourStopResource die Adresse nicht direkt hat,
        // erwarte ich, dass der Stops-Endpunkt sie (vorerst) über "kundeName" + "kundeId" liefert
        // und du im Backend vorerst *kunde.adresse* zusätzlich in einem Feld "kundeAdress" mitgibst.
        // Bis dahin kannst du hier alternativ einen Mini-Fetch per auftragId->kunde machen.
        // Für jetzt erwarte ich `activeStop` hätte (temporär) ein Feld (any): (activeStop as any).kundeAdress
        const anyStop = activeStop as any;
        return anyStop?.kundeAdress as string | undefined;
    }, [activeStop]);

    const mapsUrl = googleMapsUrlFromAddress(currentAddress);

    // Compute tour state BEFORE any early returns to avoid conditional Hooks
    const tourRunning = tour?.status === "laufend";
    const allDelivered = stops.length > 0 && stops.every((s) => s.status === "zugestellt" || s.status === "fehlgeschlagen");
    // Sichtbarkeit nach Tourstart: aktueller Stop + abgeschlossene Stops
    const displayedStops: TourStopResource[] = useMemo(() => {
        if (!tourRunning) return [];
        const completed = stops.filter((s) => s.status === "zugestellt" || s.status === "fehlgeschlagen" || s.status === "teilweise");
        return [...(activeStop ? [activeStop] : []), ...completed].sort((a, b) => a.position - b.position);
    }, [tourRunning, activeStop, stops]);

    // ======= UI =======
    if (loading) {
        return (
            <div className="container py-4">
                <div className="text-center py-5">
                    <div className="spinner-border" role="status" />
                    <div className="mt-3">Lade Tour…</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger">{error}</div>
            </div>
        );
    }

    if (!tour) {
        return (
            <div className="container py-4">
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5">
                        <h2 className="h4 mb-2">Heute ({formatDateDisplay(dateISO)}) ist dir keine Tour zugewiesen.</h2>
                        <p className="text-muted mb-0">Bitte später erneut prüfen oder den Disponenten kontaktieren.</p>
                    </div>
                </div>
            </div>
        );
    }

    // Early return for completed tours (see instructions)
    if (tour.status === "abgeschlossen") {
        return (
            <div className="container py-4">
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5">
                        <h2 className="h4 mb-2">Heute ({formatDateDisplay(dateISO)})</h2>
                        <p className="text-muted mb-0">Du hast alle deine Touren für heute abgeschlossen 🎉</p>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="container py-3">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h1 className="h4 mb-1">Meine Tour – {tour.name || tour.region}</h1>
                    <div className="text-muted small">
                        {/* alt: DateTime.fromISO(tour.datum, { zone: ZONE }).toFormat("dd.LL.yyyy") */}
                        {formatDateDisplay(tour.datum)} • Status: <span className="badge bg-secondary">{tour.status}</span>
                    </div>
                </div>
                <div className="d-flex gap-2">
                    {!tourRunning && (
                        <button className="btn btn-primary" onClick={onStartTour}>
                            <i className="ci-play-circle me-2" /> Fahrt starten
                        </button>
                    )}
                    {tourRunning && allDelivered && (
                        <button className="btn btn-success" onClick={onFinishTour}>
                            <i className="ci-check-circle me-2" /> Tour abschließen
                        </button>
                    )}
                </div>
            </div>

            {/* Tour Info */}
            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                    <div className="row g-3 align-items-center">
                        <div className="col-6">
                            <div className="text-muted small">Region</div>
                            <div className="fw-semibold">{tour.region}</div>
                        </div>
                        <div className="col-6 text-end">
                            <div className="text-muted small">Beladung</div>
                            <div className="fw-semibold">{formatKg(tour.belegtesGewichtKg)}</div>
                        </div>
                        <div className="col-6">
                            <div className="text-muted small">Fahrzeug</div>
                            <div className="fw-semibold">
                                {fahrzeug?.kennzeichen ? (
                                    <span className="badge bg-light text-dark">Kennzeichen: {fahrzeug.kennzeichen}</span>
                                ) : (
                                    <span className="badge bg-light text-dark">Kennzeichen: —</span>
                                )}
                            </div>
                        </div>
                        <div className="col-6 text-end">
                            <div className="text-muted small">Stops gesamt</div>
                            <div className="fw-semibold">{stops.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                    <div className="d-flex justify-content-between mb-2">
                        <div className="small text-muted">Fortschritt</div>
                        <div className="small">
                            {stops.filter((s) => s.status === "zugestellt").length}/{stops.length} zugestellt
                        </div>
                    </div>
                    <div className="progress" style={{ height: 8 }}>
                        <div
                            className="progress-bar"
                            role="progressbar"
                            style={{
                                width:
                                    (stops.length
                                        ? (stops.filter((s) => s.status === "zugestellt").length / stops.length) * 100
                                        : 0) + "%",
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Aktueller Stop */}
            <div className="card border-0 shadow-sm mb-3">
                <div className="card-header bg-transparent">
                    <div className="d-flex align-items-center justify-content-between">
                        <div className="fw-semibold">
                            Aktueller Halt {activeStop ? `(#${activeStop.position})` : ""}
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    {!tourRunning && (
                        <div className="text-muted">Starte die Tour, um den ersten Halt zu sehen.</div>
                    )}
                    {tourRunning && !activeStop && <div className="text-muted">Alle Stops erledigt 🎉</div>}
                    {tourRunning && activeStop && (
                        <>
                            <div className="mb-3">
                                <div className="h6 mb-1">{activeStop.kundeName || "Kunde"}</div>
                                {currentAddress && (
                                    <div className="text-muted small">{currentAddress}</div>
                                )}
                                <div className="text-muted small mb-2">Gewicht (Auftrag): {formatKg(activeStop.gewichtKg)}</div>
                                <div className="d-flex flex-wrap gap-2">
                                    <span className={cx("badge", activeStop.status === "unterwegs" ? "bg-info" : "bg-secondary")}>
                                        Status: {activeStop.status}
                                    </span>
                                    {currentAddress && (
                                        <a className="btn btn-outline-secondary btn-sm" href={mapsUrl} target="_blank" rel="noreferrer">
                                            <i className="ci-navigation me-2" />
                                            Navigation starten
                                        </a>
                                    )}
                                </div>
                                {!currentAddress && (
                                    <div className="text-danger small mt-2">
                                        Keine Kundenadresse verfügbar. (Adresse über Auftrag ➜ Kunde nachladen)
                                    </div>
                                )}
                            </div>

                            {/* Zustellnachweis / Fehlgrund */}
                            {/* Erfassung über Modals */}
                            <div className="d-flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm"
                                    disabled={!!fehlgrund}
                                    onClick={() => setShowSigModal(true)}
                                >
                                    <i className="ci-pen me-2" /> Unterschrift erfassen
                                </button>
                                {signatureDataUrl && !fehlgrund && (
                                    <span className="badge bg-success align-self-center">Unterschrift gespeichert</span>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => setShowLeergutModal(true)}
                                >
                                    <i className="ci-add me-2" /> Leergut hinzufügen
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-outline-warning btn-sm"
                                    onClick={() => setShowFailModal(true)}
                                >
                                    <i className="ci-alert me-2" /> Zustellung fehlgeschlagen
                                </button>

                                {fehlgrund && (
                                    <button
                                        type="button"
                                        className="btn btn-link text-danger btn-sm"
                                        onClick={() => { setFehlgrund(null); setFehlgrundText(""); }}
                                    >
                                        Fehlgrund zurücksetzen
                                    </button>
                                )}
                            </div>

                            {/* Abschluss-Buttons */}
                            <div className="d-flex gap-2 mt-4">
                                <button className="btn btn-success" onClick={onCompleteStop}>
                                    <i className="ci-check-circle me-2" />
                                    {fehlgrund ? "Fehlzustellung speichern" : "Zustellung abschließen"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Stopliste (kompakt) */}
            <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent">
                    <div className="fw-semibold">Stops der Tour</div>
                </div>
                <div className="list-group list-group-flush">
                    {displayedStops.map((s) => {
                        const isActive = activeStop?.id === s.id;
                        const badge =
                            s.status === "zugestellt"
                                ? "bg-success"
                                : s.status === "unterwegs"
                                    ? "bg-info"
                                    : s.status === "fehlgeschlagen"
                                        ? "bg-danger"
                                        : "bg-secondary";
                        const anyStop = s as any;
                        const addr = anyStop?.kundeAdress as string | undefined;

                        return (
                            <div
                                key={s.id}
                                className={cx("list-group-item d-flex justify-content-between align-items-center", {
                                    "bg-light": isActive,
                                })}
                                onClick={() => setActiveStop(s)}
                                role="button"
                            >
                                <div>
                                    <div className="fw-semibold">
                                        #{s.position} – {s.kundeName || "Kunde"}
                                    </div>
                                    <div className="text-muted small">
                                        {addr || "Adresse nicht geladen"} • {formatKg(s.gewichtKg)}
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    {addr && (
                                        <a
                                            className="btn btn-outline-secondary btn-sm"
                                            href={googleMapsUrlFromAddress(addr)}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Maps
                                        </a>
                                    )}
                                    <span className={cx("badge", badge)}>{s.status}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal: Unterschrift */}
            <Modal
                show={showSigModal}
                title="Unterschrift erfassen"
                onClose={() => setShowSigModal(false)}
                footer={
                    <>
                        <button type="button" className="btn btn-outline-secondary" onClick={() => sigPadRef.current?.clear()}>
                            Zurücksetzen
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                                if (!sigPadRef.current) { setShowSigModal(false); return; }
                                if (sigPadRef.current.isEmpty()) {
                                    setSignatureDataUrl(null);
                                } else {
                                    setSignatureDataUrl(sigPadRef.current.toDataURL("image/png"));
                                }
                                setShowSigModal(false);
                            }}
                        >
                            Speichern
                        </button>
                    </>
                }
            >
                {fehlgrund && (
                    <div className="alert alert-warning small mb-3">
                        Hinweis: Es ist ein Fehlgrund gesetzt. Entferne den Fehlgrund, um eine Unterschrift zu erfassen.
                    </div>
                )}
                <div className="mb-3">
                    <label className="form-label">Name des Unterzeichners</label>
                    <input
                        className="form-control"
                        value={signedByName}
                        onChange={(e) => setSignedByName(e.target.value)}
                        placeholder="z. B. Max Mustermann"
                    />
                </div>
                <div>
                    <label className="form-label">Unterschrift</label>
                    <div className="border rounded-3 p-2 bg-white">
                        <canvas ref={canvasRef} style={{ width: "100%", height: 200 }} />
                    </div>
                </div>
            </Modal>

            {/* Modal: Leergut */}
            <Modal
                show={showLeergutModal}
                title="Leergut-Mitnahme"
                onClose={() => setShowLeergutModal(false)}
                footer={
                    <>
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setLeergut([{ art: "", anzahl: 0, gewichtKg: undefined }])}
                        >
                            Zurücksetzen
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                                // Mappe Gewicht je Reihe nach Art, falls nicht manuell gesetzt
                                setLeergut((prev) => prev.map((row) => {
                                    const auto = autoGewichtKgForLeergutArt(row.art);
                                    // Nur überschreiben, wenn (a) Auto-Wert vorhanden und (b) kein manuell gesetztes Gewicht
                                    if (auto !== null && (row.gewichtKg === undefined || row.gewichtKg === null || row.gewichtKg === 0)) {
                                        return { ...row, gewichtKg: auto };
                                    }
                                    return row;
                                }));
                                setShowLeergutModal(false);
                            }}
                        >
                            Speichern
                        </button>
                    </>
                }
            >
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-semibold">Positionen</div>
                    <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => setLeergut((prev) => [...prev, { art: "", anzahl: 0, gewichtKg: undefined }])}
                    >
                        <i className="ci-add me-2" /> Position hinzufügen
                    </button>
                </div>
                <div className="list-group">
                    {leergut.map((row, idx) => (
                        <div key={idx} className="list-group-item border-0 border-bottom">
                            <div className="row g-2 align-items-end">
                                <div className="col-12 col-md-4">
                                    <label className="form-label">Art</label>
                                    <div className="input-group">
                                        <select
                                            className="form-select"
                                            value={row.art}
                                            onChange={(e) =>
                                                setLeergut((prev) => prev.map((r, i) => (i === idx ? { ...r, art: e.target.value } : r)))
                                            }
                                        >
                                            <option value="">Bitte wählen…</option>
                                            {LEERGUT_OPTIONS.map((o) => (
                                                <option key={o} value={o}>
                                                    {o}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            className="form-control"
                                            placeholder="oder frei eingeben"
                                            value={row.art && !LEERGUT_OPTIONS.includes(row.art) ? row.art : ""}
                                            onChange={(e) =>
                                                setLeergut((prev) => prev.map((r, i) => (i === idx ? { ...r, art: e.target.value } : r)))
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <label className="form-label">Anzahl</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        min={0}
                                        value={row.anzahl}
                                        onChange={(e) =>
                                            setLeergut((prev) =>
                                                prev.map((r, i) => (i === idx ? { ...r, anzahl: Number(e.target.value) } : r))
                                            )
                                        }
                                    />
                                </div>
                                <div className="col-6 col-md-3">
                                    <label className="form-label">Gewicht (kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-control"
                                        value={row.gewichtKg ?? ""}
                                        onChange={(e) =>
                                            setLeergut((prev) =>
                                                prev.map((r, i) =>
                                                    i === idx ? { ...r, gewichtKg: e.target.value ? Number(e.target.value) : undefined } : r
                                                )
                                            )
                                        }
                                    />
                                </div>
                                <div className="col-12 col-md-2 d-grid">
                                    <button
                                        className="btn btn-outline-danger"
                                        onClick={() => setLeergut((prev) => prev.filter((_, i) => i !== idx))}
                                    >
                                        Entfernen
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Modal: Zustellung fehlgeschlagen */}
            <Modal
                show={showFailModal}
                title="Zustellung fehlgeschlagen"
                onClose={() => setShowFailModal(false)}
                footer={
                    <>
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => { setFehlgrund(null); setFehlgrundText(""); }}
                        >
                            Zurücksetzen
                        </button>
                        <button type="button" className="btn btn-warning" onClick={() => setShowFailModal(false)}>
                            Fehlgrund speichern
                        </button>
                    </>
                }
            >
                <div className="mb-3">
                    <label className="form-label">Fehlgrund</label>
                    <select
                        className="form-select"
                        value={fehlgrund || ""}
                        onChange={(e) => setFehlgrund((e.target.value as FehlgrundEnum) || "")}
                    >
                        <option value="">Bitte wählen…</option>
                        <option value="KUNDE_NICHT_ERREICHBAR">Kunde nicht erreichbar</option>
                        <option value="ANNAHME_VERWEIGERT">Annahme verweigert</option>
                        <option value="FALSCH_ADRESSE">Falsche Adresse</option>
                        <option value="NICHT_RECHTZEITIG">Nicht rechtzeitig</option>
                        <option value="WARE_BESCHAEDIGT">Ware beschädigt</option>
                        <option value="SONSTIGES">Sonstiges</option>
                    </select>
                </div>
                <div>
                    <label className="form-label">Bemerkung (optional)</label>
                    <textarea
                        className="form-control"
                        rows={2}
                        value={fehlgrundText}
                        onChange={(e) => setFehlgrundText(e.target.value)}
                    />
                </div>
            </Modal>

            {/* Toast */}
            {toast && (
                <div
                    className={cx(
                        "toast align-items-center text-bg-" + (toast.type === "success" ? "success" : "danger"),
                        "border-0 position-fixed bottom-0 end-0 m-3 show"
                    )}
                    role="alert"
                >
                    <div className="d-flex">
                        <div className="toast-body">{toast.msg}</div>
                        <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} />
                    </div>
                </div>
            )}
        </div>
    );
}