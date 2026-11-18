import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Globe, Wifi, WifiOff } from 'lucide-react';
import { ASSETS } from '../assets.js';

export default function Navbar({
  lang,
  onLanguageChange,
  isOnline,
  offlineOnly,
  onOfflineOnlyChange,
  t,
}) {
  const [isOnlinePopoverOpen, setIsOnlinePopoverOpen] = useState(false);
  const onlinePopoverId = useId();
  const onlinePopoverRef = useRef(null);

  useEffect(() => {
    if (!isOnlinePopoverOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!onlinePopoverRef.current?.contains(event.target)) setIsOnlinePopoverOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOnlinePopoverOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOnlinePopoverOpen]);

  return (
    <header className="site-header">
      <div className="nav-inner">
        <a className="brand" href="#top" aria-label={t('nav.home')}>
          <img src={ASSETS.appIcon} alt="" width="38" height="38" decoding="async" />
          <span>Surfare</span>
        </a>

        <div className="nav-controls">
          <label className="language-control">
            <Globe aria-hidden="true" size={21} strokeWidth={2} />
            <span className="language-current">{lang === 'en' ? 'EN' : lang === 'tl' ? 'TL' : 'TL/EN'}</span>
            <select
              value={lang}
              onChange={(event) => onLanguageChange(event.target.value)}
              aria-label={t('nav.language')}
            >
              <option value="en">{t('nav.english')}</option>
              <option value="tl">{t('nav.tagalog')}</option>
              <option value="taglish">{t('nav.taglish')}</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} strokeWidth={2} />
          </label>
          <div className="connection-wrap" ref={onlinePopoverRef}>
            <button
              className={`connection-status ${isOnline ? 'is-online' : 'is-offline'}`}
              type="button"
              aria-live="polite"
              aria-expanded={isOnlinePopoverOpen}
              aria-controls={onlinePopoverId}
              onClick={() => setIsOnlinePopoverOpen((open) => !open)}
            >
              {isOnline ? (
                <Wifi aria-hidden="true" size={17} strokeWidth={2} />
              ) : (
                <WifiOff aria-hidden="true" size={17} strokeWidth={2} />
              )}
              <span>{isOnline ? t('nav.online') : t('nav.offline')}</span>
            </button>
            {isOnlinePopoverOpen && (
              <div className="online-popover" id={onlinePopoverId} role="dialog" aria-label={t('check.offlineOnly')}>
                <label>
                  <input
                    type="checkbox"
                    checked={offlineOnly}
                    onChange={(event) => onOfflineOnlyChange(event.target.checked)}
                  />
                  <span>{t('check.offlineOnly')}</span>
                </label>
                <p>{t('check.onlineNotice')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
