import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import './Importaciones.css';

const Importaciones = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    successful: number;
    errors: number;
    startTime: number;
    estimatedTimeRemaining: number;
  } | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const { data: importaciones } = useQuery('importaciones', async () => {
    const response = await api.get('/importaciones');
    return response.data;
  });

  const previewMutation = useMutation(
    async (formData: FormData) => {
      const response = await api.post('/importaciones/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: (data) => {
        setPreview(data);
        setShowPreview(true);
      }
    }
  );

  const importMutation = useMutation(
    async (formData: FormData) => {
      const startTime = Date.now();
      setImportProgress({
        current: 0,
        total: preview?.total || 0,
        successful: 0,
        errors: 0,
        startTime,
        estimatedTimeRemaining: 0
      });

      // Iniciar polling de progreso
      if (progressIntervalRef.current !== null) {
        window.clearInterval(progressIntervalRef.current);
      }

      const pollProgress = async () => {
        try {
          const response = await api.get('/importaciones/progress');
          if (response.data) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = response.data.current / elapsed;
            const remaining = response.data.total - response.data.current;
            const estimatedTimeRemaining = rate > 0 ? remaining / rate : 0;

            setImportProgress({
              ...response.data,
              startTime,
              estimatedTimeRemaining
            });
          }
        } catch (error) {
          console.error('Error polling progress:', error);
        }
      };

      progressIntervalRef.current = window.setInterval(pollProgress, 500);

      try {
        const response = await api.post('/importaciones/importar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (progressIntervalRef.current !== null) {
          window.clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        return response.data;
      } catch (error) {
        if (progressIntervalRef.current !== null) {
          window.clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        throw error;
      }
    },
    {
      onSuccess: () => {
        if (progressIntervalRef.current !== null) {
          window.clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setImportProgress(null);
        queryClient.invalidateQueries('importaciones');
        queryClient.invalidateQueries('suscriptores');
        queryClient.invalidateQueries('dashboard-stats');
        setFile(null);
        setPreview(null);
        setShowPreview(false);
        showToast(t('imports.success'), 'success');
      },
      onError: () => {
        if (progressIntervalRef.current !== null) {
          window.clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setImportProgress(null);
      }
    }
  );

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current !== null) {
        window.clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handlePreview = () => {
    if (!file) {
      showToast(t('imports.selectFile'), 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('archivo', file);
    previewMutation.mutate(formData);
  };

  const handleImport = () => {
    if (!file) {
      showToast(t('imports.selectFile'), 'warning');
      return;
    }

    if (!confirm(t('imports.confirmImport'))) {
      return;
    }

    const formData = new FormData();
    formData.append('archivo', file);
    importMutation.mutate(formData);
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)} ${t('imports.seconds')}`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes} ${t('imports.minutes')} ${secs} ${t('imports.seconds')}`;
  };

  return (
    <div className="importaciones">
      <h1>{t('imports.title')}</h1>

      <div className="import-section">
        <h2>{t('imports.new')}</h2>
        <div className="import-form">
          <div className="form-group">
            <label htmlFor="archivo">{t('imports.csvFile')}</label>
            <input
              type="file"
              id="archivo"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              required
            />
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
              Formatos soportados: CSV, Excel (.xlsx, .xls)
            </small>
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!file || previewMutation.isLoading}
              className="btn btn-secondary"
            >
              {previewMutation.isLoading ? t('common.loading') : t('imports.preview')}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || importMutation.isLoading}
              className="btn btn-primary"
            >
              {importMutation.isLoading ? t('imports.importing') : t('imports.import')}
            </button>
          </div>
        </div>

        {importProgress && importMutation.isLoading && (
          <div className="import-progress-section">
            <h3>{t('imports.importing')}</h3>
            <div className="progress-info">
              <div className="progress-stats">
                <p>
                  <strong>{t('imports.progress')}:</strong> {importProgress.current} / {importProgress.total}
                </p>
                <p>
                  <strong>{t('imports.successful')}:</strong> {importProgress.successful}
                </p>
                <p>
                  <strong>{t('imports.errors')}:</strong> {importProgress.errors}
                </p>
                {importProgress.estimatedTimeRemaining > 0 && (
                  <p>
                    <strong>{t('imports.estimatedTime')}:</strong> {formatTime(importProgress.estimatedTimeRemaining)}
                  </p>
                )}
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {showPreview && preview && (
          <div className="preview-section">
            <h3>{t('imports.previewTitle')}</h3>
            <div className="preview-stats">
              <p><strong>{t('imports.totalRecords')}:</strong> {preview.total}</p>
              <p><strong>{t('imports.errorsFound')}:</strong> {preview.errores.length}</p>
            </div>
            {preview.errores.length > 0 && (
              <div className="preview-errors">
                <h4>{t('imports.errors')}:</h4>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                  {t('imports.errorsNote')}
                </p>
                <ul>
                  {preview.errores.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.registros.length > 0 && (
              <div className="preview-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t('common.email')}</th>
                      <th>{t('common.name')}</th>
                      <th>{t('common.lastName')}</th>
                      {preview.registros.some((reg: any) => reg.tipoMembresia) && (
                        <th>{t('subscribers.membershipType')}</th>
                      )}
                      {preview.registros.some((reg: any) => reg.telefono) && <th>{t('common.phone')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.registros.map((reg: any, index: number) => (
                      <tr key={index}>
                        <td>{reg.email}</td>
                        <td>{reg.nombre}</td>
                        <td>{reg.apellido}</td>
                        {preview.registros.some((r: any) => r.tipoMembresia) && (
                          <td>{reg.tipoMembresia ? reg.tipoMembresia.toUpperCase() : '-'}</td>
                        )}
                        {preview.registros.some((r: any) => r.telefono) && <td>{reg.telefono || '-'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="history-section">
        <h2>{t('imports.history')}</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.user')}</th>
                <th>{t('common.file')}</th>
                <th>{t('common.records')}</th>
                <th>{t('common.successful')}</th>
                <th>{t('common.errors')}</th>
              </tr>
            </thead>
            <tbody>
              {importaciones?.map((imp: any, index: number) => (
                <tr key={imp.id || imp._id || `${imp.fecha}-${imp.nombreArchivo}-${index}`}>
                  <td>{new Date(imp.fecha).toLocaleString()}</td>
                  <td>{imp.usuario?.nombre || imp.usuario?.username}</td>
                  <td>{imp.nombreArchivo}</td>
                  <td>{imp.cantidadRegistros}</td>
                  <td className="success">{imp.registrosExitosos}</td>
                  <td className="error">{imp.registrosConError}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Importaciones;
