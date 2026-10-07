import { useLanguage } from '../contexts/LanguageContext';
import './WelcomeModal.css';

interface WelcomeModalProps {
  onClose: () => void;
}

const WelcomeModal = ({ onClose }: WelcomeModalProps) => {
  const { language } = useLanguage();

  const translations = {
    es: {
      title: '¡Bienvenido a PowerHouse Gym!',
      subtitle: 'Guía rápida para gestionar tus invitados, niños y turnos de guardería',
      step1: {
        title: '1. Agregar un Invitado',
        description: 'Haz clic en "Nuevo Invitado" y completa los datos:',
        items: [
          'ID del invitado',
          'Nombre y apellido',
          'Email (opcional, para enviar por correo)',
          'Teléfono (opcional, para enviar por WhatsApp)',
          'Foto de perfil (puedes tomarla con la cámara)'
        ]
      },
      step2: {
        title: '2. Enviar el Código QR',
        description: 'Una vez creado el invitado, puedes enviarle su código QR de dos formas:',
        whatsapp: {
          title: 'Por WhatsApp:',
          description: 'Si el invitado tiene teléfono, haz clic en el botón "WhatsApp" y se abrirá WhatsApp con un mensaje pre-configurado que incluye el código QR.'
        },
        email: {
          title: 'Por Email:',
          description: 'Si el invitado tiene email, haz clic en el botón "Email" y se enviará automáticamente un correo con el código QR.'
        }
      },
      step3: {
        title: '3. Gestionar Invitados',
        description: 'Puedes editar o eliminar invitados en cualquier momento usando los botones de acción.'
      },
      step4: {
        title: '4. Agregar Niños',
        description: 'En la pestaña "Niños" puedes agregar niños a tu cuenta. Ten en cuenta los límites según tu membresía:',
        items: [
          'Gold: 2 niños gratis, $5 USD por cada extra',
          'Silver: 1 niño gratis, $5 USD por cada extra',
          'FMS: 0 niños gratis, $5 USD por cada niño'
        ],
        note: 'Los niños extra aparecerán como "pendientes de pago" hasta que el administrador los marque como pagados.'
      },
      step5: {
        title: '5. Reservar Turnos de Guardería',
        description: 'En la pestaña "Turnos de Guardería" puedes:',
        items: [
          'Seleccionar el mes que deseas ver',
          'Ver los turnos disponibles con su capacidad',
          'Reservar turnos para tus niños (solo niños pagados pueden reservar)',
          'Ver y cancelar tus reservas existentes'
        ]
      },
      close: 'Entendido, comenzar'
    },
    en: {
      title: 'Welcome to PowerHouse Gym!',
      subtitle: 'Quick guide to manage your guests, children and daycare shifts',
      step1: {
        title: '1. Add a Guest',
        description: 'Click on "New Guest" and fill in the data:',
        items: [
          'Guest ID',
          'First and last name',
          'Email (optional, to send by email)',
          'Phone (optional, to send by WhatsApp)',
          'Profile photo (you can take it with the camera)'
        ]
      },
      step2: {
        title: '2. Send the QR Code',
        description: 'Once the guest is created, you can send them their QR code in two ways:',
        whatsapp: {
          title: 'By WhatsApp:',
          description: 'If the guest has a phone number, click the "WhatsApp" button and WhatsApp will open with a pre-configured message that includes the QR code.'
        },
        email: {
          title: 'By Email:',
          description: 'If the guest has an email, click the "Email" button and an email with the QR code will be sent automatically.'
        }
      },
      step3: {
        title: '3. Manage Guests',
        description: 'You can edit or delete guests at any time using the action buttons.'
      },
      step4: {
        title: '4. Add Children',
        description: 'In the "Children" tab you can add children to your account. Keep in mind the limits according to your membership:',
        items: [
          'Gold: 2 free children, $5 USD per extra',
          'Silver: 1 free child, $5 USD per extra',
          'FMS: 0 free children, $5 USD per child'
        ],
        note: 'Extra children will appear as "pending payment" until the administrator marks them as paid.'
      },
      step5: {
        title: '5. Reserve Daycare Shifts',
        description: 'In the "Daycare Shifts" tab you can:',
        items: [
          'Select the month you want to view',
          'See available shifts with their capacity',
          'Reserve shifts for your children (only paid children can reserve)',
          'View and cancel your existing reservations'
        ]
      },
      close: 'Got it, let\'s start'
    }
  };

  const texts = translations[language];

  return (
    <div className="welcome-modal-overlay">
      <div className="welcome-modal">
        <div className="welcome-modal-header">
          <img src="/powerhouse-logo.png" alt="PowerHouse Gym" className="welcome-modal-logo" />
          <h2>{texts.title}</h2>
          <p className="welcome-subtitle">{texts.subtitle}</p>
        </div>
        
        <div className="welcome-content">
          <div className="welcome-step">
            <h3>{texts.step1.title}</h3>
            <p>{texts.step1.description}</p>
            <ul>
              {texts.step1.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="welcome-step">
            <h3>{texts.step2.title}</h3>
            <p>{texts.step2.description}</p>
            <div className="welcome-method">
              <h4>{texts.step2.whatsapp.title}</h4>
              <p>{texts.step2.whatsapp.description}</p>
            </div>
            <div className="welcome-method">
              <h4>{texts.step2.email.title}</h4>
              <p>{texts.step2.email.description}</p>
            </div>
          </div>

          <div className="welcome-step">
            <h3>{texts.step3.title}</h3>
            <p>{texts.step3.description}</p>
          </div>

          <div className="welcome-step">
            <h3>{texts.step4.title}</h3>
            <p>{texts.step4.description}</p>
            <ul>
              {texts.step4.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            {texts.step4.note && <p style={{ marginTop: '10px', fontStyle: 'italic', color: '#666' }}>{texts.step4.note}</p>}
          </div>

          <div className="welcome-step">
            <h3>{texts.step5.title}</h3>
            <p>{texts.step5.description}</p>
            <ul>
              {texts.step5.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="welcome-modal-footer">
          <button onClick={onClose} className="btn btn-primary welcome-close-button">
            {texts.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;

