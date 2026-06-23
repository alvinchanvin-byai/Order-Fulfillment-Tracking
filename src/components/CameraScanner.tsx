/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';

interface CameraScannerProps {
  onScanSuccess: (barcode: string) => void;
  active: boolean;
}

export function CameraScanner({ onScanSuccess, active }: CameraScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!active) {
      setError(null);
      return;
    }

    setIsInitializing(true);
    setError(null);

    let isMounted = true;
    let html5QrCode: Html5Qrcode | null = null;

    // Create the instance
    try {
      html5QrCode = new Html5Qrcode("qr-reader");
      qrCodeInstanceRef.current = html5QrCode;
    } catch (e: any) {
      console.error("Html5Qrcode creation error:", e);
      if (isMounted) {
        setError("Could not initialize the scanning engine. Please refresh.");
        setIsInitializing(false);
      }
      return;
    }

    const formats = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODABAR,
      Html5QrcodeSupportedFormats.ITF
    ];

    const config = {
      fps: 20,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const width = Math.floor(viewfinderWidth * 0.85);
        const height = Math.floor(viewfinderHeight * 0.65);
        return {
          width: Math.max(Math.min(width, 480), 250),
          height: Math.max(Math.min(height, 280), 150)
        };
      },
      formatsToSupport: formats,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    };

    // Delay start slightly to allow DOM to render perfectly before canvas binding
    const startTimeout = setTimeout(() => {
      if (!isMounted || !html5QrCode) return;

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (isMounted && decodedText) {
            onScanSuccess(decodedText);
          }
        },
        () => {
          // background scanning frame did not find barcode. Ignore.
        }
      )
      .then(() => {
        if (isMounted) {
          setIsInitializing(false);
        }
      })
      .catch((err: any) => {
        console.error("Camera start failed:", err);
        if (isMounted) {
          setError(
            err?.message || 
            "Permission denied or camera is in use. Please check your browser's site permissions."
          );
          setIsInitializing(false);
        }
      });
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(startTimeout);
      
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop()
            .then(() => {
              console.log("Scanner stopped successfully");
            })
            .catch((stopErr) => {
              console.warn("Silent clean-up stop error:", stopErr);
            });
        }
      }
    };
  }, [active, onScanSuccess]);

  if (!active) {
    return (
      <div id="qr-camera-placeholder" className="relative h-48 bg-slate-800 flex flex-col items-center justify-center rounded-2xl border-2 border-slate-700 border-dashed text-slate-400 overflow-hidden">
        <CameraOff className="w-10 h-10 mb-2 opacity-50 text-slate-500" />
        <span className="text-sm font-medium">Camera input source offline</span>
        <span className="text-xs opacity-75 mt-1">Enable camera scanner above to activate scan feed</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {error ? (
        <div className="bg-red-950/45 text-red-300 text-sm p-4 rounded-2xl flex items-start gap-2.5 border-2 border-red-900 shadow-[3px_3px_0px_0px_rgba(239,68,68,0.2)]">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-red-400 uppercase tracking-widest text-xs">Camera Access Blocked</p>
            <p className="text-xs opacity-90 leading-relaxed font-semibold">{error}</p>
            <p className="text-[10px] text-slate-300 font-medium font-sans mt-2 leading-normal">
              💡 <span className="font-bold text-white">How to fix:</span> Please look up at your browser's address/search bar, click the camera icon (or lock settings icon), and explicitly change the camera permission to <strong className="text-emerald-400">"Allow"</strong>. Then disable and re-enable the camera.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border-2 border-slate-700 shadow-inner bg-slate-950 relative min-h-[220px] flex items-center justify-center">
          <div id="qr-reader" className="w-full text-slate-100" style={{ border: 'none' }} />
          
          {isInitializing && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-slate-300 gap-3">
              <svg className="animate-spin h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 animate-pulse">Requesting Camera Access...</span>
            </div>
          )}

          {!isInitializing && (
            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full z-10 animate-pulse flex items-center gap-1">
              <Camera className="w-3 h-3" /> Live Camera Active
            </div>
          )}
        </div>
      )}
    </div>
  );
}
