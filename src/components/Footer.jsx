export default function Footer({ t }) {
  return (
    <footer className="site-footer">
      <div className="page-container footer-inner">
        <div className="footer-brand-block">
          <a className="footer-brand" href="#top" aria-label={t('nav.home')}>
            <span>Surfare</span>
          </a>
          <p>{t('footer.description')}</p>
        </div>
        <p className="footer-note">{t('footer.note')}</p>
      </div>
    </footer>
  );
}
