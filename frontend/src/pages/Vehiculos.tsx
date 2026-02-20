import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bus,
  Plus,
  Loader2,
  Pencil,
  User,
  Building2,
  Route,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface VehiculoItem {
  id: string;
  placa: string;
  numeroEconomico: string | null;
  tipo: string;
  estado: string;
  empresa: { id: string; codigo: string; nombreCorto: string | null };
  derrotero: { id: string; numero: number; nombre: string } | null;
  chofer: {
    id: string;
    user: { id: string; nombre: string; telefono: string };
  } | null;
}

interface DerroteroItem {
  id: string;
  numero: number;
  nombre: string;
  empresa: { id: string; codigo: string; nombreCorto: string | null };
}

interface EmpresaItem {
  id: string;
  codigo: string;
  nombreCorto: string | null;
}

interface ChoferOption {
  id: string;
  nombre: string;
  telefono: string;
  empresaId?: string;
}

const TIPOS = [
  { value: 'AUTOBUS', label: 'Autobús' },
  { value: 'MICROBUS', label: 'Microbús' },
  { value: 'COMBI', label: 'Combi' },
];

const ESTADOS = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'INACTIVO', label: 'Inactivo' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'BAJA', label: 'Baja' },
];

export function VehiculosPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [vehiculos, setVehiculos] = useState<VehiculoItem[]>([]);
  const [derroteros, setDerroteros] = useState<DerroteroItem[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [choferes, setChoferes] = useState<ChoferOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDerrotero, setFiltroDerrotero] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canAccess = isSuperAdmin || user?.role === 'ADMIN_EMPRESA';

  const [form, setForm] = useState({
    placa: '',
    numeroEconomico: '',
    tipo: 'AUTOBUS' as string,
    empresaId: '',
    derroteroId: '',
    choferId: '',
    marca: '',
    modelo: '',
    anio: '',
    capacidad: '',
  });

  const [editForm, setEditForm] = useState({
    numeroEconomico: '',
    tipo: 'AUTOBUS' as string,
    estado: 'ACTIVO' as string,
    derroteroId: '',
    choferId: '' as string | null,
    marca: '',
    modelo: '',
    anio: '',
    capacidad: '',
  });

  const loadVehiculos = async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { limit: '100' };
      if (search) params.search = search;
      if (filtroTipo) params.tipo = filtroTipo;
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroDerrotero) params.derroteroId = filtroDerrotero;
      if (isSuperAdmin && filtroEmpresa) params.empresaId = filtroEmpresa;
      const res = await api.get<VehiculoItem[]>('/vehiculos', params);
      if (res.success && res.data) setVehiculos(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar vehículos');
    } finally {
      setLoading(false);
    }
  };

  const loadDerroteros = async () => {
    try {
      const params: Record<string, string> = {};
      if (isSuperAdmin && filtroEmpresa) params.empresaId = filtroEmpresa;
      const res = await api.get<DerroteroItem[]>('/derroteros', params);
      if (res.success && res.data) setDerroteros(res.data);
    } catch (_) {}
  };

  const loadEmpresas = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await api.get<EmpresaItem[]>('/empresas');
      if (res.success && res.data) setEmpresas(res.data);
    } catch (_) {}
  };

  const loadChoferes = async () => {
    try {
      const params: Record<string, string> = { role: 'CHOFER', limit: '200' };
      if (user?.role === 'ADMIN_EMPRESA') {
        // Admin empresa: choferes ya filtrados por empresa en backend
      } else if (filtroEmpresa) params.empresaId = filtroEmpresa;
      const res = await api.get<Array<{
        nombre: string;
        telefono: string;
        chofer?: { id: string };
        empresa?: { id: string };
      }>>('/users', params);
      if (res.success && res.data) {
        const list = res.data
          .filter((u) => u.chofer?.id)
          .map((u) => ({
            id: u.chofer!.id,
            nombre: u.nombre,
            telefono: u.telefono,
            empresaId: u.empresa?.id,
          }));
        setChoferes(list);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    loadVehiculos();
  }, [canAccess, search, filtroTipo, filtroEstado, filtroDerrotero, filtroEmpresa]);

  useEffect(() => {
    if (!canAccess) return;
    loadDerroteros();
  }, [canAccess, filtroEmpresa]);

  useEffect(() => {
    if (!canAccess) return;
    loadEmpresas();
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    loadChoferes();
  }, [canAccess, filtroEmpresa]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.placa.trim()) {
      setError('La placa es obligatoria');
      return;
    }
    const empresaId = isSuperAdmin ? form.empresaId : undefined;
    if (isSuperAdmin && !empresaId) {
      setError('Selecciona una empresa');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        placa: form.placa.trim().toUpperCase(),
        numeroEconomico: form.numeroEconomico.trim() || undefined,
        tipo: form.tipo,
        derroteroId: form.derroteroId || undefined,
        marca: form.marca.trim() || undefined,
        modelo: form.modelo.trim() || undefined,
        capacidad: form.capacidad ? parseInt(form.capacidad, 10) : undefined,
        anio: form.anio ? parseInt(form.anio, 10) : undefined,
      };
      if (empresaId) body.empresaId = empresaId;
      const res = await api.post<VehiculoItem>('/vehiculos', body);
      if (res.success && res.data) {
        setVehiculos((prev) => [res.data!, ...prev]);
        setShowForm(false);
        setForm({
          placa: '',
          numeroEconomico: '',
          tipo: 'AUTOBUS',
          empresaId: '',
          derroteroId: '',
          choferId: '',
          marca: '',
          modelo: '',
          anio: '',
          capacidad: '',
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear vehículo');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (v: VehiculoItem) => {
    setEditingId(v.id);
    setEditForm({
      numeroEconomico: v.numeroEconomico ?? '',
      tipo: v.tipo,
      estado: v.estado,
      derroteroId: v.derrotero?.id ?? '',
      choferId: v.chofer?.id ?? '',
      marca: '',
      modelo: '',
      anio: '',
      capacidad: '',
    });
  };

  const handleUpdate = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        numeroEconomico: editForm.numeroEconomico.trim() || undefined,
        tipo: editForm.tipo,
        estado: editForm.estado,
        derroteroId: editForm.derroteroId || undefined,
        choferId: editForm.choferId || null,
        marca: editForm.marca.trim() || undefined,
        modelo: editForm.modelo.trim() || undefined,
        anio: editForm.anio ? parseInt(editForm.anio, 10) : undefined,
        capacidad: editForm.capacidad ? parseInt(editForm.capacidad, 10) : undefined,
      };
      const res = await api.put<VehiculoItem>(`/vehiculos/${id}`, body);
      if (res.success && res.data) {
        setVehiculos((prev) => prev.map((ve) => (ve.id === id ? res.data! : ve)));
        setEditingId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3 px-4 h-14">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="font-semibold text-lg">Vehículos</h1>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-semibold text-lg">Vehículos</h1>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Buscar por placa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[140px]"
          />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tipo</option>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Estado</option>
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
          {isSuperAdmin && (
            <select
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas las empresas</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nombreCorto || emp.codigo}</option>
              ))}
            </select>
          )}
          <select
            value={filtroDerrotero}
            onChange={(e) => setFiltroDerrotero(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Derrotero</option>
            {derroteros.map((d) => (
              <option key={d.id} value={d.id}>{d.empresa.nombreCorto} - {d.nombre}</option>
            ))}
          </select>
          <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
            <Plus className="size-4" />
            Nuevo vehículo
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-medium">Crear vehículo</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <Input
                  placeholder="Placa *"
                  value={form.placa}
                  onChange={(e) => setForm((f) => ({ ...f, placa: e.target.value.toUpperCase() }))}
                  required
                  className="font-mono uppercase"
                />
                <Input
                  placeholder="Número económico"
                  value={form.numeroEconomico}
                  onChange={(e) => setForm((f) => ({ ...f, numeroEconomico: e.target.value }))}
                />
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {isSuperAdmin && (
                  <select
                    value={form.empresaId}
                    onChange={(e) => setForm((f) => ({ ...f, empresaId: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Empresa *</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nombreCorto || emp.codigo}</option>
                    ))}
                  </select>
                )}
                <select
                  value={form.derroteroId}
                  onChange={(e) => setForm((f) => ({ ...f, derroteroId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Derrotero (opcional)</option>
                  {derroteros.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : 'Crear'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
          </div>
        ) : vehiculos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Bus className="size-12 mx-auto mb-2 opacity-50" />
              No hay vehículos o no coinciden los filtros.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {vehiculos.map((v) => (
              <Card key={v.id}>
                <CardContent className="p-4">
                  {editingId === v.id ? (
                    <form onSubmit={(e) => handleUpdate(v.id, e)} className="space-y-3">
                      <Input
                        placeholder="Número económico"
                        value={editForm.numeroEconomico}
                        onChange={(e) => setEditForm((f) => ({ ...f, numeroEconomico: e.target.value }))}
                      />
                      <select
                        value={editForm.tipo}
                        onChange={(e) => setEditForm((f) => ({ ...f, tipo: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {TIPOS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <select
                        value={editForm.estado}
                        onChange={(e) => setEditForm((f) => ({ ...f, estado: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {ESTADOS.map((e) => (
                          <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                      </select>
                      <select
                        value={editForm.derroteroId}
                        onChange={(e) => setEditForm((f) => ({ ...f, derroteroId: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Sin derrotero</option>
                        {derroteros.map((d) => (
                          <option key={d.id} value={d.id}>{d.nombre}</option>
                        ))}
                      </select>
                      <div>
                        <label className="text-sm text-muted-foreground">Chofer asignado</label>
                        <select
                          value={editForm.choferId ?? ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, choferId: e.target.value || null }))}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                        >
                          <option value="">Sin asignar</option>
                          {choferes
                            .filter((c) => !isSuperAdmin || !v.empresa?.id || c.empresaId === v.empresa.id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>{c.nombre} ({c.telefono})</option>
                            ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={saving}>
                          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold font-mono text-lg">{v.placa}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Building2 className="size-3" />
                            {v.empresa.nombreCorto || v.empresa.codigo}
                          </p>
                          {v.derrotero && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Route className="size-3" />
                              {v.derrotero.nombre}
                            </p>
                          )}
                          {v.chofer && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <User className="size-3" />
                              {v.chofer.user.nombre} · {v.chofer.user.telefono}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="secondary">{TIPOS.find((t) => t.value === v.tipo)?.label || v.tipo}</Badge>
                            <Badge variant={v.estado === 'ACTIVO' ? 'activo' : 'inactivo'}>
                              {ESTADOS.find((e) => e.value === v.estado)?.label || v.estado}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={() => startEdit(v)} title="Editar y asignar chofer">
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
