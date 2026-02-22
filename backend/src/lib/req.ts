/**
 * Helpers para normalizar req.params / req.body / req.query (Express puede dar string | string[] | ParsedQs).
 * Uso: asStr(req.params.id), asStr(req.body.vehiculoId), asStr(req.query.empresaId)
 */
export function asStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return (v[0] != null && typeof v[0] === 'string' ? v[0] : '') || '';
  return '';
}

export function asStrOrUndef(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v : Array.isArray(v) ? (v[0] != null && typeof v[0] === 'string' ? v[0] : undefined) : undefined;
  return s !== undefined && s !== '' ? s : undefined;
}
