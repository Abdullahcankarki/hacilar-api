/**
 * Konvertiert Google Drive Links in direkte Bild-URLs
 *
 * Unterstützte Formate:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/file/d/FILE_ID
 * - https://drive.google.com/open?id=FILE_ID
 *
 * Wird konvertiert zu: https://lh3.googleusercontent.com/d/FILE_ID=w1000
 */
export function convertGoogleDriveUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  // Prüfe ob es ein Google Drive Link ist
  if (!url.includes('drive.google.com')) {
    return url; // Kein Google Drive Link, Original zurückgeben
  }

  // Bereits im lh3.googleusercontent.com Format
  if (url.includes('lh3.googleusercontent.com')) {
    return url;
  }

  // Extrahiere File-ID
  let fileId: string | null = null;

  // Format: https://drive.google.com/file/d/FILE_ID/...
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    fileId = fileMatch[1];
  }

  // Format: https://drive.google.com/open?id=FILE_ID
  if (!fileId) {
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch) {
      fileId = openMatch[1];
    }
  }

  // Konvertiere zu Backend-Proxy URL
  if (fileId) {
    const googleUrl = `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
    const apiBase = process.env.REACT_APP_API_SERVER_URL || 'http://localhost:3355';
    return `${apiBase}/api/image-proxy?url=${encodeURIComponent(googleUrl)}`;
  }

  // Fallback: Original URL
  return url;
}

/**
 * Gibt die Bild-URL zurück oder einen Fallback
 */
export function getImageUrl(url: string | undefined, fallback: string): string {
  const converted = convertGoogleDriveUrl(url);
  return converted || fallback;
}
