import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { ASSETS } from '../assets.js';
import { SURFY_QUESTION_KEYS } from '../surfy/templates.js';

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export default function AskSurfy({ isOpen, messages, onClose, onSend, t }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const dragState = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    inputRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const handleOutsidePointerDown = (event) => {
      if (!dialogRef.current?.contains(event.target)) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
      previousFocus?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = (value) => {
    const question = value.trim();
    if (!question) return;
    onSend(question);
    setDraft('');
  };

  const movePanelBy = (distance) => {
    const dialog = dialogRef.current;
    const panel = dialog?.closest('.ask-panel-position');
    if (!dialog || !panel) return;

    if (getComputedStyle(panel).position === 'fixed') {
      const currentOffset = Number(dialog.dataset.dragOffsetY || 0);
      const bounds = dialog.getBoundingClientRect();
      const nextOffset = clamp(
        currentOffset + distance,
        8 - bounds.top,
        window.innerHeight - 8 - bounds.bottom,
      );
      dialog.style.transform = `translateY(${nextOffset}px)`;
      dialog.dataset.dragOffsetY = String(nextOffset);
      return;
    }

    const parentHeight = panel.offsetParent?.clientHeight ?? window.innerHeight;
    const currentTop = Number.parseFloat(getComputedStyle(panel).top) || panel.offsetTop;
    const nextTop = clamp(currentTop + distance, 8, parentHeight - panel.offsetHeight - 8);
    panel.style.top = `${nextTop}px`;
  };

  const handleDragStart = (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const dialog = dialogRef.current;
    const panel = dialog?.closest('.ask-panel-position');
    if (!dialog || !panel) return;

    const isFixed = getComputedStyle(panel).position === 'fixed';
    const dialogBounds = dialog.getBoundingClientRect();
    dragState.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      panel,
      dialog,
      isFixed,
      startTop: Number.parseFloat(getComputedStyle(panel).top) || panel.offsetTop,
      startOffset: Number(dialog.dataset.dragOffsetY || 0),
      dialogTop: dialogBounds.top,
      dialogBottom: dialogBounds.bottom,
      parentHeight: panel.offsetParent?.clientHeight ?? window.innerHeight,
      panelHeight: panel.offsetHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleDragMove = (event) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const distance = event.clientY - drag.startY;
    if (drag.isFixed) {
      const nextOffset = clamp(
        drag.startOffset + distance,
        8 - drag.dialogTop,
        window.innerHeight - 8 - drag.dialogBottom,
      );
      drag.dialog.style.transform = `translateY(${nextOffset}px)`;
      drag.dialog.dataset.dragOffsetY = String(nextOffset);
      return;
    }

    const nextTop = clamp(
      drag.startTop + distance,
      8,
      drag.parentHeight - drag.panelHeight - 8,
    );
    drag.panel.style.top = `${nextTop}px`;
  };

  const handleDragEnd = (event) => {
    if (dragState.current?.pointerId !== event.pointerId) return;
    dragState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="ask-backdrop">
    <section
      className="ask-dialog"
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-label={t('ask.title')}
    >
      <button
        className="ask-drag-handle"
        type="button"
        aria-label={t('ask.move')}
        aria-keyshortcuts="ArrowUp ArrowDown"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            movePanelBy(event.key === 'ArrowUp' ? -24 : 24);
          }
        }}
      />
      <header className="ask-header">
        <h2>{t('ask.title')}</h2>
        <span className="ask-title-rule" aria-hidden="true" />
        <button className="ask-close" type="button" onClick={onClose} aria-label={t('ask.close')}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="ask-suggestions">
        <img
          src={ASSETS.surfyWink}
          alt={t('ask.imageAlt')}
          width="1000"
          height="1000"
          loading="lazy"
          decoding="async"
        />
        <div className="ask-chips">
          {SURFY_QUESTION_KEYS.map((key) => (
            <button type="button" className="ask-chip" key={key} onClick={() => submit(t(key))}>
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      <div className="ask-messages" aria-live="polite">
        {messages.length === 0 && <p className="ask-empty">{t('ask.fallback')}</p>}
        {messages.map((message, index) => (
          <p
            className={`chat-bubble ${message.role === 'user' ? 'chat-user' : 'chat-surfy'}`}
            key={`${message.role}-${index}`}
          >
            {message.text}
          </p>
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
        <input
          id="ask-input"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('ask.input')}
          autoComplete="off"
        />
        <button type="submit" disabled={!draft.trim()} aria-label={t('ask.send')}>
          <Send size={20} aria-hidden="true" />
        </button>
      </form>
    </section>
    </div>
  );
}
