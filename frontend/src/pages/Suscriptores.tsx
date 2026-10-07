import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import './Suscriptores.css';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const Suscriptores = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsSearch, setStatsSearch] = useState('');
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [detailSuscriptor, setDetailSuscriptor] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [statsMes, setStatsMes] = useState(new Date().getMonth() + 1);
  const [statsAnio, setStatsAnio] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    nombre: '',
    apellido: '',
    habilitado: true,
    password: '',
    telefono: '',
    tipoMembresia: 'gold' as 'gold' | 'silver' | 'fms' | 'gold_family' | 'gold_familiar' | 'family',
    reglamentoInvitados: '' as '' | 'ilimitado' | 'limitado' | 'sin_invitados'
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    busqueda: '',
    habilitado: '',
    origen: '',
    eliminado: 'false',
    indice: ''
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery(
    ['estadisticas-invitados', statsMes, statsAnio],
    async () => {
      const response = await api.get(`/suscriptores/estadisticas-invitados?mes=${statsMes}&anio=${statsAnio}`);
      return response.data;
    },
    { enabled: showStatsModal }
  );

  const { data: suscriptores, refetch: refetchSuscriptores } = useQuery(
    ['suscriptores', filters],
    async () => {
      const params = new URLSearchParams();
      if (filters.busqueda) params.append('busqueda', filters.busqueda);
      if (filters.habilitado) params.append('habilitado', filters.habilitado);
      if (filters.origen) params.append('origen', filters.origen);
      if (filters.eliminado) params.append('eliminado', filters.eliminado);
      const response = await api.get(`/suscriptores?${params.toString()}`);
      return response.data;
    }
  );

  const createMutation = useMutation(
    async (data: any) => {
      const response = await api.post('/suscriptores', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('suscriptores');
        queryClient.invalidateQueries('dashboard-stats');
        setShowModal(false);
        resetForm();
        showToast(t('subscribers.createdSuccess') || 'Suscriptor creado correctamente', 'success');
      },
      onError: (error: any) => {
        const msg = error.response?.data?.error || t('subscribers.createError') || 'Error al crear suscriptor';
        showToast(msg, 'error');
      }
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/suscriptores/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('suscriptores');
        queryClient.invalidateQueries('dashboard-stats');
        setShowModal(false);
        resetForm();
        showToast(t('subscribers.updatedSuccess') || 'Suscriptor actualizado correctamente', 'success');
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || 'Error al actualizar suscriptor', 'error');
      }
    }
  );

  const deleteMutation = useMutation(
    async (id: string) => {
      const response = await api.delete(`/suscriptores/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('suscriptores');
        queryClient.invalidateQueries('dashboard-stats');
        setDeletingId(null);
        showToast(t('subscribers.deleteSuccess'), 'success');
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || t('subscribers.deleteError'), 'error');
        setDeletingId(null);
      }
    }
  );

  const sendCredentialsMutation = useMutation(
    async (id: string) => {
      const response = await api.post(`/suscriptores/${id}/enviar-credenciales`);
      return response.data;
    },
    {
      onSuccess: () => {
        setSendingCredentials(null);
        showToast(t('subscribers.credentialsSentSuccess'), 'success');
      },
      onError: (error: any) => {
        setSendingCredentials(null);
        showToast(error.response?.data?.error || t('subscribers.credentialsSentError'), 'error');
      }
    }
  );

  // Bulk send credentials mutation (sequential to avoid provider rate limits)
  const sendCredentialsBulkMutation = useMutation(
    async (ids: string[]) => {
      const response = await api.post('/suscriptores/enviar-credenciales-masivo', { ids });
      return response.data;
    },
    {
      onMutate: () => {
        // could set a loading flag if needed
      },
      onSuccess: (data: any) => {
        // data: { successes: number, failures: Array<{ id, error }> }
        setSelectedIds(new Set());
        if (data.failures && data.failures.length > 0) {
          showToast(`${data.successes} ${t('subscribers.credentialsSentSuccess')}, ${data.failures.length} errores`, 'warning');
        } else {
          showToast(`${data.successes} ${t('subscribers.credentialsSentSuccess')}`, 'success');
        }
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || t('subscribers.credentialsSentError'), 'error');
      }
    }
  );

  const resetForm = () => {
    setFormData({
      email: '',
      nombre: '',
      apellido: '',
      habilitado: true,
      password: '',
      telefono: '',
      tipoMembresia: 'gold',
      reglamentoInvitados: ''
    });
    setEditing(null);
  };

  // Carga el form SIN abrir el modal simple
  const loadFormData = (suscriptor: any) => {
    setEditing(suscriptor);
    setFormData({
      email: suscriptor.email || '',
      nombre: suscriptor.nombre,
      apellido: suscriptor.apellido,
      habilitado: suscriptor.habilitado,
      password: '',
      telefono: suscriptor.telefono || '',
      tipoMembresia: (suscriptor.tipoMembresia || 'gold') as 'gold' | 'silver' | 'fms' | 'gold_family' | 'gold_familiar' | 'family',
      reglamentoInvitados: (suscriptor.reglamentoInvitados || '') as '' | 'ilimitado' | 'limitado' | 'sin_invitados'
    });
  };

  const handleOpenDetail = async (s: any) => {
    setDetailSuscriptor(s);
    setDetailLoading(true);
    setDetailData(null);
    loadFormData(s); // carga el form sin abrir el modal simple
    setShowDetailPanel(true);
    try {
      const res = await api.get(`/suscriptores/${s._id || s.id}/detalle`);
      setDetailData(res.data);
      // Actualizar reglamentoInvitados con el dato fresco del backend
      if (res.data?.suscriptor?.reglamentoInvitados !== undefined) {
        setFormData(prev => ({
          ...prev,
          reglamentoInvitados: (res.data.suscriptor.reglamentoInvitados || '') as '' | 'ilimitado' | 'limitado' | 'sin_invitados'
        }));
      }
    } catch {
      showToast('Error al cargar detalle del suscriptor', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePhotoUpload = async (file: File, suscriptorId: string) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append('foto', file);
      const res = await api.post(`/suscriptores/${suscriptorId}/foto`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Actualizar la foto en el detailData y en la lista
      if (res.data?.foto) {
        setDetailData((prev: any) => prev ? { ...prev, suscriptor: { ...prev.suscriptor, foto: res.data.foto } } : prev);
        setDetailSuscriptor((prev: any) => prev ? { ...prev, foto: res.data.foto } : prev);
        queryClient.invalidateQueries('suscriptores');
      }
      showToast(t('subscribers.photoSuccess'), 'success');
    } catch {
      showToast(t('subscribers.photoError'), 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && !formData.telefono.trim()) {
      showToast(t('subscribers.phoneRequired'), 'warning');
      return;
    }

    if (editing) {
      updateMutation.mutate({ id: editing._id || editing.id, data: { ...formData, reglamentoInvitados: formData.reglamentoInvitados || null } });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = async (suscriptor: any) => {
    if (!window.confirm(`${t('subscribers.confirmDelete')} ${suscriptor.nombre} ${suscriptor.apellido}?`)) {
      return;
    }
    setDeletingId(suscriptor._id || suscriptor.id);
    deleteMutation.mutate(suscriptor._id || suscriptor.id);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleSearch = () => {
    refetchSuscriptores();
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set<string>(suscriptores?.map((s: any) => String(s._id || s.id)) || []);
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const isAllSelected = !!(suscriptores && suscriptores.length > 0 && selectedIds.size === suscriptores.length);
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < (suscriptores?.length || 0);

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const filteredSuscriptores = suscriptores?.filter((_s: any, index: number) => {
    if (filters.indice) {
      const indiceNum = parseInt(filters.indice);
      if (!isNaN(indiceNum)) {
        return (index + 1) === indiceNum;
      }
    }
    return true;
  }) || [];

  return (
    <div className="suscriptores">
      <div className="page-header">
        <h1>{t('subscribers.title')}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowStatsModal(true)}
            className="btn btn-secondary"
            title="Ver estadísticas de ingresos de invitados por mes"
          >
            📊 Estadísticas
          </button>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary">
            {t('subscribers.new')}
          </button>
        </div>
      </div>

      <div className="filters-section">
        <h2>{t('common.filters')}</h2>
        <div className="filters-grid">
          <div className="form-group">
            <label>{t('common.searchLabel')}</label>
            <input
              type="text"
              value={filters.busqueda}
              onChange={(e) => handleFilterChange('busqueda', e.target.value)}
              placeholder={t('common.searchPlaceholderSubscribers')}
            />
          </div>
          <div className="form-group">
            <label>{t('common.status')}</label>
            <select
              value={filters.habilitado}
              onChange={(e) => handleFilterChange('habilitado', e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              <option value="true">{t('common.enabled')}</option>
              <option value="false">{t('common.disabled')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('common.origin')}</label>
            <select
              value={filters.origen}
              onChange={(e) => handleFilterChange('origen', e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              <option value="csv">{t('common.csv')}</option>
              <option value="manual">{t('common.manual')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('common.showDeleted')}</label>
            <select
              value={filters.eliminado}
              onChange={(e) => handleFilterChange('eliminado', e.target.value)}
            >
              <option value="false">{t('common.no')}</option>
              <option value="true">{t('common.yes')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>Índice</label>
            <input
              type="number"
              value={filters.indice}
              onChange={(e) => handleFilterChange('indice', e.target.value)}
              placeholder="Número de fila"
              min="1"
            />
          </div>
        </div>
        <button onClick={handleSearch} className="btn btn-primary">
          {t('common.search')}
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="selection-actions">
          <span>{selectedIds.size} {t('common.selected')}</span>
          <button
            onClick={() => {
              const selectedSuscriptores = filteredSuscriptores.filter((s: any) => {
                const suscriptorId = s._id || s.id;
                return selectedIds.has(suscriptorId) && s.email;
              });

              if (selectedSuscriptores.length === 0) {
                showToast(t('subscribers.noEmailRegistered'), 'warning');
                return;
              }

              if (window.confirm(t('subscribers.confirmSendCredentialsMultiple') || `¿Enviar credenciales a ${selectedSuscriptores.length} suscriptores?`)) {
                const ids = selectedSuscriptores.map((s: any) => s._id || s.id);
                sendCredentialsBulkMutation.mutate(ids);
              }
            }}
            className="btn btn-success"
            disabled={sendCredentialsBulkMutation.isLoading}
          >
            {sendCredentialsBulkMutation.isLoading ? t('common.sending') : t('subscribers.sendCredentials')}
          </button>
          <button
            onClick={() => {
              if (window.confirm(t('subscribers.confirmDeleteMultiple') || `¿Eliminar ${selectedIds.size} suscriptores?`)) {
                selectedIds.forEach(id => {
                  deleteMutation.mutate(id);
                });
                setSelectedIds(new Set());
              }
            }}
            className="btn btn-danger"
          >
            {t('common.deleteSelected')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="btn btn-secondary"
          >
            {t('common.clearSelection')}
          </button>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '30px', padding: '8px 4px' }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isIndeterminate;
                  }}
                  onChange={handleSelectAll}
                  title={t('common.selectAll')}
                />
              </th>
              <th style={{ width: '45px', padding: '8px 4px' }}>#</th>
              <th className="suscriptor-avatar-cell">{t('subscribers.photo')}</th>
              <th style={{ whiteSpace: 'nowrap' }}>Email</th>
              <th style={{ whiteSpace: 'nowrap' }}>{t('common.name')}</th>
              <th style={{ whiteSpace: 'nowrap', width: '1%' }}>{t('common.lastName')}</th>
              <th style={{ whiteSpace: 'nowrap', width: '1%' }}>{t('subscribers.membershipType')}</th>
              <th style={{ whiteSpace: 'nowrap', width: '1%' }}>{t('subscribers.enabled')}</th>
              <th style={{ whiteSpace: 'nowrap', width: '1%' }}>{t('common.createdAt')}</th>
              <th style={{ whiteSpace: 'nowrap' }}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuscriptores.map((s: any, index: number) => {
              const suscriptorId = s._id || s.id;
              const isSelected = selectedIds.has(suscriptorId);
              return (
                <tr key={suscriptorId} className={isSelected ? 'row-selected' : ''}>
                  <td style={{ width: '30px', padding: '8px 4px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(suscriptorId)}
                    />
                  </td>
                  <td style={{ width: '45px', padding: '8px 4px', textAlign: 'center' }}>{index + 1}</td>
                  <td className="suscriptor-avatar-cell">
                    {s.foto
                      ? <img src={s.foto} alt={s.nombre} className="suscriptor-avatar" />
                      : <div className="suscriptor-avatar-placeholder">{(s.nombre?.[0] || '?').toUpperCase()}</div>
                    }
                  </td>
                  <td>{s.email}</td>
                  <td>{s.nombre}</td>
                  <td style={{ width: '1%', whiteSpace: 'nowrap' }}>{s.apellido}</td>
                  <td style={{ width: '1%', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                      <span className="badge badge-info">
                        {(() => {
                          const labels: Record<string, string> = {
                            gold: 'Gold',
                            silver: 'Silver',
                            fms: 'FMS',
                            gold_family: 'Gold Family',
                            gold_familiar: 'Gold Familiar',
                            family: 'Family'
                          };
                          return labels[s.tipoMembresia] || s.tipoMembresia || 'Gold';
                        })()}
                      </span>
                      {(() => {
                        const reglamento = (s as any).reglamentoInvitados;
                        const CUTOFF = new Date('2026-05-16T00:00:00.000Z');
                        // Solo Gold puede traer invitados; silver, fms y plans familiares no
                        const NO_GUEST_PLANS = ['silver', 'fms', 'gold_family', 'gold_familiar', 'family'];
                        const esSinInvitadosPorPlan = NO_GUEST_PLANS.includes(s.tipoMembresia);
                        const esSinInvitados = reglamento === 'sin_invitados' || esSinInvitadosPorPlan;
                        const esNuevoAuto = s.tipoMembresia === 'gold' && new Date(s.createdAt) >= CUTOFF;
                        const esLimitado = !esSinInvitados && (reglamento === 'limitado' || (!reglamento && esNuevoAuto));
                        const esManual = !!reglamento;
                        if (esSinInvitados) {
                          const titleSinInv = reglamento === 'sin_invitados'
                            ? 'Gold Familiar — sin invitados (manual)'
                            : ['gold_family', 'gold_familiar', 'family'].includes(s.tipoMembresia)
                              ? 'Plan familiar — sin invitados'
                              : `Plan ${s.tipoMembresia.toUpperCase()} — solo Gold puede traer invitados`;
                          return (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontWeight: 600,
                                border: '1px solid',
                                whiteSpace: 'nowrap',
                                backgroundColor: '#fce4ec',
                                color: '#b71c1c',
                                borderColor: '#ef9a9a'
                              }}
                              title={titleSinInv}
                            >
                              {reglamento === 'sin_invitados' ? '✏️ ' : ''}🚫 Sin invitados
                            </span>
                          );
                        }
                        return (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontWeight: 600,
                              border: '1px solid',
                              whiteSpace: 'nowrap',
                              backgroundColor: esLimitado ? '#fff3e0' : '#e8f5e9',
                              color: esLimitado ? '#e65100' : '#2e7d32',
                              borderColor: esLimitado ? '#ffcc80' : '#a5d6a7'
                            }}
                            title={esManual ? 'Reglamento establecido manualmente' : 'Reglamento automático por fecha de alta'}
                          >
                            {esManual ? '✏️ ' : ''}{esLimitado ? '4×/mes' : '♾ Ilimitado'}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td style={{ width: '1%', whiteSpace: 'nowrap' }}>
                    <span className={`badge ${s.habilitado ? 'badge-success' : 'badge-error'}`}>
                      {s.habilitado ? t('subscribers.enabled') : t('subscribers.disabled')}
                    </span>
                  </td>
                  <td style={{ width: '1%', whiteSpace: 'nowrap' }}>{formatDate(s.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {!(s as any).eliminado && (
                        <>
                          <button
                            onClick={() => handleOpenDetail(s)}
                            className="btn-icon"
                            title={t('subscribers.settings')}
                          >
                            ⚙️
                          </button>
                          <button
                            onClick={() => {
                              if (!s.email) {
                                showToast(t('subscribers.noEmailRegistered'), 'warning');
                                return;
                              }
                              setSendingCredentials(suscriptorId);
                              sendCredentialsMutation.mutate(suscriptorId);
                            }}
                            className="btn-small btn-success"
                            disabled={sendingCredentials === suscriptorId}
                            title={!s.email ? t('subscribers.noEmailRegistered') : ''}
                          >
                            {sendingCredentials === suscriptorId ? t('common.sending') : t('subscribers.sendCredentials')}
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="btn-small btn-danger"
                            disabled={deletingId === suscriptorId}
                          >
                            {deletingId === suscriptorId ? t('common.deleting') : t('common.delete')}
                          </button>
                        </>
                      )}
                      {(s as any).eliminado && (
                        <span className="badge badge-error">{t('common.deleted')}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showStatsModal && (
        <div className="modal-overlay" onClick={() => setShowStatsModal(false)}>
          <div className="modal-content stats-modal" onClick={(e) => e.stopPropagation()}>
            <h2>📊 {t('subscribers.statsTitle')}</h2>

            {/* Selector de mes/año */}
            <div className="stats-mes-selector">
              <label>Mes:</label>
              <select
                value={statsMes}
                onChange={(e) => setStatsMes(parseInt(e.target.value))}
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={statsAnio}
                onChange={(e) => setStatsAnio(parseInt(e.target.value))}
              >
                {[2025, 2026, 2027].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '14px' }}
                onClick={() => refetchStats()}
                disabled={statsLoading}
              >
                {statsLoading ? 'Cargando…' : 'Actualizar'}
              </button>
            </div>

            {/* Contenido */}
            {statsLoading ? (
              <div className="stats-empty">{t('common.loading')}</div>
            ) : !statsData?.datos?.length ? (
              <div className="stats-empty">
                {t('subscribers.statsEmpty')} {MESES[statsMes - 1]} {statsAnio}
              </div>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  {MESES[statsMes - 1]} {statsAnio} — {statsData.datos.length} {t('subscribers.statsSubscribers')}
                </p>
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={statsSearch}
                    onChange={(e) => setStatsSearch(e.target.value)}
                    placeholder={t('subscribers.statsSearch')}
                    style={{ width: '100%', padding: '8px 12px', border: '2px solid var(--color-gray-dark)', borderRadius: '5px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="stats-list">
                  {(() => {
                    const filteredDatos = statsData.datos.filter((item: any) => {
                      if (!statsSearch.trim()) return true;
                      const q = statsSearch.toLowerCase();
                      return (item.nombre || '').toLowerCase().includes(q) || (item.apellido || '').toLowerCase().includes(q);
                    });
                    const maxIngresos = filteredDatos[0]?.ingresosMes || 1;
                    return filteredDatos.map((item: any, index: number) => {
                      const rankClass = index === 0 ? 'stats-top-1' : index === 1 ? 'stats-top-2' : index === 2 ? 'stats-top-3' : '';
                      const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                      const medalClass = index === 0 ? 'medal-1' : index === 1 ? 'medal-2' : index === 2 ? 'medal-3' : '';
                      const planLabel: Record<string, string> = {
                        gold: 'Gold', silver: 'Silver', fms: 'FMS',
                        gold_family: 'Gold Fam.', gold_familiar: 'Gold Fam.', family: 'Family'
                      };
                      const planClass = ['gold', 'gold_family', 'gold_familiar'].includes(item.tipoMembresia) ? 'gold'
                        : item.tipoMembresia === 'silver' ? 'silver'
                        : item.tipoMembresia === 'fms' ? 'fms' : '';
                      const pct = Math.round((item.ingresosMes / maxIngresos) * 100);

                      return (
                        <div key={item.suscriptorId} className={`stats-item ${rankClass}`}>
                          <div className={`stats-rank ${medalClass}`}>{rankLabel}</div>
                          <div className="stats-info">
                            <div className="stats-nombre">{item.nombre} {item.apellido}</div>
                            {item.email && <div className="stats-email">{item.email}</div>}
                            <div className="stats-progress-bar-wrap">
                              <div className="stats-progress-bar" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="stats-badges">
                            <span className={`stats-plan-badge ${planClass}`}>
                              {planLabel[item.tipoMembresia] || item.tipoMembresia}
                            </span>
                            {(() => {
                              const NO_GUEST = ['silver', 'fms', 'gold_family', 'gold_familiar', 'family'];
                              const sinInvitadosPorPlan = NO_GUEST.includes(item.tipoMembresia);
                              if (item.reglamentoInvitados === 'sin_invitados' || sinInvitadosPorPlan) {
                                return (
                                  <span className="stats-tipo-badge" style={{ background: '#fce4ec', color: '#b71c1c', border: '1px solid #ef9a9a' }}>
                                    {item.reglamentoInvitados === 'sin_invitados' ? '✏️ ' : ''}🚫 Sin invitados
                                  </span>
                                );
                              }
                              return (
                                <span className={`stats-tipo-badge ${item.esNuevo ? 'nuevo' : 'viejo'}`}>
                                  {item.reglamentoInvitados ? t('subscribers.statsManual') + ' ' : ''}
                                  {item.esNuevo ? t('subscribers.statsLimited') : t('subscribers.statsUnlimited')}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="stats-ingresos">
                            <div className="stats-count">{item.ingresosMes}</div>
                            <div className="stats-count-label">
                              {item.ingresosMes === 1 ? t('subscribers.statsEntry') : t('subscribers.statsEntries')}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}

            <div className="form-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowStatsModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? t('subscribers.edit') : t('subscribers.new')}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t('common.email')} *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ejemplo@email.com"
                  required
                  disabled={!!editing}
                />
                <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                  {editing ? t('subscribers.emailCannotChange') : t('subscribers.emailHint')}
                </small>
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
                <label>{t('common.lastName')}</label>
                <input
                  type="text"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('subscribers.phone')}{!editing ? ' *' : ''}</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="+1234567890"
                  required={!editing}
                />
              </div>
              <div className="form-group">
                <label>{t('subscribers.membershipType')}</label>
                <select
                  value={formData.tipoMembresia}
                  onChange={(e) => setFormData({ ...formData, tipoMembresia: e.target.value as 'gold' | 'silver' | 'fms' | 'gold_family' | 'gold_familiar' | 'family' })}
                  required
                >
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="fms">FMS</option>
                  <option value="gold_family">Gold Family</option>
                  <option value="gold_familiar">Gold Familiar</option>
                  <option value="family">Family</option>
                </select>
              </div>
              {(user?.rol === 'administrador' || user?.puedeEditarReglamento === true) && (
                <div className="form-group">
                  <label>{t('subscribers.guestLimit')}</label>
                  <select
                    className="form-select"
                    value={formData.reglamentoInvitados}
                    onChange={(e) => setFormData({ ...formData, reglamentoInvitados: e.target.value as '' | 'ilimitado' | 'limitado' | 'sin_invitados' })}
                  >
                    <option value="">{t('subscribers.guestLimitAuto')}</option>
                    <option value="ilimitado">{t('subscribers.guestLimitUnlimited')}</option>
                    <option value="limitado">{t('subscribers.guestLimitLimited')}</option>
                    <option value="sin_invitados">{t('subscribers.guestLimitNoGuests')}</option>
                  </select>
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formData.reglamentoInvitados === ''
                      ? t('subscribers.guestLimitAutoHint')
                      : formData.reglamentoInvitados === 'ilimitado'
                      ? t('subscribers.guestLimitUnlimitedHint')
                      : formData.reglamentoInvitados === 'limitado'
                      ? t('subscribers.guestLimitLimitedHint')
                      : t('subscribers.guestLimitNoGuestsHint')}
                  </small>
                </div>
              )}
              {!editing && (
                <div className="form-group">
                  <label>{t('subscribers.password')} {t('common.optional')}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    minLength={6}
                  />
                  <small>{t('subscribers.passwordHint')} {t('subscribers.passwordDefaultHint')}</small>
                </div>
              )}
              {editing && (
                <div className="form-group">
                  <label>{t('subscribers.newPassword')} ({t('common.optional')})</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    minLength={6}
                  />
                  <small>{t('subscribers.passwordChangeHint')}</small>
                </div>
              )}
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.habilitado}
                    onChange={(e) => setFormData({ ...formData, habilitado: e.target.checked })}
                  />
                  {t('subscribers.enabled')}
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? t('common.save') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDetailPanel && detailSuscriptor && (
        <div className="modal-overlay" onClick={() => { setShowDetailPanel(false); setDetailData(null); resetForm(); }}>
          <div
            className="modal-content detail-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="detail-panel-header">
              <h2>{detailSuscriptor.nombre} {detailSuscriptor.apellido}</h2>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowDetailPanel(false); setDetailData(null); resetForm(); }}
              >
                {t('common.close')}
              </button>
            </div>

            {/* Photo + Edit Form Section */}
            <div style={{ marginBottom: '24px' }}>
              <h3 className="detail-section-title">{t('subscribers.settings')}</h3>

              {/* Foto del suscriptor */}
              <div className="detail-photo-section" style={{ marginBottom: '16px' }}>
                {(() => {
                  const fotoActual = detailData?.suscriptor?.foto || detailSuscriptor?.foto;
                  const iniciales = (detailSuscriptor?.nombre?.[0] || '?').toUpperCase();
                  const suscriptorId = detailSuscriptor?._id || detailSuscriptor?.id;
                  return (
                    <>
                      <div className="detail-photo-wrapper">
                        {fotoActual
                          ? <img src={fotoActual} alt={detailSuscriptor?.nombre} className="detail-photo-img" />
                          : <div className="detail-photo-placeholder">{iniciales}</div>
                        }
                      </div>
                      <label className="detail-photo-upload-btn" style={{ cursor: uploadingPhoto ? 'not-allowed' : 'pointer' }}>
                        {uploadingPhoto
                          ? t('subscribers.photoUploading')
                          : fotoActual ? t('subscribers.changePhoto') : t('subscribers.uploadPhoto')
                        }
                        <input
                          type="file"
                          accept="image/*"
                          className="detail-photo-input"
                          disabled={uploadingPhoto}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && suscriptorId) handlePhotoUpload(file, suscriptorId);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </>
                  );
                })()}
              </div>

              <form onSubmit={(e) => { handleSubmit(e); setShowDetailPanel(false); setDetailData(null); }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('common.email')} *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={!!editing}
                    />
                    <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                      {t('subscribers.emailCannotChange')}
                    </small>
                  </div>
                  <div className="form-group">
                    <label>{t('subscribers.phone')}</label>
                    <input
                      type="tel"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="+1234567890"
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
                    <label>{t('common.lastName')}</label>
                    <input
                      type="text"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('subscribers.membershipType')}</label>
                    <select
                      className="form-select"
                      value={formData.tipoMembresia}
                      onChange={(e) => setFormData({ ...formData, tipoMembresia: e.target.value as 'gold' | 'silver' | 'fms' | 'gold_family' | 'gold_familiar' | 'family' })}
                      required
                    >
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                      <option value="fms">FMS</option>
                      <option value="gold_family">Gold Family</option>
                      <option value="gold_familiar">Gold Familiar</option>
                      <option value="family">Family</option>
                    </select>
                  </div>
                  {(user?.rol === 'administrador' || user?.puedeEditarReglamento === true) && (
                    <div className="form-group">
                      <label>{t('subscribers.guestLimit')}</label>
                      <select
                        className="form-select"
                        value={formData.reglamentoInvitados}
                        onChange={(e) => setFormData({ ...formData, reglamentoInvitados: e.target.value as '' | 'ilimitado' | 'limitado' | 'sin_invitados' })}
                      >
                        <option value="">{t('subscribers.guestLimitAuto')}</option>
                        <option value="ilimitado">{t('subscribers.guestLimitUnlimited')}</option>
                        <option value="limitado">{t('subscribers.guestLimitLimited')}</option>
                        <option value="sin_invitados">{t('subscribers.guestLimitNoGuests')}</option>
                      </select>
                      <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        {formData.reglamentoInvitados === ''
                          ? t('subscribers.guestLimitAutoHint')
                          : formData.reglamentoInvitados === 'ilimitado'
                          ? t('subscribers.guestLimitUnlimitedHint')
                          : formData.reglamentoInvitados === 'limitado'
                          ? t('subscribers.guestLimitLimitedHint')
                          : t('subscribers.guestLimitNoGuestsHint')}
                      </small>
                    </div>
                  )}
                  <div className="form-group">
                    <label>{t('subscribers.newPassword')} ({t('common.optional')})</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      minLength={6}
                    />
                    <small>{t('subscribers.passwordChangeHint')}</small>
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.habilitado}
                        onChange={(e) => setFormData({ ...formData, habilitado: e.target.checked })}
                      />
                      {t('subscribers.enabled')}
                    </label>
                  </div>
                </div>
                <div className="form-actions" style={{ marginTop: '12px' }}>
                  <button type="submit" className="btn btn-primary">
                    {t('common.save')}
                  </button>
                </div>
              </form>
            </div>

            <hr style={{ border: 'none', borderTop: '2px solid var(--color-gray-dark)', margin: '16px 0' }} />

            {/* Two-column section */}
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>{t('common.loading')}</div>
            ) : (
              <div className="detail-columns">
                {/* Left: Guest entries */}
                <div className="detail-column">
                  <h3 className="detail-section-title">{t('subscribers.guestEntries')}</h3>
                  {!detailData?.registros?.length ? (
                    <p style={{ color: '#666', fontSize: '14px' }}>{t('subscribers.noEntries')}</p>
                  ) : (
                    <div>
                      {detailData.registros.map((reg: any) => (
                        <div key={reg.id || reg._id} className="detail-entry-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                {reg.invitadoRef
                                  ? `${reg.invitadoRef.nombre} ${reg.invitadoRef.apellido}`
                                  : reg.idInvitado || '-'}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {reg.fecha ? (() => {
                                  const d = new Date(reg.fecha);
                                  const pad = (n: number) => String(n).padStart(2, '0');
                                  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                })() : '-'}
                              </div>
                              {reg.motivo && <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>{reg.motivo}</div>}
                            </div>
                            <span style={{
                              fontSize: '12px',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontWeight: 600,
                              backgroundColor: reg.permitido ? 'rgba(9,164,81,0.15)' : 'rgba(255,68,68,0.15)',
                              color: reg.permitido ? '#2e7d32' : '#c62828',
                              whiteSpace: 'nowrap',
                              marginLeft: '8px'
                            }}>
                              {reg.permitido ? t('subscribers.detailAllowed') : t('subscribers.detailDenied')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Guests */}
                <div className="detail-column">
                  <h3 className="detail-section-title">{t('subscribers.guestList')}</h3>
                  {!detailData?.invitados?.length ? (
                    <p style={{ color: '#666', fontSize: '14px' }}>{t('subscribers.noGuests')}</p>
                  ) : (
                    <div>
                      {detailData.invitados.map((inv: any) => (
                        <div key={inv.id || inv._id} className="detail-guest-item">
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{inv.nombre} {inv.apellido}</div>
                          {inv.email && <div style={{ fontSize: '12px', color: '#666' }}>{inv.email}</div>}
                          {inv.idDocumento && <div style={{ fontSize: '12px', color: '#888' }}>ID: {inv.idDocumento}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Suscriptores;
