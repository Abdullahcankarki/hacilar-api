import * as pdfjsLib from "pdfjs-dist";

// Worker via CDN laden
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

interface TextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, translateX, translateY]
}

/**
 * Rekonstruiert Textzeilen aus PDF.js TextContent Items.
 * Gruppiert Items nach Y-Koordinate (Toleranz 2px) und sortiert nach X.
 */
function reconstructLines(items: TextItem[]): string[] {
  if (items.length === 0) return [];

  // Gruppiere nach Y-Koordinate
  const yGroups = new Map<number, TextItem[]>();
  const Y_TOLERANCE = 2;

  for (const item of items) {
    const y = Math.round(item.transform[5]); // translateY
    let matchedY: number | null = null;

    for (const existingY of Array.from(yGroups.keys())) {
      if (Math.abs(existingY - y) <= Y_TOLERANCE) {
        matchedY = existingY;
        break;
      }
    }

    if (matchedY !== null) {
      yGroups.get(matchedY)!.push(item);
    } else {
      yGroups.set(y, [item]);
    }
  }

  // Sortiere Gruppen nach Y (absteigend, da PDF Y von unten zaehlt)
  const sortedGroups = Array.from(yGroups.entries()).sort(
    ([a], [b]) => b - a
  );

  // Pro Gruppe: Items nach X sortieren, zu Zeile zusammenfuegen
  return sortedGroups.map(([, group]) => {
    group.sort((a, b) => a.transform[4] - b.transform[4]); // nach X sortieren
    return group.map((item) => item.str).join(" ").trim();
  });
}

/** Extrahiert alle Textzeilen aus allen Seiten eines PDFs. */
export async function extractPdfText(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const allLines: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter(
      (item: any) => "str" in item && item.str.trim() !== ""
    ) as TextItem[];
    allLines.push(...reconstructLines(items));
  }

  return allLines;
}

/** Extrahiert Textzeilen nur von der ersten Seite. */
export async function extractFirstPageText(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  if (pdf.numPages === 0) return [];

  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.filter(
    (item: any) => "str" in item && item.str.trim() !== ""
  ) as TextItem[];

  return reconstructLines(items);
}
