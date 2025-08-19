// api.ts
import {
  KundeResource,
  LoginResponse,
  MitarbeiterResource,
  ArtikelResource,
  KundenPreisResource,
  AuftragResource,
  ArtikelPositionResource,
  ZerlegeauftragResource,
  FahrzeugResource,
} from "../Resources";
import {
  ErrorFromValidation,
  ErrorWithHTML,
  fetchWithErrorHandling,
} from "./fetchWithErrorHandling";
import { useAuth } from "../providers/Authcontext"; // falls im selben Kontext

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
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
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
    if (
      contentType.includes("application/json") &&
      Array.isArray(data.errors)
    ) {
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
  data: Partial<KundeResource> | Partial<MitarbeiterResource>
): Promise<LoginResponse> {
  const response = await fetchWithErrorHandling(`${API_URL}/api/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

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

export async function updateKunde(
  id: string,
  data: Partial<KundeResource>
): Promise<KundeResource> {
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

//* Mitarbeiter-Funktionen */
export async function getAllMitarbeiter(): Promise<MitarbeiterResource[]> {
  return apiFetch<MitarbeiterResource[]>("/api/mitarbeiter");
}

export async function getMitarbeiterById(
  id: string
): Promise<MitarbeiterResource> {
  return apiFetch<MitarbeiterResource>(`/api/mitarbeiter/${id}`);
}

export async function createMitarbeiter(
  data: Omit<MitarbeiterResource, "id" | "updatedAt">
): Promise<MitarbeiterResource> {
  return apiFetch<MitarbeiterResource>("/api/mitarbeiter", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMitarbeiter(
  id: string,
  data: Partial<MitarbeiterResource>
): Promise<MitarbeiterResource> {
  return apiFetch<MitarbeiterResource>(`/api/mitarbeiter/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMitarbeiter(
  id: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/mitarbeiter/${id}`, {
    method: "DELETE",
  });
}
/* Artikel-Funktionen */
export async function getAllArtikel(): Promise<ArtikelResource[]> {
  const kundeId = localStorage.getItem("ausgewaehlterKunde");
  const url = kundeId ? `/api/artikel?kunde=${kundeId}` : "/api/artikel";
  return apiFetch<ArtikelResource[]>(url);
}

export async function getAuswahlArtikel(): Promise<ArtikelResource[]> {
  const kundeId = localStorage.getItem("ausgewaehlterKunde");
  const url = kundeId
    ? `/api/artikel/auswahl?kunde=${kundeId}`
    : "/api/artikel/auswahl";
  return apiFetch<ArtikelResource[]>(url);
}

export async function getArtikelById(id: string): Promise<ArtikelResource> {
  const kundeId = localStorage.getItem("ausgewaehlterKunde");
  const url = kundeId
    ? `/api/artikel/${id}?kunde=${kundeId}`
    : `/api/artikel/${id}`;
  return apiFetch<ArtikelResource>(url);
}

export async function getAllArtikelClean(): Promise<ArtikelResource[]> {
  const url = "/api/artikel/clean";
  return apiFetch<ArtikelResource[]>(url);
}

export async function getArtikelByIdClean(
  id: string
): Promise<ArtikelResource> {
  const url = `/api/artikel/clean/${id}`;
  return apiFetch<ArtikelResource>(url);
}

export async function createArtikel(
  data: Omit<ArtikelResource, "id">
): Promise<ArtikelResource> {
  return apiFetch<ArtikelResource>("/api/artikel/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateArtikel(
  id: string,
  data: Partial<ArtikelResource>
): Promise<ArtikelResource> {
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
export async function getKundenpreiseByArtikel(
  artikelId: string
): Promise<KundenPreisResource[]> {
  return apiFetch<KundenPreisResource[]>(
    `/api/kundenpreis/artikel/${artikelId}`
  );
}

export async function updateKundenpreis(
  id: string,
  data: Partial<KundenPreisResource>
): Promise<KundenPreisResource> {
  return apiFetch<KundenPreisResource>(`/api/kundenpreis/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createMassKundenpreis(data: {
  artikel: string;
  aufpreis: number;
  kategorie?: string;
  region?: string;
}): Promise<KundenPreisResource> {
  return apiFetch<KundenPreisResource>("/api/kundenpreis/set-aufpreis", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createKundenpreis(
  data: Omit<KundenPreisResource, "id">
): Promise<KundenPreisResource> {
  return apiFetch<KundenPreisResource>("/api/kundenpreis", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteKundenpreis(
  id: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/kundenpreis/${id}`, {
    method: "DELETE",
  });
}

/* Auftrag-Funktionen */
export async function getAllAuftraege(): Promise<AuftragResource[]> {
  return apiFetch<AuftragResource[]>("/api/auftrag");
}

export async function getAuftragByCutomerId(
  id: string
): Promise<AuftragResource[]> {
  return apiFetch<AuftragResource[]>(`/api/auftrag/kunden/${id}`);
}

export async function getAuftragById(id: string): Promise<AuftragResource> {
  return apiFetch<AuftragResource>(`/api/auftrag/${id}`);
}

export async function getAlleAuftraegeInBearbeitung(): Promise<
  AuftragResource[]
> {
  return apiFetch<AuftragResource[]>(`/api/auftrag/in-bearbeitung`);
}

export async function getAuftragLetzte(): Promise<{
  auftrag: AuftragResource;
  artikelPositionen: ArtikelPositionResource[];
}> {
  const kundeId = localStorage.getItem("ausgewaehlterKunde");
  const url = kundeId
    ? `/api/auftrag/letzte?kunde=${kundeId}`
    : `/api/auftrag/letzte`;
  return apiFetch(url);
}
export async function getAuftragLetzteArtikel(): Promise<string[]> {
  const kundeId = localStorage.getItem("ausgewaehlterKunde");
  const url = kundeId
    ? `/api/auftrag/letzteArtikel?kunde=${kundeId}`
    : `/api/auftrag/letzteArtikel`;
  return apiFetch<string[]>(url);
}

export async function createAuftrag(
  data: Omit<AuftragResource, "id" | "createdAt" | "updatedAt" | "lieferdatum">
): Promise<AuftragResource> {
  return apiFetch<AuftragResource>("/api/auftrag", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAuftrag(
  id: string,
  data: Partial<AuftragResource>
): Promise<AuftragResource> {
  return apiFetch<AuftragResource>(`/api/auftrag/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function setAuftragInBearbeitung(
  id: string
): Promise<AuftragResource> {
  return apiFetch<AuftragResource>(`/api/auftrag/${id}/in-bearbeitung`, {
    method: "PUT",
  });
}

export async function deleteAuftrag(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/auftrag/${id}`, {
    method: "DELETE",
  });
}

/* ArtikelPosition-Funktionen */
export async function getAllArtikelPosition(): Promise<
  ArtikelPositionResource[]
> {
  return apiFetch<ArtikelPositionResource[]>("/api/artikelposition");
}

export async function getArtikelPositionById(
  id: string
): Promise<ArtikelPositionResource> {
  return apiFetch<ArtikelPositionResource>(`/api/artikelposition/${id}`);
}

export async function createArtikelPosition(
  data: Omit<ArtikelPositionResource, "id">
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

export async function updateArtikelPositionKommissionierung(
  id: string,
  data: Partial<ArtikelPositionResource>
): Promise<ArtikelPositionResource> {
  return apiFetch<ArtikelPositionResource>(
    `/api/artikelposition/${id}/kommissionierung`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteArtikelPosition(
  id: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/artikelposition/${id}`, {
    method: "DELETE",
  });
}

export async function getKundenFavoriten(kundenId?: string): Promise<string[]> {
  const id = kundenId ?? localStorage.getItem("ausgewaehlterKunde");
  if (!id) throw new Error("Kein Kunden-ID verfügbar");
  return apiFetch<string[]>(`/api/kunde/${id}/favoriten`);
}

export async function addKundenFavorit(
  kundenId: string,
  artikelId: string
): Promise<void> {
  await apiFetch(`/api/kunde/${kundenId}/favoriten`, {
    method: "POST",
    body: JSON.stringify({ artikelId }),
  });
}

export async function removeKundenFavorit(
  kundenId: string,
  artikelId: string
): Promise<void> {
  await apiFetch(`/api/kunde/${kundenId}/favoriten/${artikelId}`, {
    method: "DELETE",
  });
}

/* Zerlegeauftrag-Funktionen */
export async function getAllZerlegeauftraege(): Promise<
  ZerlegeauftragResource[]
> {
  return apiFetch<ZerlegeauftragResource[]>("/api/zerlege");
}

export async function getZerlegeauftragById(
  id: string
): Promise<ZerlegeauftragResource> {
  return apiFetch<ZerlegeauftragResource>(`/api/zerlege/${id}`);
}

export async function getAllOffeneZerlegeauftraege(): Promise<
  ZerlegeauftragResource[]
> {
  return apiFetch<ZerlegeauftragResource[]>("/api/zerlege/offen/liste");
}

export async function updateZerlegeauftragStatus(
  auftragId: string,
  artikelPositionId: string
): Promise<ZerlegeauftragResource> {
  return apiFetch<ZerlegeauftragResource>(`/api/zerlege/${auftragId}`, {
    method: "PATCH",
    body: JSON.stringify({ artikelPositionId }),
  });
}

export async function deleteZerlegeauftraegeByDatum(
  datum: string
): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>(`/api/zerlege`, {
    method: "DELETE",
  });
}

export async function createFahrzeug(
  data: Omit<FahrzeugResource, "id">
): Promise<FahrzeugResource> {
  return apiFetch<FahrzeugResource>("/api/fahrzeug", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getFahrzeugById(id: string): Promise<FahrzeugResource> {
  return apiFetch<FahrzeugResource>(`/api/fahrzeug/${id}`);
}

export async function getAllFahrzeuge(
  params: URLSearchParams
): Promise<any> {
  return apiFetch<any>(`/api/fahrzeug?${params.toString()}`);
}

export async function updateFahrzeug(
  id: string,
  data: Partial<FahrzeugResource>
): Promise<FahrzeugResource> {
  return apiFetch<FahrzeugResource>(`/api/fahrzeug/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteFahrzeug(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/fahrzeug/${id}`, {
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
  getAllArtikelClean,
  getArtikelByIdClean,
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
  getAlleAuftraegeInBearbeitung,
  getAuftragLetzte,
  getAuftragLetzteArtikel,
  createAuftrag,
  updateAuftrag,
  setAuftragInBearbeitung,
  deleteAuftrag,
  // Zerlegeauftrag
  getAllZerlegeauftraege,
  getZerlegeauftragById,
  getAllOffeneZerlegeauftraege,
  updateZerlegeauftragStatus,
  deleteZerlegeauftraegeByDatum,
  // ArtikelPosition
  getAllArtikelPosition,
  getArtikelPositionById,
  createArtikelPosition,
  updateArtikelPosition,
  updateArtikelPositionKommissionierung,
  deleteArtikelPosition,
  // Mitarbeiter
  getAllMitarbeiter,
  getMitarbeiterById,
  createMitarbeiter,
  updateMitarbeiter,
  deleteMitarbeiter,
  //Favoriten
  getKundenFavoriten,
  addKundenFavorit,
  removeKundenFavorit,
  //Fahrzeug
  getFahrzeugById,
  getAllFahrzeuge,
  updateFahrzeug,
  deleteFahrzeug,
};
