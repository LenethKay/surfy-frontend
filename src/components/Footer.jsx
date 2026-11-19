import { ASSETS } from '../assets.js';
import { Compass } from 'lucide-react';
import { useSiteTour } from './WelcomeExperience.jsx';

const FOOTER_LINKS = [
  { href: '#top', key: 'nav.home' },
  { href: '#check', key: 'check.title' },
  { href: '#how-it-works', key: 'how.title' },
  { href: '#golden-rules', key: 'check.rules.label' },
  { href: '#risk-levels', key: 'risk.title' },
  { href: '#privacy', key: 'privacy.title' },
];

export default function Footer({ t }) {
  const startTour = useSiteTour();
  return (
    <footer className="site-footer">
      <div className="page-container footer-inner">
        <div className="footer-main">
          <div className="footer-brand-block">
            <a className="footer-brand" href="#top" aria-label={t('nav.home')}>
              <img src={ASSETS.appIcon} alt="" width="40" height="40" decoding="async" />
              <span>Surfare</span>
            </a>
            <button className="tour-replay" type="button" data-tour-start onClick={startTour}>
              <Compass size={16} aria-hidden="true" />{t('tour.replay')}
            </button>
          </div>
          <nav className="footer-nav" aria-label={t('footer.explore')}>
            <h2>{t('footer.explore')}</h2>
            <ul>
              {FOOTER_LINKS.map(({ href, key }) => (
                <li key={href}>
                  <a href={href}>{t(key)}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="footer-bottom">
          <p className="footer-note">{t('footer.note')}</p>
          <p className="footer-tagline">{t('footer.description')}</p>
        </div>
      </div>
    </footer>
  );
}
