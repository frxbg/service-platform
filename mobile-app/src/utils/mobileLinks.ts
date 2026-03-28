export function buildDialLink(phone?: string | null): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\s+/g, '');
  return normalized ? `tel:${normalized}` : null;
}

export function buildNavigationLink(address?: string | null): string | null {
  if (!address) return null;
  const query = encodeURIComponent(address.trim());
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function openExternalLink(link?: string | null): void {
  if (!link) return;
  window.open(link, '_blank', 'noopener,noreferrer');
}
