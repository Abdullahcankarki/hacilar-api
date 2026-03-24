import React, { useState } from "react";
import GefluegelUebersicht from "./GefluegelUebersicht";
import GefluegelStatistik from "./GefluegelStatistik";
import PuteUebersicht from "./PuteUebersicht";
import PuteStatistik from "./PuteStatistik";

type Tab =
  | "haehnchen_tag"
  | "haehnchen_woche"
  | "haehnchen_monat"
  | "pute_tag"
  | "pute_woche"
  | "pute_monat";

const TABS: { key: Tab; label: string; group: string }[] = [
  { key: "haehnchen_tag", label: "Tag", group: "Hähnchen" },
  { key: "haehnchen_woche", label: "Woche", group: "Hähnchen" },
  { key: "haehnchen_monat", label: "Monat", group: "Hähnchen" },
  { key: "pute_tag", label: "Tag", group: "Pute" },
  { key: "pute_woche", label: "Woche", group: "Pute" },
  { key: "pute_monat", label: "Monat", group: "Pute" },
];

export default function GefluegelPage() {
  const [activeTab, setActiveTab] = useState<Tab>("haehnchen_tag");

  const groups = ["Hähnchen", "Pute"];

  return (
    <div className="container-fluid mt-3">
      {/* Tab Navigation */}
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        {groups.map((group) => (
          <div key={group} className="d-flex align-items-center gap-1">
            <span className="fw-semibold text-muted small me-1">{group}:</span>
            <div className="btn-group btn-group-sm">
              {TABS.filter((t) => t.group === group).map((t) => (
                <button
                  key={t.key}
                  className={`btn ${activeTab === t.key ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      {activeTab === "haehnchen_tag" && <GefluegelUebersicht />}
      {activeTab === "haehnchen_woche" && <GefluegelStatistik mode="woche" />}
      {activeTab === "haehnchen_monat" && <GefluegelStatistik mode="monat" />}
      {activeTab === "pute_tag" && <PuteUebersicht />}
      {activeTab === "pute_woche" && <PuteStatistik mode="woche" />}
      {activeTab === "pute_monat" && <PuteStatistik mode="monat" />}
    </div>
  );
}
