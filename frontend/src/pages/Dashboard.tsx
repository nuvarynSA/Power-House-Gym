import { useQuery } from 'react-query';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDailyMessage } from '../data/motivationalMessages';
import './Dashboard.css';

// ── Componente del mensaje motivador del día ──
const DailyMessageCard = ({ compact = false, language }: { compact?: boolean; language: string }) => {
  const msg = getDailyMessage();
  const today = new Date();
  const dayLabel = today.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  return (
    <div className={`daily-message-card${compact ? ' compact' : ''}`}>
      <div className="daily-message-badge">
        💪 {language === 'es' ? 'Mensaje del día' : 'Message of the day'}
      </div>
      <div className="daily-message-quote-icon">"</div>
      <p className="daily-message-text">
        {language === 'es' ? msg.es : msg.en}
      </p>
      <div className="daily-message-day" style={{ textTransform: 'capitalize' }}>
        {dayLabel}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'administrador';

  const { data: stats, isLoading } = useQuery('dashboard-stats', async () => {
    const now = new Date();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const anio = String(now.getFullYear());

    const [suscriptores, invitados, registros, ninos, reservasTurnos] = await Promise.all([
      api.get('/suscriptores?eliminado=false'),
      api.get('/invitados?eliminado=false'),
      api.get('/registros'),
      api.get('/ninos'),
      api.get(`/turnos/admin-reservados?mes=${mes}&anio=${anio}&incluirPasados=true`)
    ]);

    const suscriptoresData = suscriptores.data || [];
    const invitadosData = invitados.data || [];
    const registrosData = registros.data || [];
    const ninosData = ninos.data || [];
    const reservasData = reservasTurnos.data || [];

    const suscriptoresHabilitados = suscriptoresData.filter((s: any) => s.habilitado && !s.eliminado).length;
    const suscriptoresDeshabilitados = suscriptoresData.filter((s: any) => !s.habilitado && !s.eliminado).length;
    const invitadosActivos = invitadosData.filter((i: any) => i.activo && !i.eliminado).length;
    const invitadosInactivos = invitadosData.filter((i: any) => !i.activo && !i.eliminado).length;
    
    // Ingresos de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ingresosHoy = registrosData.filter((r: any) => {
      const fecha = new Date(r.fecha);
      fecha.setHours(0, 0, 0, 0);
      return fecha.getTime() === hoy.getTime() && r.permitido;
    }).length;

    // Ingresos de ayer
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const ingresosAyer = registrosData.filter((r: any) => {
      const fecha = new Date(r.fecha);
      fecha.setHours(0, 0, 0, 0);
      return fecha.getTime() === ayer.getTime() && r.permitido;
    }).length;

    // Ingresos de esta semana (últimos 7 días)
    const ultimos7Dias = [];
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      fecha.setHours(0, 0, 0, 0);
      
      const ingresos = registrosData.filter((r: any) => {
        const fechaRegistro = new Date(r.fecha);
        fechaRegistro.setHours(0, 0, 0, 0);
        return fechaRegistro.getTime() === fecha.getTime() && r.permitido;
      }).length;

      const denegados = registrosData.filter((r: any) => {
        const fechaRegistro = new Date(r.fecha);
        fechaRegistro.setHours(0, 0, 0, 0);
        return fechaRegistro.getTime() === fecha.getTime() && !r.permitido;
      }).length;

      const locale = language === 'es' ? 'es-ES' : 'en-US';
      const nombreDia = fecha.toLocaleDateString(locale, { weekday: 'short' });
      const diaMes = fecha.getDate();
      
      ultimos7Dias.push({
        fecha: `${nombreDia} ${diaMes}`,
        ingresos,
        denegados
      });
    }

    // Ingresos por día de la semana (promedio)
    const ingresosPorDiaSemana: { [key: number]: number[] } = {};
    registrosData.forEach((r: any) => {
      if (r.permitido) {
        const fecha = new Date(r.fecha);
        const diaSemana = fecha.getDay();
        if (!ingresosPorDiaSemana[diaSemana]) {
          ingresosPorDiaSemana[diaSemana] = [];
        }
        ingresosPorDiaSemana[diaSemana].push(1);
      }
    });

    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const promedioPorDia = diasSemana.map((dia, index) => {
      const total = ingresosPorDiaSemana[index]?.length || 0;
      // Calcular promedio basado en las últimas 4 semanas
      const semanas = 4;
      return {
        dia,
        promedio: Math.round((total / semanas) * 10) / 10
      };
    });

    // Total de ingresos permitidos y denegados
    const totalPermitidos = registrosData.filter((r: any) => r.permitido).length;
    const totalDenegados = registrosData.filter((r: any) => !r.permitido).length;

    const hoyKey = new Date().toISOString().split('T')[0];
    const reservasHoy = reservasData.filter((r: any) => r.fecha === hoyKey).length;
    const totalNinos = ninosData.length;
    const ninosPagados = ninosData.filter((n: any) => n.estadoPago === 'pagado').length;

    return {
      totalSuscriptores: suscriptoresData.filter((s: any) => !s.eliminado).length,
      suscriptoresHabilitados,
      suscriptoresDeshabilitados,
      totalInvitados: invitadosData.filter((i: any) => !i.eliminado).length,
      invitadosActivos,
      invitadosInactivos,
      ingresosHoy,
      ingresosAyer,
      ultimos7Dias,
      promedioPorDia,
      totalPermitidos,
      totalDenegados,
      totalNinos,
      ninosPagados,
      reservasGuarderia: reservasData.length,
      reservasGuarderiaHoy: reservasHoy
    };
  });

  // ── Vista de usuario NO administrador ──
  if (!isAdmin) {
    return (
      <div className="welcome-dashboard">
        <div className="welcome-card">
          <div className="welcome-gym-logo">🏋️</div>
          <h1>
            {language === 'es'
              ? `¡Bienvenido, ${user?.nombre || 'usuario'}!`
              : `Welcome, ${user?.nombre || 'user'}!`}
          </h1>
          <p className="welcome-subtitle">
            {new Date().toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <DailyMessageCard language={language} />
      </div>
    );
  }

  // ── Vista admin: cargando stats ──
  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="loading-state">
          <p>{t('common.loading') || 'Cargando...'}</p>
        </div>
      </div>
    );
  }

  const suscriptoresPieData = [
    { name: t('dashboard.enabledSubscribers'), value: stats?.suscriptoresHabilitados || 0 },
    { name: t('common.disabled'), value: stats?.suscriptoresDeshabilitados || 0 }
  ];

  const invitadosPieData = [
    { name: t('dashboard.activeGuests'), value: stats?.invitadosActivos || 0 },
    { name: t('common.inactive'), value: stats?.invitadosInactivos || 0 }
  ];

  const ingresosPieData = [
    { name: t('dashboard.allowed'), value: stats?.totalPermitidos || 0 },
    { name: t('dashboard.denied'), value: stats?.totalDenegados || 0 }
  ];

  const cambioIngresos = stats?.ingresosAyer 
    ? (((stats.ingresosHoy - stats.ingresosAyer) / stats.ingresosAyer) * 100).toFixed(1)
    : '0';

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>{t('dashboard.title')}</h1>
        <div className="dashboard-subtitle">
          <span className="current-date">
            {new Date().toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>
      </div>

      {/* Mensaje motivador del día — arriba de todo en el admin dashboard */}
      <DailyMessageCard compact language={language} />

      {/* Tarjetas de estadísticas principales */}
      <div className="stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{t('dashboard.totalSubscribers')}</h3>
            <p className="stat-number">{stats?.totalSuscriptores || 0}</p>
            <div className="stat-detail">
              <span className="stat-detail-item success">
                {stats?.suscriptoresHabilitados || 0} {t('dashboard.enabled')}
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-success">
          <div className="stat-icon">🎫</div>
          <div className="stat-content">
            <h3>{t('dashboard.totalGuests')}</h3>
            <p className="stat-number">{stats?.totalInvitados || 0}</p>
            <div className="stat-detail">
              <span className="stat-detail-item success">
                {stats?.invitadosActivos || 0} {t('dashboard.active')}
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-highlight">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{t('dashboard.entriesToday')}</h3>
            <p className="stat-number stat-large">{stats?.ingresosHoy || 0}</p>
            <div className="stat-detail">
              {stats?.ingresosAyer !== undefined && (
                <span className={`stat-detail-item ${parseFloat(cambioIngresos) >= 0 ? 'success' : 'warning'}`}>
                  {parseFloat(cambioIngresos) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(cambioIngresos))}% {t('dashboard.vsYesterday')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-info">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{t('dashboard.totalEntries')}</h3>
            <p className="stat-number">{stats?.totalPermitidos || 0}</p>
            <div className="stat-detail">
              <span className="stat-detail-item">
                {stats?.totalDenegados || 0} {t('dashboard.denied')}
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-info">
          <div className="stat-icon">🧒</div>
          <div className="stat-content">
            <h3>{t('dashboard.totalChildren')}</h3>
            <p className="stat-number">{stats?.totalNinos || 0}</p>
            <div className="stat-detail">
              <span className="stat-detail-item success">
                {stats?.ninosPagados || 0} {t('dashboard.paidChildren')}
              </span>
              <span className="stat-detail-item warning">
                {(stats?.totalNinos || 0) - (stats?.ninosPagados || 0)} {t('dashboard.pendingChildren')}
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-highlight">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>{t('dashboard.daycareBookings')}</h3>
            <p className="stat-number">{stats?.reservasGuarderia || 0}</p>
            <div className="stat-detail">
              <span className="stat-detail-item success">
                {stats?.reservasGuarderiaHoy || 0} {t('dashboard.bookingsToday')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-grid">
        {/* Gráfico de ingresos últimos 7 días */}
        <div className="chart-card">
          <h3 className="chart-title">{t('dashboard.entriesLast7Days')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.ultimos7Dias || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="ingresos" fill="#4CAF50" name={t('dashboard.allowed')} />
              <Bar dataKey="denegados" fill="#F44336" name={t('dashboard.denied')} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de promedio por día de la semana */}
        <div className="chart-card">
          <h3 className="chart-title">{t('dashboard.averageEntriesByDay')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.promedioPorDia || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="promedio" stroke="#2196F3" strokeWidth={3} name={t('dashboard.average')} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de distribución de suscriptores */}
        <div className="chart-card">
          <h3 className="chart-title">{t('dashboard.subscriberDistribution')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={suscriptoresPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {suscriptoresPieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#4CAF50' : '#F44336'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de distribución de invitados */}
        <div className="chart-card">
          <h3 className="chart-title">{t('dashboard.guestDistribution')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={invitadosPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {invitadosPieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#4CAF50' : '#FF9800'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de ingresos permitidos vs denegados */}
        <div className="chart-card">
          <h3 className="chart-title">{t('dashboard.entriesDistribution')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={ingresosPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {ingresosPieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#4CAF50' : '#F44336'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
