import { analyzeTextAndUrls } from './text.js';
import { analyzeUrl } from './url.js';
import { decideRisk } from './decision.js';
import { inspectImage } from './media.js';
import { validateImageFile } from './fileValidation.js';

async function checkUrlOnline(url) {
  const workerUrl = import.meta.env.VITE_WORKER_URL;
  if (!navigator.onLine || !workerUrl) {
    return { matched: false, unavailable: true };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${workerUrl.replace(/\/$/, '')}/check-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`online_check_${response.status}`);
    const result = await response.json();
    return { matched: Boolean(result.matched), unavailable: false };
  } catch (error) {
    console.error('Online URL check failed:', error);
    return { matched: false, unavailable: true };
  } finally {
    window.clearTimeout(timeout);
  }
}

function uniqueSignals(signals) {
  const seen = new Set();
  return signals.filter((signal) => {
    const key = `${signal.id}:${signal.evidence ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectTextSignals(content) {
  return analyzeTextAndUrls(content);
}

export async function analyzeInput(tab, inputs, { onlineLookup = true } = {}) {
  let content = '';
  let signals = [];
  let urls = [];
  let mediaInfo = null;

  if (tab === 'text') {
    content = inputs.message.trim();
    ({ signals, urls } = collectTextSignals(content));
  } else if (tab === 'links') {
    content = inputs.url.trim();
    const result = analyzeUrl(content);
    signals = result.signals;
    urls = result.normalized && /^https?:\/\//i.test(result.normalized) ? [result.normalized] : [];
  } else if (tab === 'image' || tab === 'qr') {
    const file = tab === 'image' ? inputs.image : inputs.qr;
    if (tab === 'qr' && inputs.qrValue) {
      mediaInfo = { text: '', qrValue: inputs.qrValue };
    } else {
      await validateImageFile(file);
      mediaInfo = await inspectImage(file, { includeOcr: tab === 'image' });
    }
    content = [mediaInfo.qrValue, mediaInfo.text].filter(Boolean).join('\n');

    if (mediaInfo.qrValue) {
      const decoded = collectTextSignals(mediaInfo.qrValue);
      signals.push(...decoded.signals);
      urls.push(...decoded.urls);
    }
    if (tab === 'image' && mediaInfo.text) {
      const ocr = collectTextSignals(mediaInfo.text);
      signals.push(...ocr.signals);
      urls.push(...ocr.urls);
    }
    if (tab === 'qr' && !mediaInfo.qrValue) {
      return {
        level: 'unknown',
        score: 0,
        signals: [],
        usedOnline: false,
        onlineUnavailable: false,
        checkedText: '',
        errorKey: 'error.qr_missing',
      };
    }
    if (tab === 'image' && !mediaInfo.text && !mediaInfo.qrValue) {
      return {
        level: 'unknown',
        score: 0,
        signals: [],
        usedOnline: false,
        onlineUnavailable: false,
        checkedText: '',
        errorKey: 'error.ocr_failed',
      };
    }
  }

  let onlineMatch = false;
  let onlineUnavailable = false;
  const firstUrl = urls[0];
  if (firstUrl && onlineLookup) {
    const online = await checkUrlOnline(firstUrl);
    onlineMatch = online.matched;
    onlineUnavailable = online.unavailable;
    if (onlineMatch) {
      signals.push({
        id: 'online_match',
        severity: 3,
        weight: 8,
        evidence: firstUrl,
      });
    }
  } else if (tab === 'links' && onlineLookup) {
    onlineUnavailable = true;
  }

  return {
    ...decideRisk(uniqueSignals(signals), content, { onlineMatch, onlineUnavailable }),
    mediaInfo,
  };
}
