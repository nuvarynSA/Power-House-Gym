import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './TutorialModal.css';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialVideo {
  id: string;
  title: string;
  titleEn: string;
  path: string;
}

const TutorialModal = ({ isOpen, onClose }: TutorialModalProps) => {
  const { language } = useLanguage();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const videos: TutorialVideo[] = [
    {
      id: 'create-user',
      title: 'Crear Usuario',
      titleEn: 'Create User',
      path: '/Create USER.mov'
    },
    {
      id: 'create-edit-remove-guest',
      title: 'Crear, Editar y Eliminar Invitado',
      titleEn: 'Create, Edit and Remove Guest',
      path: '/Create : Edit : Remove GUEST.mov'
    },
    {
      id: 'create-edit-remove-subscribers',
      title: 'Crear, Editar y Eliminar Suscriptores',
      titleEn: 'Create, Edit and Remove Subscribers',
      path: '/Create : Edit: Remove SUBSCRIBERS.mov'
    },
    {
      id: 'import-subscribers',
      title: 'Importar Suscriptores',
      titleEn: 'Import Subscribers',
      path: '/Import SUBSCRIBERS.mov'
    },
    {
      id: 'guest-platform',
      title: 'Plataforma de Invitados',
      titleEn: 'Guest Platform',
      path: '/GUEST PLATAFORM.mov'
    },
    {
      id: 'create-child-subscribe',
      title: 'Crear Niño y sacar turno (Portal Suscriptor)',
      titleEn: 'Create Child and book shift (Subscriber portal)',
      path: '/Crear Niño y sacar turno, portal suscriptor.mov'
    },
    {
      id: 'cancel-reservation-admin',
      title: 'Cancelar reserva y modificar datos de niño (Panel Admin)',
      titleEn: 'Cancel reservation and edit child (Admin panel)',
      path: '/Cancelar Reserva y modifcar datos niño, panel Admin.mov'
    }
  ];

  if (!isOpen) return null;

  const getVideoTitle = (video: TutorialVideo) => {
    return language === 'es' ? video.title : video.titleEn;
  };

  return (
    <div className="tutorial-modal-overlay" onClick={onClose}>
      <div className="tutorial-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="tutorial-modal-header">
          <h2>{language === 'es' ? 'Tutoriales del Sistema' : 'System Tutorials'}</h2>
          <button className="tutorial-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        
        <div className="tutorial-modal-body">
          {selectedVideo ? (
            <div className="tutorial-video-player">
              <button 
                className="tutorial-back-button" 
                onClick={() => setSelectedVideo(null)}
              >
                ← {language === 'es' ? 'Volver a la lista' : 'Back to list'}
              </button>
              <div className="video-container">
                <video 
                  controls 
                  autoPlay
                  className="tutorial-video"
                  key={selectedVideo}
                >
                  <source src={selectedVideo} type="video/quicktime" />
                  <source src={selectedVideo} type="video/mp4" />
                  {language === 'es' 
                    ? 'Tu navegador no soporta la reproducción de video.'
                    : 'Your browser does not support video playback.'}
                </video>
              </div>
            </div>
          ) : (
            <div className="tutorial-videos-grid">
              {videos.map((video) => (
                <div 
                  key={video.id} 
                  className="tutorial-video-card"
                  onClick={() => setSelectedVideo(video.path)}
                >
                  <div className="tutorial-video-icon">▶️</div>
                  <h3>{getVideoTitle(video)}</h3>
                  <p className="tutorial-video-description">
                    {language === 'es' 
                      ? 'Haz clic para reproducir'
                      : 'Click to play'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
