import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useLanguage } from '../contexts/LanguageContext';
import './MiCodigo.css';

const MiCodigo = () => {
  const { t } = useLanguage();
  const { codigo } = useParams<{ codigo: string }>();
  const [invitado, setInvitado] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvitado = async () => {
      try {
        if (codigo) {
          const apiUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
          const codigoEncoded = encodeURIComponent(codigo);

          // 1. Buscar como invitado (endpoint ahora devuelve 200 con datos, 403 inactivo, 404 no existe)
          const invitadoResponse = await fetch(`${apiUrl}/invitados/publico/codigo-qr/${codigoEncoded}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          if (invitadoResponse.ok) {
            // 200 — invitado activo encontrado
            const data = await invitadoResponse.json();
            if (data) {
              setInvitado(data);
              return;
            }
          } else if (invitadoResponse.status === 403) {
            // Invitado existe pero está inactivo
            const errData = await invitadoResponse.json().catch(() => ({}));
            setErrorMsg(errData.error || 'Este invitado está inactivo.');
            setInvitado(null);
            return;
          } else if (invitadoResponse.status === 404) {
            // No encontrado como invitado → intentar como niño
          } else {
            // Otro error inesperado
            const errData = await invitadoResponse.json().catch(() => ({}));
            console.error('Error al obtener invitado:', errData);
          }

          // 2. Si no es invitado, buscar en niños
          const ninoResponse = await fetch(`${apiUrl}/ninos-kiosco/publico/codigo-qr/${codigoEncoded}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          if (ninoResponse.ok) {
            const ninoData = await ninoResponse.json();
            if (ninoData) {
              setInvitado({ tipo: 'nino', ...ninoData });
              return;
            }
          }

          setInvitado(null);
          return;
        }
      } catch (error: any) {
        console.error('Error al obtener invitado:', error);
        setInvitado(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInvitado();
  }, [codigo]);

  if (loading) {
    return (
      <div className="mi-codigo-container">
        <div className="mi-codigo-content">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!invitado) {
    return (
      <div className="mi-codigo-container">
        <div className="mi-codigo-content">
          <h1>{errorMsg ? '⚠️ Acceso denegado' : t('mycode.notFound')}</h1>
          <p>{errorMsg || t('mycode.invalid')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mi-codigo-container">
      <div className="mi-codigo-content">
        <div className="mi-codigo-header">
          <img src="/powerhouse-logo.png" alt="PowerHouse Gym" className="mi-codigo-logo" />
          <h1>{t('layout.title')}</h1>
          <p>{t('mycode.title')}</p>
        </div>

        <div className="invitado-info">
          <h2>{invitado.nombre} {invitado.apellido}</h2>
          <p className="dni">{t('common.id')}: {invitado.idDocumento || invitado.dni}</p>
          {invitado.suscriptor && (
            <p className="suscriptor">
              Suscriptor: {invitado.suscriptor.nombre} {invitado.suscriptor.apellido}
            </p>
          )}
        </div>

        <div className="codes-container">
          {invitado.codigoQR && (
            <div className="qr-container">
              <div className="qr-label">{t('mycode.qr')}</div>
              <div className="qr-wrapper">
                <QRCode
                  value={invitado.codigoQR}
                  size={200}
                  level="M"
                />
              </div>
              <p className="qr-code">{invitado.codigoQR}</p>
            </div>
          )}
        </div>

        <div className="instrucciones">
          <h3>{t('mycode.instructions')}:</h3>
          <ol>
            <li>{t('mycode.instruction1')}</li>
            <li>{t('mycode.instruction2')}</li>
            <li>{t('mycode.instruction3')}</li>
          </ol>
          <p className="nota">
            <strong>{t('mycode.note')}:</strong> {t('mycode.noteText')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MiCodigo;
