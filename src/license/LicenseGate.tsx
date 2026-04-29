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
      background: "#000",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "10rem",
      fontFamily: "monospace",
      zIndex: 99999,
      userSelect: "none",
    }}
  >
    5005
  </div>
);

export default LicenseGate;
