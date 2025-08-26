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
  RegionRuleResource,
  ReihenfolgeVorlageResource,
  TourResource,
  TourStopResource,
  TourStatus,
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

function toQuery(params?: Record<string, any>): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === "") continue;
    if (Array.isArray(val)) {
      // repeat key for arrays
      for (const v of val) qs.append(key, String(v));
    } else if (typeof val === "boolean") {
      qs.set(key, val ? "true" : "false");
    } else {
      qs.set(key, String(val));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// Baut ?query=... aus einem Objekt. Lässt undefined/null/"" weg.
// Arrays werden komma-separiert kodiert (serverseitig unterstützen wir beides).
export function toQueryArtikel(params?: Record<string, any>): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      usp.append(key, val.join(","));
    } else if (typeof val === "boolean" || typeof val === "number") {
      usp.append(key, String(val));
    } else if (typeof val === "string") {
      const v = val.trim();
      if (v.length === 0) continue;
      usp.append(key, v);
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

/** Baut Querystring für /api/tour (unterstützt status als string oder Array -> "status[]") */
function toQueryTour(params?: {
  dateFrom?: string;
  dateTo?: string;
  region?: string;
  status?: string | string[];
  fahrzeugId?: string;
  fahrerId?: string;
  isStandard?: boolean;
  q?: string;
  page?: number;
  limit?: number;
  sort?: "datumAsc" | "datumDesc" | "createdDesc";
}): string {
  if (!params) return "";
  const usp = new URLSearchParams();

  const add = (k: string, v: any) => {
    if (v === undefined || v === null || v === "") return;
    usp.append(k, String(v));
  };

  if (params.dateFrom) add("dateFrom", params.dateFrom);
  if (params.dateTo) add("dateTo", params.dateTo);
  if (params.region) add("region", params.region);
  if (Array.isArray(params.status)) {
    for (const s of params.status) usp.append("status[]", s);
  } else if (typeof params.status === "string") {
    add("status", params.status);
  }
  if (params.fahrzeugId) add("fahrzeugId", params.fahrzeugId);
  if (params.fahrerId) add("fahrerId", params.fahrerId);
  if (typeof params.isStandard === "boolean") add("isStandard", params.isStandard);
  if (params.q) add("q", params.q);
  if (params.page) add("page", params.page);
  if (params.limit) add("limit", params.limit);
  if (params.sort) add("sort", params.sort);

  const s = usp.toString();
  return s ? `?${s}` : "";
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
export async function getAllKunden(params?: {
  page?: number;
  limit?: number;
  search?: string;
  region?: string;
  isApproved?: boolean;
  sortBy?: string; // e.g. "name" or "-createdAt"
}): Promise<{ items: KundeResource[]; total: number; page: number; limit: number }> {
  const q = toQuery(params);
  return apiFetch<{ items: KundeResource[]; total: number; page: number; limit: number }>(`/api/kunde${q}`);
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

export async function approveKunde(
  id: string,
  isApproved: boolean
): Promise<KundeResource> {
  return apiFetch<KundeResource>(`/api/kunde/${id}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ isApproved }),
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

export async function getAllArtikelClean(params?: {
  page?: number;
  limit?: number;
  kategorie?: string | string[];
  ausverkauft?: boolean;
  name?: string;
  erfassungsModus?: string | string[];
}): Promise<{
  items: ArtikelResource[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}> {
  const base = "/api/artikel/clean";   // ⚠️ wichtig: exakt dieser Pfad
  const q = toQueryArtikel(params);
  return apiFetch<{
    items: ArtikelResource[];
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>(`${base}${q}`);
}

/** Optional: GET /api/artikel – identisch, aber mit ?kunde=... */
export async function getAllArtikel(params?: {
  page?: number;
  limit?: number;
  kategorie?: string | string[];
  ausverkauft?: boolean;
  name?: string;
  erfassungsModus?: string | string[];
}): Promise<{
  items: ArtikelResource[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}> {
  const base = "/api/artikel";
  const queryObj: Record<string, any> = { ...(params || {}) };
  const kundeId = localStorage.getItem("ausgewaehlterKunde");
  if (kundeId) queryObj.kunde = kundeId;
  const q = toQueryArtikel(queryObj);
  return apiFetch<{
    items: ArtikelResource[];
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>(`${base}${q}`);
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

export async function getAllFahrzeuge(params?: Record<string, any>): Promise<any> {
  const q = toQueryArtikel(params);
  return apiFetch<any>(`/api/fahrzeug${q}`);
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

export async function createRegionRule(
  data: Omit<RegionRuleResource, "id">
): Promise<RegionRuleResource> {
  return apiFetch<RegionRuleResource>("/api/region-rule", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getRegionById(id: string): Promise<RegionRuleResource> {
  return apiFetch<RegionRuleResource>(`/api/region-rule/${id}`);
}

export async function getAllRegionRules(
  params?: { q?: string; region?: string; active?: boolean; page?: number; limit?: number; sortBy?: string }
): Promise<{ items: RegionRuleResource[]; total: number; page: number; limit: number }> {
  const q = toQuery(params);
  return apiFetch<{ items: RegionRuleResource[]; total: number; page: number; limit: number }>(`/api/region-rule${q}`);
}

export async function updateRegionRule(
  id: string,
  data: Partial<RegionRuleResource>
): Promise<RegionRuleResource> {
  return apiFetch<RegionRuleResource>(`/api/region-rule/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteRegionRule(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/region-rule/${id}`, {
    method: "DELETE",
  });
}


export async function createReihenfolgeVorlage(
  data: Omit<ReihenfolgeVorlageResource, "id">
): Promise<ReihenfolgeVorlageResource> {
  return apiFetch<ReihenfolgeVorlageResource>("/api/reihenfolge-vorlage", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getReihenfolgeVorlageById(id: string): Promise<ReihenfolgeVorlageResource> {
  return apiFetch<ReihenfolgeVorlageResource>(`/api/reihenfolge-vorlage/${id}`);
}

export async function getAllReihenfolgeVorlages(
  params?: { q?: string; region?: string; active?: boolean; page?: number; limit?: number; sortBy?: string }
): Promise<{ items: ReihenfolgeVorlageResource[]; total: number; page: number; limit: number }> {
  const q = toQuery(params);
  return apiFetch<{ items: ReihenfolgeVorlageResource[]; total: number; page: number; limit: number }>(`/api/reihenfolge-vorlage${q}`);
}

export async function updateReihenfolgeVorlage(
  id: string,
  data: Partial<ReihenfolgeVorlageResource>
): Promise<ReihenfolgeVorlageResource> {
  return apiFetch<ReihenfolgeVorlageResource>(`/api/reihenfolge-vorlage/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteReihenfolgeVorlage(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/reihenfolge-vorlage/${id}`, {
    method: "DELETE",
  });
}

/* ------------------------------- Tour-Funktionen ------------------------------- */
export async function createTour(
  data: {
    datum: string;
    region: string;
    name?: string;
    fahrzeugId?: string;
    fahrerId?: string;
    maxGewichtKg?: number;
    status?: TourStatus;
    reihenfolgeVorlageId?: string;
    isStandard?: boolean;
    parentTourId?: string;
    splitIndex?: number;
  }
): Promise<TourResource> {
  return apiFetch<TourResource>("/api/tour", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTourById(id: string): Promise<TourResource> {
  return apiFetch<TourResource>(`/api/tour/${id}`);
}

/** Liste / Suche mit Server-Pagination */
export async function getAllTours(params?: {
  dateFrom?: string;
  dateTo?: string;
  region?: string;
  status?: string | string[]; // passt
  fahrzeugId?: string;
  fahrerId?: string;
  isStandard?: boolean;
  q?: string;
  page?: number;
  limit?: number;
  sort?: "datumAsc" | "datumDesc" | "createdDesc";
}): Promise<{ items: TourResource[]; total: number; page: number; limit: number }> {
  const q = toQueryTour(params); // <— Stelle sicher, dass Arrays als status[]=… serialisiert werden
  return apiFetch(`/api/tour${q}`);
}

export async function updateTour(
  id: string,
  data: Partial<TourResource>
): Promise<TourResource> {
  return apiFetch<TourResource>(`/api/tour/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function archiveTour(id: string): Promise<TourResource> {
  return apiFetch<TourResource>(`/api/tour/${id}/archive`, {
    method: "POST",
  });
}

export async function unarchiveTour(id: string): Promise<TourResource> {
  return apiFetch<TourResource>(`/api/tour/${id}/unarchive`, {
    method: "POST",
  });
}

export async function deleteTour(id: string): Promise<void> {
  await apiFetch<void>(`/api/tour/${id}`, { method: "DELETE" });
}

/** Achtung: gefährlich – löscht alle Touren */
export async function deleteAllTours(): Promise<void> {
  await apiFetch<void>("/api/tour", { method: "DELETE" });
}

/* ----------------------------- TourStop-Funktionen ----------------------------- */
export async function createTourStop(
  data: Omit<TourStopResource, "id" | "updatedAt" | "abgeschlossenAm">
): Promise<TourStopResource> {
  return apiFetch<TourStopResource>("/api/tour-stop", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTourStopById(id: string): Promise<TourStopResource> {
  return apiFetch<TourStopResource>(`/api/tour-stop/${id}`);
}

/** Listet Stops, optional gefiltert nach tourId / auftragId / kundeId */
export async function listTourStops(params?: {
  tourId?: string;
  auftragId?: string;
  kundeId?: string;
}): Promise<TourStopResource[]> {
  const q = toQueryArtikel(params as any);
  return apiFetch<TourStopResource[]>(`/api/tour-stop${q}`);
}

/** Patch einzelner Felder (position, gewichtKg, status, fehlgrund, signatur..., leergutMitnahme, abgeschlossenAm) */
export async function updateTourStop(
  id: string,
  data: Partial<Pick<TourStopResource,
    "position" | "gewichtKg" | "status" | "fehlgrund" |
    "signaturPngBase64" | "signTimestampUtc" | "signedByName" |
    "leergutMitnahme" | "abgeschlossenAm"
  >>
): Promise<TourStopResource> {
  return apiFetch<TourStopResource>(`/api/tour-stop/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTourStop(id: string): Promise<void> {
  await apiFetch<void>(`/api/tour-stop/${id}`, { method: "DELETE" });
}

/** Achtung: gefährlich – löscht alle TourStops */
export async function deleteAllTourStops(): Promise<void> {
  await apiFetch<void>("/api/tour-stop", { method: "DELETE" });
}

/** Helper: Reihenfolge in einer Tour neu setzen – führt sequentielle PATCH-Requests aus */
// Robust gegen E11000 bei Unique-Index (tourId, position):
export async function reorderTourStops(tourId: string, orderedStopIds: string[]): Promise<void> {
  // defensive guards
  if (!tourId) return;
  const desired = (orderedStopIds || []).filter(Boolean);

  // 0) Hole ALLE Stops dieser Tour (wir müssen komplette Tour bewegen, um E11000 zu vermeiden)
  const allStops = await listTourStops({ tourId });
  const allIds = allStops.map(s => s.id!).filter(Boolean) as string[];
  if (!allIds.length) return;

  // 1) Phase (Temp): verschiebe ALLE Stops in einen hohen Bereich, damit 1..N frei ist
  const TEMP_OFFSET = 1000;
  let idx = 1;
  for (const id of allIds) {
    try {
      await updateTourStop(id, { position: TEMP_OFFSET + idx });
    } catch (err: any) {
      console.warn("Temp move failed for stop", id, err?.message ?? err);
    }
    idx++;
  }

  // 2) Phase (Final-Order): zuerst gewünschte Reihenfolge 1..K setzen
  let pos = 1;
  for (const id of desired) {
    try {
      await updateTourStop(id, { position: pos });
    } catch (err: any) {
      console.warn("Final set (desired) failed for stop", id, err?.message ?? err);
    }
    pos++;
  }

  // 3) Phase (Rest): restliche Stops in ihrer bisherigen Reihenfolge (nach Temp) anhängen
  const setDesired = new Set(desired);
  for (const s of allStops) {
    const id = s.id!;
    if (setDesired.has(id)) continue;
    try {
      await updateTourStop(id, { position: pos });
    } catch (err: any) {
      console.warn("Final set (rest) failed for stop", id, err?.message ?? err);
    }
    pos++;
  }
}

/** Move a TourStop atomar zwischen Touren */
export async function moveTourStop(
  stopId: string,
  data: { toTourId: string; targetIndex?: number }
): Promise<TourStopResource> {
  return apiFetch<TourStopResource>(`/api/tour-stop/${stopId}/move`, {
    method: "POST",
    body: JSON.stringify(data),
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
  approveKunde,
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
  //Region-Rule
  getRegionById,
  getAllRegionRules,
  updateRegionRule,
  deleteRegionRule,
  //ReihenfolgeVorlage
  getReihenfolgeVorlageById,
  getAllReihenfolgeVorlages,
  createReihenfolgeVorlage,
  updateReihenfolgeVorlage,
  deleteReihenfolgeVorlage,
  // Tour
  createTour,
  getTourById,
  getAllTours,
  updateTour,
  archiveTour,
  unarchiveTour,
  deleteTour,
  deleteAllTours,
  // TourStop
  createTourStop,
  getTourStopById,
  listTourStops,
  updateTourStop,
  deleteTourStop,
  deleteAllTourStops,
  reorderTourStops,
  moveTourStop,
};
