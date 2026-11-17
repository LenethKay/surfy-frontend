import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X } from 'lucide-react';

const MAX_CAPTURE_DIMENSION = 1920;
const MAX_SCAN_DIMENSION = 1100;

export default function CameraModal({ t, target, onCapture, onClose }) {
  const videoRef = useRef(null);
  const dialogRef = useRef(null);
  const streamRef = useRef(null);
  const [errorKey, setErrorKey] = useState('');
  const [decodedValue, setDecodedValue] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll('button:not([disabled])'));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let animationFrame = 0;
    let lastScan = 0;
    const scanCanvas = document.createElement('canvas');
    const scanContext = scanCanvas.getContext('2d', { willReadFrequently: true });

    const scanFrame = () => {
      if (!active || target !== 'qr') return;
      const video = videoRef.current;
      const now = performance.now();
      if (video?.videoWidth && video.videoHeight && scanContext && now - lastScan >= 120) {
        lastScan = now;
        const scale = Math.min(1, MAX_SCAN_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
        scanCanvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        scanCanvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        scanContext.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
        const image = scanContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
        const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
        if (decoded?.data) setDecodedValue(decoded.data);
      }
      animationFrame = window.requestAnimationFrame(scanFrame);
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorKey('camera.denied');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (target === 'qr') scanFrame();
        }
      } catch (error) {
        console.warn('Camera access unavailable:', error);
        if (active) setErrorKey('camera.denied');
      }
    };
    startCamera();
    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [target]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || isCapturing) return;
    setIsCapturing(true);
    try {
      const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas_unavailable');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('capture_failed');
      const file = new File([blob], `surfare-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file, decodedValue);
    } catch (error) {
      console.error('Camera capture failed:', error);
      setErrorKey('camera.captureFailed');
    } finally {
      setIsCapturing(false);
    }
  };

  const isQrMode = target === 'qr';

  return (
    <div
      className="camera-catcher"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="camera-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('camera.title')}
      >
        <button className="camera-close" type="button" onClick={onClose} aria-label={t('camera.close')}>
          <X size={20} aria-hidden="true" />
        </button>
        <h2>{t('camera.title')}</h2>
        <p>{isQrMode ? t('camera.scanning') : t('camera.permission')}</p>
        <div className="camera-preview">
          <video ref={videoRef} playsInline muted aria-label={t('camera.title')} />
          {errorKey && <p className="camera-error" role="alert">{t(errorKey)}</p>}
        </div>
        {isQrMode && decodedValue && (
          <div className="camera-decoded" aria-live="polite">
            <strong>{t('camera.found')}</strong>
            <p>{decodedValue}</p>
          </div>
        )}
        <button
          className="camera-capture"
          type="button"
          disabled={Boolean(errorKey) || isCapturing || (isQrMode && !decodedValue)}
          onClick={capture}
        >
          <Camera size={19} aria-hidden="true" />
          {isQrMode ? t('camera.useQr') : t('camera.capture')}
        </button>
      </section>
    </div>
  );
}
