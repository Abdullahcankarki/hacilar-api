import React, { useEffect, useState } from "react";
import {
  LICENSE_BLOCKED_EVENT,
  LicenseStatus,
  fetchLicenseStatus,
  installLicenseInterceptor,
} from "./licenseClient";
import LicenseSetup from "./LicenseSetup";

type Phase = "loading" | "ok" | "setup" | "blocked";

interface Props {
  children: React.ReactNode;
}

export const LicenseGate: React.FC<Props> = ({ children }) => {
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    installLicenseInterceptor();
    void refresh();

    const onBlocked = () => {
      void refresh();
    };
    window.addEventListener(LICENSE_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(LICENSE_BLOCKED_EVENT, onBlocked);
  }, []);

  async function refresh() {
    let status: LicenseStatus;
    try {
      status = await fetchLicenseStatus();
    } catch {
      status = { ok: false, hasKey: false };
    }
    if (status.ok) {
      setPhase("ok");
    } else if (!status.hasKey) {
      setPhase("setup");
    } else {
      setPhase("blocked");
    }
  }

  if (phase === "loading") {
    return null;
  }

  if (phase === "setup") {
    return <LicenseSetup onActivated={() => void refresh()} />;
  }

  if (phase === "blocked") {
    return <BlockedScreen />;
  }

  return <>{children}</>;
};

const BlockedScreen: React.FC = () => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "#fff",
      color: "#333",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      zIndex: 99999,
      padding: "1rem",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "3rem", fontWeight: 300, color: "#888", marginBottom: "0.5rem" }}>
        5005
      </div>
      <div style={{ fontSize: "1rem", color: "#555" }}>
        Service nicht verfügbar
      </div>
    </div>
  </div>
);

export default LicenseGate;
