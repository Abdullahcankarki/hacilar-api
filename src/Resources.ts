// resources.ts

export type MitarbeiterResource = {
  id?: string;
  name: string;
  email?: string;
  telefon?: string;
  abteilung?: string;
  rollen: MitarbeiterRolle[];
  aktiv?: boolean;
  bemerkung?: string;
  eintrittsdatum?: string;
  password?: string;
};

export type MitarbeiterRolle =
  | "admin"
  | "verkauf"
  | "kommissionierung"
  | "buchhaltung"
  | "wareneingang"
  | "lager"
  | "fahrer"
  | "statistik"
  | "kunde"
  | "support";

export type KundeResource = {
  id?: string;
  name?: string;
  kundenNummer?: string;
  password?: string;
  email?: string;
  adresse?: string;
  telefon?: string;
  updatedAt?: string;
  ustId?: string;
  handelsregisterNr?: string;
  ansprechpartner?: string;
  lieferzeit: string;
  region?: string;
  kategorie?: string;
  website?: string;
  isApproved?: boolean;
  gewerbeDateiUrl?: string;
  zusatzDateiUrl?: string;
};

export type AuftragResource = {
  id?: string;
  kunde: string; // ID des Kunden
  kundeName?: string;
  artikelPosition?: string[]; // Array von IDs der Artikelpositionen
  status: "offen" | "in Bearbeitung" | "abgeschlossen" | "storniert";
  lieferdatum?: string; // ISO-Datum als String, optional
  bemerkungen?: string; // Optionale Bemerkungen
  createdAt?: string; // Erstellungsdatum als ISO-String
  updatedAt?: string; // Aktualisierungsdatum als ISO-String
  gewicht?: number;
  preis?: number;
};

export type ArtikelPositionResource = {
  id?: string; // Eindeutige ID der Position
  artikel?: string; // ID des Artikels (als String)
  artikelName?: string;
  menge?: number; // Menge des Artikels
  einheit?: "kg" | "stück" | "kiste" | "karton"; // Einheit der Menge
  einzelpreis?: number; // Preis pro Gewichtseinheit für den Kunden
  zerlegung?: boolean; // Optionale Angabe, ob eine Zerlegung erfolgt
  vakuum?: boolean; // Optionale Angabe, ob das Produkt vakuumverpackt ist
  bemerkung?: string; // Optionale Bemerkungen
  gesamtgewicht?: number; // Berechnetes Gesamtgewicht
  gesamtpreis?: number; // Berechneter Gesamtpreis
  auftragId?: string;
};

export type ArtikelResource = {
  bildUrl?: string;
  id?: string; // Eindeutige ID des Artikels
  name: string;
  preis: number; // Standardpreis des Artikels
  artikelNummer: string; // Artikelnummer
  kategorie?: string;
  gewichtProStueck?: number; // Gewicht pro Stück (optional, falls nicht immer angegeben)
  gewichtProKarton?: number; // Gewicht pro Karton (optional)
  gewichtProKiste?: number; // Gewicht pro Kiste (optional)
  beschreibung?: string;
  ausverkauft?: boolean;
};

export type LoginResource = {
  id: string;
  role: MitarbeiterRolle[];
  /** Expiration time in seconds since 1.1.1970 */
  exp: number;
};

export type LoginResponse = {
  token: string;
  user: LoginResource;
};

export type KundenPreisResource = {
  id?: string; // Eindeutige ID
  artikel: string; // ID des Artikels als String
  customer: string; // ID des Kunden als String
  aufpreis: number; // Aufpreis für diesen Kunden
};
