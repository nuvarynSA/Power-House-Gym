import { APP_VERSION_LABEL } from '../config/version';

const SystemVersionBadge = () => {
  return (
    <div className="system-version-badge">
      {APP_VERSION_LABEL}
    </div>
  );
};

export default SystemVersionBadge;
