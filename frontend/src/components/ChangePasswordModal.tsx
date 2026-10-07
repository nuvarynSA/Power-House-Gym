import { useState } from 'react';
import { useSuscriptorAuth } from '../contexts/SuscriptorAuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import './ChangePasswordModal.css';


const ChangePasswordModal = () => {
  const { t } = useLanguage();
  const { cambiarPassword } = useSuscriptorAuth();
  const { showToast } = useToast();
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (nuevaPassword.length < 6) {
      setError(t('subscribers.passwordHint'));
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setError(t('subscribers.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      await cambiarPassword(nuevaPassword);
      // El modal se cerrará automáticamente cuando requiereCambioPassword sea false
      showToast(t('subscribers.passwordChangedSuccess'), 'success');
    } catch (err: any) {
      setError(err.message || t('subscribers.passwordChangedSuccess'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-overlay">
      <div className="change-password-modal">
        <div className="change-password-header">
          <h2>{t('subscribers.changePassword')}</h2>
          <p>{t('subscribers.passwordChangeRequired')}</p>
        </div>
        <form onSubmit={handleSubmit} className="change-password-form">
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>{t('subscribers.newPasswordRequired')}</label>
            <input
              type="password"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
            />
            <small>{t('subscribers.passwordHint')}</small>
          </div>
          <div className="form-group">
            <label>{t('subscribers.confirmPassword')}</label>
            <input
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
