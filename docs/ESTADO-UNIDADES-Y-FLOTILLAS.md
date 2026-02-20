# Estado de unidades y flotillas – Propuesta

## 1. Qué entendemos por “estado”

### Unidades (vehículos)
- **Estado operativo** (ya existe en el modelo): `ACTIVO` | `INACTIVO` | `MANTENIMIENTO` | `BAJA`.
- **Estado de actividad reciente** (derivado): última vez que la unidad tuvo check-in; si “hoy tuvo check-in” o “no ha pasado por punto en X horas”.
- **Asignación actual**: chofer asignado (si hay), derrotero, empresa.

### Flotillas
- **Por empresa:** conjunto de vehículos de una empresa; resumen por estado operativo y por actividad reciente.
- **Por derrotero:** vehículos asignados a cada ruta; mismo tipo de resumen.

---

## 2. Quién debe tener acceso

| Rol              | Unidades (detalle)                    | Flotillas (resumen)        |
|------------------|--------------------------------------|----------------------------|
| **Super Admin**  | Todas las unidades del sistema       | Todas las empresas/derroteros |
| **Admin Empresa**| Solo unidades de su empresa          | Solo su empresa y sus derroteros |
| **Checador**     | Solo lectura: unidades de los derroteros de sus puntos (para ver quién ha pasado) | Resumen de “su” ruta/punto si aplica |
| **Chofer**       | Solo la(s) unidad(es) que tiene asignadas | No aplica                  |

Resumen:
- **Super Admin:** todo.
- **Admin Empresa (gerente):** su flotilla y sus unidades.
- **Checador:** consulta de unidades (y actividad) para su contexto (punto/derrotero).
- **Chofer:** solo sus unidades asignadas.

---

## 3. Datos a obtener y mostrar

### 3.1 Ya disponibles (sin cambios de modelo)
- `Vehiculo`: placa, tipo, estado (ACTIVO/INACTIVO/MANTENIMIENTO/BAJA), empresa, derrotero, chofer asignado.
- `CheckIn`: por vehículo podemos obtener último check-in (fecha/hora) y contar check-ins hoy / en el mes.

### 3.2 Derivados útiles (cálculo en backend)
- **Por unidad:**
  - Último check-in: fecha/hora y (opcional) punto.
  - “Activo hoy”: sí/no (tuvo al menos un check-in hoy).
  - “Sin actividad en X horas”: por ejemplo > 8 h sin check-in (configurable).
- **Por flotilla (empresa o derrotero):**
  - Total de unidades.
  - Conteo por estado operativo: ACTIVO, INACTIVO, MANTENIMIENTO, BAJA.
  - Unidades “con actividad hoy” vs “sin actividad hoy”.
  - (Opcional) Unidades sin check-in en últimas 24 h.

### 3.3 Datos opcionales a capturar a futuro
- **Mantenimiento:** fecha próximo servicio, kilometraje (si se usa), tipo de mantenimiento.
- **Ubicación en tiempo real:** si más adelante hay streaming GPS del chofer, “última posición” de la unidad.
- **Horas de uso / turno:** si se registra hora de “salida” y “entrada” del chofer a la unidad.

Para una primera versión, con lo que ya tienes (estado operativo + check-ins) es suficiente para un buen “estado de unidades y flotillas”.

---

## 4. Propuesta de implementación

### 4.1 API sugerida
- **GET `/api/vehiculos`** (ya existe): seguir permitiendo filtrar por `estado`, `empresaId`, `derroteroId`. Añadir en la respuesta, por cada vehículo, campos calculados:
  - `ultimoCheckIn`: `{ fechaHora, puntoControlId? }` o `null`.
  - `checkInsHoy`: número (opcional).
- **GET `/api/flotillas/estado`** (nuevo) o **GET `/api/empresas/:id/resumen-flotilla`**:
  - Por empresa: total unidades, conteo por estado (ACTIVO/INACTIVO/MANTENIMIENTO/BAJA), unidades con actividad hoy, (opcional) sin actividad en 24 h.
  - Por derrotero (dentro de esa empresa): mismo tipo de resumen.
- Permisos:
  - Super Admin: todas las empresas.
  - Admin Empresa: solo su `empresaId`.
  - Checador: solo lectura; se puede limitar a derroteros/puntos que tiene asignados (opcional en v1).

### 4.2 Frontend
- **Vista “Estado de flotilla”** (gerente / Super Admin): resumen por empresa (y por derrotero): totales, por estado operativo, “con actividad hoy”.
- **Vista “Estado de unidades”** (lista/mapa): lista de vehículos con estado operativo, último check-in, “activo hoy” (sí/no). Filtros por empresa, derrotero, estado.
- **Checador:** misma lista pero filtrada a “sus” derroteros o solo consulta de última actividad en sus puntos.
- **Chofer:** solo “Mis unidades” con estado y último check-in.

### 4.3 Resumen de datos a “obtener”
- **Guardados:** estado operativo (ya), asignación chofer/derrotero/empresa (ya), check-ins (ya).
- **Calculados:** último check-in por vehículo, check-ins hoy por vehículo, conteos por flotilla (empresa/derrotero) y por estado operativo / actividad hoy.

Con esto se puede implementar una primera versión de “estado de unidades y flotillas” sin nuevos modelos, solo consultas y un endpoint de resumen (y, si se desea, pequeños ajustes en la respuesta de `GET /api/vehiculos`).
