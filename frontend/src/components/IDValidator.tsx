import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './IDValidator.css';

const IDValidator = () => {
  const { t } = useLanguage();
  const [idDocumento, setIdDocumento] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const validatorRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const clampToViewport = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };

    const margin = 10;
    const width = validatorRef.current?.offsetWidth || 320;
    const height = validatorRef.current?.offsetHeight || 280;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);

    return {
      x: Math.min(Math.max(x, margin), maxX),
      y: Math.min(Math.max(y, margin), maxY)
    };
  }, []);

  useEffect(() => {
    const initializePosition = () => {
      if (typeof window === 'undefined') return;
      const margin = 20;
      const width = validatorRef.current?.offsetWidth || 320;
      const height = validatorRef.current?.offsetHeight || 280;
      const startX = window.innerWidth - width - margin;
      const startY = window.innerHeight - height - margin;
      setPosition(clampToViewport(startX, startY));
    };

    const frameId = window.requestAnimationFrame(initializePosition);
    return () => window.cancelAnimationFrame(frameId);
  }, [clampToViewport]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampToViewport(prev.x, prev.y));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampToViewport]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextX = event.clientX - dragOffsetRef.current.x;
      const nextY = event.clientY - dragOffsetRef.current.y;
      setPosition(clampToViewport(nextX, nextY));
    };

    const stopDragging = () => {
      setIsDragging(false);
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [isDragging, clampToViewport]);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const rect = validatorRef.current?.getBoundingClientRect();
    if (!rect) return;

    event.preventDefault();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    setIsDragging(true);
  };

  const validateID = async () => {
    if (!idDocumento.trim()) {
      return;
    }

    setLoading(true);
    setResult(null);
    setShowResult(false);

    try {
      const response = await api.post('/registros/validar-ingreso', {
        tipo: 'id',
        valor: idDocumento.trim()
      });
      
      setResult(response.data);
      setShowResult(true);
      
      // Ocultar resultado después de 5 segundos
      setTimeout(() => {
        setShowResult(false);
        setIdDocumento('');
      }, 5000);
    } catch (error: any) {
      setResult({
        permitido: false,
        motivo: error.response?.data?.error || t('kiosk.validationError')
      });
      setShowResult(true);
      
      setTimeout(() => {
        setShowResult(false);
        setIdDocumento('');
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      validateID();
    }
  };

  return (
    <div
      ref={validatorRef}
      className={`id-validator ${isDragging ? 'dragging' : ''} ${isMinimized ? 'minimized' : ''}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <div
        className="id-validator-header draggable"
        onPointerDown={handleDragStart}
      >
        <h3>{t('kiosk.validateID')}</h3>
        <button
          className="id-validator-minimize-btn"
          onClick={(e) => { e.stopPropagation(); setIsMinimized(prev => !prev); }}
          title={isMinimized ? t('kiosk.maximize') : t('kiosk.minimize')}
        >
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>
      <div className="id-validator-content">
        <div className="id-validator-input-group">
          <input
            type="text"
            value={idDocumento}
            onChange={(e) => setIdDocumento(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('kiosk.enterId')}
            className="id-validator-input"
            disabled={loading}
          />
          <button
            onClick={validateID}
            disabled={loading || !idDocumento.trim()}
            className="id-validator-button"
          >
            {loading ? t('kiosk.validating') : t('kiosk.validate')}
          </button>
        </div>
        
        {showResult && result && (
          <div className={`id-validator-result ${result.permitido ? 'success' : 'error'}`}>
            {result.permitido ? (
              <div className="id-validator-success">
                <div className="id-validator-icon success">✓</div>
                <div className="id-validator-message">
                  <strong>{t('kiosk.allowed')}</strong>
                  {result.invitado && (
                    <div className="id-validator-guest-info">
                      <div>{result.invitado.nombre} {result.invitado.apellido}</div>
                      {result.suscriptor && (
                        <div className="id-validator-subscriber">
                          {t('kiosk.subscriber')}: {result.suscriptor.nombre} {result.suscriptor.apellido}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="id-validator-error">
                <div className="id-validator-icon error">✗</div>
                <div className="id-validator-message">
                  <strong>{t('kiosk.denied')}</strong>
                  <div className="id-validator-motive">{result.motivo}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IDValidator;
