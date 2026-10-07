import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import './Invitados.css';

const Invitados = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    fotoPerfil: null as File | null,
    suscriptor: '',
    activo: true,
    waiverAceptado: false
  });
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    busqueda: '',
    activo: '',
    eliminado: 'false'
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();

  const { data: invitados, refetch: refetchInvitados } = useQuery(
    ['invitados', filters],
    async () => {
      const params = new URLSearchParams();
      if (filters.busqueda) params.append('busqueda', filters.busqueda);
      if (filters.activo) params.append('activo', filters.activo);
      if (filters.eliminado) params.append('eliminado', filters.eliminado);
      const response = await api.get(`/invitados?${params.toString()}`);
      return response.data;
    }
  );

  // Obtener suscriptores con conteo de invitados
  const { data: suscriptores } = useQuery(
    ['suscriptores', 'con-conteo'],
    async () => {
      const response = editing 
        ? await api.get('/suscriptores?eliminado=false')
        : await api.get('/suscriptores/disponibles');
      return response.data;
    }
  );

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      // Detener cualquier stream anterior
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Verificar si estamos en HTTPS o localhost
      const isSecure = window.location.protocol === 'https:' ||
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';

      if (!isSecure) {
        showToast(t('common.cameraRequiresHttps'), 'warning');
        return;
      }

      // Intentar obtener acceso a la cámara
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Esperar a que el video esté listo antes de mostrar
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('Error al reproducir video:', err);
            });
          }
        };
      }
      
      setShowCamera(true);
    } catch (error: any) {
      console.error('Error al acceder a la cámara:', error);
      
      // Intentar con cámara trasera si la frontal falla
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        showToast(t('common.cameraPermissionDenied'), 'error');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        showToast(t('common.cameraNotFound'), 'error');
      } else {
        // Intentar con cámara trasera como fallback
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play().catch(err => {
                  console.error('Error al reproducir video:', err);
                });
              }
            };
          }
          setShowCamera(true);
        } catch (fallbackError) {
          showToast(t('common.cameraAccessError'), 'error');
        }
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'foto-perfil.jpg', { type: 'image/jpeg' });
            setFormData({ ...formData, fotoPerfil: file });
            setCapturedImage(URL.createObjectURL(blob));
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const createMutation = useMutation(
    async (data: any) => {
      if (!data.suscriptor) {
        throw new Error(t('guests.selectSubscriberWarning'));
      }
      const formDataToSend = new FormData();
      formDataToSend.append('nombre', data.nombre);
      formDataToSend.append('apellido', data.apellido);
      if (data.email) {
        formDataToSend.append('email', data.email);
      }
      if (data.telefono) {
        formDataToSend.append('telefono', data.telefono);
      }
      formDataToSend.append('suscriptor', data.suscriptor);
      formDataToSend.append('activo', data.activo.toString());
      formDataToSend.append('waiverAceptado', data.waiverAceptado ? 'true' : 'false');
      if (data.fotoPerfil) {
        formDataToSend.append('fotoPerfil', data.fotoPerfil);
      }
      const response = await api.post('/invitados', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invitados'] });
        queryClient.invalidateQueries('dashboard-stats');
        setShowModal(false);
        resetForm();
      },
      onError: (error: any) => {
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || error.message || t('guests.createError');
        showToast(errorMessage, 'error');
      }
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }: { id: string; data: any }) => {
      const formDataToSend = new FormData();
      if (data.nombre) {
        formDataToSend.append('nombre', data.nombre);
      }
      if (data.apellido) {
        formDataToSend.append('apellido', data.apellido);
      }
      if (data.email !== undefined) {
        formDataToSend.append('email', data.email || '');
      }
      if (data.telefono) {
        formDataToSend.append('telefono', data.telefono);
      }
      if (data.suscriptor) {
        formDataToSend.append('suscriptor', data.suscriptor);
      }
      if (typeof data.activo === 'boolean') {
        formDataToSend.append('activo', data.activo.toString());
      }
      if (data.waiverAceptado) {
        formDataToSend.append('waiverAceptado', 'true');
      }
      if (data.fotoPerfil) {
        formDataToSend.append('fotoPerfil', data.fotoPerfil);
      }
      const response = await api.put(`/invitados/${id}`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invitados'] });
        queryClient.invalidateQueries('dashboard-stats');
        setShowModal(false);
        resetForm();
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || t('guests.updateError'), 'error');
      }
    }
  );

  const deleteMutation = useMutation(
    async (id: string) => {
      const response = await api.delete(`/invitados/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invitados'] });
        queryClient.invalidateQueries('dashboard-stats');
        setDeletingId(null);
        showToast(t('guests.deletedSuccess'), 'success');
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || t('guests.deleteError'), 'error');
        setDeletingId(null);
      }
    }
  );

  const resetForm = () => {
    stopCamera();
    setFormData({
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      fotoPerfil: null,
      suscriptor: '',
      activo: true,
      waiverAceptado: false
    });
    setEditing(null);
    setCapturedImage(null);
    setShowCamera(false);
  };

  const handleEdit = (invitado: any) => {
    setEditing(invitado);
    setFormData({
      nombre: invitado.nombre,
      apellido: invitado.apellido,
      email: invitado.email || '',
      telefono: invitado.telefono || '',
      fotoPerfil: null,
      suscriptor: invitado.suscriptor?._id || invitado.suscriptor || '',
      activo: invitado.activo,
      waiverAceptado: Boolean(invitado.waiverAceptado)
    });
    setCapturedImage(invitado.fotoPerfil || null);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que el suscriptor esté seleccionado
    if (!formData.suscriptor) {
      showToast(t('guests.selectSubscriberWarning'), 'warning');
      return;
    }

    if (!formData.waiverAceptado) {
      showToast(t('guests.waiverRequired'), 'warning');
      return;
    }
    
    if (editing) {
      updateMutation.mutate({ id: editing._id || editing.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = async (invitado: any) => {
    if (!window.confirm(`${t('guests.deleteConfirm')} ${invitado.nombre} ${invitado.apellido}?`)) {
      return;
    }
    setDeletingId(invitado._id || invitado.id);
    deleteMutation.mutate(invitado._id || invitado.id);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleSearch = () => {
    refetchInvitados();
  };

  return (
    <div className="invitados">
      <div className="page-header">
        <h1>{t('guests.title')}</h1>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary">
          {t('guests.new')}
        </button>
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
              placeholder={t('common.searchPlaceholder')}
            />
          </div>
          <div className="form-group">
            <label>{t('common.status')}</label>
            <select
              value={filters.activo}
              onChange={(e) => handleFilterChange('activo', e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              <option value="true">{t('common.active')}</option>
              <option value="false">{t('common.inactive')}</option>
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
        </div>
        <button onClick={handleSearch} className="btn btn-primary">
          {t('common.search')}
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.lastName')}</th>
              <th>{t('guests.subscriber')}</th>
              <th>{t('common.active')}</th>
              <th>{t('guests.waiverAccepted')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {invitados?.map((i: any) => (
              <tr key={i._id || i.id}>
                <td>{i.nombre}</td>
                <td>{i.apellido}</td>
                <td>
                  {i.suscriptor?.nombre} {i.suscriptor?.apellido} ({i.suscriptor?.email})
                </td>
                <td>
                  <span className={`badge ${i.activo ? 'badge-success' : 'badge-error'}`}>
                    {i.activo ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td>
                  <span className={`badge ${i.waiverAceptado ? 'badge-success' : 'badge-warning'}`}>
                    {i.waiverAceptado ? t('guests.waiverAccepted') : t('guests.waiverPending')}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {i.activo !== false && (
                      <>
                        <button onClick={() => handleEdit(i)} className="btn-small btn-secondary">
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(i)}
                          className="btn-small btn-danger"
                          disabled={deletingId === (i._id || i.id)}
                        >
                          {deletingId === (i._id || i.id) ? t('common.deleting') : t('common.delete')}
                        </button>
                        {!i.waiverAceptado && (
                          <button
                            onClick={() => {
                              if (!window.confirm(t('guests.waiverConfirm'))) return;
                              updateMutation.mutate({
                                id: i._id || i.id,
                                data: {
                                  waiverAceptado: true
                                }
                              });
                            }}
                            className="btn-small btn-primary"
                          >
                            {t('guests.waiverAcceptAction')}
                          </button>
                        )}
                      </>
                    )}
                    {i.activo === false && (
                      <span className="badge badge-error">{t('common.deleted')}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? t('guests.edit') : t('guests.new')}</h2>
            <form onSubmit={handleSubmit}>
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
                <label>{t('common.email')} ({t('common.optional')})</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>{t('common.phone')} ({t('common.optional')})</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
              <div className="form-group">
                <label>{t('common.profilePhoto')}</label>
                {!showCamera && !capturedImage && (
                  <div>
                    {editing && editing.fotoPerfil && (
                      <div style={{ marginBottom: '10px' }}>
                        <p style={{ fontSize: '14px', marginBottom: '5px' }}>{t('common.currentPhoto')}:</p>
                        <img src={editing.fotoPerfil} alt="Foto actual" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '5px' }} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={startCamera}
                      className="btn btn-secondary"
                      style={{ width: '100%', marginBottom: '10px' }}
                    >
                      {t('common.takePhoto')}
                    </button>
                    <div style={{ textAlign: 'center', margin: '10px 0', color: '#666' }}>{t('common.or')}</div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormData({ ...formData, fotoPerfil: file });
                          setCapturedImage(URL.createObjectURL(file));
                        }
                      }}
                      style={{ width: '100%', marginBottom: '10px' }}
                    />
                  </div>
                )}
                {showCamera && (
                  <div className="camera-container">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      style={{ 
                        width: '100%', 
                        maxWidth: '400px', 
                        borderRadius: '5px',
                        backgroundColor: '#000',
                        minHeight: '300px',
                        objectFit: 'cover'
                      }} 
                    />
                    {!streamRef.current && (
                      <p style={{ color: '#666', marginTop: '10px', textAlign: 'center' }}>
                        {t('common.startingCamera')}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button 
                        type="button" 
                        onClick={capturePhoto} 
                        className="btn btn-primary"
                        disabled={!streamRef.current}
                      >
                        {t('common.capture')}
                      </button>
                      <button type="button" onClick={stopCamera} className="btn btn-secondary">
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
                {capturedImage && (
                  <div style={{ marginTop: '10px' }}>
                    <img src={capturedImage} alt="Foto capturada" style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '5px', display: 'block' }} />
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedImage(null);
                        setFormData({ ...formData, fotoPerfil: null });
                        startCamera();
                      }}
                      className="btn btn-secondary"
                      style={{ marginTop: '10px' }}
                    >
                      {t('common.changePhoto')}
                    </button>
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
              <div className="form-group">
                <label>{t('guests.subscriber')} *</label>
                <select
                  value={formData.suscriptor}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, suscriptor: value });
                  }}
                  required
                  style={{ 
                    borderColor: !formData.suscriptor ? '#ff4444' : undefined,
                    borderWidth: !formData.suscriptor ? '2px' : undefined
                  }}
                >
                  <option value="">{t('guests.selectSubscriber')}</option>
                  {suscriptores?.map((s: any) => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.nombre} {s.apellido} - {s.email} ({s.cantidadInvitados || 0} {s.cantidadInvitados === 1 ? t('guests.guest') : t('guests.guests')})
                    </option>
                  ))}
                </select>
                {!editing && suscriptores?.length === 0 && (
                  <p style={{ color: '#ff4444', fontSize: '12px', marginTop: '5px' }}>
                    {t('guests.noSubscribersAvailable')}
                  </p>
                )}
                {!formData.suscriptor && (
                  <small style={{ color: '#ff4444', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    {t('common.requiredField')}
                  </small>
                )}
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.waiverAceptado}
                    onChange={(e) => setFormData({ ...formData, waiverAceptado: e.target.checked })}
                    disabled={!!editing && formData.waiverAceptado}
                  />
                  {t('guests.waiverAcceptLabel')}{' '}
                  <a href={`${import.meta.env.BASE_URL}Waiver.pdf#page=1`} target="_blank" rel="noreferrer">
                    {t('guests.waiverView')}
                  </a>
                </label>
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
    </div>
  );
};

export default Invitados;
