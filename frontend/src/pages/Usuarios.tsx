import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import './Usuarios.css';

const Usuarios = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nombre: '',
    rol: 'recepcion' as 'administrador' | 'recepcion',
    activo: true,
    puedeEditarReglamento: false
  });
  const queryClient = useQueryClient();

  const { data: usuarios, isLoading, error } = useQuery('usuarios', async () => {
    const response = await api.get('/usuarios');
    return response.data;
  });

  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;

  const createMutation = useMutation(
    async (data: any) => {
      const response = await api.post('/usuarios', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['usuarios'] });
        setShowModal(false);
        resetForm();
        showToast(t('users.createSuccess') || 'Usuario creado correctamente', 'success');
      },
      onError: (error: any) => {
        const errorMessage = error.response?.data?.error || t('users.createError');
        if (error.response?.status === 403) {
          showToast(`Acceso denegado: ${errorMessage}. Tu rol actual: ${user?.rol || 'No definido'}. Si eres administrador, cierra sesión y vuelve a iniciar sesión.`, 'error', 8000);
        } else {
          showToast(errorMessage, 'error');
        }
      }
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/usuarios/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['usuarios'] });
        setShowModal(false);
        resetForm();
        showToast(t('users.updateSuccess') || 'Usuario actualizado correctamente', 'success');
      },
      onError: (error: any) => {
        const errorMessage = error.response?.data?.error || 'Error al actualizar usuario';
        if (error.response?.status === 403) {
          showToast(`Acceso denegado: ${errorMessage}. Tu rol actual: ${user?.rol || 'No definido'}. Si eres administrador, cierra sesión y vuelve a iniciar sesión.`, 'error', 8000);
        } else {
          showToast(errorMessage, 'error');
        }
      }
    }
  );

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      nombre: '',
      rol: 'recepcion',
      activo: true,
      puedeEditarReglamento: false
    });
    setEditing(null);
  };

  const handleEdit = (usuario: any) => {
    setEditing(usuario);
    setFormData({
      username: usuario.username,
      password: '',
      nombre: usuario.nombre,
      rol: usuario.rol,
      activo: usuario.activo,
      puedeEditarReglamento: usuario.puedeEditarReglamento || false
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend: any = { ...formData };
    if (editing && !dataToSend.password) {
      delete dataToSend.password;
    }
    if (editing) {
      const userId = editing.id || editing._id;
      if (!userId) {
        showToast('Error: No se pudo identificar el ID del usuario', 'error');
        return;
      }
      updateMutation.mutate({ id: userId, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  return (
    <div className="usuarios">
      <div className="page-header">
        <h1>{t('users.title')}</h1>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary">
          {t('users.new')}
        </button>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>{t('common.loading') || 'Cargando...'}</p>
        </div>
      )}
      
      {errorMessage && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4444' }}>
          <p>Error al cargar usuarios: {errorMessage}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('common.username')}</th>
                <th>{t('common.name')}</th>
                <th>{t('common.role')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {usuarios && usuarios.length > 0 ? (
                usuarios.map((u: any) => (
                  <tr key={u.id || u._id}>
                    <td>{u.username}</td>
                    <td>{u.nombre}</td>
                    <td>
                      <span className={`badge ${u.rol === 'administrador' ? 'badge-info' : 'badge-warning'}`}>
                        {u.rol === 'administrador' ? t('layout.role.admin') : t('layout.role.reception')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.activo ? 'badge-success' : 'badge-error'}`}>
                        {u.activo ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => handleEdit(u)} className="btn-small btn-secondary">
                        {t('common.edit')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                    {t('common.noData') || 'No hay usuarios'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? t('users.edit') : t('users.new')}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t('common.username')}</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  disabled={!!editing}
                />
              </div>
              <div className="form-group">
                <label>{t('common.password')} {editing && t('common.passwordHint')}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editing}
                />
              </div>
              <div className="form-group">
                <label>{t('common.name')}</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('common.role')}</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as 'administrador' | 'recepcion' })}
                  required
                >
                  <option value="recepcion">{t('layout.role.reception')}</option>
                  <option value="administrador">{t('layout.role.admin')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  />
                  {t('common.active')}
                </label>
              </div>
              {formData.rol === 'recepcion' && (
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.puedeEditarReglamento}
                      onChange={(e) => setFormData({ ...formData, puedeEditarReglamento: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div>{t('users.guestLimitPermission')}</div>
                      <small style={{ color: '#666', fontSize: '12px' }}>{t('users.guestLimitPermissionHint')}</small>
                    </div>
                  </label>
                </div>
              )}
              <div className="form-actions">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;

