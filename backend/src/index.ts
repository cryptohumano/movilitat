import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import empresaRoutes from './routes/empresa.routes.js';
import derroteroRoutes from './routes/derrotero.routes.js';
import vehiculoRoutes from './routes/vehiculo.routes.js';
import checkinRoutes from './routes/checkin.routes.js';
import userRoutes from './routes/user.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import registrosRutaRoutes from './routes/registros-ruta.routes.js';
import registrosUnidadRoutes from './routes/registros-unidad.routes.js';
import choferRoutes from './routes/chofer.routes.js';
import suscripcionesRutaRoutes from './routes/suscripciones-ruta.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import paradasReferenciaRoutes from './routes/paradas-referencia.routes.js';
import paradasCercanasRoutes from './routes/paradas-cercanas.routes.js';
import flotillasRoutes from './routes/flotillas.routes.js';
import auditLogsRoutes from './routes/audit-logs.routes.js';
import invitationsRoutes from './routes/invitations.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3001;

// Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [`https://${process.env.DOMAIN}`]
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check (timestamp en UTC; para verificar hora del servidor)
app.get('/api/health', (req, res) => {
  const now = new Date();
  res.json({
    status: 'ok',
    timestamp: now.toISOString(),
    serverTimeZone: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    service: 'RutaCheck API',
    version: '1.0.0',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/derroteros', derroteroRoutes);
app.use('/api/vehiculos', vehiculoRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/registros-ruta', registrosRutaRoutes);
app.use('/api/registros-unidad', registrosUnidadRoutes);
app.use('/api/chofer', choferRoutes);
app.use('/api/suscripciones-ruta', suscripcionesRutaRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/paradas-referencia', paradasReferenciaRoutes);
app.use('/api/paradas-cercanas', paradasCercanasRoutes);
app.use('/api/flotillas', flotillasRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/invitations', invitationsRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║         🚌 RUTACHECK API v1.0.0           ║
  ╠═══════════════════════════════════════════╣
  ║  Server running on port ${PORT}              ║
  ║  Environment: ${process.env.NODE_ENV || 'development'}             ║
  ╚═══════════════════════════════════════════╝
  `);
});

export default app;
