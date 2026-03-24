import React, { useRef, useState, useCallback } from "react";

interface PdfDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
}

export default function PdfDropZone({
  onFilesSelected,
  multiple = false,
  label,
}: PdfDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      );
      if (files.length > 0) {
        onFilesSelected(multiple ? files : [files[0]]);
      }
    },
    [onFilesSelected, multiple]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onFilesSelected(files);
      }
      e.target.value = "";
    },
    [onFilesSelected]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? "#2e86c1" : "#ccc"}`,
        borderRadius: 10,
        padding: "40px 20px",
        textAlign: "center",
        cursor: "pointer",
        background: dragOver ? "#eaf4fc" : "#f8f9fa",
        transition: "all 0.2s",
      }}
    >
      <i
        className="bi bi-cloud-arrow-up"
        style={{ fontSize: 48, color: dragOver ? "#2e86c1" : "#999" }}
      />
      <p className="mt-2 mb-1 fw-semibold" style={{ color: "#555" }}>
        {label || (multiple ? "PDFs hier ablegen" : "PDF hier ablegen")}
      </p>
      <p className="text-muted small mb-0">
        oder klicken zum Auswaehlen
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple={multiple}
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
