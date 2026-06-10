import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, Check } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  continuous?: boolean;
  scanSuccessItem?: any;
}

export function BarcodeScanner({ isOpen, onClose, onScan, continuous = false, scanSuccessItem = null }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [toastItem, setToastItem] = useState<any>(null);
  const lastScanRef = useRef<{ code: string | null, time: number }>({ code: null, time: 0 });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionId = "html5qr-code-full-region";
  
  // Create an Audio context lazily for success sound
  const playSuccessSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // High pitch beep
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch(e) {
      console.warn("AudioContext prohibited or failed", e);
    }
  };

  // Mutation observer to make sure any dynamically inserted video elements on iOS have proper playsinline/autoplay attributes
  useEffect(() => {
    if (!isOpen) return;
    
    const container = document.getElementById(scannerRegionId);
    if (!container) return;
    
    const applyVideoAttributes = (video: HTMLVideoElement) => {
      video.setAttribute('playsinline', 'true');
      (video as any).playsInline = true;
      video.setAttribute('autoplay', 'true');
      video.autoplay = true;
      video.setAttribute('muted', 'true');
      video.muted = true;
      
      // Enforce play
      if (video.paused) {
        video.play().catch(err => {
          console.warn("Attempt to autoplay video element failed:", err);
        });
      }
    };

    // Apply immediately to any existing video elements
    container.querySelectorAll('video').forEach(applyVideoAttributes);

    // Watch for new video elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) {
            applyVideoAttributes(node);
          } else if (node instanceof HTMLElement) {
            node.querySelectorAll('video').forEach(applyVideoAttributes);
          }
        });
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [isOpen]);

  useEffect(() => {
    if (scanSuccessItem) {
      setToastItem(scanSuccessItem);
      const timer = setTimeout(() => setToastItem(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [scanSuccessItem]);

  useEffect(() => {
    let active = true;

    const runInit = async () => {
      if (isOpen) {
        if (active) {
          await startScanner();
        }
      }
    };

    runInit();

    return () => {
      active = false;
      stopScanner();
      
      // Failsafe: Access the current srcObject of the video inside the scanner region and strictly stop tracks
      const container = document.getElementById(scannerRegionId);
      if (container) {
        const video = container.querySelector('video');
        if (video && video.srcObject) {
           const stream = video.srcObject as MediaStream;
           if (stream && typeof stream.getTracks === 'function') {
             stream.getTracks().forEach(track => {
               try {
                 track.stop();
               } catch (err) {}
             });
           }
           try {
             video.srcObject = null;
           } catch (_) {}
        }
      }
    };
  }, [isOpen, facingMode]);

  const startScanner = async () => {
    try {
      setCameraError(null);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {
          console.warn("Error stopping previous scanner instance", e);
        }
      }

      const html5QrCode = new Html5Qrcode(scannerRegionId);
      scannerRef.current = html5QrCode;

      const cameraIdOrConfig = { facingMode: facingMode };
      
      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39
        ]
      };

      await html5QrCode.start(
        cameraIdOrConfig,
        config,
        (decodedText) => {
          // Immediately sanitize the scanned output to avoid whitespace/case-sensitivity issues
          const sanitizedText = decodedText.trim().toUpperCase();
          
          if (sanitizedText === lastScanRef.current.code && Date.now() - lastScanRef.current.time < 1200) {
            return;
          }
          lastScanRef.current = { code: sanitizedText, time: Date.now() };

          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          onScan(sanitizedText);
          if (continuous) {
            playSuccessSound();
          } else {
            stopScanner();
            onClose();
          }
        },
        (errorMessage) => {
          // parse error, ignore it.
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Error starting scanner", err);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('NotAllowedError') || err?.name === 'PermissionDeniedError') {
        setCameraError("Camera access denied. Please enable camera permissions in your browser/iOS Settings. If you are running inside the AI Studio preview frame, please open the app in a new tab (using the arrow icon in the top right corner) to allow camera access.");
      } else if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError') {
        setCameraError("Overconstrained camera settings. The requested camera properties are not supported by your device.");
      } else {
        setCameraError(`Could not access camera: ${err?.message || err || "Unknown camera issue"}. Please ensure your camera is not being used by another application and permissions are granted.`);
      }
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err: any) {
        // Suppress transition errors common during sudden unmounts
        if (err?.message && err.message.includes("already under transition")) {
          console.warn("Scanner transition overlap suppressed.");
        } else {
          console.error("Error stopping scanner", err);
        }
      } finally {
        setIsScanning(false);
      }
    }

    // Access the current srcObject of the video inside the scanner region and stop tracks
    const container = document.getElementById(scannerRegionId);
    if (container) {
      const video = container.querySelector('video');
      if (video && video.srcObject) {
         const stream = video.srcObject as MediaStream;
         if (stream && typeof stream.getTracks === 'function') {
           stream.getTracks().forEach(track => {
             try {
               track.stop();
               console.log("Stopped track:", track.label);
             } catch (err) {
               console.warn("Failed to stop track", err);
             }
           });
         }
         try {
           video.srcObject = null;
         } catch (_) {}
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-200/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#f2f2f2] border border-gray-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 text-gray-900 font-medium">
            <Camera className="text-[#961b2b]" size={20} />
            <span>Scan Barcode</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="relative bg-[#111] aspect-square flex items-center justify-center overflow-hidden">
          <div id={scannerRegionId} className="w-full h-full" />
          
          {toastItem && (
            <div 
              className="absolute bottom-10 left-1/2 z-50 flex items-center"
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(12px)',
                borderRadius: '50px',
                padding: '12px 24px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
                gap: '10px',
                color: '#111',
                fontWeight: 500,
                fontSize: '14px',
                animation: 'slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="text-emerald-500 stroke-[3px]" size={12} />
              </div>
              Added: <span className="font-semibold line-clamp-1 max-w-[150px]">{toastItem.name}</span>
            </div>
          )}

          {/* Custom Overlay UI (only visible when scanning) */}
          {isScanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              {/* Single targeting box container with a strict square ratio and a very light surrounding shadow-mask */}
              <div 
                className="relative w-[250px] h-[250px]"
                style={{
                  boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.15)',
                }}
              >
                {/* 4 Clean White Corner Brackets */}
                {/* Top-Left */}
                <div 
                  className="absolute"
                  style={{
                    top: 0,
                    left: 0,
                    width: '40px',
                    height: '40px',
                    borderTop: '4px solid white',
                    borderLeft: '4px solid white',
                    borderTopLeftRadius: '4px',
                  }}
                />
                
                {/* Top-Right */}
                <div 
                  className="absolute"
                  style={{
                    top: 0,
                    right: 0,
                    width: '40px',
                    height: '40px',
                    borderTop: '4px solid white',
                    borderRight: '4px solid white',
                    borderTopRightRadius: '4px',
                  }}
                />

                {/* Bottom-Left */}
                <div 
                  className="absolute"
                  style={{
                    bottom: 0,
                    left: 0,
                    width: '40px',
                    height: '40px',
                    borderBottom: '4px solid white',
                    borderLeft: '4px solid white',
                    borderBottomLeftRadius: '4px',
                  }}
                />

                {/* Bottom-Right */}
                <div 
                  className="absolute"
                  style={{
                    bottom: 0,
                    right: 0,
                    width: '40px',
                    height: '40px',
                    borderBottom: '4px solid white',
                    borderRight: '4px solid white',
                    borderBottomRightRadius: '4px',
                  }}
                />

                {/* Laser Animation */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,1)] animate-[scan_2s_linear_infinite] z-20"></div>
              </div>
              
              <div className="absolute top-[20px] text-xs font-semibold tracking-wider text-white bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-md z-20 shadow-sm border border-white/10 uppercase">
                Align QR Code in Square
              </div>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#961b2b]/10 flex items-center justify-center mb-4">
                <Camera className="text-[#961b2b]" size={24} />
              </div>
              <p className="text-gray-900 font-medium mb-2">Camera Error</p>
              <p className="text-sm text-gray-500">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-gray-200 flex justify-between gap-3">
          <button 
            type="button"
            onClick={toggleCamera}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-mono"
          >
            <RefreshCw size={16} />
            Flip Camera
          </button>
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#961b2b] hover:bg-[#961b2b]/90 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popFloat {
          0% { transform: scale(0.9) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUpFade {
          0% { opacity: 0; transform: translateY(20px) translateX(-50%); }
          100% { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
        #html5qr-code-full-region video {
          object-fit: cover;
          border-radius: 0;
        }
        /* Hide any camera scan region border generated by html5-qrcode library */
        div[id$="__scan_region"] {
          border: none !important;
        }
        #html5qr-code-full-region {
          border: none !important;
        }
      `}</style>
    </div>
  );
}
