import { ASSETS } from '../assets.js';
import { Compass } from 'lucide-react';
import { useSiteTour } from './WelcomeExperience.jsx';

export default function Hero({ t }) {
  const startTour = useSiteTour();
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-content">
        <p className="hero-eyebrow">{t('hero.eyebrow')}</p>
        <h1 id="hero-title">
          <span className="hero-title-before">{t('hero.before')}</span>{' '}
          <span className="hero-title-highlight">{t('hero.highlight')}</span>{' '}
          <span className="hero-title-after">{t('hero.after')}</span>
        </h1>
        <p className="hero-subtitle">{t('hero.subtitle')}</p>
        <div className="hero-actions">
          <a className="hero-primary" href="#check">{t('hero.cta')}</a>
          <a className="hero-secondary" href="#how-it-works">{t('hero.learn')}</a>
        </div>
        <a className="hero-scroll" href="#check">
          <span className="scroll-track" aria-hidden="true"><span /></span>
          {t('hero.scroll')}
        </a>
        <button className="hero-tour-start" type="button" data-tour-start onClick={startTour}>
          <Compass size={16} aria-hidden="true" />{t('tour.start')}
        </button>
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
