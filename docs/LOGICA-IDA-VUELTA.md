# Lógica Ida y Vuelta en Rutas

## Problema

Una ruta física (ej. Cuatro Caminos ↔ Rosario) se recorre en **dos sentidos**: **ida** (ej. Cuatro Caminos → Rosario) y **vuelta** (Rosario → Cuatro Caminos). Es el **mismo camino** en sentido inverso: las paradas son las mismas pero el **orden** es el reverso. Además, en operación **no sabemos solo con el check-in** si el vehículo va o viene; hace falta poder marcar o inferir el sentido.

## Modelo adoptado

- **Un solo derrotero** con una sola secuencia de puntos: cada `PuntoControl` tiene un `orden` (1, 2, …, N) que define la **ida** (recorrido 1 → N).
- **Vuelta = mismo camino, orden inverso**: no se duplican puntos ni derroteros. Al consultar la ruta en sentido **VUELTA**, se devuelven los mismos puntos ordenados por `orden` descendente (N → 1).
- **Sentido actual del chofer**: en `Chofer` existe el campo `sentidoActual` (`IDA` | `VUELTA`), que solo aplica cuando el chofer tiene una **unidad activa**. Así sabemos si "va" o "viene" en esa jornada/turno.

## Cómo se determina la lógica

1. **Paradero inicial vs final**
   - **Ida**: el "inicio de ruta" es el punto con `orden = 1` (ej. Cuatro Caminos); el "paradero final" es el punto con `orden = N` (ej. Rosario).
   - **Vuelta**: el inicio es el punto con `orden = N` y el final el punto con `orden = 1`. Misma ruta, sentido opuesto.

2. **Al llegar al paradero final**
   - Cuando el vehículo llega al paradero final (orden 1 en ida o orden N en vuelta), en la práctica "da la vuelta" y empieza el otro sentido.
   - El chofer (o la app) puede marcar el cambio con:
     - **POST /api/chofer/iniciar-vuelta**: indica "estoy iniciando vuelta" (sentido N → 1).
     - **POST /api/chofer/iniciar-ida**: indica "estoy iniciando ida" (sentido 1 → N).

3. **Consultar paradas en un sentido**
   - **GET /api/derroteros/:id?sentido=IDA**: devuelve los puntos ordenados por `orden` ascendente (1 → N).
   - **GET /api/derroteros/:id?sentido=VUELTA**: devuelve los mismos puntos ordenados por `orden` descendente (N → 1).
   - Si no se envía `sentido`, se asume IDA.

4. **Estado del chofer**
   - **GET /api/chofer/unidad-activa** incluye `sentidoActual` (IDA o VUELTA) cuando tiene unidad activa.
   - Al **activar unidad** se fija por defecto `sentidoActual = IDA`.
   - Al **terminar unidad** se limpia `sentidoActual`.

## Resumen

| Concepto | Ida | Vuelta |
|---------|-----|--------|
| Orden de paradas | 1 → N | N → 1 |
| Paradero "inicio" | orden 1 | orden N |
| Paradero "final" | orden N | orden 1 |
| Query derrotero | `?sentido=IDA` (o sin query) | `?sentido=VUELTA` |
| Chofer | `sentidoActual = IDA` | `sentidoActual = VUELTA` |

Así se determina la lógica: **una sola ruta física, un solo orden de paradas en BD; el sentido (ida o vuelta) se maneja con el parámetro de consulta y con el estado del chofer**, y al llegar al paradero final se usa "iniciar ida" o "iniciar vuelta" para reflejar que se invierte el sentido.

---

## Unidad "cierra por hoy" (se lleva a guardar)

- Al **terminar unidad** el chofer puede indicar si la unidad **se lleva a guardar** (cierra por hoy).
- Si indica que sí: se guarda `Vehiculo.encerradoHasta` = fin del día actual. Esa unidad **no se podrá activar** hasta el día siguiente (otro chofer no puede tomarla hoy).
- En la lista de unidades para activar, las que tienen `encerradoHasta` ≥ hoy se muestran como "encerrada hoy" y no se puede pulsar activar.
