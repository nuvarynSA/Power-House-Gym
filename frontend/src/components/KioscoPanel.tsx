import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import './KioscoPanel.css';

interface KioscoPanelProps {
  onClose?: () => void;
  preferredFacingMode?: 'user' | 'environment';
}

const KioscoPanel = ({ onClose, preferredFacingMode = 'user' }: KioscoPanelProps) => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [result, setResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showArms, setShowArms] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  useEffect(() => {
    // Cargar el sonido de error
    errorAudioRef.current = new Audio('/error.mp3');
    errorAudioRef.current.volume = 0.7;
    
    // Iniciar escáner automáticamente al montar el componente
    startScanner();
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
      if (errorAudioRef.current) {
        errorAudioRef.current.pause();
        errorAudioRef.current = null;
      }
    };
  }, []);
  
  // Limpiar cuando se cierra el modal
  useEffect(() => {
    if (!onClose) {
      return;
    }
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          try {
            const clearResult = scannerRef.current?.clear();
            if (clearResult && typeof (clearResult as any).then === 'function') {
              (clearResult as Promise<void>).catch(() => {});
            }
          } catch (error) {
            // Ignorar errores en cleanup
          }
        });
      }
    };
  }, [onClose]);

  const resumeScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
      } catch (err: any) {
        console.error('Error al reanudar escáner:', err);
        startScanner();
      }
    }
    setScannerPaused(false);
  };

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Sonido de éxito: dos tonos ascendentes
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
      // Ignorar errores al reproducir sonido
    }
  };

  const playErrorSound = () => {
    try {
      if (errorAudioRef.current) {
        errorAudioRef.current.currentTime = 0;
        errorAudioRef.current.play().catch(() => {});
      }
    } catch (error) {
      console.warn('Error al reproducir sonido de error:', error);
    }
  };

  const validateIngreso = async (valor: string) => {
    setScannerPaused(true);

    setResult(null);
    setShowPopup(false);
    setShowArms(false);

    // Detener el escáner mientras se valida
    if (scannerRef.current) {
      try {
        await scannerRef.current.pause();
      } catch (error) {
        console.error('Error al pausar escáner:', error);
      }
    }

    try {
      const response = await api.post('/registros/validar-ingreso', {
        tipo: 'codigoQR',
        valor: valor.trim()
      });
      
      setResult(response.data);

      // Mostrar popup y animaciones
      setShowPopup(true);
      
      if (response.data.permitido) {
        playSuccessSound();
        setShowArms(true);
      } else {
        playErrorSound();
      }
      
      // Ocultar popup después de 2 segundos, pero los brazos se ocultan después de la animación
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
      popupTimeoutRef.current = setTimeout(() => {
        setShowPopup(false);
        // Esperar a que termine la animación de salida de los brazos (1.2s) antes de ocultarlos
        setTimeout(() => {
          setShowArms(false);
        }, 1200);
        setResult(null);
        
        // Reanudar el escáner después de que terminen todas las animaciones
        if (cooldownRef.current) clearTimeout(cooldownRef.current);
        cooldownRef.current = setTimeout(() => {
          resumeScanner();
        }, 2000);
      }, 2000);
      
    } catch (error: any) {
      setResult({
        permitido: false,
        motivo: error.response?.data?.error || 'Error al validar ingreso'
      });
      playErrorSound();
      setShowPopup(true);
      
      // Ocultar popup después de 2 segundos
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
      popupTimeoutRef.current = setTimeout(() => {
        setShowPopup(false);
        setResult(null);
        
        if (cooldownRef.current) clearTimeout(cooldownRef.current);
        cooldownRef.current = setTimeout(() => {
          resumeScanner();
        }, 2000);
      }, 2000);
    } finally {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      cooldownRef.current = setTimeout(() => resumeScanner(), 2200);
    }
  };

  const startScanner = async () => {
    try {
      const isSecure = window.isSecureContext ||
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        const msg = t('common.cameraRequiresHttps');
        setScannerMessage(msg);
        showToast(msg, 'error', 9000);
        setScanning(false);
        return;
      }

      setScannerMessage(null);

      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch (error) {
          console.error('Error al limpiar escáner anterior:', error);
        }
        scannerRef.current = null;
      }

      setScanning(true);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const scannerContainer = document.getElementById('kiosco-scanner-container');
      if (!scannerContainer) {
        console.error('Scanner container not found');
        setScanning(false);
        return;
      }

      scannerContainer.innerHTML = '';

      scannerRef.current = new Html5Qrcode('kiosco-scanner-container', {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      });

      setScannerPaused(false);
      lastScanRef.current = '';
      lastScanTimeRef.current = 0;

      const onDecodedText = (decodedText: string) => {
        const now = Date.now();
        if (scannerPaused || showPopup) return;
        if (!decodedText) return;
        if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 1500) {
          return;
        }
        lastScanRef.current = decodedText;
        lastScanTimeRef.current = now;
        setScannerPaused(true);
        validateIngreso(decodedText);
      };

      const scannerConfig = {
        fps: 12,
        qrbox: undefined as undefined,
        aspectRatio: 1.0,
        videoConstraints: {
          facingMode: preferredFacingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } as any
      };

      const facingModes: Array<'user' | 'environment'> = preferredFacingMode === 'environment'
        ? ['environment', 'user']
        : ['user', 'environment'];

      const cameras = await Html5Qrcode.getCameras().catch(() => []);
      const preferredLabelPattern = preferredFacingMode === 'environment'
        ? /(back|rear|environment|tr[áa]sera)/i
        : /(front|user|frontal)/i;
      const fallbackLabelPattern = preferredFacingMode === 'environment'
        ? /(front|user|frontal)/i
        : /(back|rear|environment|tr[áa]sera)/i;
      const preferredCamera = cameras.find((camera) => preferredLabelPattern.test(camera.label));
      const fallbackCamera = cameras.find((camera) => fallbackLabelPattern.test(camera.label));

      const cameraInputs: any[] = [];
      if (preferredCamera?.id) {
        cameraInputs.push({ deviceId: { exact: preferredCamera.id } });
      }
      if (fallbackCamera?.id && fallbackCamera.id !== preferredCamera?.id) {
        cameraInputs.push({ deviceId: { exact: fallbackCamera.id } });
      }
      facingModes.forEach((facingMode) => {
        cameraInputs.push({ facingMode });
      });

      let started = false;
      for (const cameraInput of cameraInputs) {
        try {
          await scannerRef.current.start(
            cameraInput,
            scannerConfig,
            onDecodedText,
            (_errorMessage) => {
              // Ignorar errores de escaneo continuo
            }
          );
          started = true;
          break;
        } catch (scanError) {
          console.log(
            'Error iniciando cámara del kiosko, intentando alternativa:',
            scanError
          );
        }
      }

      if (!started) {
        setScanning(false);
        setScannerMessage(t('common.cameraStartError'));
        showToast(t('common.cameraStartError'), 'error', 9000);
        console.error('Error al iniciar escáner con cámaras frontal y trasera');
      }
    } catch (error) {
      console.error('Error al iniciar escáner:', error);
      setScannerMessage(t('common.cameraStartError'));
      showToast(t('common.cameraStartError'), 'error', 9000);
      setScanning(false);
    }
  };

  return (
    <div className={`kiosco-panel ${onClose ? 'kiosco-modal' : ''}`}>
      {/* Animaciones de brazos */}
      {showArms && result?.permitido && (
        <>
          <div className="kiosco-arm kiosco-arm-left">
            <img src="/LOGO DEGRADAO VERDE-01.png" alt="Arm" />
          </div>
          <div className="kiosco-arm kiosco-arm-right">
            <img src="/LOGO DEGRADAO VERDE-01.png" alt="Arm" style={{ transform: 'scaleX(-1)' }} />
          </div>
        </>
      )}

      {/* Cámara centrada */}
      <div className="kiosco-camera-container">
        {!scanning && !scannerMessage && (
          <p className="kiosco-scanner-hint">{t('kiosk.startingCamera')}</p>
        )}
        {scannerMessage && (
          <p className="kiosco-scanner-hint kiosco-scanner-hint-error">{scannerMessage}</p>
        )}
        <div id="kiosco-scanner-container" className="kiosco-scanner-container"></div>
      </div>

      {/* Popup grande de resultado */}
      {showPopup && result && (
        <div className={`kiosco-popup ${showPopup ? 'show' : ''} ${result.permitido ? 'success' : 'error'}`}>
          <div className="kiosco-popup-content">
            {result.permitido && result.invitado ? (
              <div className="kiosco-popup-success">
                <div className="kiosco-popup-icon success">✓</div>
                <h1 className="kiosco-popup-title success">{t('kiosk.allowed')}</h1>
                {result.invitado.fotoPerfil && (
                  <div className="kiosco-popup-photo">
                    <img 
                      src={result.invitado.fotoPerfil} 
                      alt={`${result.invitado.nombre} ${result.invitado.apellido}`}
                    />
                  </div>
                )}
                <div className="kiosco-popup-info">
                  <div className="kiosco-popup-guest-name">
                    <strong>{t('kiosk.guest')}:</strong> {result.invitado.nombre} {result.invitado.apellido}
                  </div>
                  {result.suscriptor && (
                    <div className="kiosco-popup-subscriber-name">
                      <strong>{t('kiosk.subscriber')}:</strong> {result.suscriptor.nombre} {result.suscriptor.apellido}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="kiosco-popup-error">
                <div className="kiosco-popup-icon error">✗</div>
                <h1 className="kiosco-popup-title error">{t('kiosk.denied')}</h1>
                <p className="kiosco-popup-motive">{result.motivo}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KioscoPanel;
