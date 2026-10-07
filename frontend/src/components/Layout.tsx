import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import KioscoPanel from './KioscoPanel';
import KioscoNinosPanel from './KioscoNinosPanel';
import IDValidator from './IDValidator';
import TutorialModal from './TutorialModal';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [kioscoInvitadosMode, setKioscoInvitadosMode] = useState<'user' | 'environment' | null>(null);
  const [kioscoNinosModalOpen, setKioscoNinosModalOpen] = useState(false);
  const [tutorialModalOpen, setTutorialModalOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  // El Kiosco ahora está siempre visible, no necesita navegación

  return (
    <div className="layout">
      <div className="top-bar">
        <div className="top-bar-left">
          <button
            onClick={() => setTutorialModalOpen(true)}
            className="help-button"
            title={language === 'es' ? 'Tutoriales y Ayuda' : 'Tutorials and Help'}
            aria-label="Help"
          >
            ❓
          </button>
        </div>
        <div className="top-bar-content">
          <div className="language-toggle">
            <button
              onClick={toggleLanguage}
              className={`lang-button ${language === 'es' ? 'active' : ''}`}
              title={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              {language === 'es' ? 'ES' : 'EN'}
            </button>
          </div>
        </div>
      </div>
      <button className="mobile-menu-toggle" onClick={toggleMobileMenu} aria-label="Toggle menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
      {mobileMenuOpen && <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>}
      <nav className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <img src="/powerhouse-logo.png" alt="PowerHouse Gym" className="sidebar-logo" />
          <h1>{t('layout.title')}</h1>
          <p className="sidebar-subtitle">{t('layout.subtitle')}</p>
        </div>
        <div className="sidebar-user">
          <p className="user-name">{user?.nombre}</p>
          <p className="user-role">{user?.rol === 'administrador' ? t('layout.role.admin') : t('layout.role.reception')}</p>
        </div>
        <ul className="sidebar-menu">
          <li>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''} onClick={closeMobileMenu}>
              {t('nav.dashboard')}
            </Link>
          </li>
          <li>
            <Link to="/importaciones" className={isActive('/importaciones') ? 'active' : ''} onClick={closeMobileMenu}>
              {t('nav.imports')}
            </Link>
          </li>
          <li>
            <Link to="/suscriptores" className={isActive('/suscriptores') ? 'active' : ''} onClick={closeMobileMenu}>
              {t('nav.subscribers')}
            </Link>
          </li>
          <li>
            <Link to="/invitados" className={isActive('/invitados') ? 'active' : ''} onClick={closeMobileMenu}>
              {t('nav.guests')}
            </Link>
          </li>
          <li>
            <Link to="/ninos" className={isActive('/ninos') ? 'active' : ''} onClick={closeMobileMenu}>
              {t('nav.children')}
            </Link>
          </li>
          <li>
            <Link to="/turnos" className={isActive('/turnos') ? 'active' : ''} onClick={closeMobileMenu}>
              {t('nav.shifts')}
            </Link>
          </li>
          <li>
            <Link to="/registros" className={isActive('/registros') ? 'active' : ''} onClick={closeMobileMenu}>
              {t('nav.records')}
            </Link>
          </li>
          <li>
            <Link to="/registros-ninos" className={isActive('/registros-ninos') ? 'active' : ''} onClick={closeMobileMenu}>
              {t('nav.childrenRecords')}
            </Link>
          </li>
          {user?.rol === 'administrador' && (
            <>
              <li>
                <Link to="/usuarios" className={isActive('/usuarios') ? 'active' : ''} onClick={closeMobileMenu}>
                  {t('nav.users')}
                </Link>
              </li>
              <li>
                <Link to="/logs" className={isActive('/logs') ? 'active' : ''} onClick={closeMobileMenu}>
                  📋 Logs
                </Link>
              </li>
            </>
          )}
          <li>
            <button
              onClick={() => {
                setKioscoInvitadosMode('user');
                closeMobileMenu();
              }}
              className="sidebar-kiosk-button"
            >
              🏋️ {t('nav.kioskFront')}
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                setKioscoInvitadosMode('environment');
                closeMobileMenu();
              }}
              className="sidebar-kiosk-button"
            >
              📷 {t('nav.kioskRear')}
            </button>
          </li>
          <li>
            <button 
              onClick={() => {
                setKioscoNinosModalOpen(true);
                closeMobileMenu();
              }} 
              className="sidebar-kiosk-button"
            >
              👶 {t('childrenKiosk.title')}
            </button>
          </li>
        </ul>
        <div className="sidebar-footer">
          <button onClick={logout} className="logout-button">
            {t('common.logout')}
          </button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
      
      {/* Validador de ID fijo - Solo visible cuando NO está abierto el modal del Kiosco */}
      {!kioscoInvitadosMode && !kioscoNinosModalOpen && <IDValidator />}
      
      {kioscoInvitadosMode && (
        <div className="kiosco-modal-overlay">
          <KioscoPanel
            onClose={undefined}
            preferredFacingMode={kioscoInvitadosMode}
          />
        </div>
      )}
      
      {kioscoNinosModalOpen && (
        <div className="kiosco-modal-overlay">
          <KioscoNinosPanel onClose={undefined} />
        </div>
      )}
      
      <TutorialModal 
        isOpen={tutorialModalOpen} 
        onClose={() => setTutorialModalOpen(false)} 
      />
    </div>
  );
};

export default Layout;
