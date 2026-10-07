import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import QRCode from 'react-qr-code';
import api from '../services/api';
import { useSuscriptorAuth } from '../contexts/SuscriptorAuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import WelcomeModal from '../components/WelcomeModal';
import './Invitados.css';
import './SuscriptorDashboard.css';

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

const DEFAULT_TURNOS_CONFIG: GuarderiaConfig = {
  disponibilidad: buildDefaultDisponibilidad()
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

const formatDateKey = (dateKey: string, locale: string) => {
  if (!ISO_DATE_RE.test(dateKey)) return '-';
  const [year, month, day] = dateKey.split('-');
  return locale === 'es-ES' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
};

const formatTurnoDate = (dateInput: string | Date | undefined, locale: string) => {
  const key = toDateKey(dateInput);
  return key ? formatDateKey(key, locale) : '-';
};

const getWeekdayShortFromDateKey = (dateKey: string, locale: string) => {
  if (!ISO_DATE_RE.test(dateKey)) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return utcNoon.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
};

const SuscriptorDashboard = () => {
  const { suscriptor, requiereCambioPassword, updateSuscriptor, logout } = useSuscriptorAuth();
  const { language, setLanguage, t } = useLanguage();
  const { showToast } = useToast();
  const isGold = suscriptor?.tipoMembresia === 'gold';
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    fotoPerfil: null as File | null,
    activo: true,
    waiverAceptado: false
  });
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showTemporalQrModal, setShowTemporalQrModal] = useState(false);
  const [selectedInvitadoQr, setSelectedInvitadoQr] = useState<any>(null);
  const [temporalQrValue, setTemporalQrValue] = useState('');
  const [temporalQrExpiresAt, setTemporalQrExpiresAt] = useState<string | null>(null);
  const [temporalQrSecondsLeft, setTemporalQrSecondsLeft] = useState(0);
  const [generatingTemporalQr, setGeneratingTemporalQr] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invitados' | 'ninos' | 'turnos'>('invitados');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileShowCamera, setProfileShowCamera] = useState(false);
  const [profileCapturedImage, setProfileCapturedImage] = useState<string | null>(null);
  const profileVideoRef = useRef<HTMLVideoElement>(null);
  const profileCanvasRef = useRef<HTMLCanvasElement>(null);
  const profileStreamRef = useRef<MediaStream | null>(null);
  const temporalQrRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const temporalQrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Estados para niños
  const [showNinoModal, setShowNinoModal] = useState(false);
  const [editingNino, setEditingNino] = useState<any>(null);
  const [ninoFormData, setNinoFormData] = useState({
    nombre: '',
    apellido: '',
    fechaNacimiento: '',
    foto: null as File | null,
  });
  const [ninoCapturedImage, setNinoCapturedImage] = useState<string | null>(null);
  const [ninoShowCamera, setNinoShowCamera] = useState(false);
  const ninoVideoRef = useRef<HTMLVideoElement>(null);
  const ninoStreamRef = useRef<MediaStream | null>(null);
  const ninoCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Estados para turnos
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTurnoIds, setSelectedTurnoIds] = useState<string[]>([]);
  const [reserveNinoId, setReserveNinoId] = useState('');
  const [isBatchReserving, setIsBatchReserving] = useState(false);
  
  // Estados para el flujo de primera vez
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  // Aplicar tema oscuro/claro
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  // Pedir foto de perfil si no tiene
  useEffect(() => {
    if (suscriptor && !suscriptor.foto) {
      setShowPhotoPrompt(true);
    }
  }, [suscriptor]);

  // Si no es gold, mover a la primera pestaña disponible
  useEffect(() => {
    if (!isGold && activeTab === 'invitados') {
      setActiveTab('ninos');
    }
  }, [isGold, activeTab]);
  
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) {
      showToast(language === 'es' ? 'Sube una foto para continuar' : 'Please upload a photo to continue', 'warning');
      return;
    }
    try {
      setUploadingPhoto(true);
      const form = new FormData();
      form.append('foto', photoFile);
      const response = await api.post('/suscriptores/mi-foto', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateSuscriptor({ foto: response.data?.foto || null });
      showToast(language === 'es' ? 'Foto actualizada' : 'Photo updated', 'success');
      if (profileCapturedImage && profileCapturedImage.startsWith('blob:')) {
        URL.revokeObjectURL(profileCapturedImage);
      }
      stopProfileCamera();
      setPhotoFile(null);
      setProfileCapturedImage(null);
      setShowPhotoPrompt(false);
    } catch (error: any) {
      console.error('Error subiendo foto de suscriptor', error);
      showToast(language === 'es' ? 'No se pudo subir la foto' : 'Unable to upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();

  // Obtener invitados del suscriptor actual (sin filtros)
  const { data: invitados } = useQuery(
    ['invitados', 'suscriptor', suscriptor?.id],
    async () => {
      if (!suscriptor?.id) return [];
      const params = new URLSearchParams();
      params.append('suscriptor', suscriptor.id);
      params.append('activo', 'true'); // Solo mostrar activos
      const response = await api.get(`/invitados?${params.toString()}`);
      return response.data;
    },
    { enabled: !!suscriptor?.id }
  );

  // Obtener niños del suscriptor actual
  const { data: ninos } = useQuery(
    ['ninos', 'suscriptor', suscriptor?.id],
    async () => {
      if (!suscriptor?.id) return [];
      const response = await api.get(`/ninos?suscriptor=${suscriptor.id}`);
      return response.data;
    },
    { enabled: !!suscriptor?.id }
  );

  // Obtener turnos disponibles
  const { data: turnos } = useQuery(
    ['turnos', selectedMonth],
    async () => {
      const [year, month] = selectedMonth.split('-');
      const response = await api.get(`/turnos?anio=${year}&mes=${month}`);
      return response.data;
    }
  );

  const { data: turnosConfig } = useQuery(
    ['turnos-config'],
    async () => {
      const response = await api.get('/turnos/config');
      return response.data as GuarderiaConfig;
    }
  );

  const guarderiaConfig: GuarderiaConfig = useMemo(
    () =>
      turnosConfig
        ? { disponibilidad: normalizarDisponibilidad(turnosConfig.disponibilidad) }
        : DEFAULT_TURNOS_CONFIG,
    [turnosConfig]
  );

  // Obtener reservas del suscriptor
  const { data: reservas } = useQuery(
    ['reservas', suscriptor?.id],
    async () => {
      if (!suscriptor?.id) return [];
      const response = await api.get(`/turnos/reservas/suscriptor/${suscriptor.id}`);
      return response.data;
    },
    { enabled: !!suscriptor?.id }
  );

  // Mostrar welcome modal después del login (si no lo ha visto)
  useEffect(() => {
    if (!suscriptor || requiereCambioPassword) return;

    if (!localStorage.getItem(`welcome_seen_${suscriptor.id}`)) {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        localStorage.setItem(`welcome_seen_${suscriptor.id}`, 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [suscriptor, requiereCambioPassword]);

  // Cuando se cierra el welcome modal, verificar si necesita cambiar contraseña
  const handleWelcomeClose = () => {
    setShowWelcomeModal(false);
    localStorage.setItem(`welcome_seen_${suscriptor?.id}`, 'true');
  };

  // Toggle de idioma
  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (ninoStreamRef.current) {
        ninoStreamRef.current.getTracks().forEach(track => track.stop());
        ninoStreamRef.current = null;
      }
      if (profileStreamRef.current) {
        profileStreamRef.current.getTracks().forEach(track => track.stop());
        profileStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (profileCapturedImage && profileCapturedImage.startsWith('blob:')) {
        URL.revokeObjectURL(profileCapturedImage);
      }
    };
  }, [profileCapturedImage]);

  const startCamera = async () => {
    try {
      // Limpiar stream anterior si existe
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

      // Mostrar la cámara primero para que el elemento video esté en el DOM
      setShowCamera(true);

      // Esperar un momento para que React renderice el elemento video
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
        const video = videoRef.current;
        video.srcObject = stream;
        
        // Asegurar que el video se reproduzca
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Video reproduciéndose correctamente');
            })
            .catch(err => {
              console.error('Error al reproducir video:', err);
              // Intentar reproducir de nuevo después de un momento
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.play().catch(e => {
                    console.error('Error al reintentar reproducir:', e);
                  });
                }
              }, 200);
            });
        }

        // También usar onloadedmetadata como respaldo
        video.onloadedmetadata = () => {
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(err => {
              console.error('Error al reproducir desde onloadedmetadata:', err);
            });
          }
        };

        // Forzar reproducción cuando el video esté listo
        video.oncanplay = () => {
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(err => {
              console.error('Error al reproducir desde oncanplay:', err);
            });
          }
        };
      } else {
        console.error('videoRef.current es null');
        setShowCamera(false);
      }
    } catch (error: any) {
      console.error('Error al acceder a la cámara:', error);
      setShowCamera(false);
      let errorMessage = t('common.cameraAccessError');
      if (error.name === 'NotAllowedError') {
        errorMessage = t('common.cameraPermissionDenied');
      } else if (error.name === 'NotFoundError') {
        errorMessage = t('common.cameraNotFound');
      } else if (error.name === 'NotReadableError') {
        errorMessage = t('common.cameraInUse');
      }
        showToast(errorMessage, 'error');
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
            const file = new File([blob], 'foto-perfil.jpg', { type: 'image/jpeg' });
            setFormData({ ...formData, fotoPerfil: file });
            setCapturedImage(URL.createObjectURL(blob));
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const stopProfileCamera = () => {
    if (profileStreamRef.current) {
      profileStreamRef.current.getTracks().forEach((track) => track.stop());
      profileStreamRef.current = null;
    }
    if (profileVideoRef.current) {
      profileVideoRef.current.srcObject = null;
    }
    setProfileShowCamera(false);
  };

  const startProfileCamera = async () => {
    try {
      stopProfileCamera();

      const isSecure = window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (!isSecure) {
        showToast(t('common.cameraRequiresHttps'), 'warning');
        return;
      }

      setProfileShowCamera(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      profileStreamRef.current = stream;

      if (profileVideoRef.current) {
        profileVideoRef.current.srcObject = stream;
        profileVideoRef.current.play().catch(() => {});
      }
    } catch (error: any) {
      stopProfileCamera();
      if (error.name === 'NotAllowedError') {
        showToast(t('common.cameraPermissionDenied'), 'error');
      } else if (error.name === 'NotFoundError') {
        showToast(t('common.cameraNotFound'), 'error');
      } else if (error.name === 'NotReadableError') {
        showToast(t('common.cameraInUse'), 'error');
      } else {
        showToast(t('common.cameraAccessError'), 'error');
      }
    }
  };

  const clearProfileCapturedImage = () => {
    if (profileCapturedImage && profileCapturedImage.startsWith('blob:')) {
      URL.revokeObjectURL(profileCapturedImage);
    }
    setProfileCapturedImage(null);
    setPhotoFile(null);
  };

  const captureProfilePhoto = () => {
    if (!profileVideoRef.current || !profileCanvasRef.current) return;

    const video = profileVideoRef.current;
    const canvas = profileCanvasRef.current;

    if (!video.videoWidth || !video.videoHeight) {
      showToast(t('common.cameraAccessError'), 'error');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'foto-suscriptor.jpg', { type: 'image/jpeg' });
      if (profileCapturedImage && profileCapturedImage.startsWith('blob:')) {
        URL.revokeObjectURL(profileCapturedImage);
      }
      setPhotoFile(file);
      setProfileCapturedImage(URL.createObjectURL(blob));
      stopProfileCamera();
    }, 'image/jpeg', 0.9);
  };

  const createMutation = useMutation(
    async (data: FormData) => {
      const response = await api.post('/invitados', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invitados'] });
        setShowModal(false);
        resetForm();
      },
      onError: (error: any) => {
        const backendError = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg;
        const backendDetails = error.response?.data?.details;
        const errorMessage = backendDetails
          ? `${backendError || t('guests.createError')}: ${backendDetails}`
          : (backendError || error.message || t('guests.createError'));
        showToast(errorMessage, 'error');
      }
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }: { id: string; data: FormData }) => {
      const response = await api.put(`/invitados/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invitados'] });
        setShowModal(false);
        resetForm();
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
        setDeletingId(null);
        showToast(t('guests.deletedSuccess'), 'success');
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || t('guests.deleteError'), 'error');
        setDeletingId(null);
      }
    }
  );

  const clearTemporalQrTimers = useCallback(() => {
    if (temporalQrRefreshTimeoutRef.current) {
      clearTimeout(temporalQrRefreshTimeoutRef.current);
      temporalQrRefreshTimeoutRef.current = null;
    }
    if (temporalQrIntervalRef.current) {
      clearInterval(temporalQrIntervalRef.current);
      temporalQrIntervalRef.current = null;
    }
  }, []);

  const generateTemporalQr = useCallback(async (invitadoId: string) => {
    setGeneratingTemporalQr(true);
    try {
      const response = await api.post(`/invitados/${invitadoId}/qr-temporal`);
      const qrTemporal = response.data?.qrTemporal as string | undefined;
      const expiresAt = response.data?.expiresAt as string | undefined;

      if (!qrTemporal || !expiresAt) {
        throw new Error('Respuesta inválida al generar QR temporal');
      }

      setTemporalQrValue(qrTemporal);
      setTemporalQrExpiresAt(expiresAt);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || t('guests.temporaryQrError');
      showToast(errorMessage, 'error');
    } finally {
      setGeneratingTemporalQr(false);
    }
  }, [showToast, t]);

  // Mutaciones para niños
  const createNinoMutation = useMutation(
    async (data: FormData) => {
      const response = await api.post('/ninos', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['ninos'] });
        setShowNinoModal(false);
        resetNinoForm();
        showToast(t('children.createdSuccess'), 'success');
      },
      onError: (error: any) => {
        const backendError = error.response?.data?.error;
        const backendDetails = error.response?.data?.details;
        const errorMessage = backendDetails ? `${backendError || t('children.createError')}: ${backendDetails}` : (backendError || t('children.createError'));
        showToast(errorMessage, 'error');
      }
    }
  );
   

  // Mutaciones para turnos
  const reserveMutation = useMutation(
    async (data: any) => {
      const response = await api.post('/turnos/reservar', data);
      return response.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['turnos'] });
        queryClient.invalidateQueries({ queryKey: ['reservas'] });
        setReserveNinoId('');
        setSelectedTurnoIds([]);

        const items = Array.isArray(data) ? data : [];
        const ok = items.filter((i: any) => !i.error).length;
        const errs = items.filter((i: any) => i.error);

        if (ok) {
          showToast(
            language === 'es'
              ? `Reserva${ok > 1 ? 's' : ''} confirmada${ok > 1 ? 's' : ''}`
              : `Booking${ok > 1 ? 's' : ''} confirmed`,
            'success'
          );
        }

        errs.forEach((e: any) => {
          showToast(e.error || t('shifts.reservationError'), 'error');
        });
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || t('shifts.reservationError'), 'error');
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
        queryClient.invalidateQueries({ queryKey: ['reservas'] });
        showToast(t('shifts.cancelSuccess'), 'success');
      }
    }
  );


  // Helpers de calendario/turnos
  const dayLabels: Record<DayKey, string> = {
    monday: t('shifts.mondayShort'),
    tuesday: t('shifts.tuesdayShort'),
    wednesday: t('shifts.wednesdayShort'),
    thursday: t('shifts.thursdayShort'),
    friday: t('shifts.fridayShort'),
    saturday: t('shifts.saturdayShort'),
    sunday: t('shifts.sundayShort')
  };

  const horarioParaFecha = (fechaStr: string) => {
    if (!fechaStr) return [];
    const fecha = new Date(`${fechaStr}T00:00:00`);
    const dayKey = DAY_KEY_BY_INDEX[fecha.getDay()];
    return guarderiaConfig.disponibilidad[dayKey] || [];
  };

  const fechaHabilitada = (fechaStr: string) => horarioParaFecha(fechaStr).some(Boolean);
  const resumenHorario = () =>
    DAY_KEYS
      .map((day) => `${dayLabels[day]} ${(guarderiaConfig.disponibilidad[day] || []).filter(Boolean).length}h`)
      .join(' · ');

  const locale = language === 'es' ? 'es-ES' : 'en-US';

  type DiaItem = { tipo: 'dia'; fecha: string } | { tipo: 'pad' };

  const diasDelMes: DiaItem[] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    if (!y || !m) return [];
    const first = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // lunes=0
    const items: DiaItem[] = Array.from({ length: offset }, () => ({ tipo: 'pad' }));
    for (let i = 1; i <= lastDay; i++) {
      const key = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      items.push({ tipo: 'dia', fecha: key });
    }
    return items;
  }, [selectedMonth]);

  const turnosPorDia = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    (turnos || []).forEach((turno: any) => {
      const key = toDateKey(turno.fecha);
      if (!key) return;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(turno);
    });
    Object.keys(grouped).forEach((k) => {
      grouped[k] = grouped[k].sort((a, b) => a.hora.localeCompare(b.hora));
    });
    return grouped;
  }, [turnos]);

  useEffect(() => {
    const todayKey = toDateKey(new Date()) || new Date().toISOString().split('T')[0];
    const dayItems = diasDelMes.filter((d): d is { tipo: 'dia'; fecha: string } => d.tipo === 'dia');
    const availableDays = dayItems
      .map((d) => d.fecha)
      .filter((fecha) => {
        const isPast = fecha < todayKey;
        if (isPast) return false;
        const hasTurnos = !!turnosPorDia[fecha];
        const enabled = fechaHabilitada(fecha);
        return hasTurnos || enabled;
      });

    let nextSelectedDay = '';
    if (availableDays.includes(todayKey)) {
      nextSelectedDay = todayKey;
    } else if (availableDays.length) {
      nextSelectedDay = availableDays[0];
    }

    setSelectedDay((prev) => (prev === nextSelectedDay ? prev : nextSelectedDay));
    setSelectedTurnoIds((prev) => (prev.length ? [] : prev));
  }, [turnosPorDia, diasDelMes, guarderiaConfig]);

  const turnosDelDia = selectedDay ? turnosPorDia[selectedDay] || [] : [];
  const diaSeleccionadoHabilitado = selectedDay ? fechaHabilitada(selectedDay) : false;

  useEffect(() => {
    return () => {
      clearTemporalQrTimers();
    };
  }, [clearTemporalQrTimers]);

  useEffect(() => {
    if (!showTemporalQrModal || !selectedInvitadoQr || !temporalQrExpiresAt) {
      return;
    }

    clearTemporalQrTimers();

    const invitadoId = selectedInvitadoQr._id || selectedInvitadoQr.id;
    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(temporalQrExpiresAt).getTime() - Date.now()) / 1000)
      );
      setTemporalQrSecondsLeft(remaining);
      return remaining;
    };

    updateCountdown();
    temporalQrIntervalRef.current = setInterval(updateCountdown, 1000);

    const refreshInMs = Math.max(
      0,
      new Date(temporalQrExpiresAt).getTime() - Date.now() - 5000
    );
    temporalQrRefreshTimeoutRef.current = setTimeout(() => {
      if (invitadoId) {
        generateTemporalQr(invitadoId);
      }
    }, refreshInMs);

    return () => {
      clearTemporalQrTimers();
    };
  }, [
    clearTemporalQrTimers,
    generateTemporalQr,
    selectedInvitadoQr,
    showTemporalQrModal,
    temporalQrExpiresAt
  ]);


  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      fotoPerfil: null,
      activo: true,
      waiverAceptado: false
    });
    setEditing(null);
    setCapturedImage(null);
    setShowCamera(false);
  };

  const resetNinoForm = () => {
    setNinoFormData({
      nombre: '',
      apellido: '',
      fechaNacimiento: '',
      foto: null,
    });
    setEditingNino(null);
    setNinoCapturedImage(null);
    stopNinoCamera();
  };

  const stopNinoCamera = () => {
    if (ninoStreamRef.current) {
      ninoStreamRef.current.getTracks().forEach(track => track.stop());
      ninoStreamRef.current = null;
    }
    if (ninoVideoRef.current) {
      ninoVideoRef.current.srcObject = null;
    }
    setNinoShowCamera(false);
  };

  const startNinoCamera = async () => {
    try {
      if (ninoStreamRef.current) {
        ninoStreamRef.current.getTracks().forEach(track => track.stop());
        ninoStreamRef.current = null;
      }

      const isSecure = window.location.protocol === 'https:' ||
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';

      if (!isSecure) {
        showToast(t('common.cameraRequiresHttps'), 'warning');
        return;
      }

      setNinoShowCamera(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      ninoStreamRef.current = stream;

      if (ninoVideoRef.current) {
        ninoVideoRef.current.srcObject = stream;
        ninoVideoRef.current.play().catch(() => {});
      }
    } catch (error: any) {
      stopNinoCamera();
      if (error.name === 'NotAllowedError') {
        showToast(t('common.cameraPermissionDenied'), 'error');
      } else if (error.name === 'NotFoundError') {
        showToast(t('common.cameraNotFound'), 'error');
      } else if (error.name === 'NotReadableError') {
        showToast(t('common.cameraInUse'), 'error');
      } else {
        showToast(t('common.cameraAccessError'), 'error');
      }
    }
  };

  const handleEdit = (invitado: any) => {
    setEditing(invitado);
    setFormData({
      nombre: invitado.nombre,
      apellido: invitado.apellido,
      email: invitado.email || '',
      telefono: invitado.telefono || '',
      fotoPerfil: null,
      activo: invitado.activo,
      waiverAceptado: Boolean(invitado.waiverAceptado)
    });
    setCapturedImage(invitado.fotoPerfil || null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!suscriptor?.id) {
      showToast(t('guests.missingSubscriber'), 'error');
      return;
    }
    
    // La foto es requerida solo al crear, no al editar
    if (!formData.fotoPerfil && !editing && !capturedImage) {
      showToast(t('common.profilePhoto') + ' ' + t('common.requiredField'), 'warning');
      return;
    }

    if (!formData.waiverAceptado) {
      showToast(t('guests.waiverRequired'), 'warning');
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', formData.nombre);
    formDataToSend.append('apellido', formData.apellido);
    if (formData.email) {
      formDataToSend.append('email', formData.email);
    }
    if (formData.telefono) {
      formDataToSend.append('telefono', formData.telefono);
    }
    formDataToSend.append('suscriptor', suscriptor.id);
    formDataToSend.append('activo', formData.activo.toString());
    formDataToSend.append('waiverAceptado', formData.waiverAceptado ? 'true' : 'false');
    
    if (formData.fotoPerfil) {
      formDataToSend.append('fotoPerfil', formData.fotoPerfil);
    }

    if (editing) {
      updateMutation.mutate({ id: editing._id || editing.id, data: formDataToSend });
    } else {
      createMutation.mutate(formDataToSend);
    }
  };

  const handleDelete = async (invitado: any) => {
    if (!window.confirm(`${t('guests.deleteConfirm')} ${invitado.nombre} ${invitado.apellido}?`)) {
      return;
    }
    setDeletingId(invitado._id || invitado.id);
    deleteMutation.mutate(invitado._id || invitado.id);
  };

  const closeTemporalQrModal = () => {
    clearTemporalQrTimers();
    setShowTemporalQrModal(false);
    setSelectedInvitadoQr(null);
    setTemporalQrValue('');
    setTemporalQrExpiresAt(null);
    setTemporalQrSecondsLeft(0);
    setGeneratingTemporalQr(false);
  };

  const handleShowTemporalQr = async (invitado: any) => {
    const invitadoId = invitado._id || invitado.id;
    if (!invitadoId) {
      showToast(t('guests.temporaryQrError'), 'error');
      return;
    }

    setSelectedInvitadoQr(invitado);
    setShowTemporalQrModal(true);
    setTemporalQrValue('');
    setTemporalQrExpiresAt(null);
    setTemporalQrSecondsLeft(0);
    await generateTemporalQr(invitadoId);
  };

  const handleViewQRNino = (nino: any) => {
    if (!nino.codigoQR) {
      showToast(t('children.noQr'), 'warning');
      return;
    }
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    const qrLink = `${frontendUrl}/mi-codigo/${encodeURIComponent(nino.codigoQR)}`;
    window.open(qrLink, '_blank');
  };

  if (!suscriptor) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div className="invitados suscriptor-dashboard">
      {/* Modales del flujo de primera vez */}
      {requiereCambioPassword && <ChangePasswordModal />}
      {showWelcomeModal && <WelcomeModal onClose={handleWelcomeClose} />}
      {showPhotoPrompt && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{language === 'es' ? 'Sube tu foto de perfil' : 'Upload your profile photo'}</h3>
            <p className="helper-text">
              {language === 'es'
                ? 'Debes subir tu foto para continuar usando el portal.'
                : 'You must upload your photo to continue using the portal.'}
            </p>
            <div className="form-group">
              {!profileShowCamera && !profileCapturedImage && (
                <div>
                  <button
                    type="button"
                    onClick={startProfileCamera}
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
                      const file = e.target.files?.[0] || null;
                      if (!file) return;
                      if (profileCapturedImage && profileCapturedImage.startsWith('blob:')) {
                        URL.revokeObjectURL(profileCapturedImage);
                      }
                      setPhotoFile(file);
                      setProfileCapturedImage(URL.createObjectURL(file));
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {profileShowCamera && (
                <div className="camera-container">
                  <video
                    ref={profileVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', maxWidth: '400px', borderRadius: '5px' }}
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={captureProfilePhoto}
                      className="btn btn-primary"
                    >
                      {t('common.capture')}
                    </button>
                    <button
                      type="button"
                      onClick={stopProfileCamera}
                      className="btn btn-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {profileCapturedImage && (
                <div style={{ marginTop: '10px' }}>
                  <img
                    src={profileCapturedImage}
                    alt={language === 'es' ? 'Foto seleccionada' : 'Selected photo'}
                    style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '5px', display: 'block' }}
                  />
                  <button
                    type="button"
                    onClick={clearProfileCapturedImage}
                    className="btn btn-secondary"
                    style={{ marginTop: '10px' }}
                  >
                    {t('common.changePhoto')}
                  </button>
                </div>
              )}

              <canvas ref={profileCanvasRef} style={{ display: 'none' }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleUploadPhoto} disabled={uploadingPhoto || !photoFile}>
                {uploadingPhoto ? (language === 'es' ? 'Subiendo...' : 'Uploading...') : (language === 'es' ? 'Guardar' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header con toggle de idioma y tema */}
      <div className="suscriptor-header">
        <div className="suscriptor-header-top">
          <div className="suscriptor-header-title-row">
            <div className="suscriptor-header-title-group">
              <img
                src="/powerhouse-logo.png"
                alt="PowerHouse Gym"
                className="suscriptor-header-logo"
              />
            </div>
            <div className="suscriptor-header-controls">
              <button
                onClick={() => setShowWelcomeModal(true)}
                className="help-icon-button"
                title={language === 'es' ? 'Ver tutorial' : 'View tutorial'}
                aria-label={language === 'es' ? 'Ver tutorial' : 'View tutorial'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </button>
              <button
                onClick={toggleDarkMode}
                className="theme-toggle-button"
                title={isDarkMode ? (language === 'es' ? 'Modo claro' : 'Light mode') : (language === 'es' ? 'Modo oscuro' : 'Dark mode')}
                aria-label={isDarkMode ? (language === 'es' ? 'Modo claro' : 'Light mode') : (language === 'es' ? 'Modo oscuro' : 'Dark mode')}
              >
                {isDarkMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
              <button
                onClick={toggleLanguage}
                className={`lang-toggle-button ${language === 'es' ? 'active' : ''}`}
                title={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
              >
                {language === 'es' ? 'ES' : 'EN'}
              </button>
              <button
                type="button"
                onClick={logout}
                className="suscriptor-logout-button"
                title={t('common.logout')}
                aria-label={t('common.logout')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span className="logout-label">{t('common.logout')}</span>
              </button>
            </div>
          </div>
          <p className="suscriptor-welcome-text">{t('common.welcome')}, {suscriptor.nombre} {suscriptor.apellido}</p>
        </div>
        {activeTab === 'invitados' && (
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary btn-new-guest">
            {t('guests.new')}
          </button>
        )}
        {activeTab === 'ninos' && (
          <button onClick={() => { resetNinoForm(); setShowNinoModal(true); }} className="btn btn-primary btn-new-guest">
            {t('children.new')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="suscriptor-tabs">
        {isGold && (
          <button
            className={`tab-button ${activeTab === 'invitados' ? 'active' : ''}`}
            onClick={() => setActiveTab('invitados')}
          >
            {t('guests.title')}
          </button>
        )}
        <button
          className={`tab-button ${activeTab === 'ninos' ? 'active' : ''}`}
          onClick={() => setActiveTab('ninos')}
        >
          {t('children.title')}
        </button>
        <button
          className={`tab-button ${activeTab === 'turnos' ? 'active' : ''}`}
          onClick={() => setActiveTab('turnos')}
        >
          {t('shifts.title')}
        </button>
      </div>

      {/* Tab Content: Invitados */}
      {activeTab === 'invitados' && (
      <>
      {/* Lista de invitados en cards (responsive) */}
      <div className="invitados-cards-container">
        {invitados && invitados.length > 0 ? (
          invitados.map((inv: any) => {
            const isExpanded = expandedCard === (inv._id || inv.id);
            return (
              <div key={inv._id || inv.id} className={`invitado-card ${isExpanded ? 'expanded' : ''}`}>
                <button
                  className="invitado-card-toggle"
                  onClick={() => setExpandedCard(isExpanded ? null : (inv._id || inv.id))}
                >
                  <div className="invitado-card-header">
                    {inv.fotoPerfil ? (
                      <img 
                        src={inv.fotoPerfil} 
                        alt={`${inv.nombre} ${inv.apellido}`} 
                        className="invitado-card-photo"
                      />
                    ) : (
                      <div className="invitado-card-photo-placeholder">
                        {inv.nombre.charAt(0)}{inv.apellido.charAt(0)}
                      </div>
                    )}
                    <div className="invitado-card-info">
                      <h3>{inv.nombre} {inv.apellido}</h3>
                      <span className={`badge badge-status ${inv.activo ? 'badge-success' : 'badge-error'}`}>
                        {inv.activo ? t('common.active') : t('common.inactive')}
                      </span>
                    </div>
                  </div>
                  <svg 
                    className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                
                {isExpanded && (
                  <div className="invitado-card-expanded-content">
                    <div className="invitado-card-details">
                      {inv.email && (
                        <div className="invitado-card-detail">
                          <span className="detail-label">{t('common.email')}:</span>
                          <span className="detail-value">{inv.email}</span>
                        </div>
                      )}
                      {inv.telefono && (
                        <div className="invitado-card-detail">
                          <span className="detail-label">{t('common.phone')}:</span>
                          <span className="detail-value">{inv.telefono}</span>
                        </div>
                      )}
                      <div className="invitado-card-detail">
                        <span className="detail-label">{t('guests.waiverLabel')}:</span>
                        <span className="detail-value">
                          {inv.waiverAceptado ? t('guests.waiverAccepted') : t('guests.waiverPending')}
                        </span>
                      </div>
                    </div>

                    <div className="invitado-card-actions">
                      <button onClick={() => handleEdit(inv)} className="btn-small btn-secondary">
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleShowTemporalQr(inv)}
                        className="btn-small btn-primary btn-temporal-qr"
                      >
                        {t('guests.showTemporaryQr')}
                      </button>
                      <button
                        onClick={() => handleDelete(inv)}
                        className="btn-small btn-danger"
                        disabled={deletingId === (inv._id || inv.id)}
                      >
                        {deletingId === (inv._id || inv.id) ? t('common.deleting') : t('common.delete')}
                      </button>
                      {!inv.waiverAceptado && (
                        <button
                          onClick={() => {
                            if (!window.confirm(t('guests.waiverConfirm'))) return;
                            const data = new FormData();
                            data.append('waiverAceptado', 'true');
                            updateMutation.mutate({ id: inv._id || inv.id, data });
                          }}
                          className="btn-small btn-primary"
                        >
                          {t('guests.waiverAcceptAction')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="no-invitados">
            <p>{t('common.noData')}</p>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary">
              {t('guests.new')}
            </button>
          </div>
        )}
      </div>
      </>
      )}

      {/* Tab Content: Niños */}
      {activeTab === 'ninos' && (
        <div className="ninos-section">
          <div className="ninos-cards-container">
            {ninos && ninos.length > 0 ? (
              ninos.map((nino: any) => (
                <div key={nino.id || nino._id} className="nino-card">
                  <div className="nino-card-header">
                    {nino.foto ? (
                      <img src={nino.foto} alt={`${nino.nombre} ${nino.apellido}`} className="nino-card-photo" />
                    ) : (
                      <div className="nino-card-photo-placeholder">
                        {nino.nombre.charAt(0)}{nino.apellido.charAt(0)}
                      </div>
                    )}
                    <div className="nino-card-info">
                      <h3>{nino.nombre} {nino.apellido}</h3>
                      <p>{t('children.birthDate')}: {new Date(nino.fechaNacimiento).toLocaleDateString(locale, { timeZone: TIME_ZONE })}</p>
                      <div className="nino-card-actions">
                        {nino.codigoQR && (
                          <button
                            onClick={() => handleViewQRNino(nino)}
                            className="btn-small btn-primary"
                            title={language === 'es' ? 'Ver QR' : 'View QR'}
                            style={{ marginTop: '8px' }}
                          >
                            {t('common.viewCode')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-ninos">
                <p>{t('common.noData')}</p>
                <button onClick={() => { resetNinoForm(); setShowNinoModal(true); }} className="btn btn-primary">
                  {t('children.new')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Turnos */}
      {activeTab === 'turnos' && (
        <div className="turnos-section">
          <div className="turnos-header">
            <div>
              <p className="turnos-subtitle">
                {language === 'es' ? 'Guardería · móvil friendly' : 'Kids club · mobile friendly'}
              </p>
              <h3>{language === 'es' ? 'Agenda y reservas' : 'Schedule & bookings'}</h3>
            </div>
            <div className="month-selector">
              <label>{language === 'es' ? 'Mes' : 'Month'}</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="turnos-calendar">
            {diasDelMes.map((item, idx) => {
              if (item.tipo === 'pad') {
                return <div key={`pad-${idx}`} className="calendar-day pad" aria-hidden="true" />;
              }
              const dia = item.fecha;
              const todayKey = toDateKey(new Date()) || new Date().toISOString().split('T')[0];
              const [, , d] = dia.split('-').map(Number);
              const dayNumber = d;
              const dayName = getWeekdayShortFromDateKey(dia, locale);
              const isSelected = selectedDay === dia;
              const isPast = dia < todayKey;
              const hasTurnos = !!turnosPorDia[dia];
              const dayEnabled = fechaHabilitada(dia);
              const isSelectable = !isPast && (dayEnabled || hasTurnos);
              const className = `calendar-day ${isSelected ? 'selected' : ''} ${!dayEnabled ? 'muted' : ''} ${!isSelectable ? 'disabled' : ''}`;
              return (
                <button
                  key={dia}
                  className={className}
                  onClick={() => {
                    if (!isSelectable) return;
                    setSelectedDay(dia);
                    setSelectedTurnoIds([]);
                  }}
                  disabled={!isSelectable}
                >
                  <span className="day-name">{dayName}</span>
                  <span className="day-number">{dayNumber}</span>
                </button>
              );
            })}
            {!diasDelMes.length && (
              <p className="no-data">{t('common.noData')}</p>
            )}
          </div>

          <div className="turnos-detalle">
            <div className="turnos-horas">
              <div className="turnos-horas-header">
                <span className="helper">{resumenHorario()}</span>
              </div>

              {turnosDelDia.length ? (
                <div className="turnos-horas-grid">
                  {turnosDelDia.map((turno: any) => {
                    const isReserved = reservas?.some((r: any) => r.turno.id === (turno.id || turno._id));
                    const lleno = (turno.cantidadNinos || 0) >= turno.capacidad;
                    const idTurno = turno.id || turno._id;
                    const isSelectedTurno = selectedTurnoIds.includes(idTurno);
                    return (
                      <button
                        key={idTurno}
                        className={`hora-chip ${isSelectedTurno ? 'active' : ''} ${lleno ? 'disabled' : ''}`}
                        onClick={() => {
                          if (lleno) return;
                          setSelectedTurnoIds((prev) =>
                            prev.includes(idTurno) ? prev.filter((id) => id !== idTurno) : [...prev, idTurno]
                          );
                        }}
                        disabled={lleno}
                      >
                        <div className="hora-label">
                          {(() => {
                            const [h, m] = turno.hora.split(':').map(Number);
                            const suffix = h >= 12 ? 'pm' : 'am';
                            const hour12 = h % 12 === 0 ? 12 : h % 12;
                            return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
                          })()}
                        </div>
                        <div className="hora-cap">
                          {lleno ? t('shifts.full') : ''}
                        </div>
                        {isReserved && <span className="badge-mini success">✓</span>}
                        {lleno && <span className="badge-mini error">{t('shifts.full')}</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="no-data">
                  {diaSeleccionadoHabilitado
                    ? (language === 'es' ? 'No hay turnos en este día' : 'No slots for this day')
                    : t('shifts.dayDisabled')}
                </p>
              )}
            </div>

            <div className="turnos-reserva-box">
              <h4>{language === 'es' ? 'Confirmar reserva' : 'Confirm booking'}</h4>
              <p className="helper">{language === 'es' ? 'Elige al niño para este turno.' : 'Choose the child for this slot.'}</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedTurnoIds.length) {
                    showToast(language === 'es' ? 'Selecciona un turno' : 'Select a slot', 'warning');
                    return;
                  }
                  if (!reserveNinoId) {
                    showToast(t('shifts.selectChild'), 'warning');
                    return;
                  }
                const ninoData = ninos?.find((n: any) => (n.id || n._id) === reserveNinoId);
                if (!ninoData) return;
                setIsBatchReserving(true);
                reserveMutation.mutate(
                  selectedTurnoIds.map((turnoId) => ({
                    turno: turnoId,
                    nino: reserveNinoId,
                    suscriptor: suscriptor?.id || (ninoData.padres && ninoData.padres.length > 0 ? ninoData.padres[0].id : '')
                  })),
                  {
                    onSettled: () => setIsBatchReserving(false)
                  }
                );
                }}
              >
                <div className="form-group">
                  <label>{t('shifts.selectChild')}</label>
                  <select
                    value={reserveNinoId}
                    onChange={(e) => setReserveNinoId(e.target.value)}
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!selectedTurnoIds.length || reserveMutation.isLoading || isBatchReserving}
                >
                  {reserveMutation.isLoading || isBatchReserving ? t('common.loading') : t('shifts.reserve')}
                </button>
              </form>

              {reservas && reservas.length > 0 && (
                <div className="reservas-section">
                  <div className="reservas-header">
                    <h5>{language === 'es' ? 'Reservas hechas' : 'My bookings'}</h5>
                    <span className="badge-mini neutral">{reservas.length}</span>
                  </div>
                  <div className="reservas-list">
                    {reservas.map((reserva: any) => (
                      <div key={reserva.id} className="reserva-card">
                        <div>
                          <p className="reserva-title">
                            {formatTurnoDate(reserva.turno.fecha, locale)} · {reserva.turno.hora}
                          </p>
                          <p className="reserva-child">{reserva.nino.nombre} {reserva.nino.apellido}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(t('shifts.cancelReservation') + '?')) {
                              cancelReserveMutation.mutate(reserva.id);
                            }
                          }}
                          className="btn-small btn-danger"
                          disabled={cancelReserveMutation.isLoading}
                        >
                          {t('shifts.cancelReservation')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTemporalQrModal && (
        <div className="modal-overlay" onClick={closeTemporalQrModal}>
          <div className="modal-content temporal-qr-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('guests.temporaryQrTitle')}</h2>
            {selectedInvitadoQr && (
              <p className="temporal-qr-guest">
                {selectedInvitadoQr.nombre} {selectedInvitadoQr.apellido}
              </p>
            )}
            <p className="temporal-qr-description">{t('guests.temporaryQrDescription')}</p>

            <div className="temporal-qr-box">
              {temporalQrValue ? (
                <QRCode
                  value={temporalQrValue}
                  size={512}
                  level="M"
                  style={{ width: '100%', height: 'auto', maxWidth: '380px' }}
                />
              ) : (
                <p>{t('guests.temporaryQrGenerating')}</p>
              )}
            </div>

            <p className="temporal-qr-countdown">
              {t('guests.temporaryQrExpiresIn', { seconds: temporalQrSecondsLeft })}
            </p>
            <p className="temporal-qr-note">{t('guests.memberMustBePresent')}</p>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={closeTemporalQrModal}>
                {t('common.close')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={generatingTemporalQr || !selectedInvitadoQr}
                onClick={() => {
                  const invitadoId = selectedInvitadoQr?._id || selectedInvitadoQr?.id;
                  if (invitadoId) {
                    generateTemporalQr(invitadoId);
                  }
                }}
              >
                {generatingTemporalQr ? t('guests.temporaryQrGenerating') : t('guests.regenerateTemporaryQr')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? t('guests.edit') : t('guests.new')}</h2>
            <form onSubmit={handleSubmit}>
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
                <label>{t('common.email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>{t('common.phone')} {formData.telefono ? '' : `(${t('guests.whatsapp')})`}</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="+1234567890"
                />
                <small style={{ color: '#666', fontSize: '12px' }}>
                  {t('guests.whatsapp')}
                </small>
              </div>
              <div className="form-group">
                <label>{t('common.profilePhoto')} *</label>
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
                        {/* Molde de cara - óvalo grande centrado */}
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
                        {/* Guías para ojos */}
                        <circle cx="170" cy="160" r="15" fill="none" stroke="rgba(9, 164, 81, 0.4)" strokeWidth="2" />
                        <circle cx="230" cy="160" r="15" fill="none" stroke="rgba(9, 164, 81, 0.4)" strokeWidth="2" />
                        {/* Guía para nariz */}
                        <ellipse cx="200" cy="200" rx="8" ry="25" fill="none" stroke="rgba(9, 164, 81, 0.4)" strokeWidth="2" />
                        {/* Guía para boca */}
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

      {/* Modal para crear/editar niño */}
      {showNinoModal && (
        <div className="modal-overlay" onClick={() => { setShowNinoModal(false); resetNinoForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingNino ? t('children.edit') : t('children.new')}</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!suscriptor?.id) {
                showToast('Error: No se pudo identificar el suscriptor', 'error');
                return;
              }
              if (!ninoFormData.foto && !editingNino && !ninoCapturedImage) {
                showToast(t('children.photoRequired'), 'warning');
                return;
              }
              const formDataToSend = new FormData();
              formDataToSend.append('nombre', ninoFormData.nombre);
              formDataToSend.append('apellido', ninoFormData.apellido);
              formDataToSend.append('fechaNacimiento', ninoFormData.fechaNacimiento);
              formDataToSend.append('suscriptor', suscriptor.id);
              if (ninoFormData.foto) {
                formDataToSend.append('foto', ninoFormData.foto);
              }
              createNinoMutation.mutate(formDataToSend);
            }}>
              <div className="form-group">
                <label>{t('common.name')} *</label>
                <input
                  type="text"
                  value={ninoFormData.nombre}
                  onChange={(e) => setNinoFormData({ ...ninoFormData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('common.lastName')} *</label>
                <input
                  type="text"
                  value={ninoFormData.apellido}
                  onChange={(e) => setNinoFormData({ ...ninoFormData, apellido: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('children.birthDate')} *</label>
                <input
                  type="date"
                  value={ninoFormData.fechaNacimiento}
                  onChange={(e) => setNinoFormData({ ...ninoFormData, fechaNacimiento: e.target.value })}
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="form-group">
                <label>{t('children.photo')} *</label>
                {!ninoShowCamera && !ninoCapturedImage && (
                  <div>
                    <button
                      type="button"
                      onClick={startNinoCamera}
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
                          setNinoFormData({ ...ninoFormData, foto: file });
                          setNinoCapturedImage(URL.createObjectURL(file));
                        }
                      }}
                      style={{ width: '100%', marginBottom: '10px' }}
                    />
                  </div>
                )}
                {ninoShowCamera && (
                  <div className="camera-container">
                    <video ref={ninoVideoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: '400px', borderRadius: '5px' }} />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (ninoVideoRef.current && ninoCanvasRef.current) {
                            const canvas = ninoCanvasRef.current;
                            const video = ninoVideoRef.current;
                            if (!video.videoWidth || !video.videoHeight) {
                              showToast(t('common.cameraAccessError'), 'error');
                              return;
                            }
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                              ctx.drawImage(video, 0, 0);
                              canvas.toBlob((blob) => {
                                if (blob) {
                                  const file = new File([blob], 'foto-nino.jpg', { type: 'image/jpeg' });
                                  setNinoFormData((prev) => ({ ...prev, foto: file }));
                                  setNinoCapturedImage(URL.createObjectURL(blob));
                                  stopNinoCamera();
                                }
                              }, 'image/jpeg', 0.9);
                            }
                          }
                        }}
                        className="btn btn-primary"
                      >
                        {t('common.capture')}
                      </button>
                      <button
                        type="button"
                        onClick={stopNinoCamera}
                        className="btn btn-secondary"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
                {ninoCapturedImage && (
                  <div style={{ marginTop: '10px' }}>
                    <img src={ninoCapturedImage} alt="Foto capturada" style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '5px', display: 'block' }} />
                    <button
                      type="button"
                      onClick={() => {
                        setNinoCapturedImage(null);
                        setNinoFormData({ ...ninoFormData, foto: null });
                      }}
                      className="btn btn-secondary"
                      style={{ marginTop: '10px' }}
                    >
                      {t('common.changePhoto')}
                    </button>
                  </div>
                )}
                <canvas ref={ninoCanvasRef} style={{ display: 'none' }} />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => { setShowNinoModal(false); resetNinoForm(); }} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={createNinoMutation.isLoading}>
                  {createNinoMutation.isLoading ? t('common.saving') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SuscriptorDashboard;
