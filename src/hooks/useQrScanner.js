import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/**
 * Camera + jsQR scanning loop shared by the Doctor panel and the Entry gate.
 *
 *   const { videoRef, canvasRef, active, error, start, stop } = useQrScanner({
 *     onDetect: (text) => …,      // called with the raw QR text
 *     stopOnDetect: true,         // doctor panel: switch the camera off after a hit
 *     cooldownMs: 3000,           // entry gate: ignore the same code for 3 s while the camera keeps running
 *   });
 *
 * Render <video ref={videoRef} playsInline muted /> and <canvas ref={canvasRef} /> (canvas can be hidden).
 */
export default function useQrScanner({ onDetect, intervalMs = 300, stopOnDetect = false, cooldownMs = 0, idealSize } = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const lastRef = useRef({ text: '', at: 0 });
  const onDetectRef = useRef(onDetect);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    setError('');
    try {
      const video = { facingMode: { ideal: 'environment' } };
      if (idealSize) {
        video.width = { ideal: idealSize.width };
        video.height = { ideal: idealSize.height };
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      streamRef.current = stream;
      const el = videoRef.current;
      if (!el) {
        stop();
        return;
      }
      el.srcObject = stream;
      await el.play();
      setActive(true);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      timerRef.current = setInterval(() => {
        if (!streamRef.current || !el.videoWidth || !el.videoHeight) return;
        canvas.width = el.videoWidth;
        canvas.height = el.videoHeight;
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (!code || !code.data) return;
        const now = Date.now();
        if (cooldownMs && code.data === lastRef.current.text && now - lastRef.current.at < cooldownMs) return;
        lastRef.current = { text: code.data, at: now };
        if (stopOnDetect) stop();
        onDetectRef.current?.(code.data);
      }, intervalMs);
    } catch (err) {
      stop();
      if (err?.name === 'NotAllowedError') setError('Camera permission denied. Please allow camera access.');
      else if (err?.name === 'NotFoundError') setError('No camera found on this device.');
      else if (!window.isSecureContext) setError('Camera needs a secure (https) connection.');
      else setError(`Camera error: ${err?.message || 'could not start camera'}`);
    }
  }, [cooldownMs, idealSize, intervalMs, stop, stopOnDetect]);

  /** Forget the last scan so the same QR can be scanned again immediately (entry gate "Clear & Scan Next"). */
  const resetCooldown = useCallback(() => {
    lastRef.current = { text: '', at: 0 };
  }, []);

  useEffect(() => stop, [stop]); // always release the camera when the page unmounts

  return { videoRef, canvasRef, active, error, start, stop, resetCooldown };
}
