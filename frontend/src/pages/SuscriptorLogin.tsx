import { useState, useEffect } from 'react';
import { useSuscriptorAuth } from '../contexts/SuscriptorAuthContext';
import { useNavigate } from 'react-router-dom';
import ChangePasswordModal from '../components/ChangePasswordModal';
import LanguageSelectionModal from '../components/LanguageSelectionModal';
import './Login.css';

const SuscriptorLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLanguageSelection, setShowLanguageSelection] = useState(false);
  const [languageSelected, setLanguageSelected] = useState(false);
  const { login, requiereCambioPassword, isAuthenticated, isInitializing } = useSuscriptorAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar si ya hay un idioma seleccionado
    const storedLanguage = localStorage.getItem('language');
    if (!storedLanguage) {
      // Si no hay idioma, mostrar selección de idioma primero
      setShowLanguageSelection(true);
    } else {
      setLanguageSelected(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate('/suscriptor/dashboard');
    }
  }, [isAuthenticated, isInitializing, navigate]);

  const handleLanguageSelected = () => {
    setShowLanguageSelection(false);
    setLanguageSelected(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!languageSelected) {
      setShowLanguageSelection(true);
      return;
    }
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Si requiere cambio de contraseña, no navegar (el modal se mostrará)
      // Si no requiere cambio, navegar al dashboard
      if (!requiereCambioPassword) {
        navigate('/suscriptor/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  if (showLanguageSelection) {
    return <LanguageSelectionModal onLanguageSelected={handleLanguageSelected} />;
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <img src="/powerhouse-logo.png" alt="PowerHouse Gym" className="login-logo" />
          <h1>PowerHouse Gym</h1>
          <p>Portal de Suscriptores</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="Ingrese su email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
      {requiereCambioPassword && <ChangePasswordModal />}
    </div>
  );
};

export default SuscriptorLogin;
