# Lógica: paradas (checkpoints), ETA y datos de unidad

Este documento describe **cómo debe funcionar** el sistema de paradas, quién las registra, cómo se calcula el ETA (QR vs GPS) y qué datos de ruta/unidad se esperan. Es el marco de diseño; la implementación se va alineando a esto.

---

## 1. Paradas (checkpoints) de la ruta

### 1.1 Qué son
- Cada **parada** es un punto fijo del recorrido con **coordenadas GPS** (lat/long). La unidad que hace la ruta pasa por esos puntos en un orden definido.
- En el modelo actual: **PuntoControl** = parada/checkpoint de un **Derrotero** (ruta). Tiene nombre, opcionalmente latitud/longitud (o vínculo a ParadaReferencia con coordenadas).

### 1.2 Quién registra y quién elimina (esfuerzo conjunto)
- **Crear / editar paradas:**  
  - **Checador:** puede registrar paradas (checkpoints) en las rutas donde opera — por ejemplo al configurar su punto o cuando se añade un nuevo lugar de chequeo.  
  - **Admin de empresa:** puede crear y editar paradas de los derroteros de su empresa.  
  - Es un **esfuerzo conjunto**: el checador conoce el terreno; el admin define o valida la estructura de la ruta.
- **Eliminar paradas:**  
  - **Solo el admin de empresa.** El checador no puede borrar paradas; así se evita perder historial o romper la secuencia de la ruta por error.

Resumen de permisos (objetivo):

| Acción              | Checador | Admin empresa |
|---------------------|----------|----------------|
| Crear parada        | Sí       | Sí             |
| Editar parada       | Sí (las suyas o según política) | Sí |
| Eliminar parada     | No       | Sí             |

*(Hoy puede no estar implementado el CRUD de PuntoControl en la API; este es el comportamiento deseado.)*

### 1.3 Orden y coordenadas
- Cada parada debe tener **orden** en la ruta (1, 2, 3…) para saber “siguiente parada” y calcular ETA. Falta en el modelo: campo **orden** en PuntoControl.
- Las coordenadas GPS pueden estar en el propio PuntoControl (latitud/longitud) o en una ParadaReferencia vinculada. Lo importante: cada checkpoint tiene posición para mapas y, si se usa, para comparar con GPS del chofer.

---

## 2. ETA: cómo se determina

### 2.1 Fuente principal: escaneo de QR en las paradas
- El **ETA que se muestra al pasajero** se calcula a partir de los **check-ins (escaneos)** en las paradas:
  - El checador escanea el QR del chofer/unidad al pasar por su punto → se registra **vehiculoId**, **puntoControlId**, **fechaHora** y **tiempoTranscurrido** (minutos desde el paso anterior).
  - Con el **orden** de paradas y los **tiempos típicos** entre paradas (histórico de check-ins), se calcula:
    - Última parada conocida = P, hora = T.
    - Siguiente parada = Q; tiempo típico P→Q = Δ.
    - **ETA en Q = T + Δ.** Para paradas más adelante se suman los segmentos.
- Es decir: **el ETA estimado para el usuario viene del escaneo de QR en las paradas**, no del GPS en tiempo real.

### 2.2 Fallback: GPS del chofer con la app abierta
- Si el **chofer** lleva la **app abierta y el GPS activo**, se puede enviar posición de forma periódica (hoy no está implementado).
- Uso de ese dato:
  - **Checadores asignados a la ruta:** pueden ver la **posición en vivo** (mapa) de las unidades, como apoyo cuando no hay escaneo reciente o para verificar que la unidad se acerca.
  - **Pasajeros:** el ETA que se les muestra sigue siendo el **estimado por check-ins (QR)**; el GPS del chofer es complemento para operación/checadores, no la fuente principal del ETA público.
- Resumen: **ETA al usuario = por escaneo en paradas;** **GPS = para checadores asignados a la ruta** (y opcionalmente para refinar o fallback interno).

### 2.3 Asignación del checador a la ruta
- Para que el checador pueda registrar check-ins y (en el futuro) ver GPS de unidades, debe estar **asignado** a uno o varios **puntos de control** de derroteros concretos.
- **Admin de empresa** debe **autorizar/asignar** al checador a esos puntos (hoy: PuntoControl.checadorId; el admin sería quien asigna al checador a un punto o quien da permiso para que el checador opere en una ruta). Es decir: el checador asignado a ruta (vía puntos) es el que hace el trabajo de registro en paradas y, si se implementa, ve el GPS de las unidades de esa ruta.

---

## 3. Datos de la ruta y de la unidad

Además de ETA y paradas, se esperan datos operativos y de mantenimiento:

### 3.1 Kilómetros recorridos de la unidad
- Ya existe **RegistroUnidad** con tipo **KM** (kilometraje). El chofer o el admin registran el km; se puede tomar el último valor por unidad y, si se registra por fecha/ruta, derivar **km recorridos por ruta** o **km acumulados en un periodo**.
- Para “km recorridos en la ruta” de hoy/jornada: se podría derivar de (último km del día − km inicial) o de sumar segmentos entre paradas si en el futuro se guarda km por checkpoint.

### 3.2 Gasto / consumo (km/l, costo por km)
- **Gasto:** ya hay **RegistroRutaChofer** (ingresos/gastos por ruta) y **RegistroUnidad** (servicios, deterioros). Falta modelo o campos explícitos para:
  - **Combustible:** litros o gasto en combustible por periodo/unidad.
  - **Consumo promedio km/l** de la unidad (o por ruta): derivado de litros y km recorridos.
- Podría añadirse:
  - En **RegistroUnidad**: tipo **COMBUSTIBLE** o **GASTO** (litros, monto), o una tabla **ConsumoUnidad** (vehiculoId, fecha, litros, km, costo).
  - Cálculo: **km/l = km recorridos / litros;** **gasto por km = gasto combustible / km.**

### 3.3 Resumen de datos por unidad/ruta (objetivo)
- Por **unidad**: km recorridos (ya hay base con RegistroUnidad KM), gasto en combustible, km/l promedio, servicios/deterioros (ya existe).
- Por **ruta (derrotero)**: total de km recorridos por las unidades asignadas, gasto promedio, etc., derivados de los registros de unidad y de chofer.

---

## 4. Flujo resumido

1. **Paradas (checkpoints)**  
   - Tienen coordenadas GPS y orden en la ruta.  
   - Las crean/editan checador y admin empresa; solo admin empresa puede eliminarlas.

2. **Registro de paso**  
   - Checador (autorizado/asignado a puntos de la ruta) escanea QR al paso de la unidad → CheckIn (vehiculo, punto, hora, tiempoTranscurrido). Opcional: envío de posición GPS del chofer para checadores.

3. **ETA al pasajero**  
   - Se calcula con los **check-ins (QR)** en paradas: última parada + tiempos típicos entre paradas. El GPS del chofer es fallback/visual para checadores, no la base del ETA mostrado al usuario.

4. **Datos de unidad/ruta**  
   - Km recorridos: desde RegistroUnidad (KM).  
   - Gasto y km/l: requieren registrar combustible/consumo (por implementar o ampliar) y derivar promedios según tiempo/unidad/ruta.

---

## 5. Estado actual vs objetivo

| Tema | Estado actual | Objetivo |
|------|----------------|----------|
| Paradas con coordenadas | PuntoControl con lat/long opcionales | Mantener; asegurar que cada parada tenga coordenadas (o ParadaReferencia). |
| Orden de paradas | No existe en modelo | Añadir `orden` en PuntoControl. |
| CRUD paradas (crear/editar/eliminar) | No hay API dedicada (o solo seed) | Checador + Admin: crear/editar. Solo Admin: eliminar. |
| ETA por check-ins (QR) | Base de datos lista (CheckIn); falta orden y tiempos típicos | Calcular ETA con orden + tiempos típicos; exponer a pasajero. |
| GPS chofer (fallback) | No implementado | Envío periódico de posición; vista solo para checadores asignados a la ruta. |
| Checador asignado a ruta | PuntoControl.checadorId; asignación por punto | Admin autoriza/asigna checador a puntos (rutas). |
| Km recorridos unidad | RegistroUnidad tipo KM | Consolidar por periodo/ruta si se requiere. |
| Gasto / km/l | RegistroRutaChofer (gastos genéricos); no combustible explícito | Registrar combustible/consumo; calcular km/l y gasto promedio por km. |

Este documento sirve como referencia de **cómo** debe funcionar la lógica; las tareas concretas (schema, endpoints, permisos, pantallas) se pueden priorizar e implementar por fases (orden de paradas + ETA por QR primero; luego GPS checador; después consumo/km/l).
