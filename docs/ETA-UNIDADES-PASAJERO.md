# ETA de unidades para el pasajero

Objetivo: que el pasajero vea un **tiempo estimado de llegada (ETA)** de cada unidad en las rutas suscritas (o al menos “última posición + ETA al siguiente punto”). Este documento resume qué hay hoy, qué falta y cómo construirlo.

---

## 1. Qué tenemos hoy (chofer, QR, checadores)

### Check-ins (ya implementado)
- **Checador** registra el paso de una unidad por su punto: manual (vehiculoId + puntoControlId) o por **QR** (placa + chofer desde el código del QR).
- En cada check-in se guarda:
  - **vehiculoId**, **puntoControlId**, **fechaHora**
  - **tiempoTranscurrido**: minutos desde el **último** check-in de **ese mismo vehículo** (en cualquier punto). Es decir: “hace X minutos pasó por el punto anterior”.
- Los choferes tienen QR que el checador escanea; el backend asocia vehiculo + punto + hora. No hay tracking GPS continuo; la posición “conocida” es **en qué punto de control estuvo y cuándo**.

### Puntos de control
- Cada **PuntoControl** pertenece a un **Derrotero** (ruta) y tiene nombre, opcionalmente lat/long.
- **No hay campo de orden** (ej. “parada 1, 2, 3…”). Sabemos qué puntos pertenecen a una ruta, pero no el orden oficial del recorrido.

### Para el pasajero hoy
- **Suscripciones:** rutas a las que está suscrito.
- **Estado por ruta:** unidades en la ruta, cuántas tuvieron actividad hoy, última actividad (timestamp). **No** hay “última parada por unidad” ni “ETA”.

Conclusión: la base para ETA **sí está**: cada paso por un punto queda registrado (checador + QR/chofer) con hora y tiempo desde el paso anterior. Lo que falta es **orden de paradas** y **usar esos datos** para calcular y exponer ETA.

---

## 2. Qué hace falta para tener ETA

### 2.1 Orden de los puntos en la ruta
- Hoy no sabemos si “Metro Rosario” va antes o después de “Calacoaya” en la ruta 25.
- **Opción A (recomendada):** Añadir **orden** al modelo (ej. `PuntoControl.orden: Int`). Cada punto de un derrotero tiene orden 1, 2, 3… Así definimos la secuencia oficial del recorrido.
- **Opción B:** Inferir orden a partir de los check-ins (secuencia más frecuente por vehículo). Más frágil y con más lógica; puede usarse como complemento o para validar.

### 2.2 Última posición por unidad
- Por cada **vehículo activo** en la ruta (derrotero): último check-in del día (o de las últimas 24 h): **puntoControlId**, **fechaHora**.
- Eso ya se puede obtener con los datos actuales: `CheckIn` por `vehiculoId` + `fechaHora` desc, filtrando por vehículos del derrotero.

### 2.3 Tiempos entre paradas (segmentos)
- **tiempoTranscurrido** en cada check-in es “minutos desde el paso anterior” (del mismo vehículo). No está ligado al punto anterior en la ruta, sino al último check-in de ese vehículo (que puede ser en otro punto).
- Para ETA entre dos puntos **consecutivos en la ruta** (A → B) hace falta:
  - O bien **promedio histórico**: de todos los check-ins en punto B donde el check-in anterior del mismo vehículo fue en A, promediar `tiempoTranscurrido` (o la diferencia de `fechaHora`). Eso da “tiempo típico de A a B”.
  - O bien **configuración fija** por segmento (ej. “A→B: 12 min”) si la operación lo define así.

### 2.4 Cálculo del ETA
- **Última parada conocida:** P (con hora T).
- **Siguiente parada en la ruta:** Q (orden P.orden + 1).
- **Tiempo típico P→Q:** obtenido de historial (o config).
- **ETA en Q:** T + tiempo_típico_P_Q.
- Para una parada más adelante (ej. R): ETA_R = T + suma de tiempos típicos de todos los segmentos desde P hasta R.

---

## 3. Cómo construirlo (plan)

### Paso 1: Orden de puntos (schema + datos)
- Añadir **`orden Int?`** (o `orden Int @default(0)`) a **PuntoControl** en Prisma. Migración.
- En admin (o seed): asignar orden a cada punto por derrotero (1, 2, 3…). Si ya existen puntos, script o UI para definir el orden.

### Paso 2: Última posición por unidad (hoy)
- Endpoint o ampliación de uno existente que, para un **derroteroId** (y opcionalmente ruta suscrita del pasajero), devuelva por cada **vehículo activo** del derrotero:
  - **vehiculoId**, **placa**, **numeroEconomico**
  - **ultimoCheckIn**: { puntoControlId, puntoControl.nombre, fechaHora }
- Fuente: último `CheckIn` del vehículo (hoy o últimas 24 h), con `include` de `puntoControl`. No requiere orden todavía.

### Paso 3: Tiempos típicos por segmento (histórico)
- Por cada par de puntos **consecutivos** (A, B) en un derrotero (usando `orden`):
  - Consultar check-ins en B donde el check-in anterior del mismo vehiculo fue en A (mismo día o últimos N días).
  - Calcular diferencia de `fechaHora` (o usar `tiempoTranscurrido` del check-in en B cuando el anterior es A) y promediar.
- Guardar en cache (Redis) o en tabla (ej. `TiempoSegmento`: derroteroId, puntoAId, puntoBId, promedioMinutos, cantidadMuestras) para no recalcular siempre.

### Paso 4: ETA por unidad
- Para cada unidad con última posición (P, T):
  - Siguiente punto en la ruta: Q (orden = P.orden + 1). Si no hay, “fin de ruta” o sin ETA.
  - Tiempo típico P→Q (del paso 3).
  - ETA_siguiente = T + tiempo_típico. Opcional: ETA a un punto concreto (ej. “mi parada”) sumando segmentos hasta ese punto.

### Paso 5: API para el pasajero
- **Opción A:** Ampliar **GET /api/suscripciones-ruta** (o un sub-recurso) para que, cuando se pida una ruta con detalle, incluya **unidadesConPosicion**: array de { vehiculo, ultimoPunto, fechaHora, etaSiguientePunto [, etaMiParada si se envía puntoControlId ] }.
- **Opción B:** Nuevo endpoint **GET /api/suscripciones-ruta/:derroteroId/etas** (o **GET /api/derroteros/:id/unidades-eta**) que devuelva la lista de unidades con última posición y ETA. El front de “Mis rutas” o detalle de ruta lo consume.

### Paso 6: UI pasajero
- En “Mis rutas” o en detalle de ruta: por cada unidad (o resumen “próximas unidades”), mostrar:
  - Placa / número económico.
  - “Última parada: X, hace Y min” (o “a las HH:MM”).
  - “ETA siguiente parada: HH:MM” o “Llega en ~Z min”.
  - Opcional: si el pasajero elige “mi parada”, mostrar “ETA en mi parada: ~Z min”.

---

## 4. Resumen

| Qué | Estado | Acción |
|-----|--------|--------|
| Registro de paso (checador + QR) | Hecho | — |
| CheckIn con punto + hora + tiempoTranscurrido | Hecho | — |
| Orden de puntos en la ruta | No existe | Añadir `PuntoControl.orden`, migración y datos |
| Última posición por unidad | Dato existente | Consulta (endpoint o ampliación) |
| Tiempos típicos por segmento | No existe | Calcular desde historial (y opcional cache/tabla) |
| Cálculo ETA (siguiente parada / parada dada) | No existe | Lógica con orden + tiempos típicos |
| API para pasajero (unidades + ETA) | No existe | Nuevo endpoint o ampliar suscripciones |
| UI pasajero (mostrar ETA) | No existe | Consumir API en Mis rutas / detalle ruta |

La base (chofer, QR, checadores, check-ins con punto y tiempo) **sí está**. Para tener ETA por unidad hace falta: **(1) orden de paradas en la ruta**, **(2) tiempos típicos entre paradas consecutivas** (desde historial de check-ins), y **(3) exponer última posición + ETA** en una API que el front del pasajero use.

Si quieres, el siguiente paso puede ser: añadir **`orden`** a `PuntoControl` (migración + actualizar seed o doc de cómo rellenarlo) y esbozar el endpoint **“unidades con última posición”** para una ruta (sin ETA todavía), para que el pasajero al menos vea “última parada vista” por unidad.
