import { useLanguage } from '../contexts/LanguageContext';
import './LanguageSelectionModal.css';

interface LanguageSelectionModalProps {
  onLanguageSelected: () => void;
}

const LanguageSelectionModal = ({ onLanguageSelected }: LanguageSelectionModalProps) => {
  const { setLanguage } = useLanguage();

  const handleLanguageSelect = (lang: 'es' | 'en') => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    onLanguageSelected();
  };

  return (
    <div className="language-selection-overlay">
      <div className="language-selection-modal">
        <div className="language-selection-header">
          <img src="/powerhouse-logo.png" alt="PowerHouse Gym" className="language-selection-logo" />
          <h2>Selecciona tu idioma / Select your language</h2>
        </div>
        <div className="language-selection-buttons">
          <button
            onClick={() => handleLanguageSelect('es')}
            className="language-button language-button-es"
          >
            <span className="language-flag">🇪🇸</span>
            <span className="language-name">Español</span>
          </button>
          <button
            onClick={() => handleLanguageSelect('en')}
            className="language-button language-button-en"
          >
            <span className="language-flag">🇺🇸</span>
            <span className="language-name">English</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelectionModal;
