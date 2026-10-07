import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import './Kiosco.css';

const KioscoNinos = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [checkType, setCheckType] = useState<'check_in' | 'check_out'>('check_in');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);
  const scannerResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    successAudioRef.current = new Audio('/success.mp3');
    errorAudioRef.current = new Audio('/error.mp3');
    
    startScanner();
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
      if (scannerResumeTimeoutRef.current) {
        clearTimeout(scannerResumeTimeoutRef.current);
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

  const startScanner = async () => {
    try {
      setScanning(true);
      scannerRef.current = new Html5Qrcode('qr-reader');
      
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {}
      );
    } catch (error) {
      console.error('Error starting scanner:', error);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
      setScanning(false);
    } catch (error) {
      console.error('Error stopping scanner:', error);
    }
  };

  const handleScan = async (codigoQR: string) => {
    if (scannerPaused) return;

    setLoading(true);
    setResult(null);
    setScannerPaused(true);

    try {
      const response = await api.post('/ninos-kiosco/validar-ingreso', {
        codigoQR: codigoQR.trim(),
        tipo: checkType === 'check_in' ? 'checkin' : 'checkout'
      });

      setResult(response.data);
      
      if (response.data.permitido) {
        playSuccessSound();
        showToast(t(`childrenKiosk.${checkType}Success`), 'success');
      } else {
        playErrorSound();
        showToast(response.data.motivo || t('childrenKiosk.cannotEnter'), 'error');
      }

      setTimeout(() => {
        setResult(null);
        setScannerPaused(false);
      }, 5000);
    } catch (error: any) {
      playErrorSound();
      const errorMessage = error.response?.data?.error || error.response?.data?.motivo || t('childrenKiosk.notFound');
      showToast(errorMessage, 'error');
      setResult({
        permitido: false,
        motivo: errorMessage,
        nino: null
      });
      setScannerPaused(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kiosco">
      <div className="kiosco-header">
        <h1>{t('childrenKiosk.title')}</h1>
        <div className="check-type-selector">
          <button
            className={`btn ${checkType === 'check_in' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCheckType('check_in')}
          >
            {t('childrenKiosk.checkIn')}
          </button>
          <button
            className={`btn ${checkType === 'check_out' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCheckType('check_out')}
          >
            {t('childrenKiosk.checkOut')}
          </button>
        </div>
      </div>

      <div className="kiosco-content">
        <div className="qr-scanner-container">
          <div id="qr-reader" style={{ width: '100%', maxWidth: '500px' }}></div>
          {!scanning && (
            <button onClick={startScanner} className="btn btn-primary">
              {t('childrenKiosk.scanQR')}
            </button>
          )}
          {scanning && (
            <button onClick={stopScanner} className="btn btn-secondary">
              {t('kiosk.stop')}
            </button>
          )}
        </div>

        {loading && (
          <div className="kiosco-loading">
            <p>{t('childrenKiosk.scanning')}</p>
          </div>
        )}

        {result && result.nino && (
          <div className={`kiosco-result ${result.permitido ? (result.requierePago ? 'warning' : 'success') : 'error'}`}>
            <div className="result-header">
              <h2>{result.permitido ? (result.tipo === 'check_out' ? t('childrenKiosk.checkOutSuccess') : t('childrenKiosk.checkInSuccess')) : result.motivo}</h2>
            </div>

            {result.requierePago && (
              <div className="pago-requerido-banner">
                <div className="pago-icono">💳</div>
                <div className="pago-texto">
                  <strong>Se requiere pago de ${result.montoPago} USD</strong>
                  <p>Es el niño #{result.ninosIngresadosHoy} del día. Por favor cobrar en recepción.</p>
                </div>
              </div>
            )}

            <div className="child-info-card">
              <div className="child-photo-container">
                {result.nino.foto ? (
                  <img src={result.nino.foto} alt={`${result.nino.nombre} ${result.nino.apellido}`} />
                ) : (
                  <div className="photo-placeholder">
                    {result.nino.nombre.charAt(0)}{result.nino.apellido.charAt(0)}
                  </div>
                )}
              </div>

              <div className="child-details">
                <h3>{result.nino.nombre} {result.nino.apellido}</h3>
                {(() => {
                  const membresia = result.nino.padres?.[0]?.tipoMembresia;
                  if (!membresia) return null;
                  const isGold = membresia === 'gold' || membresia.includes('gold');
                  const isSilver = membresia === 'silver';
                  if (isGold) return <span className="membresia-badge gold">Gold</span>;
                  if (isSilver) return <span className="membresia-badge silver">Silver</span>;
                  return null;
                })()}
              </div>
            </div>

            {result.nino.padres && result.nino.padres.length > 0 && (
              <div className="parents-info">
                <h4>{t('childrenKiosk.parentsInfo')}</h4>
                <div className="parents-grid">
                  {result.nino.padres.map((padre: any, idx: number) => (
                    <div key={padre.id || idx} className="parent-card">
                      {padre.foto ? (
                        <img src={padre.foto} alt={`${padre.nombre} ${padre.apellido}`} />
                      ) : (
                        <div className="parent-photo-placeholder">
                          {padre.nombre.charAt(0)}{padre.apellido.charAt(0)}
                        </div>
                      )}
                      <div className="parent-info">
                        <p><strong>{padre.nombre} {padre.apellido}</strong></p>
                        {padre.email && <p>{padre.email}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !result && (
          <div className="kiosco-waiting">
            <p>{t('childrenKiosk.waiting')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KioscoNinos;
