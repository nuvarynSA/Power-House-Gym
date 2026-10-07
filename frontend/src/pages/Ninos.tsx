import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import './Invitados.css';

const Ninos = () => {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    fechaNacimiento: '',
    foto: null as File | null,
    suscriptor: ''
  });
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    busqueda: '',
    suscriptor: ''
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();

  const { data: ninos, refetch: refetchNinos } = useQuery(
    ['ninos', filters],
    async () => {
      const params = new URLSearchParams();
      if (filters.busqueda) params.append('busqueda', filters.busqueda);
      if (filters.suscriptor) params.append('suscriptor', filters.suscriptor);
      const response = await api.get(`/ninos?${params.toString()}`);
      return response.data;
    }
  );
  // Unificar niños duplicados (mismo nombre/apellido/fechaNacimiento) y sumar padres
  const ninosUnificados = useMemo(() => {
    if (!ninos) return [];
    const map = new Map<string, any>();
    ninos.forEach((n: any) => {
      const key = `${(n.nombre || '').trim().toLowerCase()}|${(n.apellido || '').trim().toLowerCase()}|${new Date(n.fechaNacimiento).toISOString().slice(0, 10)}`;
      if (!map.has(key)) {
        map.set(key, { ...n, padres: [...(n.padres || [])] });
      } else {
        const existente = map.get(key);
        const padresActualizados = [...(existente.padres || [])];
        (n.padres || []).forEach((p: any) => {
          if (!padresActualizados.find((e: any) => e.id === p.id)) {
            padresActualizados.push(p);
          }
        });
        map.set(key, { ...existente, padres: padresActualizados });
      }
    });
    return Array.from(map.values());
  }, [ninos]);

  const { data: suscriptores } = useQuery(
    ['suscriptores', 'disponibles'],
    async () => {
      const response = await api.get('/suscriptores?eliminado=false&habilitado=true');
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const isSecure = window.location.protocol === 'https:' ||
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';

      if (!isSecure) {
        showToast(t('common.cameraRequiresHttps'), 'warning');
        return;
      }

      setShowCamera(true);
      await new Promise(resolve => setTimeout(resolve, 100));

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
        videoRef.current.play().catch(() => {});
      }
    } catch (error: any) {
      console.error('Error al acceder a la cámara:', error);
      setShowCamera(false);
      showToast(t('common.cameraAccessError'), 'error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
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
            const file = new File([blob], 'foto-nino.jpg', { type: 'image/jpeg' });
            setFormData({ ...formData, foto: file });
            setCapturedImage(URL.createObjectURL(blob));
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const createMutation = useMutation(
    async (data: FormData) => {
      const response = await api.post('/ninos', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['ninos'] });
        setShowModal(false);
        resetForm();
        showToast(t('children.createdSuccess'), 'success');
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || t('children.createError'), 'error');
      }
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }: { id: string; data: FormData }) => {
      const response = await api.put(`/ninos/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['ninos'] });
        setShowModal(false);
        resetForm();
        showToast(t('children.updatedSuccess'), 'success');
      }
    }
  );

  const deleteMutation = useMutation(
    async (id: string) => {
      const response = await api.delete(`/ninos/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['ninos'] });
        setDeletingId(null);
        showToast(t('children.deletedSuccess'), 'success');
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || t('children.deleteError'), 'error');
        setDeletingId(null);
      }
    }
  );

  const resetForm = () => {
    stopCamera();
    setFormData({
      nombre: '',
      apellido: '',
      fechaNacimiento: '',
      foto: null,
      suscriptor: ''
    });
    setEditing(null);
    setCapturedImage(null);
    setShowCamera(false);
  };

  const handleEdit = (nino: any) => {
    setEditing(nino);
    setFormData({
      nombre: nino.nombre,
      apellido: nino.apellido,
      fechaNacimiento: nino.fechaNacimiento ? new Date(nino.fechaNacimiento).toISOString().split('T')[0] : '',
      foto: null,
      suscriptor: nino.padres && nino.padres.length > 0 ? nino.padres[0].id : ''
    });
    setCapturedImage(nino.foto || null);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.suscriptor) {
      showToast(t('children.selectParent'), 'warning');
      return;
    }
    
    if (!formData.foto && !editing && !capturedImage) {
      showToast(t('children.photoRequired'), 'warning');
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', formData.nombre);
    formDataToSend.append('apellido', formData.apellido);
    formDataToSend.append('fechaNacimiento', formData.fechaNacimiento);
    formDataToSend.append('suscriptor', formData.suscriptor);
    
    if (formData.foto) {
      formDataToSend.append('foto', formData.foto);
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id || editing._id, data: formDataToSend });
    } else {
      createMutation.mutate(formDataToSend);
    }
  };

  const handleDelete = async (nino: any) => {
    if (!window.confirm(`${t('children.confirmDelete')} ${nino.nombre} ${nino.apellido}?`)) {
      return;
    }
    setDeletingId(nino.id || nino._id);
    deleteMutation.mutate(nino.id || nino._id);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleSearch = () => {
    refetchNinos();
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  return (
    <div className="invitados ninos-page">
      <div className="page-header">
        <h1>{t('children.title')}</h1>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary">
          {t('children.new')}
        </button>
      </div>
      <p className="helper ninos-helper">
        {language === 'es'
          ? 'Para que ambos padres vean al mismo niño, cada uno debe agregarlo en su cuenta usando exactamente el mismo nombre, apellido y fecha de nacimiento.'
          : 'For both parents to see the same child, each must add the child in their account using the exact same name, last name, and birth date.'}
      </p>

      <div className="filters-section">
        <h2>{t('common.filters')}</h2>
        <div className="filters-grid">
          <div className="form-group">
            <label>{t('common.searchLabel')}</label>
            <input
              type="text"
              value={filters.busqueda}
              onChange={(e) => handleFilterChange('busqueda', e.target.value)}
              placeholder={t('children.searchPlaceholder')}
            />
          </div>
          <div className="form-group">
            <label>{t('children.parent')}</label>
            <select
              value={filters.suscriptor}
              onChange={(e) => handleFilterChange('suscriptor', e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              {suscriptores?.map((s: any) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.nombre} {s.apellido}
                </option>
              ))}
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
              <th>{t('children.birthDate')}</th>
              <th>{t('children.parents')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {ninosUnificados.map((nino: any) => (
              <tr key={nino.id || nino._id}>
                <td>{nino.nombre}</td>
                <td>{nino.apellido}</td>
                <td>{formatDate(nino.fechaNacimiento)}</td>
                <td>
                  {nino.padres && nino.padres.length > 0 ? (
                    <div>
                      {nino.padres.map((padre: any) => (
                        <div key={padre.id}>
                          {padre.nombre} {padre.apellido} ({padre.email})
                        </div>
                      ))}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => handleEdit(nino)} className="btn-small btn-secondary">
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(nino)}
                      className="btn-small btn-danger"
                      disabled={deletingId === (nino.id || nino._id)}
                    >
                      {deletingId === (nino.id || nino._id) ? t('common.deleting') : t('common.delete')}
                    </button>
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
            <h2>{editing ? t('children.edit') : t('children.new')}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t('children.parent')} *</label>
                <select
                  value={formData.suscriptor}
                  onChange={(e) => setFormData({ ...formData, suscriptor: e.target.value })}
                  required
                >
                  <option value="">{t('children.selectParent')}</option>
                  {suscriptores?.map((s: any) => (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {s.nombre} {s.apellido} ({s.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('common.name')} *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('common.lastName')} *</label>
                <input
                  type="text"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('children.birthDate')} *</label>
                <input
                  type="date"
                  value={formData.fechaNacimiento}
                  onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="form-group">
                <label>{t('children.photo')} *</label>
                {!showCamera && !capturedImage && (
                  <div>
                    {editing && editing.foto && (
                      <div style={{ marginBottom: '10px' }}>
                        <p style={{ fontSize: '14px', marginBottom: '5px' }}>{t('children.currentPhoto')}:</p>
                        <img src={editing.foto} alt="Foto actual" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '5px' }} />
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
                    <div style={{ textAlign: 'center', margin: '10px 0', color: '#666' }}>o</div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormData({ ...formData, foto: file });
                          setCapturedImage(URL.createObjectURL(file));
                        }
                      }}
                      style={{ width: '100%', marginBottom: '10px' }}
                    />
                  </div>
                )}
                {showCamera && (
                  <div className="camera-container">
                    <div className="camera-wrapper">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted
                        style={{ 
                          width: '100%', 
                          maxWidth: '400px', 
                          borderRadius: '5px', 
                          backgroundColor: '#000000', 
                          minHeight: '200px',
                          display: 'block',
                          objectFit: 'cover'
                        }} 
                      />
                      <svg className="face-guide" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                        <ellipse
                          cx="200"
                          cy="200"
                          rx="120"
                          ry="160"
                          fill="none"
                          stroke="rgba(9, 164, 81, 0.6)"
                          strokeWidth="3"
                          strokeDasharray="5,5"
                        />
                        <circle cx="170" cy="160" r="15" fill="none" stroke="rgba(9, 164, 81, 0.4)" strokeWidth="2" />
                        <circle cx="230" cy="160" r="15" fill="none" stroke="rgba(9, 164, 81, 0.4)" strokeWidth="2" />
                        <ellipse cx="200" cy="200" rx="8" ry="25" fill="none" stroke="rgba(9, 164, 81, 0.4)" strokeWidth="2" />
                        <ellipse cx="200" cy="260" rx="40" ry="15" fill="none" stroke="rgba(9, 164, 81, 0.4)" strokeWidth="2" />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button type="button" onClick={capturePhoto} className="btn btn-primary">
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
                        setFormData({ ...formData, foto: null });
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

export default Ninos;
