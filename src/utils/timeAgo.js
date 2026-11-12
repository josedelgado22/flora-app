/** timeAgo.js - "hace 5 min", "hace 2 h", "hace 3 d" a partir de una fecha ISO. */
export function timeAgo(iso, now = Date.now()) {
  const diffMs = now - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60 * 1000) return 'ahora';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}