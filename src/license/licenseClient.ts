const API_URL = process.env.REACT_APP_API_SERVER_URL || "";

export const LICENSE_BLOCKED_EVENT = "license-blocked";

export interface LicenseStatus {
  ok: boolean;
  hasKey: boolean;
  validUntil?: string;
}

export const LICENSE_KEY_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export async function fetchLicenseStatus(): Promise<LicenseStatus> {
  const res = await fetch(`${API_URL}/api/license/status`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return { ok: false, hasKey: false };
  return (await res.json()) as LicenseStatus;
}

export async function activateLicense(licenseKey: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/license/activate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ licenseKey }),
  });
  return res.ok;
}

export function installLicenseInterceptor(): void {
  if ((window as any).__licenseFetchInstalled) return;
  (window as any).__licenseFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await originalFetch(input, init);
    if (response.status === 503) {
      try {
        const cloned = response.clone();
        const ct = cloned.headers.get("content-type") ?? "";
        if (ct.startsWith("application/json")) {
          const body = await cloned.json().catch(() => null);
          if (body && body.error === "5005") {
            window.dispatchEvent(new CustomEvent(LICENSE_BLOCKED_EVENT));
          }
        }
      } catch {
        // ignore
      }
    }
    return response;
  };
}
