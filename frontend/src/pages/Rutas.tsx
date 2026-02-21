import { useEffect, useState, useMemo, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  Route,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  MapPin,
  Navigation,
  GripVertical,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface DerroteroItem {
  id: string;
  numero: number;
  nombre: string;
  empresa: { id: string; codigo: string; nombreCorto: string | null };
  _count?: { puntosControl: number };
}

interface PuntoControlItem {
  id: string;
  nombre: string;
  orden: number;
  descripcion: string | null;
  latitud?: number | string | null;
  longitud?: number | string | null;
  paradaReferencia?: { id: string; nombre: string } | null;
  checadorId?: string | null;
  checador?: { id: string; user: { nombre: string; telefono: string } } | null;
}

interface ParadaRefOption {
  id: string;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
  alcaldia?: string | null;
}

interface DerroteroDetalle {
  id: string;
  numero: number;
  nombre: string;
  empresa: { id: string; codigo: string; nombre: string; nombreCorto: string | null };
  puntosControl: PuntoControlItem[];
}

function SortableParadaRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-2 items-stretch ${isDragging ? 'opacity-50' : ''}`}
    >
      {!disabled && (
        <button
          type="button"
          className="shrink-0 p-2 rounded touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:bg-muted/50 border-0 bg-transparent"
          {...attributes}
          {...listeners}
          aria-label="Mover parada"
        >
          <GripVertical className="size-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function RutasPage() {
  const user = useAuthStore((s) => s.user);
  const [derroteros, setDerroteros] = useState<DerroteroItem[]>([]);
  const [selected, setSelected] = useState<DerroteroDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPuntoId, setEditingPuntoId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', orden: '', latitud: '', longitud: '', paradaReferenciaId: '' });
  const [editForm, setEditForm] = useState({ nombre: '', orden: '', latitud: '', longitud: '', paradaReferenciaId: '' });
  const [buscarRef, setBuscarRef] = useState('');
  const [paradasRef, setParadasRef] = useState<ParadaRefOption[]>([]);
  const [loadingRef, setLoadingRef] = useState(false);
  const [buscarRefEdit, setBuscarRefEdit] = useState('');
  const [paradasRefEdit, setParadasRefEdit] = useState<ParadaRefOption[]>([]);
  const [loadingRefEdit, setLoadingRefEdit] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [loadingGpsEdit, setLoadingGpsEdit] = useState(false);
  const [errorGps, setErrorGps] = useState('');
  const [checadores, setChecadores] = useState<{ id: string; checadorId: string; nombre: string; telefono: string }[]>([]);
  const [showNewDerroteroForm, setShowNewDerroteroForm] = useState(false);
  const [savingNewDerrotero, setSavingNewDerrotero] = useState(false);
  const [newDerroteroForm, setNewDerroteroForm] = useState({
    numero: '',
    nombre: '',
    empresaId: '',
    autobuses: '',
    microbuses: '',
    combis: '',
  });
  const [empresas, setEmpresas] = useState<{ id: string; codigo: string; nombreCorto: string | null }[]>([]);

  const canAccess =
    user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_EMPRESA';

  const orderedPuntos = useMemo(
    () => [...(selected?.puntosControl ?? [])].sort((a, b) => a.orden - b.orden),
    [selected?.puntosControl]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!selected || !over || active.id === over.id) return;
    const oldIndex = orderedPuntos.findIndex((p) => p.id === active.id);
    const newIndex = orderedPuntos.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...orderedPuntos];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);
    const withNewOrden = reordered.map((p, i) => ({ ...p, orden: i + 1 }));
    setSelected((prev) => (prev ? { ...prev, puntosControl: withNewOrden } : null));
    setError('');
    try {
      await Promise.all(
        withNewOrden.map((p, i) =>
          api.put(`/derroteros/${selected.id}/puntos/${p.id}`, { orden: i + 1 })
        )
      );
    } catch (e) {
      setError('Error al guardar el nuevo orden. Recarga la página.');
      loadDetalle(selected.id);
    }
  };

  const loadDerroteros = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<DerroteroItem[]>('/derroteros', { activo: 'true' });
      if (res.success && Array.isArray(res.data)) {
        setDerroteros(res.data);
      }
    } catch (e) {
      setError('No se pudieron cargar las rutas');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadDetalle = async (id: string) => {
    setLoadingDetalle(true);
    setError('');
    try {
      const res = await api.get<DerroteroDetalle>(`/derroteros/${id}`);
      if (res.success && res.data) {
        setSelected(res.data);
        setShowForm(false);
        setEditingPuntoId(null);
      }
    } catch (e) {
      setError('No se pudo cargar el detalle de la ruta');
      console.error(e);
    } finally {
      setLoadingDetalle(false);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    loadDerroteros();
  }, [canAccess]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.get<{ id: string; codigo: string; nombreCorto: string | null }[]>('/empresas')
        .then((res) => res.success && Array.isArray(res.data) && setEmpresas(res.data))
        .catch(() => setEmpresas([]));
    }
  }, [user?.role]);

  const handleCreateDerrotero = async () => {
    const num = newDerroteroForm.numero.trim();
    const nom = newDerroteroForm.nombre.trim();
    if (!num || !nom) {
      setError('Número y nombre son obligatorios.');
      return;
    }
    const n = parseInt(num, 10);
    if (Number.isNaN(n) || n < 1) {
      setError('El número debe ser un entero mayor a 0.');
      return;
    }
    if (user?.role === 'SUPER_ADMIN' && !newDerroteroForm.empresaId) {
      setError('Elige una empresa.');
      return;
    }
    setError('');
    setSavingNewDerrotero(true);
    try {
      const body: Record<string, unknown> = {
        numero: n,
        nombre: nom,
        autobuses: parseInt(newDerroteroForm.autobuses, 10) || 0,
        microbuses: parseInt(newDerroteroForm.microbuses, 10) || 0,
        combis: parseInt(newDerroteroForm.combis, 10) || 0,
      };
      if (user?.role === 'SUPER_ADMIN') body.empresaId = newDerroteroForm.empresaId;
      const res = await api.post<DerroteroItem>('/derroteros', body);
      if (res.success && res.data) {
        setShowNewDerroteroForm(false);
        setNewDerroteroForm({ numero: '', nombre: '', empresaId: '', autobuses: '', microbuses: '', combis: '' });
        await loadDerroteros();
        loadDetalle(res.data.id);
      } else {
        setError((res as { message?: string }).message ?? 'Error al crear el derrotero');
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error al crear el derrotero';
      setError(msg);
    } finally {
      setSavingNewDerrotero(false);
    }
  };

  useEffect(() => {
    if (!selected?.empresa?.id) {
      setChecadores([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ id: string; nombre: string; telefono: string; checador?: { id: string } }[]>(
          '/users',
          { role: 'CHECADOR', empresaId: selected.empresa.id, limit: '200' }
        );
        if (cancelled || !res.success || !Array.isArray(res.data)) return;
        const list = res.data
          .filter((u) => u.checador?.id)
          .map((u) => ({ id: u.checador!.id, checadorId: u.checador!.id, nombre: u.nombre, telefono: u.telefono }));
        setChecadores(list);
      } catch {
        if (!cancelled) setChecadores([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selected?.empresa?.id]);

  const buscarParadasReferencia = async (search: string, isEdit: boolean) => {
    if (!search.trim()) {
      if (isEdit) setParadasRefEdit([]);
      else setParadasRef([]);
      return;
    }
    if (isEdit) setLoadingRefEdit(true);
    else setLoadingRef(true);
    try {
      const res = await api.get<ParadaRefOption[]>('/paradas-referencia', {
        search: search.trim(),
        limit: '15',
      });
      if (res.success && Array.isArray(res.data)) {
        const list = res.data.filter((p) => p.latitud != null && p.longitud != null);
        if (isEdit) setParadasRefEdit(list);
        else setParadasRef(list);
      }
    } catch (_) {
      if (isEdit) setParadasRefEdit([]);
      else setParadasRef([]);
    } finally {
      if (isEdit) setLoadingRefEdit(false);
      else setLoadingRef(false);
    }
  };

  const obtenerUbicacionTelefono = (isEdit: boolean) => {
    if (!navigator.geolocation) {
      setErrorGps('Tu navegador no soporta geolocalización.');
      return;
    }
    if (isEdit) setLoadingGpsEdit(true);
    else setLoadingGps(true);
    setErrorGps('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (isEdit) {
          setEditForm((f) => ({
            ...f,
            latitud: String(lat),
            longitud: String(lon),
            paradaReferenciaId: '',
          }));
          setLoadingGpsEdit(false);
        } else {
          setForm((f) => ({
            ...f,
            latitud: String(lat),
            longitud: String(lon),
            paradaReferenciaId: '',
          }));
          setLoadingGps(false);
        }
      },
      (err) => {
        if (isEdit) setLoadingGpsEdit(false);
        else setLoadingGps(false);
        const msg =
          err.code === 1
            ? 'Permiso de ubicación denegado. Activa la ubicación en tu teléfono.'
            : err.code === 2
              ? 'No se pudo obtener la ubicación. Revisa que el GPS esté activo.'
              : 'Error al obtener la ubicación.';
        setErrorGps(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const seleccionarParadaRef = (p: ParadaRefOption, isEdit: boolean) => {
    if (isEdit) {
      setEditForm((f) => ({
        ...f,
        nombre: p.nombre,
        latitud: p.latitud != null ? String(p.latitud) : '',
        longitud: p.longitud != null ? String(p.longitud) : '',
        paradaReferenciaId: p.id,
      }));
      setParadasRefEdit([]);
      setBuscarRefEdit('');
    } else {
      setForm((f) => ({
        ...f,
        nombre: p.nombre,
        latitud: p.latitud != null ? String(p.latitud) : '',
        longitud: p.longitud != null ? String(p.longitud) : '',
        paradaReferenciaId: p.id,
      }));
      setParadasRef([]);
      setBuscarRef('');
    }
  };

  const handleAddParada = async () => {
    if (!selected || !form.nombre.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body: { nombre: string; orden?: number; latitud?: number; longitud?: number } = { nombre: form.nombre.trim() };
      if (form.orden.trim() && !Number.isNaN(Number(form.orden))) body.orden = Number(form.orden);
      if (form.latitud.trim() && !Number.isNaN(Number(form.latitud))) body.latitud = Number(form.latitud);
      if (form.longitud.trim() && !Number.isNaN(Number(form.longitud))) body.longitud = Number(form.longitud);
      const res = await api.post<{ data: PuntoControlItem }>(
        `/derroteros/${selected.id}/puntos`,
        body
      );
      if (res.success && res.data) {
        setSelected((prev) =>
          prev
            ? {
                ...prev,
                puntosControl: [...prev.puntosControl, res.data!].sort(
                  (a, b) => a.orden - b.orden
                ),
              }
            : null
        );
        setForm({ nombre: '', orden: '', latitud: '', longitud: '', paradaReferenciaId: '' });
        setShowForm(false);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Error al agregar parada');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateParada = async () => {
    if (!selected || !editingPuntoId) return;
    setSaving(true);
    setError('');
    try {
      const body: { nombre?: string; orden?: number; latitud?: number; longitud?: number; paradaReferenciaId?: string | null; checadorId?: string | null } = {};
      if (editForm.nombre.trim()) body.nombre = editForm.nombre.trim();
      if (editForm.orden.trim() && !Number.isNaN(Number(editForm.orden))) body.orden = Number(editForm.orden);
      if (editForm.latitud !== undefined && editForm.latitud !== '' && !Number.isNaN(Number(editForm.latitud))) body.latitud = Number(editForm.latitud);
      if (editForm.longitud !== undefined && editForm.longitud !== '' && !Number.isNaN(Number(editForm.longitud))) body.longitud = Number(editForm.longitud);
      if (editForm.paradaReferenciaId !== undefined) body.paradaReferenciaId = editForm.paradaReferenciaId || null;
      if (editForm.checadorId !== undefined) body.checadorId = editForm.checadorId || null;
      const res = await api.put<{ data: PuntoControlItem }>(
        `/derroteros/${selected.id}/puntos/${editingPuntoId}`,
        body
      );
      if (res.success && res.data) {
        setSelected((prev) =>
          prev
            ? {
                ...prev,
                puntosControl: prev.puntosControl
                  .map((p) => (p.id === editingPuntoId ? res.data! : p))
                  .sort((a, b) => a.orden - b.orden),
              }
            : null
        );
        setEditingPuntoId(null);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Error al actualizar parada');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteParada = async (puntoId: string) => {
    if (!selected || !window.confirm('¿Eliminar esta parada?')) return;
    setSaving(true);
    setError('');
    try {
      await api.delete(`/derroteros/${selected.id}/puntos/${puntoId}`);
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              puntosControl: prev.puntosControl.filter((p) => p.id !== puntoId),
            }
          : null
      );
      if (editingPuntoId === puntoId) setEditingPuntoId(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Error al eliminar parada');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: PuntoControlItem) => {
    setErrorGps('');
    setEditingPuntoId(p.id);
    setEditForm({
      nombre: p.nombre,
      orden: String(p.orden),
      latitud: p.latitud != null ? String(p.latitud) : '',
      longitud: p.longitud != null ? String(p.longitud) : '',
    });
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Rutas" />
        <main className="p-4 pb-nav">
          <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        title={selected ? `Paradas: ${selected.empresa?.nombreCorto || selected.empresa?.codigo} – Ruta ${selected.numero}` : 'Rutas'}
        leftAction={
          selected ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelected(null);
                setError('');
              }}
              aria-label="Volver"
            >
              <ArrowLeft className="size-5" />
            </Button>
          ) : undefined
        }
      />
      <main className="p-4 pb-nav">
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {!selected ? (
          <>
            <p className="text-muted-foreground mb-4">
              Elige una ruta para ver y gestionar sus paradas (puntos de control).
            </p>
            {!showNewDerroteroForm ? (
              <Button
                className="mb-4 w-full sm:w-auto"
                onClick={() => setShowNewDerroteroForm(true)}
              >
                <Plus className="size-4 mr-2" />
                Nuevo derrotero
              </Button>
            ) : (
              <Card className="mb-4">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-medium">Crear derrotero (ruta)</h3>
                  {user?.role === 'SUPER_ADMIN' && (
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1">Empresa</label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={newDerroteroForm.empresaId}
                        onChange={(e) => setNewDerroteroForm((f) => ({ ...f, empresaId: e.target.value }))}
                      >
                        <option value="">Selecciona empresa</option>
                        {empresas.map((e) => (
                          <option key={e.id} value={e.id}>{e.nombreCorto || e.codigo}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Input
                    placeholder="Número de ruta (ej. 1, 2, 76)"
                    type="number"
                    min={1}
                    value={newDerroteroForm.numero}
                    onChange={(e) => setNewDerroteroForm((f) => ({ ...f, numero: e.target.value }))}
                  />
                  <Input
                    placeholder="Nombre del derrotero (ej. Cuatro Caminos - Rosario)"
                    value={newDerroteroForm.nombre}
                    onChange={(e) => setNewDerroteroForm((f) => ({ ...f, nombre: e.target.value }))}
                  />
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <label className="text-muted-foreground block mb-1">Autobuses</label>
                      <Input
                        type="number"
                        min={0}
                        value={newDerroteroForm.autobuses}
                        onChange={(e) => setNewDerroteroForm((f) => ({ ...f, autobuses: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground block mb-1">Microbuses</label>
                      <Input
                        type="number"
                        min={0}
                        value={newDerroteroForm.microbuses}
                        onChange={(e) => setNewDerroteroForm((f) => ({ ...f, microbuses: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground block mb-1">Combis</label>
                      <Input
                        type="number"
                        min={0}
                        value={newDerroteroForm.combis}
                        onChange={(e) => setNewDerroteroForm((f) => ({ ...f, combis: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowNewDerroteroForm(false);
                        setError('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateDerrotero} disabled={savingNewDerrotero}>
                      {savingNewDerrotero ? <Loader2 className="size-4 animate-spin" /> : null}
                      {savingNewDerrotero ? ' Creando…' : 'Crear derrotero'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {derroteros.map((d) => (
                  <Card
                    key={d.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => loadDetalle(d.id)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <Route className="size-8 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {d.empresa?.nombreCorto || d.empresa?.codigo} – Ruta {d.numero}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{d.nombre}</p>
                        {d._count != null && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {d._count.puntosControl ?? 0} paradas
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {derroteros.length === 0 && !showNewDerroteroForm && (
                  <p className="text-muted-foreground text-center py-8">
                    No hay rutas activas. Usa el botón «Nuevo derrotero» para crear una.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-2">{selected.nombre}</p>
            {loadingDetalle ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Paradas de la ruta</h2>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowForm(true);
                      setEditingPuntoId(null);
                      setForm({ nombre: '', orden: '', latitud: '', longitud: '', paradaReferenciaId: '' });
                    }}
                  >
                    <Plus className="size-4 mr-1" />
                    Agregar parada
                  </Button>
                </div>

                {showForm && (
                  <Card className="mb-4">
                    <CardContent className="p-4 space-y-3">
                      <Input
                        placeholder="Nombre de la parada"
                        value={form.nombre}
                        onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                      />
                      <Input
                        placeholder="Orden (opcional, ej. 1, 2, 3…)"
                        type="number"
                        value={form.orden}
                        onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
                      />
                      <div>
                        <label className="text-sm font-medium text-muted-foreground block mb-1">Coordenadas GPS (desde tu teléfono)</label>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => obtenerUbicacionTelefono(false)}
                          disabled={loadingGps}
                        >
                          {loadingGps ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Navigation className="size-4" />
                          )}
                          {loadingGps ? 'Obteniendo ubicación…' : 'Usar ubicación del teléfono'}
                        </Button>
                        {errorGps && !loadingGps && (
                          <p className="text-xs text-destructive mt-1">{errorGps}</p>
                        )}
                        {form.latitud && form.longitud && (
                          <p className="text-xs text-primary mt-1">✓ GPS: {form.latitud}, {form.longitud}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Latitud"
                          type="number"
                          step="any"
                          value={form.latitud}
                          onChange={(e) => setForm((f) => ({ ...f, latitud: e.target.value }))}
                        />
                        <Input
                          placeholder="Longitud"
                          type="number"
                          step="any"
                          value={form.longitud}
                          onChange={(e) => setForm((f) => ({ ...f, longitud: e.target.value }))}
                        />
                      </div>
                      <details className="text-sm">
                        <summary className="text-muted-foreground cursor-pointer">O bien buscar en catálogo CDMX</summary>
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Buscar parada (nombre o id)…"
                              value={buscarRef}
                              onChange={(e) => setBuscarRef(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarParadasReferencia(buscarRef, false))}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={() => buscarParadasReferencia(buscarRef, false)} disabled={loadingRef}>
                              {loadingRef ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
                            </Button>
                          </div>
                          {paradasRef.length > 0 && (
                            <ul className="border border-border rounded-md divide-y divide-border max-h-32 overflow-auto">
                              {paradasRef.map((p) => (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                                    onClick={() => seleccionarParadaRef(p, false)}
                                  >
                                    {p.nombre}
                                    {p.alcaldia && <span className="text-muted-foreground ml-1">· {p.alcaldia}</span>}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </details>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAddParada}
                          disabled={saving || !form.nombre.trim()}
                        >
                          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowForm(false)}
                          disabled={saving}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={orderedPuntos.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-2 list-none p-0 m-0">
                      {orderedPuntos.map((p) => (
                        <li key={p.id}>
                          <SortableParadaRow
                            id={p.id}
                            disabled={editingPuntoId === p.id}
                          >
                            {editingPuntoId === p.id ? (
                              <Card>
                            <CardContent className="p-4 space-y-3">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground block mb-1">Coordenadas GPS (desde tu teléfono)</label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full gap-2"
                                  onClick={() => obtenerUbicacionTelefono(true)}
                                  disabled={loadingGpsEdit}
                                >
                                  {loadingGpsEdit ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Navigation className="size-4" />
                                  )}
                                  {loadingGpsEdit ? 'Obteniendo ubicación…' : 'Usar ubicación del teléfono'}
                                </Button>
                                {errorGps && !loadingGpsEdit && (
                                  <p className="text-xs text-destructive mt-1">{errorGps}</p>
                                )}
                              </div>
                              <Input
                                placeholder="Nombre"
                                value={editForm.nombre}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, nombre: e.target.value }))
                                }
                              />
                              <Input
                                placeholder="Orden"
                                type="number"
                                value={editForm.orden}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, orden: e.target.value }))
                                }
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Latitud"
                                  type="number"
                                  step="any"
                                  value={editForm.latitud}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, latitud: e.target.value }))
                                  }
                                />
                                <Input
                                  placeholder="Longitud"
                                  type="number"
                                  step="any"
                                  value={editForm.longitud}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, longitud: e.target.value }))
                                  }
                                />
                              </div>
                              <details className="text-sm">
                                <summary className="text-muted-foreground cursor-pointer">O bien buscar en catálogo CDMX</summary>
                                <div className="mt-2 flex gap-2">
                                  <Input
                                    placeholder="Buscar parada…"
                                    value={buscarRefEdit}
                                    onChange={(e) => setBuscarRefEdit(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarParadasReferencia(buscarRefEdit, true))}
                                  />
                                  <Button type="button" variant="outline" size="sm" onClick={() => buscarParadasReferencia(buscarRefEdit, true)} disabled={loadingRefEdit}>
                                    {loadingRefEdit ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
                                  </Button>
                                </div>
                                {paradasRefEdit.length > 0 && (
                                  <ul className="mt-2 border border-border rounded-md divide-y divide-border max-h-28 overflow-auto">
                                    {paradasRefEdit.map((pr) => (
                                      <li key={pr.id}>
                                        <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50" onClick={() => seleccionarParadaRef(pr, true)}>
                                          {pr.nombre}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </details>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleUpdateParada} disabled={saving}>
                                  {saving ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    'Guardar'
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingPuntoId(null)}
                                  disabled={saving}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card>
                            <CardContent className="flex items-center gap-3 p-4">
                              <MapPin className="size-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{p.nombre}</p>
                                <p className="text-xs text-muted-foreground">
                                  Orden: {p.orden}
                                  {(p.latitud != null && p.longitud != null) && (
                                    <> · GPS: {Number(p.latitud).toFixed(4)}, {Number(p.longitud).toFixed(4)}</>
                                  )}
                                  {p.paradaReferencia?.nombre && (
                                    <> · Ref: {p.paradaReferencia.nombre}</>
                                  )}
                                  {p.checador?.user && (
                                    <> · Checador: {p.checador.user.nombre}</>
                                  )}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEdit(p)}
                                  aria-label="Editar"
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteParada(p.id)}
                                  disabled={saving}
                                  aria-label="Eliminar"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                          </SortableParadaRow>
                        </li>
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
                {selected.puntosControl.length === 0 && !showForm && (
                  <p className="text-muted-foreground text-center py-6">
                    No hay paradas. Usa «Agregar parada» para definir el recorrido.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
