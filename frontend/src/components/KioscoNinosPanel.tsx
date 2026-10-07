import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './KioscoPanel.css';

interface KioscoNinosPanelProps {
  onClose?: () => void;
}

const KioscoNinosPanel = ({ onClose }: KioscoNinosPanelProps) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showArms, setShowArms] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  useEffect(() => {
    errorAudioRef.current = new Audio('/error.mp3');
    errorAudioRef.current.volume = 0.7;
    
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

  const validateIngreso = async (codigoQR: string) => {
    setScannerPaused(true);

    setLoading(true);
    setResult(null);
    setShowPopup(false);
    setShowArms(false);

    try {
      const response = await api.post('/ninos-kiosco/validar-ingreso', {
        codigoQR: codigoQR.trim()
      });
      
      setResult(response.data);

      setShowPopup(true);
      
      if (response.data.permitido) {
        playSuccessSound();
        setShowArms(true);
      } else {
        playErrorSound();
      }
      
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
      popupTimeoutRef.current = setTimeout(() => {
        setShowPopup(false);
        setTimeout(() => {
          setShowArms(false);
        }, 1200);
        setResult(null);
        
        if (cooldownRef.current) clearTimeout(cooldownRef.current);
        cooldownRef.current = setTimeout(() => {
          resumeScanner();
        }, 2000);
      }, 5000);
      
    } catch (error: any) {
      setResult({
        permitido: false,
        motivo: error.response?.data?.motivo || error.response?.data?.error || 'Error al validar ingreso',
        nino: error.response?.data?.nino || null
      });
      playErrorSound();
      setShowPopup(true);
      
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
      }, 5000);
    } finally {
      setLoading(false);
      // Reanudar sí o sí tras el cooldown, aunque haya fallado antes
      if (!cooldownRef.current) {
        cooldownRef.current = setTimeout(() => resumeScanner(), 2200);
      }
    }
  };

  const startScanner = async () => {
    try {
      setScannerPaused(false);
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        console.warn('⚠️ Se requiere HTTPS para acceder a la cámara.');
        return;
      }

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

      const scannerContainer = document.getElementById('kiosco-ninos-scanner-container');
      if (!scannerContainer) {
        console.error('Scanner container not found');
        setScanning(false);
        return;
      }

      scannerContainer.innerHTML = '';

      scannerRef.current = new Html5Qrcode('kiosco-ninos-scanner-container', {
        verbose: false
      });

      lastScanRef.current = '';
      lastScanTimeRef.current = 0;

      await scannerRef.current.start(
        {
          facingMode: 'user'
        },
        {
          fps: 10,
          qrbox: undefined,
          aspectRatio: 1.0
        },
        (decodedText) => {
          const now = Date.now();
          if (scannerPaused || showPopup) return;
          if (decodedText && !loading) {
            if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 1500) {
              return;
            }
            lastScanRef.current = decodedText;
            lastScanTimeRef.current = now;
            setScannerPaused(true);
            validateIngreso(decodedText);
          }
        },
        (_errorMessage) => {
          // Ignorar errores de escaneo continuo
        }
      ).catch(async (err) => {
        console.log('Error con cámara frontal, intentando trasera:', err);
        try {
          await scannerRef.current!.start(
            {
              facingMode: 'environment'
            },
            {
              fps: 10,
              qrbox: undefined,
              aspectRatio: 1.0
            },
            (decodedText) => {
              const now = Date.now();
              if (scannerPaused || showPopup) return;
              if (decodedText && !loading) {
                if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 1500) {
                  return;
                }
                lastScanRef.current = decodedText;
                lastScanTimeRef.current = now;
                setScannerPaused(true);
                validateIngreso(decodedText);
              }
            },
            (_errorMessage) => {
              // Ignorar errores de escaneo continuo
            }
          );
        } catch (backError) {
          console.error('Error al iniciar escáner:', backError);
          setScanning(false);
        }
      });
    } catch (error) {
      console.error('Error al iniciar escáner:', error);
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
        {!scanning && (
          <p className="kiosco-scanner-hint">{t('kiosk.startingCamera')}</p>
        )}
        <div id="kiosco-ninos-scanner-container" className="kiosco-scanner-container"></div>
      </div>

      {/* Popup grande de resultado */}
      {showPopup && result && (
        <div className={`kiosco-popup ${showPopup ? 'show' : ''} ${result.permitido ? 'success' : 'error'}`}>
          <div className="kiosco-popup-content">
            {result.permitido && result.nino ? (
              <div className="kiosco-popup-success">
                <div className="kiosco-popup-icon success">✓</div>
                <h1 className="kiosco-popup-title success">
                  {result.tipo === 'check_in' ? t('childrenKiosk.checkInSuccess') : t('childrenKiosk.checkOutSuccess')}
                </h1>
                {result.nino.foto && (
                  <div className="kiosco-popup-photo">
                    <img 
                      src={result.nino.foto} 
                      alt={`${result.nino.nombre} ${result.nino.apellido}`}
                    />
                  </div>
                )}
                <div className="kiosco-popup-info">
                  <div className="kiosco-popup-guest-name">
                    <strong>{t('childrenKiosk.childInfo')}:</strong> {result.nino.nombre} {result.nino.apellido}
                  </div>
                  {result.nino.padres && result.nino.padres.length > 0 && (
                    <div className="kiosco-popup-subscriber-name" style={{ marginTop: '10px' }}>
                      <strong>{t('childrenKiosk.parentsInfo')}:</strong>
                      <div
                        style={{
                          marginTop: '12px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: '16px',
                          justifyItems: 'center'
                        }}
                      >
                        {result.nino.padres.map((padre: any, idx: number) => (
                          <div
                            key={padre.id || idx}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '10px'
                            }}
                          >
                            {padre.foto ? (
                              <img
                                src={padre.foto}
                                alt={`${padre.nombre} ${padre.apellido}`}
                                style={{
                                  width: 110,
                                  height: 110,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '3px solid #09a451',
                                  boxShadow: '0 6px 18px rgba(9,164,81,0.35)'
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 110,
                                  height: 110,
                                  borderRadius: '50%',
                                  background: '#0c301a',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '32px',
                                  fontWeight: 700,
                                  border: '3px solid #09a451'
                                }}
                              >
                                {padre.nombre.charAt(0)}{padre.apellido.charAt(0)}
                              </div>
                            )}
                            <span style={{ fontSize: '18px', textAlign: 'center', color: '#fff' }}>
                              {padre.nombre} {padre.apellido}
                            </span>
                          </div>
                        ))}
                      </div>
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

export default KioscoNinosPanel;
