// api.ts
import {
  KundeResource,
  LoginResponse,
  VerkaeuferResource,
  ArtikelResource,
  KundenPreisResource,
  AuftragResource,
  ArtikelPositionResource,
} from "../Resources";
import { ErrorFromValidation, ErrorWithHTML, fetchWithErrorHandling } from "./fetchWithErrorHandling";
import { useAuth } from '../providers/Authcontext'; // falls im selben Kontext

let ausgewaehlterKundeGlobal: string | null = null;

export const setGlobalAusgewaehlterKunde = (id: string | null) => {
  ausgewaehlterKundeGlobal = id;
};

export const getGlobalAusgewaehlterKunde = (): string | null => {
  return ausgewaehlterKundeGlobal;
};

const API_URL = process.env.REACT_APP_API_SERVER_URL || "";

/**
 * Liefert das aktuell gespeicherte Token.
 */
function getToken(): string | null {
  return localStorage.getItem("token");
}

/**
 * Generischer Fetch‑Wrapper, der JSON-Requests absendet, den Authorization‑Header (falls vorhanden) setzt
 * und Fehler zentral verarbeitet.
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("Content-Type") ?? "";
  const text = await response.text(); // EINMAL lesen

  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!response.ok) {
    if (contentType.includes("application/json") && Array.isArray(data.errors)) {
      throw new ErrorFromValidation(response.status, data.errors);
    }
    if (contentType.includes("text/html")) {
      throw new ErrorWithHTML(response.status, text);
    }
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }

  return data as T;
}

/**
 * Authentifiziert einen Nutzer (Kunde oder Verkäufer) anhand der übergebenen Daten.
 * Beim Login wird kein Token gesendet.
 */
export async function login(
  data: Partial<KundeResource> | Partial<VerkaeuferResource>
): Promise<LoginResponse> {
  const response = await fetchWithErrorHandling(`${API_URL}/api/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Login-Fehler");
  }
  return response.json();
}

/* Kunde-Funktionen */
export async function getAllKunden(): Promise<KundeResource[]> {
  return apiFetch<KundeResource[]>("/api/kunde");
}

export async function getAllNotApprovedKunden(): Promise<KundeResource[]> {
  return apiFetch<KundeResource[]>("/api/kunde/unapproved");
}

export async function getKundeById(id: string): Promise<KundeResource> {
  return apiFetch<KundeResource>(`/api/kunde/${id}`);
}

export async function createKunde(
  data: Omit<KundeResource, "id" | "updatedAt">
): Promise<KundeResource> {
  return apiFetch<KundeResource>("/api/kunde/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateKunde(id: string, data: Partial<KundeResource>): Promise<KundeResource> {
  return apiFetch<KundeResource>(`/api/kunde/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteKunde(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/kunde/${id}`, {
    method: "DELETE",
  });
}

//* Verkaeufer-Funktionen */
export async function getAllVerkaeufer(): Promise<VerkaeuferResource[]> {
  return apiFetch<VerkaeuferResource[]>("/api/verkaeufer");
}

export async function getVerkaeuferById(id: string): Promise<VerkaeuferResource> {
  return apiFetch<VerkaeuferResource>(`/api/verkaeufer/${id}`);
}

export async function createVerkaeufer(data: Omit<VerkaeuferResource, "id" | "updatedAt">): Promise<VerkaeuferResource> {
  return apiFetch<VerkaeuferResource>("/api/verkaeufer", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateVerkaeufer(id: string, data: Partial<VerkaeuferResource>): Promise<VerkaeuferResource> {
  return apiFetch<VerkaeuferResource>(`/api/verkaeufer/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteVerkaeufer(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/verkaeufer/${id}`, {
    method: "DELETE",
  });
}
/* Artikel-Funktionen */
export async function getAllArtikel(): Promise<ArtikelResource[]> {
  const kundeId = getGlobalAusgewaehlterKunde();
  const url = kundeId ? `/api/artikel?kunde=${kundeId}` : "/api/artikel";
  return apiFetch<ArtikelResource[]>(url);
}

export async function getAuswahlArtikel(): Promise<ArtikelResource[]> {
  const kundeId = getGlobalAusgewaehlterKunde();
  const url = kundeId ? `/api/artikel/auswahl?kunde=${kundeId}` : "/api/artikel/auswahl";
  return apiFetch<ArtikelResource[]>(url);
}

export async function getArtikelById(id: string): Promise<ArtikelResource> {
  const kundeId = getGlobalAusgewaehlterKunde();
  const url = kundeId ? `/api/artikel/${id}?kunde=${kundeId}` : `/api/artikel/${id}`;
  return apiFetch<ArtikelResource>(url);
}

export async function createArtikel(data: Omit<ArtikelResource, "id">): Promise<ArtikelResource> {
  return apiFetch<ArtikelResource>("/api/artikel/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateArtikel(id: string, data: Partial<ArtikelResource>): Promise<ArtikelResource> {
  return apiFetch<ArtikelResource>(`/api/artikel/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteArtikel(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/artikel/${id}`, {
    method: "DELETE",
  });
}

/* Kundenpreis-Funktionen */
export async function getKundenpreiseByArtikel(artikelId: string): Promise<KundenPreisResource[]> {
  return apiFetch<KundenPreisResource[]>(`/api/kundenpreis/artikel/${artikelId}`);
}

export async function updateKundenpreis(id: string, data: Partial<KundenPreisResource>): Promise<KundenPreisResource> {
  return apiFetch<KundenPreisResource>(`/api/kundenpreis/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createMassKundenpreis(data: { artikel: string; aufpreis: number; kategorie?: string; region?: string }): Promise<KundenPreisResource> {
  return apiFetch<KundenPreisResource>("/api/kundenpreis/set-aufpreis", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createKundenpreis(data: Omit<KundenPreisResource, "id">): Promise<KundenPreisResource> {
  return apiFetch<KundenPreisResource>("/api/kundenpreis", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteKundenpreis(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/kundenpreis/${id}`, {
    method: "DELETE",
  });
}

/* Auftrag-Funktionen */
export async function getAllAuftraege(): Promise<AuftragResource[]> {
  return apiFetch<AuftragResource[]>("/api/auftrag");
}

export async function getAuftragByCutomerId(id: string): Promise<AuftragResource[]> {
  return apiFetch<AuftragResource[]>(`/api/auftrag/kunden/${id}`);
}

export async function getAuftragById(id: string): Promise<AuftragResource> {
  return apiFetch<AuftragResource>(`/api/auftrag/${id}`);
}

export async function getAuftragLetzte(): Promise<{
  auftrag: AuftragResource;
  artikelPositionen: ArtikelPositionResource[];
}> {
  return apiFetch(`/api/auftrag/letzte`);
}
export async function getAuftragLetzteArtikel(): Promise<string[]> {
  return apiFetch<Promise<string[]>>(`/api/auftrag/letzteArtikel`);
}

export async function createAuftrag(data: Omit<AuftragResource, "id" | "createdAt" | "updatedAt">): Promise<AuftragResource> {
  return apiFetch<AuftragResource>("/api/auftrag", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAuftrag(id: string, data: Partial<AuftragResource>): Promise<AuftragResource> {
  return apiFetch<AuftragResource>(`/api/auftrag/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAuftrag(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/auftrag/${id}`, {
    method: "DELETE",
  });
}

/* ArtikelPosition-Funktionen */
export async function getAllArtikelPosition(): Promise<ArtikelPositionResource[]> {
  return apiFetch<ArtikelPositionResource[]>("/api/artikelposition");
}

export async function getArtikelPositionById(id: string): Promise<ArtikelPositionResource> {
  return apiFetch<ArtikelPositionResource>(`/api/artikelposition/${id}`);
}


export async function createArtikelPosition(
  data: Omit<ArtikelPositionResource, 'id'>
): Promise<ArtikelPositionResource> {
  return apiFetch<ArtikelPositionResource>("/api/artikelposition", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateArtikelPosition(
  id: string,
  data: Partial<ArtikelPositionResource>
): Promise<ArtikelPositionResource> {
  return apiFetch<ArtikelPositionResource>(`/api/artikelposition/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteArtikelPosition(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/artikelposition/${id}`, {
    method: "DELETE",
  });
}

export async function getKundenFavoriten(kundenId: string): Promise<string[]> {
  return apiFetch<string[]>(`/api/kunde/${kundenId}/favoriten`);
}

export async function addKundenFavorit(kundenId: string, artikelId: string): Promise<void> {
  await apiFetch(`/api/kunde/${kundenId}/favoriten`, {
    method: "POST",
    body: JSON.stringify({ artikelId }),
  });
}

export async function removeKundenFavorit(kundenId: string, artikelId: string): Promise<void> {
  await apiFetch(`/api/kunde/${kundenId}/favoriten/${artikelId}`, {
    method: "DELETE",
  });
}

/* Exportiere ein Objekt, das alle Funktionen zusammenfasst */
export const api = {
  apiFetch,
  login,
  // Kunde
  getAllKunden,
  getAllNotApprovedKunden,
  getKundeById,
  createKunde,
  updateKunde,
  deleteKunde,
  // Artikel
  getAllArtikel,
  getAuswahlArtikel,
  getArtikelById,
  createArtikel,
  updateArtikel,
  deleteArtikel,
  // Kundenpreis
  getKundenpreiseByArtikel,
  updateKundenpreis,
  createKundenpreis,
  deleteKundenpreis,
  createMassKundenpreis,
  // Auftrag
  getAllAuftraege,
  getAuftragById,
  getAuftragByCutomerId,
  getAuftragLetzte,
  getAuftragLetzteArtikel,
  createAuftrag,
  updateAuftrag,
  deleteAuftrag,
  // ArtikelPosition
  getAllArtikelPosition,
  getArtikelPositionById,
  createArtikelPosition,
  updateArtikelPosition,
  deleteArtikelPosition,
  // Verkaeufer
  getAllVerkaeufer,
  getVerkaeuferById,
  createVerkaeufer,
  updateVerkaeufer,
  deleteVerkaeufer,
  //Favoriten
  getKundenFavoriten,
  addKundenFavorit,
  removeKundenFavorit
};