-- Backfill: vehículos que ya tenían choferId deben tener esa asignación en vehiculos_choferes
INSERT INTO "vehiculos_choferes" ("id", "vehiculoId", "choferId", "createdAt")
SELECT gen_random_uuid(), v.id, v."choferId", NOW()
FROM "vehiculos" v
WHERE v."choferId" IS NOT NULL
ON CONFLICT ("vehiculoId", "choferId") DO NOTHING;
