import React, { useState } from "react";
import { LICENSE_KEY_REGEX, activateLicense } from "./licenseClient";

interface Props {
  onActivated: () => void;
}

export const LicenseSetup: React.FC<Props> = ({ onActivated }) => {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = value.trim().toUpperCase();
  const valid = LICENSE_KEY_REGEX.test(normalized);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const ok = await activateLicense(normalized);
    setBusy(false);
    if (ok) {
      onActivated();
    } else {
      setError("5005");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#111",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          background: "#1c1c1c",
          padding: "2rem 2.5rem",
          borderRadius: "12px",
          minWidth: "360px",
          boxShadow: "0 6px 30px rgba(0,0,0,0.5)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Lizenzschlüssel eingeben</h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          maxLength={19}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            fontSize: "1.1rem",
            fontFamily: "monospace",
            letterSpacing: "0.1em",
            border: "1px solid #444",
            background: "#000",
            color: "#fff",
            borderRadius: "6px",
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={!valid || busy}
          style={{
            marginTop: "1rem",
            width: "100%",
            padding: "0.75rem 1rem",
            fontSize: "1rem",
            background: valid ? "#0d6efd" : "#444",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: valid && !busy ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "..." : "Speichern"}
        </button>
        {error && (
          <div style={{ marginTop: "1rem", textAlign: "center", color: "#ff6b6b", fontFamily: "monospace" }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default LicenseSetup;
