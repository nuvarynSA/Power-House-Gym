import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './Registros.css';

const Registros = () => {
  const { t } = useLanguage();
  const [filters, setFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
    permitido: '',
    id: ''
  });
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

  const { data: registros, refetch } = useQuery(
    ['registros', filters],
    async () => {
      const params = new URLSearchParams();
      if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
      if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
      if (filters.permitido) params.append('permitido', filters.permitido);
      if (filters.id) params.append('id', filters.id);

      const response = await api.get(`/registros?${params.toString()}`);
      return response.data;
    },
    { enabled: true }
  );

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
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

  return (
    <div className="registros">
      <h1>{t('records.title')}</h1>

      <div className="filters-section">
        <h2>{t('common.filters')}</h2>
        <div className="filters-grid">
          <div className="form-group">
            <label>{t('records.dateFrom')}</label>
            <input
              type="date"
              value={filters.fechaDesde}
              onChange={(e) => handleFilterChange('fechaDesde', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>{t('records.dateTo')}</label>
            <input
              type="date"
              value={filters.fechaHasta}
              onChange={(e) => handleFilterChange('fechaHasta', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>{t('common.result')}</label>
            <select
              value={filters.permitido}
              onChange={(e) => handleFilterChange('permitido', e.target.value)}
            >
              <option value="">{t('records.all')}</option>
              <option value="true">{t('records.allowed')}</option>
              <option value="false">{t('records.denied')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('records.guestId')}</label>
            <input
              type="text"
              value={filters.id}
              onChange={(e) => handleFilterChange('id', e.target.value)}
              placeholder={t('records.searchById')}
            />
          </div>
        </div>
        <button onClick={handleSearch} className="btn btn-primary">
          {t('common.search')}
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('records.guestId')}</th>
              <th>{t('records.guest')}</th>
              <th>{t('kiosk.subscriber')}</th>
              <th>{t('common.result')}</th>
              <th>{t('common.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {registros?.map((r: any) => (
              <tr key={r._id || r.id}>
                <td>{new Date(r.fecha).toLocaleString()}</td>
                <td>{r.idInvitado || r.dniInvitado}</td>
                <td>
                  {r.invitado ? (
                    <div className="record-person">
                      {r.invitado.fotoPerfil && (
                        <button
                          type="button"
                          className="record-photo-button"
                          onClick={() =>
                            handleOpenImage(
                              r.invitado.fotoPerfil,
                              `${r.invitado.nombre} ${r.invitado.apellido}`
                            )
                          }
                          aria-label={`Ver foto de ${r.invitado.nombre} ${r.invitado.apellido}`}
                        >
                          <img
                            src={r.invitado.fotoPerfil}
                            alt={`${r.invitado.nombre} ${r.invitado.apellido}`}
                            className="record-photo"
                          />
                        </button>
                      )}
                      <span>{r.invitado.nombre} {r.invitado.apellido}</span>
                    </div>
                  ) : '-'}
                </td>
                <td>
                  {r.suscriptor ? (
                    <div className="record-person">
                      {r.suscriptor.foto && (
                        <button
                          type="button"
                          className="record-photo-button"
                          onClick={() =>
                            handleOpenImage(
                              r.suscriptor.foto,
                              `${r.suscriptor.nombre} ${r.suscriptor.apellido}`
                            )
                          }
                          aria-label={`Ver foto de ${r.suscriptor.nombre} ${r.suscriptor.apellido}`}
                        >
                          <img
                            src={r.suscriptor.foto}
                            alt={`${r.suscriptor.nombre} ${r.suscriptor.apellido}`}
                            className="record-photo"
                          />
                        </button>
                      )}
                      <span>{r.suscriptor.nombre} {r.suscriptor.apellido} ({r.suscriptor.email})</span>
                    </div>
                  ) : '-'}
                </td>
                <td>
                  <span className={`badge ${r.permitido ? 'badge-success' : 'badge-error'}`}>
                    {r.permitido ? t('records.allowed') : t('records.denied')}
                  </span>
                </td>
                <td>{r.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

export default Registros;
