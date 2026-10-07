import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import './Kiosco.css';

const Kiosco = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [idDocumento, setIdDocumento] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [showLogoSplash, setShowLogoSplash] = useState(false);
  const idInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoSplashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (idInputRef.current) {
      idInputRef.current.focus();
    }

    // Inicializar elementos de audio
    successAudioRef.current = new Audio('/success.mp3');
    errorAudioRef.current = new Audio('/error.mp3');
    
    // Iniciar escáner automáticamente al montar el componente
    startScanner();
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
      if (scannerResumeTimeoutRef.current) {
        clearTimeout(scannerResumeTimeoutRef.current);
      }
      if (logoSplashTimeoutRef.current) {
        clearTimeout(logoSplashTimeoutRef.current);
      }
      if (successAudioRef.current) {
        successAudioRef.current.pause();
        successAudioRef.current = null;
      }
      if (errorAudioRef.current) {
        errorAudioRef.current.pause();
        errorAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (codigoBarras.length > 0) {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      barcodeTimeoutRef.current = setTimeout(() => {
        if (codigoBarras.trim().length > 0) {
          validateIngreso('barcode', codigoBarras.trim());
          setCodigoBarras('');
        }
      }, 300);
    }

    return () => {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [codigoBarras]);

  const playSuccessSound = () => {
    if (successAudioRef.current) {
      successAudioRef.current.currentTime = 0;
      successAudioRef.current.play().catch(() => {});
    }
  };

  const playErrorSound = () => {
    if (errorAudioRef.current) {
      errorAudioRef.current.currentTime = 0;
      errorAudioRef.current.play().catch(() => {});
    }
  };

  const validateIngreso = async (tipo: 'id' | 'barcode' | 'qr', valor: string, fromCamera: boolean = false) => {
    // Si viene de la cámara y el escáner está pausado, ignorar
    if (fromCamera && scannerPaused) {
      return;
    }

    setLoading(true);
    setResult(null);

    // Si viene de la cámara, marcar como pausado para ignorar nuevas lecturas
    if (fromCamera && scanning) {
      setScannerPaused(true);
    }

    try {
      const tipoBackend = tipo === 'barcode' ? 'codigoBarras' : tipo === 'qr' ? 'codigoQR' : 'id';
      
      const response = await api.post('/registros/validar-ingreso', {
        tipo: tipoBackend,
        valor: valor.trim()
      });
      
      setResult(response.data);

      // Logo splash: después de 2 s mostrar logo grande por 2 s
      if (response.data.permitido) {
        if (logoSplashTimeoutRef.current) clearTimeout(logoSplashTimeoutRef.current);
        logoSplashTimeoutRef.current = setTimeout(() => {
          setShowLogoSplash(true);
          logoSplashTimeoutRef.current = setTimeout(() => {
            setShowLogoSplash(false);
          }, 2000);
        }, 2000);
      }

      // NO reproducir sonidos cuando viene de la cámara
      if (!fromCamera) {
        if (response.data.permitido) {
          playSuccessSound();
        } else {
          playErrorSound();
        }
      }
    } catch (error: any) {
      setResult({
        permitido: false,
        motivo: error.response?.data?.error || 'Error al validar ingreso'
      });
      // NO reproducir sonidos cuando viene de la cámara
      if (!fromCamera) {
        playErrorSound();
      }
    } finally {
      setLoading(false);
      
      // Si viene de la cámara, reactivar después de 2 segundos
      if (fromCamera && scanning) {
        if (scannerResumeTimeoutRef.current) {
          clearTimeout(scannerResumeTimeoutRef.current);
        }
        scannerResumeTimeoutRef.current = setTimeout(() => {
          setScannerPaused(false);
        }, 2000);
      } else {
        // Para ID y barcode, limpiar después de 10 segundos
        setTimeout(() => {
          setIdDocumento('');
          setCodigoBarras('');
          setResult(null);
          setShowLogoSplash(false);
          if (logoSplashTimeoutRef.current) clearTimeout(logoSplashTimeoutRef.current);

          if (idInputRef.current) {
            idInputRef.current.focus();
          }
        }, 10000);
      }
    }
  };

  const handleIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idDocumento.trim()) return;
    await validateIngreso('id', idDocumento);
  };

  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCodigoBarras(e.target.value);
  };

  const handleBarcodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && codigoBarras.trim().length > 0) {
      e.preventDefault();
      validateIngreso('barcode', codigoBarras.trim());
      setCodigoBarras('');
    }
  };

  const startScanner = async () => {
    try {
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        showToast(t('common.cameraRequiresHttps'), 'warning');
        return;
      }

      setScanning(true);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const scannerContainer = document.getElementById('scanner-container');
      if (!scannerContainer) {
        setScanning(false);
        return;
      }

      scannerRef.current = new Html5Qrcode('scanner-container', {
        verbose: false
      });

      await scannerRef.current.start(
        {
          facingMode: 'environment'
        },
        {
          fps: 10,
          qrbox: undefined,
          aspectRatio: 1.0
        },
        (decodedText) => {
          if (decodedText && !loading && !scannerPaused) {
            validateIngreso('qr', decodedText, true);
          }
        },
        (_errorMessage) => {
          // Ignorar errores de escaneo continuo
        }
      ).catch(async () => {
        try {
          await scannerRef.current!.start(
            {
              facingMode: 'user'
            },
            {
              fps: 10,
              qrbox: undefined,
              aspectRatio: 1.0
            },
            (decodedText) => {
              if (decodedText && !loading && !scannerPaused) {
                validateIngreso('qr', decodedText, true);
              }
            },
            (_errorMessage) => {
              // Ignorar errores de escaneo continuo
            }
          );
        } catch {
          setScanning(false);
          showToast(t('common.cameraStartError'), 'error', 8000);
        }
      });
    } catch {
      setScanning(false);
      showToast(t('common.cameraStartError'), 'error', 8000);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // Ignorar errores al detener escáner
      }
      scannerRef.current = null;
    }
    const scannerContainer = document.getElementById('scanner-container');
    if (scannerContainer) {
      scannerContainer.innerHTML = '';
    }
    setScanning(false);
    setScannerPaused(false);
    if (scannerResumeTimeoutRef.current) {
      clearTimeout(scannerResumeTimeoutRef.current);
    }
  };

  return (
    <div className="kiosco-page">
      <div className="kiosco-layout">
        <div className="kiosco-left-column">
          <div className="validation-option">
            <h3>{t('kiosk.mode.id')}</h3>
            <form onSubmit={handleIdSubmit} className="kiosco-form">
              <div className="input-group">
                <label htmlFor="id-documento">{t('kiosk.enterId')}</label>
                <input
                  ref={idInputRef}
                  type="text"
                  id="id-documento"
                  value={idDocumento}
                  onChange={(e) => setIdDocumento(e.target.value)}
                  placeholder="12345678"
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
              <button type="submit" disabled={loading || !idDocumento.trim()} className="submit-button">
                {loading ? 'Validando...' : 'Validar'}
              </button>
            </form>
          </div>

          <div className="validation-option">
            <h3>{t('kiosk.mode.camera')}</h3>
            <div id="scanner-container" className="scanner-container"></div>
            {scanning && (
              <button
                type="button"
                onClick={stopScanner}
                className="submit-button stop-button"
              >
                {t('kiosk.stop')}
              </button>
            )}
            {!scanning && (
              <p className="scanner-hint">
                {t('common.startingCamera')}
              </p>
            )}
          </div>

          <div className="validation-option">
            <h3>{t('kiosk.mode.barcode')}</h3>
            <div className="input-group">
              <label htmlFor="codigo-barras">{t('kiosk.enterBarcode')}</label>
              <input
                ref={barcodeInputRef}
                type="text"
                id="codigo-barras"
                value={codigoBarras}
                onChange={handleBarcodeInput}
                onKeyPress={handleBarcodeKeyPress}
                placeholder="Escanee o ingrese el código"
                disabled={loading}
                autoComplete="off"
                className="barcode-input"
              />
            </div>
            <p className="scanner-hint">
              Conecte el lector de códigos de barras y escanee directamente. 
              La validación se realizará automáticamente.
            </p>
          </div>
        </div>

        <div className="kiosco-right-column">
          {showLogoSplash ? (
            <div className="logo-splash-panel">
              <img src="/powerhouse-logo.png" alt="PowerHouse Gym" className="logo-splash-img" />
            </div>
          ) : result ? (
            <div className={`result-panel ${result.permitido ? 'success' : 'error'}`}>
              <div className="result-status">
                <div className="result-icon-large">
                  {result.permitido ? '✓' : '✗'}
                </div>
                <h2>{result.permitido ? t('kiosk.allowed') : t('kiosk.denied')}</h2>
                <p className="result-motive">{result.motivo}</p>
              </div>

              {result.invitado && (
                <div className="result-guest-info">
                  {result.invitado.fotoPerfil && (
                    <div className="guest-photo">
                      <img 
                        src={result.invitado.fotoPerfil} 
                        alt={`${result.invitado.nombre} ${result.invitado.apellido}`}
                      />
                    </div>
                  )}
                  <div className="guest-details">
                    <h3>Información del Invitado</h3>
                    <p><strong>Nombre:</strong> {result.invitado.nombre} {result.invitado.apellido}</p>
                    <p><strong>{t('common.id')}:</strong> {result.invitado.idDocumento || result.invitado.dni}</p>
                    {result.invitado.email && (
                      <p><strong>Email:</strong> {result.invitado.email}</p>
                    )}
                    {result.suscriptor && (
                      <div className="subscriber-info">
                        <h4>Suscriptor</h4>
                        <p><strong>Nombre:</strong> {result.suscriptor.nombre} {result.suscriptor.apellido}</p>
                        <p><strong>Email:</strong> {result.suscriptor.email}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="result-panel empty">
              <div className="empty-state">
                <p>Esperando validación...</p>
                <p className="empty-hint">Use cualquiera de las opciones a la izquierda para validar un ingreso</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Kiosco;
