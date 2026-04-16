import React, { useState } from "react";
import GefluegelUebersicht from "./GefluegelUebersicht";
import GefluegelStatistik from "./GefluegelStatistik";
import PuteUebersicht from "./PuteUebersicht";
import PuteStatistik from "./PuteStatistik";
import GanzHaehnchenUebersicht from "./GanzHaehnchenUebersicht";
import GanzHaehnchenStatistik from "./GanzHaehnchenStatistik";
import BrustUebersicht from "./BrustUebersicht";
import BrustStatistik from "./BrustStatistik";

type Tab =
  | "haehnchen_tag"
  | "haehnchen_woche"
  | "haehnchen_monat"
  | "pute_tag"
  | "pute_woche"
  | "pute_monat"
  | "ganz_tag"
  | "ganz_woche"
  | "ganz_monat"
  | "brust_tag"
  | "brust_woche"
  | "brust_monat";

const TABS: { key: Tab; label: string; group: string }[] = [
  { key: "haehnchen_tag", label: "Tag", group: "Hähnchen" },
  { key: "haehnchen_woche", label: "Woche", group: "Hähnchen" },
  { key: "haehnchen_monat", label: "Monat", group: "Hähnchen" },
  { key: "pute_tag", label: "Tag", group: "Pute" },
  { key: "pute_woche", label: "Woche", group: "Pute" },
  { key: "pute_monat", label: "Monat", group: "Pute" },
  { key: "ganz_tag", label: "Tag", group: "Ganz Hähnchen" },
  { key: "ganz_woche", label: "Woche", group: "Ganz Hähnchen" },
  { key: "ganz_monat", label: "Monat", group: "Ganz Hähnchen" },
  { key: "brust_tag", label: "Tag", group: "Brust" },
  { key: "brust_woche", label: "Woche", group: "Brust" },
  { key: "brust_monat", label: "Monat", group: "Brust" },
];

export default function GefluegelPage() {
  const [activeTab, setActiveTab] = useState<Tab>("haehnchen_tag");

  const groups = ["Hähnchen", "Pute", "Ganz Hähnchen", "Brust"];

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
      {activeTab === "ganz_tag" && <GanzHaehnchenUebersicht />}
      {activeTab === "ganz_woche" && <GanzHaehnchenStatistik mode="woche" />}
      {activeTab === "ganz_monat" && <GanzHaehnchenStatistik mode="monat" />}
      {activeTab === "brust_tag" && <BrustUebersicht />}
      {activeTab === "brust_woche" && <BrustStatistik mode="woche" />}
      {activeTab === "brust_monat" && <BrustStatistik mode="monat" />}
    </div>
  );
}
