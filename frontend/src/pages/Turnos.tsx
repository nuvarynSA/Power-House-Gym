import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import './Turnos.css';

const TIME_ZONE = 'America/New_York';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type GuarderiaConfig = {
  disponibilidad: Record<DayKey, boolean[]>;
};

const DAY_KEYS: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_KEY_BY_INDEX: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const crearDisponibilidadDia = (inicio: number, fin: number, habilitado: boolean) => {
  const horas = Array.from({ length: 24 }, () => false);
  if (!habilitado) return horas;
  const start = Math.max(0, Math.min(23, inicio));
  const end = Math.max(0, Math.min(23, fin));
  for (let h = start; h <= end; h++) {
    horas[h] = true;
  }
  return horas;
};

const buildDefaultDisponibilidad = () => {
  const weekday = crearDisponibilidadDia(5, 23, true);
  return {
    monday: [...weekday],
    tuesday: [...weekday],
    wednesday: [...weekday],
    thursday: [...weekday],
    friday: [...weekday],
    saturday: crearDisponibilidadDia(6, 21, true),
    sunday: crearDisponibilidadDia(8, 20, true)
  };
};

const normalizarDisponibilidad = (raw: any): Record<DayKey, boolean[]> => {
  const fallback = buildDefaultDisponibilidad();
  if (!raw || typeof raw !== 'object') return fallback;
  const normalized: Record<DayKey, boolean[]> = { ...fallback };
  DAY_KEYS.forEach((day) => {
    if (Array.isArray(raw[day])) {
      normalized[day] = Array.from({ length: 24 }, (_, idx) => Boolean(raw[day][idx]));
    }
  });
  return normalized;
};

const DEFAULT_CONFIG: GuarderiaConfig = {
  disponibilidad: buildDefaultDisponibilidad()
};

const obtenerDisponibilidadDia = (fechaStr: string, config: GuarderiaConfig) => {
  if (!fechaStr) return [];
  const fecha = new Date(`${fechaStr}T00:00:00`);
  const dayKey = DAY_KEY_BY_INDEX[fecha.getDay()];
  return config.disponibilidad[dayKey] || [];
};

const generarHorasDisponibles = (fechaStr: string, config: GuarderiaConfig): string[] => {
  const disponibilidad = obtenerDisponibilidadDia(fechaStr, config);
  return disponibilidad
    .map((activo, hour) => (activo ? `${hour.toString().padStart(2, '0')}:00` : null))
    .filter(Boolean) as string[];
};

const toDateKey = (input: string | Date | undefined) => {
  if (!input) return '';
  if (typeof input === 'string' && ISO_DATE_RE.test(input)) {
    return input;
  }

  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
};

const Turnos = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState<GuarderiaConfig>(DEFAULT_CONFIG);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showChildrenModal, setShowChildrenModal] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState<any>(null);
  const [reserveForm, setReserveForm] = useState({
    fecha: '',
    hora: '',
    nino: ''
  });
  const today = new Date();
  const [filters, setFilters] = useState({
    fecha: '',
    mes: String(today.getMonth() + 1).padStart(2, '0'),
    anio: String(today.getFullYear())
  });

  const { data: configData } = useQuery(['turnos-config'], async () => {
    const response = await api.get('/turnos/config');
    return response.data as GuarderiaConfig;
  });

  const guarderiaConfig: GuarderiaConfig = configData
    ? { disponibilidad: normalizarDisponibilidad(configData.disponibilidad) }
    : DEFAULT_CONFIG;
  const dayLabels: Record<DayKey, string> = {
    monday: t('shifts.mondayShort'),
    tuesday: t('shifts.tuesdayShort'),
    wednesday: t('shifts.wednesdayShort'),
    thursday: t('shifts.thursdayShort'),
    friday: t('shifts.fridayShort'),
    saturday: t('shifts.saturdayShort'),
    sunday: t('shifts.sundayShort')
  };
  const dayHeaders: Record<DayKey, string> = {
    monday: t('shifts.monday'),
    tuesday: t('shifts.tuesday'),
    wednesday: t('shifts.wednesday'),
    thursday: t('shifts.thursday'),
    friday: t('shifts.friday'),
    saturday: t('shifts.saturday'),
    sunday: t('shifts.sunday')
  };
  const horasDelDia = Array.from({ length: 24 }, (_, idx) => idx);
  const resumenHorario = (config: GuarderiaConfig) =>
    DAY_KEYS
      .map((day) => {
        const count = config.disponibilidad[day]?.filter(Boolean).length || 0;
        return `${dayLabels[day]} ${count}h`;
      })
      .join(' · ');

  useEffect(() => {
    if (configData) {
      setConfigForm({
        disponibilidad: normalizarDisponibilidad(configData.disponibilidad)
      });
    }
  }, [configData]);

  const { data: turnos, refetch: refetchTurnos } = useQuery(
    ['turnos', filters],
    async () => {
      const params = new URLSearchParams();
      if (filters.fecha) params.append('fecha', filters.fecha);
      if (filters.mes) params.append('mes', filters.mes);
      if (filters.anio) params.append('anio', filters.anio);
      const response = await api.get(`/turnos/admin-reservados?${params.toString()}`);
      return response.data;
    }
  );

  const { data: ninos } = useQuery(
    ['ninos', 'all'],
    async () => {
      const response = await api.get('/ninos');
      return response.data;
    }
  );

  // Crear slots no aplica: solo se reservan horas hardcodeadas

  const updateConfigMutation = useMutation(
    async (data: GuarderiaConfig) => {
      const response = await api.put('/turnos/config', data);
      return response.data;
    },
    {
      onSuccess: (data) => {
        setConfigForm({ disponibilidad: normalizarDisponibilidad(data.disponibilidad) });
        queryClient.invalidateQueries({ queryKey: ['turnos-config'] });
        showToast(t('shifts.configSaved'), 'success');
        setShowConfigModal(false);
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || t('shifts.configError'), 'error');
      }
    }
  );

  const reserveMutation = useMutation(
    async (data: any) => {
      const response = await api.post('/turnos/reservar', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['turnos'] });
        setShowReserveModal(false);
        resetReserveForm();
        showToast(t('shifts.reserveSuccess'), 'success');
      },
      onError: (error: any) => {
        if (Array.isArray(error.response?.data)) {
          const mensajes = error.response.data.map((e: any) => e.error || e.msg).join(', ');
          showToast(mensajes || t('shifts.reserveError'), 'error');
        } else {
          showToast(error.response?.data?.error || t('shifts.reserveError'), 'error');
        }
      }
    }
  );

  const cancelReserveMutation = useMutation(
    async (id: string) => {
      const response = await api.delete(`/turnos/reservar/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['turnos'] });
        showToast(t('shifts.cancelSuccess'), 'success');
      }
    }
  );

  const resetReserveForm = () => {
    setReserveForm({
      fecha: '',
      hora: '',
      nino: ''
    });
  };

  const toggleDisponibilidad = (dia: DayKey, hora: number) => {
    setConfigForm((prev) => {
      const dayHours = prev.disponibilidad[dia] || Array(24).fill(false);
      const updated = [...dayHours];
      updated[hora] = !updated[hora];
      return {
        ...prev,
        disponibilidad: {
          ...prev.disponibilidad,
          [dia]: updated
        }
      };
    });
  };

  const handleViewChildren = (turno: any) => {
    setSelectedTurno(turno);
    setShowChildrenModal(true);
  };

  const horasDisponibles = useMemo(
    () => generarHorasDisponibles(reserveForm.fecha, guarderiaConfig),
    [reserveForm.fecha, guarderiaConfig]
  );

  useEffect(() => {
    if (!reserveForm.fecha) return;
    const horas = generarHorasDisponibles(reserveForm.fecha, guarderiaConfig);
    if (!horas.length && reserveForm.hora) {
      setReserveForm((prev) => ({ ...prev, hora: '' }));
    } else if (horas.length && !horas.includes(reserveForm.hora)) {
      setReserveForm((prev) => ({ ...prev, hora: horas[0] }));
    }
  }, [guarderiaConfig, reserveForm.fecha, reserveForm.hora]);

  const handleReserveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reserveForm.nino || !reserveForm.fecha || !reserveForm.hora) {
      showToast(t('shifts.selectChild'), 'warning');
      return;
    }
    
    const ninoData = ninos?.find((n: any) => (n.id || n._id) === reserveForm.nino);
    if (!ninoData) {
      showToast(t('shifts.selectChild'), 'warning');
      return;
    }

    const turnoSlot = `slot-${reserveForm.fecha}-${reserveForm.hora}`;

    reserveMutation.mutate({
      turno: turnoSlot,
      nino: reserveForm.nino,
      suscriptor: ninoData.padres && ninoData.padres.length > 0 ? ninoData.padres[0].id : ''
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleSearch = () => {
    refetchTurnos();
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return '-';
    try {
      if (typeof date === 'string' && ISO_DATE_RE.test(date)) {
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year}`;
      }
      return new Date(date).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: TIME_ZONE
      });
    } catch {
      return '-';
    }
  };

  const turnosAgrupados = useMemo(() => {
    if (!turnos) return [];

    const grouped: Record<string, any[]> = {};

    turnos.forEach((t: any) => {
      const key = toDateKey(t.fecha);
      if (!key) return;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([fecha, items]) => ({
        fecha,
        items: (items as any[]).sort((a, b) => a.hora.localeCompare(b.hora))
      }));
  }, [turnos]);

  const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
  const currentYear = today.getFullYear().toString();

  return (
    <div className="turnos">
      <div className="page-header">
        <h1>{t('shifts.title')}</h1>
        <div className="page-actions">
          <button
            onClick={() => {
              setConfigForm(guarderiaConfig);
              setShowConfigModal(true);
            }}
            className="btn btn-secondary"
          >
            {t('shifts.configure')}
          </button>
          <button
            onClick={() => {
              const todayStr = toDateKey(new Date()) || new Date().toISOString().slice(0, 10);
              const horas = generarHorasDisponibles(todayStr, guarderiaConfig);
              setReserveForm({
                fecha: todayStr,
                hora: horas[0] || '',
                nino: ''
              });
              setShowReserveModal(true);
            }}
            className="btn btn-primary"
          >
            {t('shifts.reserve')}
          </button>
        </div>
      </div>
      <p className="schedule-summary">
        {t('shifts.currentSchedule')}: {resumenHorario(guarderiaConfig)}
      </p>

      <div className="filters-section">
        <h2>{t('common.filters')}</h2>
        <div className="filters-grid">
          <div className="form-group">
            <label>{t('shifts.date')}</label>
            <input
              type="date"
              value={filters.fecha}
              onChange={(e) => handleFilterChange('fecha', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>{t('common.month')}</label>
            <input
              type="number"
              min="1"
              max="12"
              value={filters.mes || currentMonth}
              onChange={(e) => handleFilterChange('mes', e.target.value)}
              placeholder="Mes (1-12)"
            />
          </div>
          <div className="form-group">
            <label>{t('common.year')}</label>
            <input
              type="number"
              min="2020"
              max="2100"
              value={filters.anio || currentYear}
              onChange={(e) => handleFilterChange('anio', e.target.value)}
              placeholder="Año"
            />
          </div>
        </div>
        <button onClick={handleSearch} className="btn btn-primary">
          {t('common.search')}
        </button>
      </div>

      <div className="turnos-grid-admin">
        {turnosAgrupados.map((grupo) => (
          <div key={grupo.fecha} className="turnos-group-card">
            <div className="turnos-group-header">
              <h3>{formatDate(grupo.fecha)}</h3>
              <span className="badge">{grupo.items.length} {t('shifts.time')}</span>
            </div>
            <div className="turnos-group-body">
              {grupo.items.map((turno: any) => (
                <div key={turno.id || turno._id || `${turno.fecha}-${turno.hora}`} className="turno-item">
                  <div>
                    <p className="turno-hora">{turno.hora}</p>
                    <p className="turno-cap">{turno.cantidadNinos || 0} / {turno.capacidad}</p>
                  </div>
                  <div className="turno-actions">
                    <button onClick={() => handleViewChildren(turno)} className="btn-small btn-secondary">
                      {t('shifts.viewChildren')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content config-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('shifts.configure')}</h2>
            <p className="helper">{t('shifts.configHelper')}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateConfigMutation.mutate(configForm);
              }}
            >
              <div className="config-table">
                <div className="config-row config-header">
                  {DAY_KEYS.map((day) => (
                    <div key={day} className="config-header-cell">
                      {dayHeaders[day]}
                    </div>
                  ))}
                </div>
                {horasDelDia.map((hour) => (
                  <div key={hour} className="config-row" data-hour={`${hour.toString().padStart(2, '0')}:00`}>
                    {DAY_KEYS.map((day) => {
                      const isActive = configForm.disponibilidad[day]?.[hour];
                      return (
                        <button
                          type="button"
                          key={`${day}-${hour}`}
                          className={`config-slot ${isActive ? 'active' : ''}`}
                          aria-pressed={isActive}
                          aria-label={`${dayHeaders[day]} ${hour.toString().padStart(2, '0')}:00`}
                          onClick={() => toggleDisponibilidad(day, hour)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowConfigModal(false)} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={updateConfigMutation.isLoading}>
                  {updateConfigMutation.isLoading ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReserveModal && (
        <div className="modal-overlay" onClick={() => { setShowReserveModal(false); resetReserveForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{t('shifts.reserve')}</h2>
            <form onSubmit={handleReserveSubmit}>
              <div className="form-group">
                <label>{t('shifts.date')}</label>
                <input
                  type="date"
                  value={reserveForm.fecha}
                  onChange={(e) => {
                    const value = e.target.value;
                    const horas = generarHorasDisponibles(value, guarderiaConfig);
                    setReserveForm((prev) => ({
                      ...prev,
                      fecha: value,
                      hora: horas[0] || ''
                    }));
                  }}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('shifts.time')}</label>
                <select
                  value={reserveForm.hora}
                  onChange={(e) => setReserveForm({ ...reserveForm, hora: e.target.value })}
                  disabled={!reserveForm.fecha}
                  required
                >
                  <option value="">{t('shifts.time')}</option>
                  {reserveForm.fecha && horasDisponibles.map((hora) => (
                    <option key={hora} value={hora}>
                      {hora}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('shifts.selectChild')} *</label>
                <select
                  value={reserveForm.nino}
                  onChange={(e) => setReserveForm({ ...reserveForm, nino: e.target.value })}
                  required
                >
                  <option value="">{t('shifts.selectChild')}</option>
                  {ninos?.map((nino: any) => (
                    <option key={nino.id || nino._id} value={nino.id || nino._id}>
                      {nino.nombre} {nino.apellido}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => { setShowReserveModal(false); resetReserveForm(); }} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('shifts.reserve')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChildrenModal && selectedTurno && (
        <div className="modal-overlay" onClick={() => { setShowChildrenModal(false); setSelectedTurno(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <h2>{t('shifts.children')} - {formatDate(selectedTurno.fecha)} {selectedTurno.hora}</h2>
            {selectedTurno.ninos && selectedTurno.ninos.length > 0 ? (
              <div className="children-list">
                {selectedTurno.ninos.map((ninoData: any, idx: number) => (
                  <div key={idx} className="child-item">
                    {ninoData.foto ? (
                      <img src={ninoData.foto} alt={`${ninoData.nombre} ${ninoData.apellido}`} />
                    ) : (
                      <div className="child-photo-placeholder">
                        {ninoData.nombre.charAt(0)}{ninoData.apellido.charAt(0)}
                      </div>
                    )}
                    <div className="child-item-info">
                      <p><strong>{ninoData.nombre} {ninoData.apellido}</strong></p>
                      {ninoData.suscriptor && (
                        <p>{ninoData.suscriptor.nombre} {ninoData.suscriptor.apellido}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`${t('shifts.cancelReservation')}?`)) {
                          const reservaId = ninoData.reservaId;
                          if (reservaId) {
                            cancelReserveMutation.mutate(reservaId);
                            setShowChildrenModal(false);
                            setSelectedTurno(null);
                          } else {
                            showToast(t('shifts.reservationError'), 'error');
                          }
                        }
                      }}
                      className="btn-small btn-danger"
                    >
                      {t('shifts.cancelReservation')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>{t('shifts.noReservations')}</p>
            )}
            <div className="form-actions">
              <button type="button" onClick={() => { setShowChildrenModal(false); setSelectedTurno(null); }} className="btn btn-secondary">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Turnos;
