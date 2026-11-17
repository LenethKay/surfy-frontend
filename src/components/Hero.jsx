import { ASSETS } from '../assets.js';

export default function Hero({ t }) {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-content">
        <p className="hero-eyebrow">{t('hero.eyebrow')}</p>
        <h1 id="hero-title">
          {t('hero.before')} <span>{t('hero.highlight')}</span> {t('hero.after')}
        </h1>
        <p className="hero-subtitle">{t('hero.subtitle')}</p>
      </div>
      <div className="wave-stage" aria-hidden="true">
        <img
          src={ASSETS.waveBorder}
          alt=""
          width="2172"
          height="414"
          fetchpriority="high"
        />
      </div>
    </section>
  );
}
