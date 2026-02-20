/**
 * Importa el CSV de WiFi en transporte CDMX (datos.cdmx.gob.mx) a ParadaReferencia.
 * Uso: desde la raíz del repo:
 *   cd backend && npx tsx scripts/import-paradas-cdmx.ts
 *   o: npx tsx backend/scripts/import-paradas-cdmx.ts (con CSV en transporte/data-2026-02-20.csv)
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CSV_PATH =
  process.env.CSV_PARADAS_PATH ||
  (existsSync(resolve(process.cwd(), 'data-2026-02-20.csv'))
    ? resolve(process.cwd(), 'data-2026-02-20.csv')
    : resolve(process.cwd(), '..', 'data-2026-02-20.csv'));

function parseCsvLine(line: string): { id: string; programa: string; latitud: number; longitud: number; alcaldia: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const firstComma = trimmed.indexOf(',');
  if (firstComma === -1) return null;
  const id = trimmed.slice(0, firstComma).trim();
  let rest = trimmed.slice(firstComma + 1);
  let programa = '';
  if (rest.startsWith('"')) {
    const endQuote = rest.indexOf('"', 1);
    if (endQuote === -1) return null;
    programa = rest.slice(1, endQuote).trim();
    rest = rest.slice(endQuote + 1).trim();
    if (rest.startsWith(',')) rest = rest.slice(1);
  } else {
    const next = rest.indexOf(',');
    if (next === -1) return null;
    programa = rest.slice(0, next).trim();
    rest = rest.slice(next + 1);
  }
  const parts = rest.split(',');
  if (parts.length < 3) return null;
  const latitud = parseFloat(parts[0].trim());
  const longitud = parseFloat(parts[1].trim());
  const alcaldia = parts.slice(2).join(',').trim();
  if (isNaN(latitud) || isNaN(longitud)) return null;
  return { id, programa, latitud, longitud, alcaldia };
}

async function main() {
  console.log('Leyendo CSV:', CSV_PATH);
  const content = readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split(/\r?\n/);
  const header = lines[0];
  const dataLines = lines.slice(1).filter((l) => l.trim());
  console.log('Líneas de datos:', dataLines.length);

  const rows: Array<{ idExterno: string; nombre: string; latitud: number; longitud: number; alcaldia: string; programa: string }> = [];
  for (const line of dataLines) {
    const parsed = parseCsvLine(line);
    if (!parsed) continue;
    rows.push({
      idExterno: parsed.id,
      nombre: parsed.id.replace(/_/g, ' ').trim(),
      latitud: parsed.latitud,
      longitud: parsed.longitud,
      alcaldia: parsed.alcaldia || undefined,
      programa: parsed.programa || undefined,
    });
  }

  console.log('Registros parseados:', rows.length);
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      await prisma.paradaReferencia.upsert({
        where: { idExterno: row.idExterno },
        create: {
          idExterno: row.idExterno,
          nombre: row.nombre,
          latitud: row.latitud,
          longitud: row.longitud,
          alcaldia: row.alcaldia,
          programa: row.programa,
        },
        update: {
          nombre: row.nombre,
          latitud: row.latitud,
          longitud: row.longitud,
          alcaldia: row.alcaldia,
          programa: row.programa,
        },
      });
      created++;
    } catch (e) {
      skipped++;
    }
  }
  console.log('Listo. Creados/actualizados:', created, 'Omitidos:', skipped);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
