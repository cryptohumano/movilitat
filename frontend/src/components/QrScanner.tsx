import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const CONTAINER_ID = 'qr-reader-checador';

interface QrScannerProps {
  onScan: (qrData: string) => void;
  onError?: (err: string) => void;
  className?: string;
}

export function QrScanner({ onScan, onError, className = '' }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setCameraError(null);
    container.id = CONTAINER_ID;

    // Evitar doble inicialización (p. ej. React Strict Mode monta dos veces)
    if (scannerRef.current?.getState() === 2) {
      return;
    }
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      } catch {
        // ignorar si ya estaba limpio
      }
      scannerRef.current = null;
    }
    // Limpiar cualquier video anterior que la librería haya dejado (evita doble cámara)
    container.innerHTML = '';

    const scanner = new Html5Qrcode(CONTAINER_ID);
    scannerRef.current = scanner;

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
        scannerRef.current = null;
      });

    return () => {
      const scan = scannerRef.current;
      scannerRef.current = null;
      if (scan?.isScanning) {
        scan
          .stop()
          .then(() => {
            try {
              scan.clear();
            } catch {
              // ignorar
            }
            if (containerRef.current) containerRef.current.innerHTML = '';
          })
          .catch(() => {
            if (containerRef.current) containerRef.current.innerHTML = '';
          });
      } else {
        try {
          if (scan) scan.clear();
        } catch {
          // ignorar
        }
        if (containerRef.current) containerRef.current.innerHTML = '';
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
