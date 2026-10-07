import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import './Registros.css';

const TIME_ZONE = 'America/New_York';

const normalizeWhatsAppPhoneUs = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  const lastTenDigits = digits.slice(-10);

  if (lastTenDigits.length !== 10) {
    return '';
  }

  return `1${lastTenDigits}`;
};

interface RegistroNino {
  id: string;
  tipo: 'check_in' | 'check_out';
  fecha: string;
  nino: {
    id: string;
    nombre: string;
    apellido: string;
    foto?: string | null;
    estadoPago?: string;
    padres: { id: string; nombre: string; apellido: string; email?: string; foto?: string | null }[];
  };
}

interface ActiveDaycareNino {
  nino: {
    id: string;
    nombre: string;
    apellido: string;
    foto?: string | null;
    estadoPago?: string;
  };
  registroId: string;
  checkInAt: string;
  minutosEnGuarderia: number;
  telefonoRecordatorio?: string | null;
  padres: {
    id: string;
    nombre: string;
    apellido: string;
    email?: string;
    telefono?: string | null;
    foto?: string | null;
  }[];
}

const RegistrosNinos = () => {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    desde: '',
    hasta: '',
    tipo: '',
    nino: '',
    suscriptor: '',
    page: 1
  });
  const [nowTs, setNowTs] = useState(Date.now());
  const [checkoutingId, setCheckoutingId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const { data: ninos } = useQuery(['ninos', 'all'], async () => {
    const response = await api.get('/ninos');
    return response.data;
  });

  const { data: suscriptores } = useQuery(['suscriptores', 'lista'], async () => {
    const response = await api.get('/suscriptores?habilitado=true');
    return response.data;
  });

  const { data: activosData } = useQuery(
    ['registros-ninos', 'activos'],
    async () => {
      const response = await api.get('/registros-ninos/activos');
      return response.data as { data: ActiveDaycareNino[]; total: number };
    },
    {
      refetchInterval: 15000
    }
  );

  const { data, refetch, isFetching } = useQuery(
    ['registros-ninos', filters],
    async () => {
      const params = new URLSearchParams();
      if (filters.desde) params.append('desde', filters.desde);
      if (filters.hasta) params.append('hasta', filters.hasta);
      if (filters.tipo) params.append('tipo', filters.tipo);
      if (filters.nino) params.append('nino', filters.nino);
      if (filters.suscriptor) params.append('suscriptor', filters.suscriptor);
      params.append('page', String(filters.page));
      params.append('limit', '50');
      const response = await api.get(`/registros-ninos?${params.toString()}`);
      return response.data as { data: RegistroNino[]; total: number; page: number; limit: number };
    }
  );

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'page' ? Number(value) || 1 : value,
      page: key === 'page' ? Number(value) || 1 : 1
    }));
  };

  const handleSearch = () => {
    refetch();
  };

  const handleOpenImage = (src: string, alt: string) => {
    setSelectedImage({ src, alt });
  };

  const handleCloseImage = () => {
    setSelectedImage(null);
  };

  const checkoutManualMutation = useMutation(
    async (ninoId: string) => {
      const response = await api.post(`/registros-ninos/${ninoId}/checkout-manual`);
      return response.data;
    },
    {
      onMutate: (ninoId: string) => {
        setCheckoutingId(ninoId);
      },
      onSuccess: () => {
        showToast(
          language === 'es'
            ? 'Check-out manual registrado correctamente'
            : 'Manual check-out saved successfully',
          'success'
        );
        queryClient.invalidateQueries(['registros-ninos', 'activos']);
        queryClient.invalidateQueries(['registros-ninos']);
      },
      onError: (error: any) => {
        showToast(
          error?.response?.data?.error ||
            (language === 'es' ? 'No se pudo registrar el check-out manual' : 'Unable to save manual check-out'),
          'error'
        );
      },
      onSettled: () => {
        setCheckoutingId(null);
      }
    }
  );

  const activos = useMemo(() => activosData?.data || [], [activosData]);

  const getElapsed = (checkInAt: string) => {
    const diffMs = Math.max(0, nowTs - new Date(checkInAt).getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { hours, minutes, seconds, totalMinutes };
  };

  const formatElapsed = (checkInAt: string) => {
    const elapsed = getElapsed(checkInAt);
    return `${String(elapsed.hours).padStart(2, '0')}:${String(elapsed.minutes).padStart(2, '0')}:${String(elapsed.seconds).padStart(2, '0')}`;
  };

  const handleReminderWhatsApp = (item: ActiveDaycareNino) => {
    const telefono = normalizeWhatsAppPhoneUs(
      item.telefonoRecordatorio || item.padres.find((p) => !!p.telefono)?.telefono || ''
    );

    if (!telefono) {
      showToast(
        language === 'es'
          ? 'No hay teléfono disponible para enviar recordatorio'
          : 'There is no phone number to send a reminder',
        'warning'
      );
      return;
    }

    const horaIngreso = new Date(item.checkInAt).toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', {
      timeZone: TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit'
    });

    const mensaje =
      language === 'es'
        ? `Hola, recordatorio: ${item.nino.nombre} ${item.nino.apellido} está en la guardería desde las ${horaIngreso}. Por favor realiza el check-out al retirarlo. Gracias.`
        : `Hello, reminder: ${item.nino.nombre} ${item.nino.apellido} has been in daycare since ${horaIngreso}. Please complete check-out when picking them up. Thank you.`;

    const whatsappUrl = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  const totalPages = data?.limit ? Math.ceil((data?.total || 0) / data.limit) : 1;

  return (
    <div className="registros">
      <h1>{t('childRecords.title')}</h1>

      <div className="active-daycare-section">
        <div className="active-daycare-header">
          <h2>
            {language === 'es'
              ? 'Niños actualmente en guardería'
              : 'Children currently in daycare'}
          </h2>
          <span className="active-daycare-count">{activos.length}</span>
        </div>

        {activos.length > 0 ? (
          <div className="active-daycare-grid">
            {activos.map((item) => {
              const elapsed = getElapsed(item.checkInAt);
              const isOverHourAndHalf = elapsed.totalMinutes >= 90;
              const isOverHour = elapsed.totalMinutes >= 60 && elapsed.totalMinutes < 90;
              const cardStatusClass = isOverHourAndHalf
                ? 'active-daycare-card-overhourhalf'
                : isOverHour
                  ? 'active-daycare-card-overhour'
                  : '';
              const counterStatusClass = isOverHourAndHalf
                ? 'active-daycare-counter-critical'
                : isOverHour
                  ? 'active-daycare-counter-warning'
                  : '';
              const telefonoContacto =
                item.telefonoRecordatorio ||
                item.padres.find((p) => !!p.telefono)?.telefono ||
                null;
              return (
                <div
                  key={`${item.nino.id}-${item.registroId}`}
                  className={`active-daycare-card ${cardStatusClass}`}
                >
                  <div className="active-daycare-card-top">
                    <div className="active-daycare-avatar">
                      {item.nino.foto ? (
                        <button
                          type="button"
                          className="active-daycare-avatar-button"
                          onClick={() => handleOpenImage(item.nino.foto as string, `${item.nino.nombre} ${item.nino.apellido}`)}
                          aria-label={`Ver foto de ${item.nino.nombre} ${item.nino.apellido}`}
                        >
                          <img src={item.nino.foto} alt={`${item.nino.nombre} ${item.nino.apellido}`} />
                        </button>
                      ) : (
                        <span>
                          {item.nino.nombre.charAt(0)}
                          {item.nino.apellido.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3>{item.nino.nombre} {item.nino.apellido}</h3>
                      <p>
                        {language === 'es' ? 'Desde' : 'Since'}:{' '}
                        {new Date(item.checkInAt).toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', {
                          timeZone: TIME_ZONE,
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className={`active-daycare-counter ${counterStatusClass}`}>
                        {language === 'es' ? 'Tiempo' : 'Time'}: {formatElapsed(item.checkInAt)}
                      </p>
                    </div>
                  </div>

                  <div className="active-daycare-parents">
                    {item.padres.map((p) => (
                      <span key={p.id} className="active-daycare-parent-pill">
                        {p.nombre} {p.apellido}
                      </span>
                    ))}
                  </div>

                  <div className="active-daycare-phone">
                    <strong>{language === 'es' ? 'Teléfono de papá/mamá:' : 'Parent phone:'}</strong>{' '}
                    {telefonoContacto ? (
                      <a href={`tel:${telefonoContacto}`} className="active-daycare-phone-link">
                        {telefonoContacto}
                      </a>
                    ) : (
                      <span>{language === 'es' ? 'No disponible' : 'Not available'}</span>
                    )}
                  </div>

                  <div className="active-daycare-actions">
                    <button
                      onClick={() => checkoutManualMutation.mutate(item.nino.id)}
                      className="btn btn-primary"
                      disabled={checkoutingId === item.nino.id}
                    >
                      {checkoutingId === item.nino.id
                        ? (language === 'es' ? 'Guardando...' : 'Saving...')
                        : (language === 'es' ? 'Marcar checkout' : 'Mark checkout')}
                    </button>
                    <button
                      onClick={() => handleReminderWhatsApp(item)}
                      className="btn btn-secondary"
                    >
                      {language === 'es' ? 'Enviar recordatorio' : 'Send reminder'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="active-daycare-empty">
            {language === 'es'
              ? 'No hay niños actualmente en guardería.'
              : 'There are no children currently in daycare.'}
          </p>
        )}
      </div>

      <div className="filters-section">
        <h2>{t('common.filters')}</h2>
        <div className="filters-grid">
          <div className="form-group">
            <label>{t('records.dateFrom')}</label>
            <input
              type="date"
              value={filters.desde}
              onChange={(e) => handleFilterChange('desde', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>{t('records.dateTo')}</label>
            <input
              type="date"
              value={filters.hasta}
              onChange={(e) => handleFilterChange('hasta', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>{t('childrenKiosk.type')}</label>
            <select
              value={filters.tipo}
              onChange={(e) => handleFilterChange('tipo', e.target.value)}
            >
              <option value="">{t('records.all')}</option>
              <option value="check_in">Check-in</option>
              <option value="check_out">Check-out</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('children.label')}</label>
            <select
              value={filters.nino}
              onChange={(e) => handleFilterChange('nino', e.target.value)}
            >
              <option value="">{t('records.all')}</option>
              {ninos?.map((n: any) => (
                <option key={n.id || n._id} value={n.id || n._id}>
                  {n.nombre} {n.apellido}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('nav.subscribers')}</label>
            <select
              value={filters.suscriptor}
              onChange={(e) => handleFilterChange('suscriptor', e.target.value)}
            >
              <option value="">{t('records.all')}</option>
              {suscriptores?.map((s: any) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.nombre} {s.apellido}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={handleSearch} className="btn btn-primary" disabled={isFetching}>
          {t('common.search')}
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('children.label')}</th>
              <th>{t('childrenKiosk.parentsInfo')}</th>
              <th>{t('childrenKiosk.type')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.fecha).toLocaleString('es-ES', { timeZone: TIME_ZONE })}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {r.nino.foto && (
                      <button
                        type="button"
                        className="record-photo-button"
                        onClick={() => handleOpenImage(r.nino.foto as string, `${r.nino.nombre} ${r.nino.apellido}`)}
                        aria-label={`Ver foto de ${r.nino.nombre} ${r.nino.apellido}`}
                      >
                        <img
                          src={r.nino.foto}
                          alt={`${r.nino.nombre} ${r.nino.apellido}`}
                          className="record-photo"
                        />
                      </button>
                    )}
                    <div>
                      <div>{r.nino.nombre} {r.nino.apellido}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {r.nino.padres?.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {p.foto && (
                        <img
                          src={p.foto}
                          alt={`${p.nombre} ${p.apellido}`}
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      )}
                      <span>{p.nombre} {p.apellido}</span>
                    </div>
                  ))}
                </td>
                <td>{r.tipo === 'check_in' ? 'Check-in' : 'Check-out'}</td>
              </tr>
            ))}
            {!data?.data?.length && (
              <tr>
                <td colSpan={4}>{t('records.noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > data.limit && (
        <div className="pagination">
          <button
            disabled={filters.page <= 1}
            onClick={() => handleFilterChange('page', String(filters.page - 1))}
          >
            {t('common.prev')}
          </button>
          <span>{filters.page} / {totalPages}</span>
          <button
            disabled={filters.page >= totalPages}
            onClick={() => handleFilterChange('page', String(filters.page + 1))}
          >
            {t('common.next')}
          </button>
        </div>
      )}

      {selectedImage && (
        <div className="image-modal-overlay" onClick={handleCloseImage}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="image-modal-close"
              onClick={handleCloseImage}
              aria-label={t('common.close')}
            >
              ×
            </button>
            <img src={selectedImage.src} alt={selectedImage.alt} className="image-modal-photo" />
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrosNinos;
