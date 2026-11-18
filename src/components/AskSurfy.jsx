import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { ASSETS } from '../assets.js';
import { SURFY_QUESTION_KEYS } from '../surfy/templates.js';

export default function AskSurfy({
  isOpen,
  isClosing,
  isThinking,
  messages,
  onSend,
  t,
}) {
  const [draft, setDraft] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
  }, [messages, isThinking]);

  if (!isOpen) return null;

  const submit = (value) => {
    const question = value.trim();
    if (!question) return;
    onSend(question);
    setDraft('');
    if (inputRef.current) {
      inputRef.current.style.height = '';
      inputRef.current.style.overflowY = 'hidden';
    }
  };

  return (
    <section
      className={`ask-dialog${isClosing ? ' is-closing' : ''}${isCollapsed ? ' is-collapsed' : ''}`}
      role="complementary"
      aria-label={t('ask.title')}
    >
      <button
        className="ask-mobile-handle"
        type="button"
        aria-label={t(isCollapsed ? 'ask.expand' : 'ask.collapse')}
        aria-expanded={!isCollapsed}
        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
      >
        <span aria-hidden="true" />
      </button>

      <div className="ask-brand">
        <img
          src={ASSETS.surfyWink}
          alt={t('ask.imageAlt')}
          width="1000"
          height="1000"
          decoding="async"
        />
        <h2>{t('ask.title')}</h2>
      </div>

      <div className="ask-content">
        <div className="ask-messages" ref={messagesRef} aria-live="polite">
          {messages.map((message, index) => {
            if (message.role === 'divider') {
              return (
                <div className="ask-result-divider" role="separator" key={`divider-${index}`}>
                  <span>{message.text}</span>
                </div>
              );
            }
            return (
              <p
                className={`chat-bubble ${message.role === 'user' ? 'chat-user' : 'chat-surfy'}`}
                key={`${message.role}-${index}`}
              >
                {message.text}
              </p>
            );
          })}
          {isThinking && (
            <p className="chat-bubble chat-surfy chat-typing" role="status" aria-label={t('ask.thinking')}>
              <span aria-hidden="true"><i /><i /><i /></span>
            </p>
          )}
        </div>

        <div className="ask-chips">
          {SURFY_QUESTION_KEYS.map((key) => (
            <button type="button" className="ask-chip" key={key} onClick={() => submit(t(key))}>
              {t(key)}
            </button>
          ))}
        </div>

        <form
          className="ask-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
        >
          <label className="sr-only" htmlFor="ask-input">
            {t('ask.input')}
          </label>
          <textarea
            id="ask-input"
            ref={inputRef}
            rows="1"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onInput={(event) => {
              const textarea = event.currentTarget;
              const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 20;
              const cssMaximumHeight = Number.parseFloat(getComputedStyle(textarea).maxHeight);
              const maximumHeight = Math.min(
                lineHeight * 3 + 36,
                Number.isFinite(cssMaximumHeight) ? cssMaximumHeight : Infinity,
              );
              textarea.style.height = 'auto';
              textarea.style.height = `${Math.min(textarea.scrollHeight, maximumHeight)}px`;
              textarea.style.overflowY = textarea.scrollHeight > maximumHeight ? 'auto' : 'hidden';
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form.requestSubmit();
              }
            }}
            placeholder={t('ask.input')}
            autoComplete="off"
          />
          <button type="submit" disabled={!draft.trim()} aria-label={t('ask.send')}>
            <Send aria-hidden="true" />
          </button>
        </form>
      </div>
    </section>
  );
}
