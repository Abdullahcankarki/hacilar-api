import React, { useEffect, useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { de } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("de", de);

function useIsNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return narrow;
}

function parseIso(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLabel(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Props {
  von: string;
  bis: string;
  onChange: (von: string, bis: string) => void;
  label?: string;
}

/**
 * Hotel-Buchungs-artiger Date-Range-Picker.
 * Erster Klick = Start, zweiter Klick = Ende.
 * Akzeptiert Teilauswahl erst nach vollständigem Range.
 */
export default function DateRangePicker({ von, bis, onChange, label }: Props) {
  const [startDate, setStartDate] = useState<Date | null>(parseIso(von));
  const [endDate, setEndDate] = useState<Date | null>(parseIso(bis));
  const narrow = useIsNarrow();

  // Sync from outside
  React.useEffect(() => {
    setStartDate(parseIso(von));
    setEndDate(parseIso(bis));
  }, [von, bis]);

  const handleChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
    if (start && end) {
      onChange(formatIso(start), formatIso(end));
    }
  };

  const displayText =
    startDate && endDate
      ? `${formatLabel(startDate)} – ${formatLabel(endDate)}`
      : startDate
      ? `${formatLabel(startDate)} – …`
      : "Zeitraum wählen";

  return (
    <div className="d-inline-block">
      <DatePicker
        selected={startDate}
        onChange={handleChange as any}
        startDate={startDate ?? undefined}
        endDate={endDate ?? undefined}
        selectsRange
        locale="de"
        dateFormat="dd.MM.yyyy"
        monthsShown={narrow ? 1 : 2}
        portalId="datepicker-portal"
        popperPlacement="bottom-end"
        shouldCloseOnSelect={false}
        calendarClassName="date-range-calendar shadow border-0 rounded-3"
        customInput={
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm rounded-3 d-inline-flex align-items-center gap-2"
          >
            <i className="bi bi-calendar-range" />
            <span>{label ?? displayText}</span>
          </button>
        }
      />
    </div>
  );
}
