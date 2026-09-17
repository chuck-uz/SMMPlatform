// Public-facing site identity (address shown on legal pages, robots host,
// contact email) comes from the runtime environment, never from source: the
// repository is public and must not carry the owner's domain or mailbox.
// Callers must be dynamically rendered so these are read per request, not
// baked in at build time.

export type SiteUrl = { origin: string; host: string };

export function parseSiteUrl(raw: string | undefined): SiteUrl | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return { origin: url.origin, host: url.host };
  } catch {
    return null;
  }
}

export function parseContactEmail(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || !/^[^\s@]+@[^\s@]+$/.test(value)) return null;
  return value;
}

export function getSiteUrl(): SiteUrl | null {
  return parseSiteUrl(process.env.NEXTAUTH_URL);
}

export function getContactEmail(): string | null {
  return parseContactEmail(process.env.CONTACT_EMAIL);
}
