import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './Logs.css';

const Logs = () => {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    tipo: '',
    usuario: '',
    busqueda: '',
    fechaDesde: '',
    fechaHasta: ''
  });

  const { data, isLoading, refetch } = useQuery(
    ['logs', page, filters],
    async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '100');
      if (filters.tipo) params.append('tipo', filters.tipo);
      if (filters.usuario) params.append('usuario', filters.usuario);
      if (filters.busqueda) params.append('busqueda', filters.busqueda);
      if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
      if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);

      const response = await api.get(`/logs?${params.toString()}`);
      return response.data;
    },
    { enabled: true }
  );

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const handleSearch = () => {
    refetch();
  };

  const tipoLogLabels: { [key: string]: string } = {
    login: t('logs.type.login'),
    logout: t('logs.type.logout'),
    crear_invitado: t('logs.type.createGuest'),
    editar_invitado: t('logs.type.editGuest'),
    eliminar_invitado: t('logs.type.deleteGuest'),
    crear_suscriptor: t('logs.type.createSubscriber'),
    editar_suscriptor: t('logs.type.editSubscriber'),
    eliminar_suscriptor: t('logs.type.deleteSubscriber'),
    validar_ingreso: t('logs.type.validateEntry'),
    enviar_email: t('logs.type.sendEmail'),
    importar_csv: t('logs.type.importCsv'),
    crear_usuario: t('logs.type.createUser'),
    editar_usuario: t('logs.type.editUser'),
    qr_no_encontrado: t('logs.type.qrNotFound'),
  };

  return (
    <div className="logs">
      <div className="page-header">
        <h1>{t('logs.title')}</h1>
      </div>

      <div className="filters-section">
        <h2>{t('logs.filters')}</h2>
        <div className="filters-grid">
          <div className="form-group">
            <label>{t('logs.type')}</label>
            <select
              value={filters.tipo}
              onChange={(e) => handleFilterChange('tipo', e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              {Object.entries(tipoLogLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('common.user')}</label>
            <input
              type="text"
              value={filters.usuario}
              onChange={(e) => handleFilterChange('usuario', e.target.value)}
              placeholder={t('logs.searchUser')}
            />
          </div>
          <div className="form-group">
            <label>{t('common.searchLabel')}</label>
            <input
              type="text"
              value={filters.busqueda}
              onChange={(e) => handleFilterChange('busqueda', e.target.value)}
              placeholder={t('logs.searchAction')}
            />
          </div>
          <div className="form-group">
            <label>{t('logs.dateFrom')}</label>
            <input
              type="date"
              value={filters.fechaDesde}
              onChange={(e) => handleFilterChange('fechaDesde', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>{t('logs.dateTo')}</label>
            <input
              type="date"
              value={filters.fechaHasta}
              onChange={(e) => handleFilterChange('fechaHasta', e.target.value)}
            />
          </div>
        </div>
        <button onClick={handleSearch} className="btn btn-primary">
          {t('common.search')}
        </button>
      </div>

      <div className="table-container">
        {isLoading ? (
          <p>{t('logs.loading')}</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('logs.type')}</th>
                  <th>{t('common.user')}</th>
                  <th>{t('logs.action')}</th>
                  <th>{t('logs.details')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.logs?.map((log: any) => (
                  <tr key={log.id || log._id}>
                    <td>{new Date(log.fecha).toLocaleString()}</td>
                    <td>
                      <span className={`badge badge-log-${log.tipo}`}>
                        {tipoLogLabels[log.tipo] || log.tipo}
                      </span>
                    </td>
                    <td>{log.usuarioNombre || log.usuarioRef?.nombre || t('common.system')}</td>
                    <td>{log.accion}</td>
                    <td>{log.detalles || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data?.pagination && (
              <div className="pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary"
                >
                  {t('common.previous')}
                </button>
                <span>
                  {t('common.page')} {data.pagination.page} {t('common.of')} {data.pagination.totalPages} 
                  ({data.pagination.total} {t('common.totalRecords')})
                </span>
                <button
                  onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page >= data.pagination.totalPages}
                  className="btn btn-secondary"
                >
                  {t('common.next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Logs;

