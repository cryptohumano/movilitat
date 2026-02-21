import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Plus,
  Loader2,
  Pencil,
  Key,
  Building2,
  Link2,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/layout/BottomNav';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface UserItem {
  id: string;
  telefono: string;
  email: string | null;
  nombre: string;
  apellido: string | null;
  role: string;
  activo: boolean;
  empresa?: { id: string; nombreCorto: string | null };
}

interface EmpresaItem {
  id: string;
  codigo: string;
  nombreCorto: string | null;
}

const ROLES: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_EMPRESA: 'Admin Empresa',
  CHECADOR: 'Checador',
  CHOFER: 'Chofer',
  PASAJERO: 'Pasajero (transporte público)',
};

export function UsuariosPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<'CHECADOR' | 'CHOFER' | 'ADMIN_EMPRESA'>('CHECADOR');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteEmpresaId, setInviteEmpresaId] = useState('');

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminEmpresa = user?.role === 'ADMIN_EMPRESA';

  const canAccess = isSuperAdmin || isAdminEmpresa;
  const canCreateRoles = isSuperAdmin
    ? ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CHECADOR', 'CHOFER', 'PASAJERO']
    : ['ADMIN_EMPRESA', 'CHECADOR', 'CHOFER'];

  const [form, setForm] = useState({
    telefono: '',
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    role: 'CHOFER' as string,
    empresaId: '',
  });

  const [editForm, setEditForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    activo: true,
  });

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { limit: '100' };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await api.get<UserItem[]>('/users', params);
      if (res.success && res.data) setUsers(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadEmpresas = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await api.get<EmpresaItem[]>('/empresas');
      if (res.success && res.data) setEmpresas(res.data);
    } catch (_) {}
  };

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    loadUsers();
    loadEmpresas();
  }, [canAccess, search, roleFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.telefono.trim() || !form.nombre.trim() || !form.password.trim()) {
      setError('Teléfono, nombre y contraseña son obligatorios');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        telefono: form.telefono.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        password: form.password,
        role: form.role,
      };
      if (form.email.trim()) body.email = form.email.trim();
      if (isSuperAdmin && form.empresaId) body.empresaId = form.empresaId;
      const res = await api.post<UserItem>('/users', body);
      if (res.success) {
        setUsers((prev) => [res.data!, ...prev]);
        setShowForm(false);
        setForm({ telefono: '', email: '', password: '', nombre: '', apellido: '', role: 'CHOFER', empresaId: '' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u: UserItem) => {
    setEditingId(u.id);
    setEditForm({
      nombre: u.nombre,
      apellido: u.apellido ?? '',
      email: u.email ?? '',
      activo: u.activo,
    });
  };

  const handleUpdate = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.put<UserItem>(`/users/${id}`, editForm);
      if (res.success && res.data) {
        setUsers((prev) => prev.map((u) => (u.id === id ? res.data! : u)));
        setEditingId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerarInvitacion = async () => {
    setInviteLoading(true);
    setInviteLink('');
    setError('');
    try {
      const body: { role: 'CHECADOR' | 'CHOFER' | 'ADMIN_EMPRESA'; email?: string; empresaId?: string } = {
        role: inviteRole,
      };
      if (inviteEmail.trim()) body.email = inviteEmail.trim();
      if (isSuperAdmin && inviteEmpresaId) body.empresaId = inviteEmpresaId;
      const res = await api.post<{ link: string }>('/invitations', body);
      if (res.success && res.data?.link) {
        setInviteLink(res.data.link);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar invitación');
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    window.alert('Enlace copiado al portapapeles');
  };

  const handleResetPassword = async (id: string) => {
    const newPassword = window.prompt('Nueva contraseña (mínimo 6 caracteres)');
    if (!newPassword || newPassword.length < 6) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/users/${id}/reset-password`, { newPassword });
      setError('');
      window.alert('Contraseña actualizada');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar contraseña');
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
            <h1 className="font-semibold text-lg">Usuarios</h1>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-nav">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-semibold text-lg">Usuarios</h1>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 overflow-auto">
        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Buscar por nombre, teléfono, email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[200px]"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los roles</option>
            {Object.entries(ROLES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
            <Plus className="size-4" />
            Nuevo usuario
          </Button>
          <Button variant="outline" onClick={() => setShowInvite((s) => !s)} className="gap-2">
            <Link2 className="size-4" />
            Invitar por enlace
          </Button>
        </div>

        {showInvite && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-medium">Generar enlace de invitación</h3>
              <p className="text-sm text-muted-foreground">
                Quien reciba el enlace podrá registrarse y se le asignará el rol y la empresa que elijas.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Rol</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'CHECADOR' | 'CHOFER' | 'ADMIN_EMPRESA')}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="CHECADOR">{ROLES.CHECADOR}</option>
                    <option value="CHOFER">{ROLES.CHOFER}</option>
                    <option value="ADMIN_EMPRESA">{ROLES.ADMIN_EMPRESA}</option>
                  </select>
                </div>
                {isSuperAdmin && empresas.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Empresa</label>
                    <select
                      value={inviteEmpresaId}
                      onChange={(e) => setInviteEmpresaId(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Sin empresa</option>
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>{e.nombreCorto || e.codigo}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Email (opcional)</label>
                  <Input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-48"
                  />
                </div>
                <Button onClick={handleGenerarInvitacion} disabled={inviteLoading}>
                  {inviteLoading ? <Loader2 className="size-4 animate-spin" /> : 'Generar enlace'}
                </Button>
              </div>
              {inviteLink && (
                <div className="flex gap-2 items-center pt-2 border-t border-border">
                  <Input readOnly value={inviteLink} className="font-mono text-xs flex-1" />
                  <Button variant="outline" size="sm" onClick={copyInviteLink} className="gap-1">
                    <Copy className="size-4" />
                    Copiar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showForm && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-medium">Crear usuario</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <Input
                  placeholder="Teléfono *"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <Input
                  placeholder="Contraseña *"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                />
                <Input
                  placeholder="Nombre *"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Apellido"
                  value={form.apellido}
                  onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
                />
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {canCreateRoles.map((r) => (
                    <option key={r} value={r}>{ROLES[r]}</option>
                  ))}
                </select>
                {isSuperAdmin && (
                  <select
                    value={form.empresaId}
                    onChange={(e) => setForm((f) => ({ ...f, empresaId: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sin empresa</option>
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>{e.nombreCorto || e.codigo}</option>
                    ))}
                  </select>
                )}
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
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Users className="size-12 mx-auto mb-2 opacity-50" />
              No hay usuarios o no coinciden los filtros.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <Card key={u.id}>
                <CardContent className="p-4">
                  {editingId === u.id ? (
                    <form onSubmit={(e) => handleUpdate(u.id, e)} className="space-y-3">
                      <Input
                        placeholder="Nombre"
                        value={editForm.nombre}
                        onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                      />
                      <Input
                        placeholder="Apellido"
                        value={editForm.apellido}
                        onChange={(e) => setEditForm((f) => ({ ...f, apellido: e.target.value }))}
                      />
                      <Input
                        placeholder="Email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editForm.activo}
                          onChange={(e) => setEditForm((f) => ({ ...f, activo: e.target.checked }))}
                        />
                        Activo
                      </label>
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
                          <p className="font-medium">{u.nombre} {u.apellido}</p>
                          <p className="text-sm text-muted-foreground">{u.telefono}</p>
                          {u.email && <p className="text-sm text-muted-foreground">{u.email}</p>}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="secondary">{ROLES[u.role] || u.role}</Badge>
                            {u.empresa && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="size-3" />
                                {u.empresa.nombreCorto}
                              </span>
                            )}
                            {!u.activo && <Badge variant="destructive">Inactivo</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon-sm" onClick={() => startEdit(u)}>
                            <Pencil className="size-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleResetPassword(u.id)}
                              disabled={saving}
                              title="Resetear contraseña"
                            >
                              <Key className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
