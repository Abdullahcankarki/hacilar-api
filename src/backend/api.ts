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

let ausgewaehlterKundeGlobal: string | null = null;

export const setGlobalAusgewaehlterKunde = (id: string | null) => {
  ausgewaehlterKundeGlobal = id;
};

export const getGlobalAusgewaehlterKunde = (): string | null => {
  return ausgewaehlterKundeGlobal;
};

const API_URL = process.env.REACT_APP_API_SERVER_URL || "";

/** Mapping: auftragId -> Tour-Infos (ohne Resource-Erweiterung) */
export type TourInfosMap = Record<string, {
  tourStopId?: string;
  tourId?: string;
  reihenfolge?: number;
  kennzeichen?: string;
}>;

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
export async function getAllAuftraege(params?: {
  page?: number;
  limit?: number;
  // Filters
  status?: "offen" | "in Bearbeitung" | "abgeschlossen" | "storniert";
  statusIn?: Array<"offen" | "in Bearbeitung" | "abgeschlossen" | "storniert">;
  kunde?: string;
  auftragsnummer?: string;
  q?: string;
  lieferdatumVon?: string;
  lieferdatumBis?: string;
  createdVon?: string;
  createdBis?: string;
  updatedVon?: string;
  updatedBis?: string;
  kommissioniertStatus?: "offen" | "gestartet" | "fertig";
  kontrolliertStatus?: "offen" | "geprüft";
  bearbeiter?: string;
  kommissioniertVon?: string;
  kontrolliertVon?: string;
  hasTour?: boolean;
  // Sorting
  sort?:
    | "createdAtDesc" | "createdAtAsc"
    | "updatedAtDesc" | "updatedAtAsc"
    | "lieferdatumAsc" | "lieferdatumDesc"
    | "auftragsnummerAsc" | "auftragsnummerDesc";
}): Promise<AuftragResource[]> {
  const qObj: Record<string, any> = { ...(params || {}) };
  // Backend erwartet statusIn als kommagetrennte Liste – sichere das hier ab
  if (Array.isArray(qObj.statusIn)) {
    qObj.statusIn = qObj.statusIn.join(",");
  }
  const q = toQuery(qObj);
  return apiFetch<AuftragResource[]>(`/api/auftrag${q}`);
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

/**
 * GET /api/auftrag/in-bearbeitung/tour-infos
 * Liefert Mapping für die aktuell sichtbaren in-Bearbeitung-Aufträge.
 */
export async function getTourInfosForInBearbeitung(): Promise<TourInfosMap> {
  return apiFetch<TourInfosMap>(`/api/auftrag/in-bearbeitung/tour-infos`);
}

/**
 * POST /api/auftrag/tour-infos
 * Body: { ids: string[] }
 * Liefert Mapping auftragId -> { reihenfolge, kennzeichen, ... }
 */
export async function getTourInfosForAuftraege(ids: string[]): Promise<TourInfosMap> {
  return apiFetch<TourInfosMap>(`/api/auftrag/tour-infos`, {
    method: "POST",
    body: JSON.stringify({ ids }),
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

/** Kompakter Typ für Kundenstopps inkl. Koordinaten (vom Backend geliefert) */
export type TourCustomerStopDTO = {
  tourId: string;
  stopId: string;
  kundeId: string;
  kundeName?: string;
  kundeAdress?: string;
  position: number;
  lat?: number;
  lng?: number;
};

/** Kundenstopps (heute) inkl. ETA-Range & optionaler Fahrzeugposition */
export type TourCustomerStopTodayDTO = {
  tourId: string;
  stopId: string;
  position: number;
  status?: string;
  etaFromUtc: string; // earliest ETA (UTC)
  etaToUtc: string;   // latest ETA (UTC)
  fahrzeug?: { name?: string; samsaraId?: string; coords?: { lat?: number; lng?: number } };
};

/**
 * GET /api/tourstops/customers/by-date
 * Optional: date (YYYY-MM-DD, Europe/Berlin), fahrerId, region
 */
export async function getCustomerStopsByDate(params?: {
  date?: string;
  fahrerId?: string;
  region?: string;
}): Promise<TourCustomerStopDTO[]> {
  const q = toQuery({ date: params?.date, fahrerId: params?.fahrerId, region: params?.region });
  return apiFetch<TourCustomerStopDTO[]>(`/api/tour-stop/customers/by-date${q}`);
}

/**
 * GET /api/tour-stop/customers/today/:kundeId
 * Verhalten geändert: 
 *  - Wenn der eingeloggte Nutzer die Rolle 'kunde' hat und **keine** kundenId übergeben wurde, wird seine eigene ID verwendet.
 *  - Für Admin/Verkäufer & Co. MUSS die kundenId **explizit** übergeben werden (kein Fallback mehr auf localStorage.ausgewaehlterKunde).
 */
export async function getCustomerStopsToday(kundeId?: string): Promise<TourCustomerStopTodayDTO[]> {
  let id = (kundeId || '').trim();

  // Rollen aus gespeichertem User ziehen (nur zur Unterscheidung Kunde vs. Nicht-Kunde)
  let isKunde = false;
  let userId: string | undefined;
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u: any = JSON.parse(raw);
      const roles: string[] = Array.isArray(u?.rollen)
        ? u.rollen
        : (Array.isArray(u?.role) ? u.role : (u?.role ? [u.role] : []));
      isKunde = roles.includes('kunde');
      userId = String(u?.id || u?._id || '');
    }
  } catch {}

  // Kunde eingeloggt → falls keine ID übergeben, nimm seine eigene
  if (!id && isKunde && userId) {
    id = userId;
  }

  // Nicht-Kunde (Admin/Verkäufer) → kundenId MUSS übergeben werden
  if (!id) {
    throw new Error('Bitte Kunden-ID angeben (für Admin/Verkäufer ist keine automatische Auswahl mehr erlaubt).');
  }

  return apiFetch<TourCustomerStopTodayDTO[]>(`/api/tour-stop/customers/today/${id}`);
}
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

/* Beleg-Funktionen */
export async function generateBelegPdf(
  auftragId: string,
  typ: "lieferschein" | "rechnung" | "gutschrift" | "preisdifferenz",
  data?: Partial<any>
): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/beleg/${auftragId}/${typ}/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: data ? JSON.stringify(data) : "{}",
  });
  if (!res.ok) throw new Error(`Fehler beim PDF-Generieren: ${res.statusText}`);
  return res.blob();
}

export type BatchBelegFile = { auftragId: string; filename: string; blob: Blob };

// ------------------------- Zusatz-Typen: Charges & Bestand -------------------------
export type ChargeListResponse = { items: any[]; total: number; page: number; limit: number };
export type BestandUebersichtResponse = { items: any[]; total: number; page: number; limit: number };
export type ChargeViewResponse = { charge: any | null; reservierungen: any[]; bewegungen: any[] };
/* ------------------------------ Charges (Chargen) ------------------------------ */
export async function listCharges(params?: {
  artikelId?: string; q?: string; isTK?: boolean; mhdFrom?: string; mhdTo?: string; page?: number; limit?: number;
}): Promise<ChargeListResponse> {
  const q = toQuery(params as any);
  return apiFetch<ChargeListResponse>(`/api/charges${q}`);
}

export async function getChargeByIdApi(id: string): Promise<any> {
  return apiFetch<any>(`/api/charges/${id}`);
}

export async function getChargeViewApi(id: string): Promise<ChargeViewResponse> {
  return apiFetch<ChargeViewResponse>(`/api/charges/${id}/view`);
}

export async function createChargeApi(data: {
  artikelId: string; mhd: string; isTK: boolean; schlachtDatum?: string; lieferantId?: string;
}): Promise<any> {
  return apiFetch<any>(`/api/charges`, { method: "POST", body: JSON.stringify(data) });
}

export async function updateChargeApi(id: string, data: Partial<{ mhd: string; isTK: boolean; schlachtDatum?: string; lieferantId?: string; artikelId: string }>): Promise<any> {
  return apiFetch<any>(`/api/charges/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function mergeChargeApi(sourceChargeId: string, data: { zielChargeId: string; menge?: number; zielLagerbereich: "TK"|"NON_TK"; notiz?: string; }): Promise<any> {
  return apiFetch<any>(`/api/charges/${sourceChargeId}/merge`, { method: "POST", body: JSON.stringify(data) });
}

export async function umbuchenChargeApi(sourceChargeId: string, data: { nach: { chargeId?: string; lagerbereich: "TK"|"NON_TK"; newCharge?: { mhd: string; isTK: boolean; schlachtDatum?: string; lieferantId?: string } }; menge: number; notiz?: string; }): Promise<any> {
  return apiFetch<any>(`/api/charges/${sourceChargeId}/umbuchen`, { method: "POST", body: JSON.stringify(data) });
}

export async function muellChargeApi(chargeId: string, data: { menge: number; lagerbereich: "TK"|"NON_TK"; grund: "MHD_ABGELAUFEN"|"BESCHAEDIGT"|"VERDERB"|"RUECKWEISUNG_KUNDE"|"SONSTIGES"; notiz?: string; }): Promise<any> {
  return apiFetch<any>(`/api/charges/${chargeId}/muell`, { method: "POST", body: JSON.stringify(data) });
}

export async function deleteChargeApi(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/charges/${id}`, { method: "DELETE" });
}

/* ----------------------------------- Bestand ---------------------------------- */
export async function getBestandUebersichtApi(params?: {
  artikelId?: string; chargeId?: string; lagerbereich?: "TK"|"NON_TK"; datum?: string; q?: string; kritisch?: boolean; thresholdDays?: number; page?: number; limit?: number;
}): Promise<BestandUebersichtResponse> {
  const q = toQuery(params as any);
  return apiFetch<BestandUebersichtResponse>(`/api/bestand/uebersicht${q}`);
}

export async function getBestandChargeViewApi(chargeId: string): Promise<ChargeViewResponse> {
  return apiFetch<ChargeViewResponse>(`/api/bestand/charge/${chargeId}`);
}

export async function getBestandZeitreiseApi(params: { datum: string; artikelId?: string; chargeId?: string; }): Promise<{ items: any[] }> {
  const q = toQuery(params as any);
  return apiFetch<{ items: any[] }>(`/api/bestand/zeitreise${q}`);
}

/**
 * Manueller Zugang (ohne Wareneingang): Bestand positiv korrigieren oder neue Charge on-the-fly anlegen
 * POST /api/bestand/manuell-zugang
 */
export async function addManuellerZugangApi(data: {
  artikelId: string;
  menge: number; // > 0
  lagerbereich: "TK" | "NON_TK";
  notiz?: string;
  chargeId?: string; // existierende Charge nutzen
  createNewCharge?: { // neue Charge anlegen
    mhd: string; // YYYY-MM-DD
    isTK: boolean;
    schlachtDatum?: string; // YYYY-MM-DD
    lieferantId?: string;
  };
}): Promise<{ bewegung: any; chargeId: string }> {
  return apiFetch<{ bewegung: any; chargeId: string }>(`/api/bestand/manuell-zugang`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * DELETE /api/bestand/charge/:id/komplett
 * Löscht eine Charge inkl. Bewegungen, Reservierungen und Aggregationen (transaktional)
 */
export async function deleteBestandChargeKomplettApi(id: string): Promise<{
  success: boolean;
  deleted: { reservierungen: number; bewegungen: number; agg: number; charge: number };
}> {
  return apiFetch(`/api/bestand/charge/${id}/komplett`, { method: "DELETE" });
}

/**
 * DELETE /api/bestand/artikel/:id/komplett
 * Löscht alle Bestände/Charges eines Artikels inkl. zugehöriger Daten
 */
export async function deleteBestandByArtikelKomplettApi(id: string): Promise<{
  success: boolean;
  deleted: { reservierungen: number; bewegungen: number; agg: number; charges: number };
}> {
  return apiFetch(`/api/bestand/artikel/${id}/komplett`, { method: "DELETE" });
}

/* ----------------------------------- Historie --------------------------------- */
export async function listHistorie(params?: {
  from?: string; to?: string; typ?: string; artikelId?: string; chargeId?: string; auftragId?: string; lagerbereich?: "TK"|"NON_TK"; q?: string; page?: number; limit?: number;
}): Promise<{ items: any[]; total: number; page: number; limit: number }> {
  const q = toQuery(params as any);
  return apiFetch(`/api/historie${q}`);
}

export async function getBewegungByIdApi(id: string): Promise<any> {
  return apiFetch<any>(`/api/historie/${id}`);
}

export async function exportHistorieCsv(params?: {
  from?: string; to?: string; typ?: string; artikelId?: string; chargeId?: string; auftragId?: string; lagerbereich?: "TK"|"NON_TK"; q?: string; filename?: string;
}): Promise<Blob> {
  const q = toQuery(params as any);
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/api/historie/export.csv${q}` , {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Export fehlgeschlagen: ${res.statusText}`);
  return res.blob();
}

/* ------------------------------------ Müll ------------------------------------ */
export async function listMuellApi(params?: { from?: string; to?: string; artikelId?: string; chargeId?: string; q?: string; page?: number; limit?: number; }): Promise<{ items: any[]; total: number; page: number; limit: number }> {
  const q = toQuery(params as any);
  return apiFetch(`/api/muell${q}`);
}

export async function bookMuellApi(data: { artikelId: string; chargeId: string; menge: number; lagerbereich: "TK"|"NON_TK"; grund: string; notiz?: string; }): Promise<any> {
  return apiFetch<any>(`/api/muell`, { method: "POST", body: JSON.stringify(data) });
}

export async function undoMuellApi(bewegungId: string, begruendung?: string): Promise<any> {
  return apiFetch<any>(`/api/muell/${bewegungId}/undo`, { method: "POST", body: JSON.stringify({ begruendung }) });
}

/* -------------------------------- Reservierungen ------------------------------- */
export async function createReservierungApi(data: { artikelId: string; auftragId: string; lieferDatum: string; menge: number; }): Promise<any> {
  return apiFetch<any>(`/api/reservierungen`, { method: "POST", body: JSON.stringify(data) });
}

export async function listReservierungenApi(params?: { artikelId?: string; auftragId?: string; status?: "AKTIV"|"ERFUELLT"|"AUFGELOEST"; from?: string; to?: string; q?: string; page?: number; limit?: number; }): Promise<{ items: any[]; total: number; page: number; limit: number }> {
  // Service nutzt lieferDatumFrom/To – Route akzeptiert from/to, der Server mappt bereits; hier belassen wir from/to
  const q = toQuery(params as any);
  return apiFetch(`/api/reservierungen${q}`);
}

export async function getReservierungByIdApi(id: string): Promise<any> {
  return apiFetch<any>(`/api/reservierungen/${id}`);
}

export async function updateReservierungApi(id: string, data: Partial<{ menge: number; lieferDatum: string; status: "AKTIV"|"ERFUELLT"|"AUFGELOEST" }>): Promise<any> {
  return apiFetch<any>(`/api/reservierungen/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function cancelReservierungApi(id: string): Promise<any> {
  return apiFetch<any>(`/api/reservierungen/${id}/cancel`, { method: "POST" });
}

/* ----------------------------------- Warnungen -------------------------------- */
export async function getMhdWarnungenApi(params?: { thresholdDays?: number; onlyCritical?: boolean; artikelId?: string; page?: number; limit?: number; }): Promise<{ items: any[]; total: number; page: number; limit: number }> {
  const q = toQuery(params as any);
  return apiFetch(`/api/warnungen/mhd${q}`);
}

export async function getUeberreserviertWarnungenApi(params?: { bisDatum?: string; artikelId?: string; }): Promise<{ items: any[]; total: number }> {
  const q = toQuery(params as any);
  return apiFetch(`/api/warnungen/ueberreserviert${q}`);
}

export async function getTkMismatchWarnungenApi(params?: { from?: string; to?: string; artikelId?: string; page?: number; limit?: number; }): Promise<{ items: any[]; total: number; page: number; limit: number }> {
  const q = toQuery(params as any);
  return apiFetch(`/api/warnungen/tk-mismatch${q}`);
}

export async function getWarnungenSummaryApi(params?: { thresholdDays?: number; bisDatum?: string; }): Promise<{ mhd: { total: number; critical: number }; ueberreserviert: { total: number }; tkMismatch: { total: number } }> {
  const q = toQuery(params as any);
  return apiFetch(`/api/warnungen/summary${q}`);
}

/**
 * POST /api/beleg/batch/pdf
 * Body: { auftragIds: string[], belegTyp: "lieferschein"|"rechnung"|"gutschrift"|"preisdifferenz" }
 * Response: { files: { auftragId, filename, dataBase64, mime }[] }
 *
 * Liefert **einzelne** PDFs (nicht gemerged) als Browser-Blob pro Auftrag.
 */
export async function generateBelegeBatchPdfs(
  auftragIds: string[],
  typ: "lieferschein" | "rechnung" | "gutschrift" | "preisdifferenz"
): Promise<BatchBelegFile[]> {
  const res = await fetch(`${API_URL}/api/beleg/batch/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify({ auftragIds, belegTyp: typ }),
  });
  if (!res.ok) throw new Error(`Fehler beim Batch-PDF-Generieren: ${res.statusText}`);
  const json = await res.json();
  const files = Array.isArray(json?.files) ? json.files : [];

  // Helper: Base64 → Blob
  const base64ToBlob = (b64: string, mime = "application/pdf"): Blob => {
    const byteStr = atob(b64);
    const len = byteStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = byteStr.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const result: BatchBelegFile[] = files.map((f: any) => ({
    auftragId: String(f.auftragId || ""),
    filename: String(f.filename || "beleg.pdf"),
    blob: base64ToBlob(String(f.dataBase64 || ""), String(f.mime || "application/pdf")),
  }));
  return result;
}

export async function addBeleg(
  auftragId: string,
  beleg: any
): Promise<any> {
  return apiFetch<any>(`/api/beleg/${auftragId}/add`, {
    method: "POST",
    body: JSON.stringify(beleg),
  });
}

export async function logBelegEmail(
  auftragId: string,
  log: any
): Promise<any> {
  return apiFetch<any>(`/api/beleg/${auftragId}/email-log`, {
    method: "POST",
    body: JSON.stringify(log),
  });
}

export async function getBelege(auftragId: string): Promise<any[]> {
  return apiFetch<any[]>(`/api/beleg/${auftragId}`);
}

export async function getBelegEmailLogs(auftragId: string): Promise<any[]> {
  return apiFetch<any[]>(`/api/beleg/${auftragId}/email-logs`);
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
  getTourInfosForInBearbeitung,
  getTourInfosForAuftraege,
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
  getCustomerStopsByDate,
  getCustomerStopsToday,
  updateTourStop,
  deleteTourStop,
  deleteAllTourStops,
  reorderTourStops,
  moveTourStop,
  // Beleg
  generateBelegPdf,
  generateBelegeBatchPdfs,
  addBeleg,
  logBelegEmail,
  getBelege,
  getBelegEmailLogs,
  // Charges
  listCharges,
  getChargeByIdApi,
  getChargeViewApi,
  createChargeApi,
  updateChargeApi,
  mergeChargeApi,
  umbuchenChargeApi,
  muellChargeApi,
  deleteChargeApi,
  // Bestand
  getBestandUebersichtApi,
  getBestandChargeViewApi,
  getBestandZeitreiseApi,
  addManuellerZugangApi,
  deleteBestandChargeKomplettApi,
  deleteBestandByArtikelKomplettApi,
  // Historie
  listHistorie,
  getBewegungByIdApi,
  exportHistorieCsv,
  // Müll
  listMuellApi,
  bookMuellApi,
  undoMuellApi,
  // Reservierungen
  createReservierungApi,
  listReservierungenApi,
  getReservierungByIdApi,
  updateReservierungApi,
  cancelReservierungApi,
  // Warnungen
  getMhdWarnungenApi,
  getUeberreserviertWarnungenApi,
  getTkMismatchWarnungenApi,
  getWarnungenSummaryApi,
};
