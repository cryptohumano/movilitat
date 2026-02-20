import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  onScan: (qrData: string) => void;
  onError?: (err: string) => void;
  className?: string;
}

export function QrScanner({ onScan, onError, className = '' }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const id = 'qr-reader-' + Math.random().toString(36).slice(2);
    container.id = id;

    const scanner = new Html5Qrcode(id);

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => {
          onScanRef.current(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        const msg = err?.message || 'No se pudo acceder a la cámara';
        setCameraError(msg);
        onError?.(msg);
      });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [onError]);

  if (cameraError) {
    return (
      <div className={`rounded-xl bg-destructive/10 border border-destructive/30 p-6 text-center ${className}`}>
        <p className="text-destructive text-sm">{cameraError}</p>
        <p className="text-muted-foreground text-xs mt-2">
          Usa la búsqueda por placa como alternativa
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-xl overflow-hidden bg-black min-h-[280px] ${className}`}
    />
  );
}
