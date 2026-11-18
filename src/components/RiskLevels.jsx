import { useId, useState } from 'react';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { ASSETS } from '../assets.js';

const LEVELS = [
  { key: 'low', mascot: ASSETS.surfyWink },
  { key: 'medium', mascot: ASSETS.surfyPoint },
  { key: 'high', mascot: ASSETS.surfyAlarm },
  { key: 'unknown', mascot: ASSETS.surfyMagnify },
];

export default function RiskLevels({ t }) {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(true);
  const privacyPanelId = useId();

  return (
    <section className="risks-section" id="risk-levels" aria-labelledby="risk-title">
      <div className="page-container">
        <p className="section-eyebrow">{t('risk.eyebrow')}</p>
        <h2 id="risk-title">{t('risk.title')}</h2>

        <div className="risk-grid">
          {LEVELS.map((level) => (
            <article className={`risk-card risk-${level.key}`} key={level.key}>
              <div className="risk-art">
                <div className="risk-card-color" aria-hidden="true" />
                <img
                  src={level.mascot}
                  alt={t(`risk.alt.${level.key}`)}
                  width="1000"
                  height="1000"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="risk-card-copy">
                <span className="risk-pill">{t(`risk.${level.key}.badge`)}</span>
                <h3>{t(`risk.${level.key}.name`)}</h3>
                <p>{t(`risk.${level.key}.description`)}</p>
              </div>
            </article>
          ))}
        </div>

        <article className="privacy-card" id="privacy">
          <div className="privacy-heading">
            <span className="privacy-icon">
              <Lock aria-hidden="true" size={28} strokeWidth={2} />
            </span>
            <div>
              <h3>{t('privacy.title')}</h3>
              <p>{t('privacy.body')}</p>
            </div>
          </div>
          <button
            className="privacy-toggle"
            type="button"
            aria-expanded={isPrivacyOpen}
            aria-controls={privacyPanelId}
            onClick={() => setIsPrivacyOpen((open) => !open)}
          >
            <span>{t('privacy.question')}</span>
            {isPrivacyOpen ? (
              <ChevronUp aria-hidden="true" size={20} strokeWidth={1.8} />
            ) : (
              <ChevronDown aria-hidden="true" size={20} strokeWidth={1.8} />
            )}
          </button>
          <div className="privacy-details" id={privacyPanelId} hidden={!isPrivacyOpen}>
            <p>{t('privacy.links')}</p>
            <p>{t('privacy.text')}</p>
            <p>{t('privacy.image')}</p>
          </div>
        </article>
      </div>
    </section>
  );
}
