# 🚌 Movilitat

**Sistema de digitalización para transporte público en Naucalpan y Atizapán**

PWA mobile-first para gestionar check-ins de vehículos, optimizar operaciones y digitalizar el flujo económico del transporte público.

## 📊 Datos del Sistema

| Métrica | Valor |
|---------|-------|
| **Empresas** | 11 |
| **Derroteros (rutas)** | 53 |
| **Vehículos registrados** | 1,242 |
| **Puntos de control** | ~17 |

## 🎯 Roles del Sistema

| Rol | Funcionalidades |
|-----|-----------------|
| **Super Admin** | Gestión completa del sistema, empresas, reportes globales |
| **Admin Empresa** | Dashboard de empresa, vehículos, derroteros, reportes |
| **Checador** | Registrar check-ins, ver ingresos, gestionar punto de control |
| **Chofer** | Activar/terminar unidad, Mi QR, historial check-ins, cronómetro en ruta, reabrir unidad |
| **Pasajero** | Registro sin invitación; seguir rutas; paradas cercanas (lista/mapa); ver unidades activas |

## 🛠️ Stack Tecnológico

### Frontend
- **Vite 7** - Build tool ultra rápido
- **React 19** - Framework UI
- **TypeScript** - Tipado estático
- **Tailwind CSS 4.1** - Estilos
- **shadcn/ui** - Componentes UI
- **Zustand** - Estado global
- **React Query** - Cache de datos
- **Workbox** - PWA/Offline

### Backend
- **Express** - API REST
- **Prisma** - ORM
- **PostgreSQL** - Base de datos
- **JWT** - Autenticación
- **Zod** - Validación

### Infraestructura
- **Docker** - Contenedores
- **Nginx** - Reverse proxy
- **Redis** - Cache, sesiones y rate limiting

## 🚀 Inicio Rápido

### Requisitos
- Node.js 20+
- Corepack habilitado
- Docker (opcional; incluye PostgreSQL y Redis si usas `yarn docker:up`)

### 1. Clonar y configurar

```bash
# Habilitar corepack
corepack enable

# Instalar dependencias
yarn install

# Copiar variables de entorno
cp .env.example .env
```

### 2. Base de datos

```bash
# Con Docker
yarn docker:up

# O manualmente con PostgreSQL local
yarn prisma:migrate
yarn prisma:seed
```

### 3. Desarrollo

```bash
# Backend (puerto 3001)
yarn dev:backend

# Frontend (puerto 3000)
yarn dev:frontend

# O ambos en paralelo
yarn dev
```

### 4. Acceder

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001/api
- **Prisma Studio**: `yarn prisma:studio`

## 🔐 Credenciales de Prueba

| Rol | Usuario / Teléfono | Contraseña |
|-----|--------------------|------------|
| Super Admin | admin@rutacheck.mx / 5551234567 | admin123 |
| Gerente (Admin Empresa) | admin@ruta25.mx / 5559876543 | admin123 |
| Checador (Juan) | 5551111111 | admin123 |
| Chofer Pedro | 5552222222 | admin123 |
| Chofer Juan | 5553333333 | admin123 |
| Chofer Edgar | 5554444444 | admin123 |
| Pasajero (María) | 5550000001 | admin123 |

**Pasajeros:** registro abierto en `/registro-pasajero` (sin invitación). Invitaciones para otros roles en `/registro` con token.

Tras `yarn prisma:seed` hay **145 check-ins de ejemplo** en la ruta E01 (checador Juan, choferes Juan/Edgar/Pedro) para probar métricas e ingresos.

## 📁 Estructura del Proyecto

```
transporte/
├── backend/
│   ├── src/
│   │   ├── routes/         # API: auth, dashboard, chofer, checkin, paradas-cercanas, invitaciones, etc.
│   │   ├── middleware/     # Auth, rate limit
│   │   └── lib/            # Prisma, Redis, auditoría
│   └── prisma/
│       ├── schema.prisma   # Modelos de datos
│       ├── migrations/
│       └── seed.ts         # Datos iniciales
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes React (layout, UI, modales)
│   │   ├── pages/          # Páginas (Dashboard, MisRutas, RegistroPasajero, etc.)
│   │   ├── stores/         # Estado Zustand
│   │   └── lib/            # Utilidades
│   └── public/             # Assets estáticos
└── docker/
    ├── docker-compose.yml
    └── nginx/              # Configuración Nginx
```

## 📱 Características PWA

- ✅ Instalable como app nativa
- ✅ Funciona offline (básico)
- ✅ Push notifications (próximamente)
- ✅ Geolocalización
- ✅ Cámara QR (escanear en check-in)
- ✅ Mobile-first design
- ✅ Safe area support (notch/home indicator)
- ✅ **Pasajeros:** registro abierto, seguir rutas, paradas cercanas (lista + mapa Leaflet), unidades activas
- ✅ **Choferes:** cronómetro "Tiempo en ruta", reabrir unidad; admin puede reabrir unidades encerradas
- ✅ Mapas con Leaflet (paradas cercanas, actividad)

## 🗄️ Modelo de Datos

### Entidades principales

```
Empresa (11)
  └── Derrotero (53)
        └── PuntoControl (~17)
        └── Vehiculo (1,242)
              └── CheckIn
                    └── Pago
              └── Chofer (N:N, asignación por día)

Usuario
  └── Chofer (extensión: unidad activa, unidadActivaDesde, sentido ida/vuelta)
  └── Checador (extensión)
  └── Pasajero (sin empresa)
        └── SuscripcionRuta (seguir rutas, notificaciones)

Invitacion (tokens para registro de chofer/checador/admin)
AuditLog (activar/terminar/reabrir unidad, etc.)
```

### Flujo de Check-in

1. Vehículo llega al punto de control
2. Checador escanea QR o busca por placa
3. Sistema registra: ubicación GPS, tiempo transcurrido
4. Chofer paga $15 MXN
5. Checador recibe 50% comisión

## 🚌 Placas y QR

### Formato de placas

En el seed de prueba las placas siguen el patrón:

- **`{empresa}-{derrotero}-{número}`**  
  Ejemplos: `01-1-001`, `01-1-002`, `01-2-001` (empresa E01, derrotero 1 o 2, número interno).
- Las placas reales pueden ser las oficiales (ej. CDMX); el sistema acepta cualquier texto único por vehículo.
- Para ver todas las placas: **Prisma Studio** (`yarn prisma:studio`) → modelo `vehiculos`, o API `GET /api/vehiculos`.

### ¿Quién lleva el QR?

**El chofer lleva el QR**, no el camión.

- Así se identifica **qué chofer** va en la unidad y se pueden **turnar unidades**: el mismo chofer puede cambiar de camión en el día.
- El chofer entra a **Mi QR** (app), elige **el vehículo que está manejando en ese momento** y muestra el código (en el celular o impreso).
- Al escanear, el checador registra **vehículo + chofer** en un solo paso.

### Formato del QR

- Contenido: **`PLACA|CHOFER_ID`** (ej. `01-1-001|clxxx...`).
- El checador escanea con la app (Check-in → Escanear QR) o puede registrar por placa manualmente.
- Para **turnar**: el chofer en Mi QR selecciona otro vehículo asignado; el QR pasa a tener la nueva placa con el mismo chofer.

### Resumen

| Dónde | Qué |
|------|-----|
| **Placas** | Una por vehículo en BD; formato libre (seed: `01-1-001`, etc.). |
| **QR** | Lo lleva el **chofer**; contenido `PLACA\|CHOFER_ID`. |
| **Generar QR** | App → **Mi QR** (rol Chofer) → elegir unidad actual. |
| **Turnos** | Cambiar de unidad en Mi QR = nuevo QR con otra placa, mismo chofer. |

## 📈 Modelo de Negocio

### SaaS: quién paga a quién
- **Se le cobra al admin de la empresa** (gerente / Admin Empresa): la plataforma factura a la empresa; el gerente es el responsable de esa cuenta.
- Super Admin (plataforma) crea empresas y al primer gerente; ese gerente puede crear **otros gerentes** de la misma empresa y gestionar choferes, checadores, vehículos y derroteros de su empresa.

### Jerarquía y multi-empresa
- **Gerentes (Admin Empresa)**  
  Pertenecen a **una** empresa. Solo pueden gestionar usuarios y recursos de esa empresa. Pueden ser varios por empresa (el “admin de la empresa” los maneja: Super Admin o otro gerente de la misma empresa).

- **Choferes y checadores**  
  Pueden trabajar en **diferentes empresas** y derroteros. Su ámbito no es un solo `empresaId`, sino:
  - **Chofer**: los vehículos que tiene asignados (cada vehículo es de una empresa/derrotero).
  - **Checador**: los puntos de control que tiene asignados (cada punto es de un derrotero/empresa).  
  Así, un mismo chofer o checador puede operar en varias rutas/empresas según sus asignaciones.

### De dónde sale la comisión del checador (modelo solo suscripción)

En operación **no se maneja efectivo en el flujo**: el ingreso real viene de la **suscripción** que paga la empresa a la plataforma. La “comisión” del checador es un **cálculo de referencia**:

1. **Origen del dinero**  
   La empresa paga a la plataforma (suscripción por derrotero/mes). De ese ingreso (o de un fondo de incentivos acordado con la empresa), se define cuánto corresponde al checador.

2. **Cómo se calcula en el sistema**  
   Cada check-in tiene un **monto de referencia** (ej. $15 MXN). El dashboard del checador muestra “Ganas este mes (50% comisión)” como:  
   **suma de (monto de referencia × 50%)** de los check-ins pagados que registró ese mes.  
   Ese número es la **base de cálculo** para pagarle al checador, no un cobro al chofer en el punto.

3. **Quién paga al checador**  
   - **Opción A:** La plataforma paga al checador (con lo que le paga la empresa por suscripción) usando ese cálculo.  
   - **Opción B:** La empresa paga al checador; la plataforma entrega reportes (check-ins, monto de referencia, 50%) y la empresa liquida por su cuenta.

En ambos casos: **no hay intercambio de efectivo en la operación**; el flujo es **Empresa → Suscripción → Plataforma** y de ahí (o vía empresa) **Incentivo al checador** según check-ins.

### Pasajeros (seguir rutas)

- **Registro:** cualquiera puede crearse cuenta como pasajero en `/registro-pasajero` (teléfono, nombre, contraseña). No requiere invitación.
- **Seguir rutas:** en **Mis rutas** el pasajero puede seguir o dejar de seguir derroteros. La app usa “seguir” (no “suscripción de pago”).
- **Paradas cercanas:** el dashboard pasajero muestra paradas cercanas según ubicación (lista o mapa). API: `GET /api/paradas-cercanas?lat=&lng=&radioKm=1`.
- **Unidades activas:** en rutas que sigue, el pasajero ve cuántas unidades están activas ahora.

### Cobro en el punto (check-in)
- **Monto fijo:** $15 MXN por paso de ruta. El chofer **paga en mano** al checador; el checador confirma en la app que le pagó esa ruta (QR/registro = cobrado).
- El **50% no aplica** sobre esos $15; solo tendría sentido como **referido** (si checador/gerente embarca a otra empresa con código de referido, ahí puede haber un % o bono).

### B2B (suscripción)
- Empresa: $500-1,000/mes por derrotero → paga a la plataforma. En el punto: $15 chofer → checador en mano; la app registra y confirma el pago.

## 🔜 Roadmap

- [x] Escaneo de QR con cámara
- [x] Mapas con Leaflet (paradas cercanas, actividad)
- [x] App para pasajeros (registro, seguir rutas, paradas cercanas, unidades activas)
- [x] Dashboard chofer (cronómetro en ruta, reabrir unidad) y auditoría
- [ ] Push notifications
- [ ] Modo offline completo
- [ ] Reportes avanzados
- [ ] Dashboard en tiempo real (más métricas en vivo)

## 📝 Licencia

MIT

---

**Movilitat** - Digitalizando el transporte público 🚌
