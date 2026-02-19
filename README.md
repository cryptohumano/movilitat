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
| **Chofer** | Ver historial de check-ins, gastos, información de vehículo |

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
- **Redis** - Cache/Sesiones

## 🚀 Inicio Rápido

### Requisitos
- Node.js 20+
- Corepack habilitado
- Docker (opcional)

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

| Rol | Teléfono | Contraseña |
|-----|----------|------------|
| Super Admin | 5551234567 | admin123 |
| Admin Empresa | 5559876543 | admin123 |
| Checador | 5551111111 | admin123 |
| Chofer | 5552222222 | admin123 |

## 📁 Estructura del Proyecto

```
movilitat/
├── backend/
│   ├── src/
│   │   ├── routes/         # Rutas API
│   │   ├── middleware/     # Auth, validación
│   │   └── lib/            # Prisma client
│   └── prisma/
│       ├── schema.prisma   # Modelos de datos
│       └── seed.ts         # Datos iniciales
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── pages/          # Páginas/vistas
│   │   ├── stores/         # Estado Zustand
│   │   └── lib/            # Utilidades
│   └── public/             # Assets estáticos
└── docker/
    ├── docker-compose.yml
    └── nginx/              # Configuración Nginx
```

## 📱 Características PWA

- ✅ Instalable como app nativa
- ✅ Funciona offline
- ✅ Push notifications (próximamente)
- ✅ Geolocalización
- ✅ Cámara QR (próximamente)
- ✅ Mobile-first design
- ✅ Safe area support (notch/home indicator)

## 🗄️ Modelo de Datos

### Entidades principales

```
Empresa (11)
  └── Derrotero (53)
        └── PuntoControl (~17)
        └── Vehiculo (1,242)
              └── CheckIn
                    └── Pago

Usuario
  └── Chofer (extensión)
  └── Checador (extensión)
```

### Flujo de Check-in

1. Vehículo llega al punto de control
2. Checador escanea QR o busca por placa
3. Sistema registra: ubicación GPS, tiempo transcurrido
4. Chofer paga $15 MXN
5. Checador recibe 50% comisión

## 📈 Modelo de Negocio

### B2C (Chofer paga)
- Chofer: $15/día por check-in
- Checador: $7.50 comisión (50%)
- Plataforma: $7.50 (50%)

### B2B (Empresa paga)
- Empresa: $500-1,000/mes por derrotero
- Checador: incentivo adicional
- Mayor margen (~70%)

## 🔜 Roadmap

- [ ] Escaneo de QR con cámara
- [ ] Push notifications
- [ ] Modo offline completo
- [ ] Reportes avanzados
- [ ] Mapas con Leaflet
- [ ] Dashboard en tiempo real
- [ ] App para pasajeros

## 📝 Licencia

MIT

---

**Movilitat** - Digitalizando el transporte público 🚌
