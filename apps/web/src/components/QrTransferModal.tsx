'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { api, extractErrorMessage } from '../lib/api';
import {
  QrCode,
  Send,
  ArrowDownLeft,
  Copy,
  Check,
  Download,
  X,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  Sparkles,
  Smartphone,
  ExternalLink,
  Clipboard,
  Camera,
  Upload,
} from 'lucide-react';

interface QrTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userAccountNumber: string;
  initialTab?: 'RECEIVE' | 'SEND';
  initialRecipient?: string;
  initialAmount?: string;
  onTransferSuccess?: () => void;
  onOpenExternalDeposit?: () => void;
}

export function QrTransferModal({
  isOpen,
  onClose,
  user,
  userAccountNumber,
  initialTab = 'RECEIVE',
  initialRecipient = '',
  initialAmount = '',
  onTransferSuccess,
  onOpenExternalDeposit,
}: QrTransferModalProps) {
  const [tab, setTab] = useState<'RECEIVE' | 'SEND'>(initialTab);
  const [receiveMode, setReceiveMode] = useState<'AVORA_ACCOUNT' | 'USDT_CRYPTO'>('AVORA_ACCOUNT');

  // Receive State
  const [requestedAmount, setRequestedAmount] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

  // Send State
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [verifiedRecipient, setVerifiedRecipient] = useState<any>(null);
  const [sendLoading, setSendLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // In-App Camera Scanner & QR Capture Feedback State
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraCaptureLock, setCameraCaptureLock] = useState<boolean>(false);
  const [capturedQrInfo, setCapturedQrInfo] = useState<{
    account: string;
    amount?: string;
    source: 'CAMERA' | 'IMAGE' | 'LINK';
    capturedAt: string;
  } | null>(null);
  const [scannerStatus, setScannerStatus] = useState<string>('Point your camera at an Avora Account QR Code...');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  // Play crisp audio + haptic confirmation feedback when a QR code is captured
  const playCaptureFeedback = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([70, 40, 110]);
      }
    } catch (e) {
      // ignore vibration errors
    }

    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // First tone (880Hz A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.09);

      // Second tone (1318.5Hz E6 - pleasant confirmation chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, now + 0.08);
      gain2.gain.setValueAtTime(0.15, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.24);
    } catch (e) {
      // ignore audio context restrictions
    }
  };

  // Official external receiving EVM wallet address for USDT deposits
  const [receivingAddress, setReceivingAddress] = useState<string>('0x18adf8B0DFBaC2C2c6A8EE1c59fF6cdFa74f47Ad');

  // Ensure jsQR universal decoder is loaded (required for iOS Safari / iPhone which lacks native BarcodeDetector)
  const ensureJsQrLoaded = (): Promise<any> => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if ((window as any).jsQR) return Promise.resolve((window as any).jsQR);

    return new Promise((resolve) => {
      const existing = document.getElementById('avora-jsqr-script') as HTMLScriptElement | null;
      if (existing) {
        if ((window as any).jsQR) {
          resolve((window as any).jsQR);
          return;
        }
        existing.addEventListener('load', () => resolve((window as any).jsQR));
        existing.addEventListener('error', () => resolve(null));
        return;
      }

      const script = document.createElement('script');
      script.id = 'avora-jsqr-script';
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.async = true;
      script.onload = () => resolve((window as any).jsQR);
      script.onerror = () => {
        const fallback = document.createElement('script');
        fallback.src = 'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js';
        fallback.async = true;
        fallback.onload = () => resolve((window as any).jsQR);
        fallback.onerror = () => resolve(null);
        document.head.appendChild(fallback);
      };
      document.head.appendChild(script);
    });
  };

  // Decode QR code from any HTMLVideoElement or HTMLImageElement using HTML5 Canvas + jsQR
  const decodeQrFromCanvasSource = (
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number
  ): string | null => {
    const jsQR = typeof window !== 'undefined' ? (window as any).jsQR : null;
    if (!jsQR || !sourceWidth || !sourceHeight) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Pass 1: Full frame scaled to max 720px
    const scale1 = Math.min(1, 720 / Math.max(sourceWidth, sourceHeight));
    const w1 = Math.max(1, Math.floor(sourceWidth * scale1));
    const h1 = Math.max(1, Math.floor(sourceHeight * scale1));
    canvas.width = w1;
    canvas.height = h1;
    ctx.drawImage(source, 0, 0, w1, h1);
    const imgData1 = ctx.getImageData(0, 0, w1, h1);
    const code1 = jsQR(imgData1.data, w1, h1, { inversionAttempts: 'attemptBoth' });
    if (code1 && code1.data) return code1.data;

    // Pass 2: Center 60% crop (zooms into QR code when pointing phone camera at a laptop screen)
    const crop60 = Math.floor(Math.min(sourceWidth, sourceHeight) * 0.6);
    if (crop60 > 80) {
      const sx = Math.floor((sourceWidth - crop60) / 2);
      const sy = Math.floor((sourceHeight - crop60) / 2);
      const targetSize = 480;
      canvas.width = targetSize;
      canvas.height = targetSize;
      ctx.drawImage(source, sx, sy, crop60, crop60, 0, 0, targetSize, targetSize);
      const imgData2 = ctx.getImageData(0, 0, targetSize, targetSize);
      const code2 = jsQR(imgData2.data, targetSize, targetSize, { inversionAttempts: 'attemptBoth' });
      if (code2 && code2.data) return code2.data;
    }

    // Pass 3: Tighter Center 40% crop (for screenshots or further camera distance)
    const crop40 = Math.floor(Math.min(sourceWidth, sourceHeight) * 0.4);
    if (crop40 > 60) {
      const sx = Math.floor((sourceWidth - crop40) / 2);
      const sy = Math.floor((sourceHeight - crop40) / 2);
      const targetSize = 420;
      canvas.width = targetSize;
      canvas.height = targetSize;
      ctx.drawImage(source, sx, sy, crop40, crop40, 0, 0, targetSize, targetSize);
      const imgData3 = ctx.getImageData(0, 0, targetSize, targetSize);
      const code3 = jsQR(imgData3.data, targetSize, targetSize, { inversionAttempts: 'attemptBoth' });
      if (code3 && code3.data) return code3.data;
    }

    // Pass 4: Horizontally Mirrored Frame (for Windows Laptops / MacBooks / Front Cameras with mirrored webcam drivers)
    canvas.width = w1;
    canvas.height = h1;
    ctx.save();
    ctx.translate(w1, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source, 0, 0, w1, h1);
    ctx.restore();
    const imgData4 = ctx.getImageData(0, 0, w1, h1);
    const code4 = jsQR(imgData4.data, w1, h1, { inversionAttempts: 'attemptBoth' });
    if (code4 && code4.data) return code4.data;

    return null;
  };

  // Helper to parse any QR payload (https URL, avora: URI, or raw account/email)
  const parseQrPayload = (raw: string): { account: string; amount?: string } => {
    const trimmed = raw.trim();
    if (
      trimmed.includes('payTo=') ||
      trimmed.includes('to=') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('avora:')
    ) {
      try {
        const queryPart = trimmed.includes('?') ? trimmed.split('?')[1] : trimmed;
        const params = new URLSearchParams(queryPart);
        const to = params.get('payTo') || params.get('to') || params.get('account');
        const amt = params.get('amount') || undefined;
        if (to) {
          return { account: to.trim(), amount: amt };
        }
      } catch (e) {
        // fallback
      }
    }
    // Also detect any AVR-XXXX-XXXX account code inside arbitrary text
    const avrMatch = trimmed.match(/AVR-\d{4}-\d{4}/i);
    if (avrMatch) {
      return { account: avrMatch[0].toUpperCase() };
    }
    return { account: trimmed };
  };

  // Stop active camera stream
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraCaptureLock(false);
    setCameraOpen(false);
  };

  // Lookup recipient by identifier
  const executeLookup = async (
    rawValue: string,
    prefillAmount?: string,
    autoFocusAmount = false
  ) => {
    const { account, amount } = parseQrPayload(rawValue);
    if (!account) return;

    setRecipientInput(account);
    if (amount) {
      setSendAmount(amount);
    } else if (prefillAmount) {
      setSendAmount(prefillAmount);
    }

    setLookupLoading(true);
    setErrorMsg(null);
    setVerifiedRecipient(null);

    try {
      const res = await api.post('/p2p/lookup-recipient', { identifier: account });
      if (res.data.success) {
        setVerifiedRecipient(res.data.data);
        if (autoFocusAmount && !amount && !prefillAmount) {
          setTimeout(() => {
            amountInputRef.current?.focus();
          }, 150);
        }
      }
    } catch (err: any) {
      setErrorMsg(
        extractErrorMessage(
          err,
          'Recipient not found. Please verify the Avora Account Number or registered email.'
        )
      );
    } finally {
      setLookupLoading(false);
    }
  };

  // Unified QR Capture UX handler (Audio/Haptic chime + Lock-On Overlay + Persistent Capture Banner + Auto-Verify)
  const handleQrCaptured = (rawQrText: string, source: 'CAMERA' | 'IMAGE' | 'LINK') => {
    const { account, amount } = parseQrPayload(rawQrText);
    if (!account) return;

    playCaptureFeedback();

    setCapturedQrInfo({
      account,
      amount,
      source,
      capturedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    });

    // Trigger recipient verification immediately
    executeLookup(rawQrText, amount, true);

    if (source === 'CAMERA') {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      // Freeze the video frame on the captured QR code for visual confirmation
      try {
        videoRef.current?.pause();
      } catch (e) {
        // ignore
      }
      setCameraCaptureLock(true);
      setScannerStatus(`QR Code Captured! Found ${account}`);
      setTimeout(() => {
        stopCamera();
      }, 900);
    } else {
      stopCamera();
    }
  };

  // Sync initialTab & initialRecipient when modal opens, and preload jsQR for instant iOS scanning
  useEffect(() => {
    if (isOpen) {
      ensureJsQrLoaded().catch(() => {});
      if (initialTab) setTab(initialTab);
      setErrorMsg(null);
      setSuccessMsg(null);
      if (initialRecipient) {
        setTab('SEND');
        setCapturedQrInfo({
          account: parseQrPayload(initialRecipient).account,
          amount: initialAmount || parseQrPayload(initialRecipient).amount,
          source: 'LINK',
          capturedAt: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        });
        executeLookup(initialRecipient, initialAmount, true);
      }
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, initialTab, initialRecipient, initialAmount]);

  // Load active receiving address configured by admin
  useEffect(() => {
    if (!isOpen) return;
    api.get('/wallet/deposit/instructions')
      .then((res) => {
        const addr = res.data?.data?.usdt?.BEP20?.address || res.data?.data?.usdt?.ERC20?.address;
        if (addr) setReceivingAddress(addr);
      })
      .catch(() => {});
  }, [isOpen]);

  // Generate QR Code dynamically using standard HTTPS URL with crisp module size for easy screen-to-phone scanning
  useEffect(() => {
    if (!isOpen) return;

    let qrContent = userAccountNumber;
    if (receiveMode === 'AVORA_ACCOUNT') {
      const baseOrigin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://avorabank.com';
      const amt = parseFloat(requestedAmount);
      if (!isNaN(amt) && amt > 0) {
        qrContent = `${baseOrigin}/dashboard?payTo=${encodeURIComponent(userAccountNumber)}&amount=${amt.toFixed(2)}`;
      } else {
        qrContent = `${baseOrigin}/dashboard?payTo=${encodeURIComponent(userAccountNumber)}`;
      }
    } else {
      qrContent = receivingAddress;
    }

    QRCode.toDataURL(qrContent, {
      width: 360,
      margin: 3,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [isOpen, receiveMode, userAccountNumber, requestedAmount, receivingAddress]);

  if (!isOpen) return null;

  // Start Live Camera Scanner (supports Windows Laptops, MacBooks, iPhones, iPads, and all Android devices)
  const startCameraWithMode = async (preferredMode: 'environment' | 'user') => {
    stopCamera();
    setErrorMsg(null);
    setCameraCaptureLock(false);
    setCapturedQrInfo(null);
    setCameraFacingMode(preferredMode);
    setScannerStatus('Initializing camera & QR engine...');
    await ensureJsQrLoaded();

    try {
      let stream: MediaStream;
      try {
        // Tier 1: High-definition request with preferred camera (rear camera on phones/tablets, webcam on laptops)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: preferredMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (constraintErr) {
        try {
          // Tier 2: Basic facingMode without resolution constraints (for older iPads / Androids / laptop drivers)
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: preferredMode },
            audio: false,
          });
        } catch (fallbackErr) {
          // Tier 3: Universal default video device (for Windows Laptops / MacBooks / USB webcams)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      streamRef.current = stream;
      setCameraOpen(true);
      setScannerStatus('Point your camera at an Avora Account QR Code...');

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(() => {});
        }
      }, 80);

      const nativeDetector =
        typeof window !== 'undefined' && 'BarcodeDetector' in window
          ? new (window as any).BarcodeDetector({ formats: ['qr_code'] })
          : null;

      scanIntervalRef.current = setInterval(async () => {
        const videoEl = videoRef.current;
        if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return;

        // 1. Universal HTML5 Canvas + jsQR scan (works on iOS Safari, iPadOS, macOS, Windows, and Android)
        try {
          const decoded = decodeQrFromCanvasSource(
            videoEl,
            videoEl.videoWidth,
            videoEl.videoHeight
          );
          if (decoded) {
            handleQrCaptured(decoded, 'CAMERA');
            return;
          }
        } catch (e) {
          // continue
        }

        // 2. Native BarcodeDetector hardware acceleration if available
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(videoEl);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleQrCaptured(barcodes[0].rawValue, 'CAMERA');
            }
          } catch (e) {
            // continue
          }
        }
      }, 200);
    } catch (err) {
      setErrorMsg(
        'Camera access was denied or unavailable. You can also upload a QR screenshot or paste the account number.'
      );
    }
  };

  const handleStartCamera = () => startCameraWithMode(cameraFacingMode);

  const handleSwitchCamera = () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    startCameraWithMode(nextMode);
  };

  // Handle QR Image Upload (supports iOS Safari via jsQR + HTML5 Canvas)
  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setCapturedQrInfo(null);
    await ensureJsQrLoaded();

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });

      const decoded = decodeQrFromCanvasSource(img, img.naturalWidth, img.naturalHeight);
      if (decoded) {
        handleQrCaptured(decoded, 'IMAGE');
        return;
      }

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          handleQrCaptured(barcodes[0].rawValue, 'IMAGE');
          return;
        }
      }
    } catch (err) {
      // fall through to error message
    }

    setErrorMsg(
      'Could not detect a clear QR code in that image. Try cropping closer to the QR square or enter the AVR-... account number below.'
    );
  };

  // Copy helper
  const handleCopy = (text: string, type: 'account' | 'address') => {
    navigator.clipboard.writeText(text);
    if (type === 'account') {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    } else {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  // Download QR image
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `Avora-Account-QR-${userAccountNumber}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  // Lookup Recipient from button click
  const handleLookup = async () => {
    if (!recipientInput.trim()) return;
    await executeLookup(recipientInput);
  };

  // Handle Send Execution
  const handleSendTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedRecipient) {
      setErrorMsg('Please click "Verify" on the recipient account before sending.');
      return;
    }
    const amt = parseFloat(sendAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid transfer amount.');
      return;
    }

    setSendLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.post('/p2p/transfer', {
        recipientIdentifier: verifiedRecipient.accountNumber || verifiedRecipient.recipientId,
        amount: amt,
        currency: 'USD',
        notes: notes.trim() || 'Avora Account Transfer',
        twoFactorCode: user?.twoFactorEnabled ? twoFactorCode : undefined,
      });

      if (res.data.success) {
        setSuccessMsg(`Successfully transferred $${amt.toFixed(2)} USD to ${verifiedRecipient.fullName} (${verifiedRecipient.accountNumber})!`);
        setSendAmount('');
        setNotes('');
        setTwoFactorCode('');
        setVerifiedRecipient(null);
        setRecipientInput('');
        if (onTransferSuccess) onTransferSuccess();
      }
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Account transfer failed. Check available balance or credentials.'));
    } finally {
      setSendLoading(false);
    }
  };

  const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.email || 'Avora Client');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5 my-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-sm shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Account &amp; QR Transfers
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Instant zero-fee account-to-account transfer via Avora Account Number or QR code
            </p>
          </div>
        </div>

        {/* Main Tab Toggle: Receive via QR vs Send Money */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setTab('RECEIVE');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'RECEIVE'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
            <span>My Account QR (Receive)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('SEND');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'SEND'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Send className="w-4 h-4 text-blue-500" />
            <span>Account Transfer (Send)</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: RECEIVE VIA ACCOUNT QR CODE */}
        {/* ===================================================================== */}
        {tab === 'RECEIVE' && (
          <div className="space-y-4 pb-1">
            {/* Mode Selector: Avora Account vs External USDT */}
            <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setReceiveMode('AVORA_ACCOUNT')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  receiveMode === 'AVORA_ACCOUNT'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Avora Account QR (Zero Fee)
              </button>
              <button
                type="button"
                onClick={() => setReceiveMode('USDT_CRYPTO')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  receiveMode === 'USDT_CRYPTO'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                External USDT Deposit QR
              </button>
            </div>

            {/* QR Card Presentation */}
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-3.5">
              
              <div className="p-2.5 bg-white rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 inline-block">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Avora Account Transfer QR Code"
                    className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl object-contain mx-auto"
                  />
                ) : (
                  <div className="w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center text-xs text-slate-400">
                    Generating Account QR...
                  </div>
                )}
                <div className="text-[10px] text-slate-400 font-mono pt-1 text-center font-bold">
                  {receiveMode === 'AVORA_ACCOUNT' ? 'Scan with Camera or Avora App' : 'Scan via Trust Wallet / Binance / OKX'}
                </div>
              </div>

              {/* Account Details Box */}
              {receiveMode === 'AVORA_ACCOUNT' ? (
                <div className="w-full space-y-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Account Holder Name
                    </span>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {userName}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-between">
                    <div className="text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Avora Account Number</span>
                      <span className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-wider select-all">
                        {userAccountNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(userAccountNumber, 'account')}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      {copiedAccount ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-1 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Official Custody Address (BEP-20 / ERC-20)
                  </span>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300">
                    <span className="truncate pr-2 font-bold select-all">{receivingAddress}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(receivingAddress, 'address')}
                      className="shrink-0 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-500 font-sans font-bold text-[11px]"
                    >
                      {copiedAddress ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Where to Scan Explainer Notice */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-500/20 text-left text-xs text-emerald-800 dark:text-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {receiveMode === 'AVORA_ACCOUNT'
                      ? 'How to scan or use this QR code:'
                      : 'How to scan with Trust Wallet / Crypto App:'}
                  </span>
                </div>
                {receiveMode === 'AVORA_ACCOUNT' ? (
                  <div className="space-y-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    <p>
                      • <strong>Using Phone Camera:</strong> Point any smartphone camera at this QR code to detect the Avora Account transfer details.
                    </p>
                    <p>
                      • <strong>Avora Bank Users:</strong> Another client can enter your Account Number (<code>{userAccountNumber}</code>) under the <em>Account Transfer (Send)</em> tab to send funds with zero fees.
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 font-medium pt-0.5">
                      ⚠️ <em>Note: Trust Wallet is for blockchain crypto deposits only. If you want to deposit USDT from Trust Wallet, click the <strong>&quot;External USDT Deposit QR&quot;</strong> tab above.</em>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    <p>
                      • <strong>Trust Wallet / Binance / OKX:</strong> Open your wallet &gt; Tap <strong>Send USDT (BEP-20)</strong> &gt; Tap the <strong>QR Scanner</strong> icon &gt; Scan this QR code.
                    </p>
                    <p>
                      • Funds will be credited automatically to your Avora balance upon on-chain block confirmation.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Optional Specific Amount Request */}
            {receiveMode === 'AVORA_ACCOUNT' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Optional: Request a Specific Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 500.00 (QR updates dynamically with requested amount)"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownloadQr}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download QR Code Image (PNG)</span>
            </button>

            {onOpenExternalDeposit && receiveMode === 'USDT_CRYPTO' && (
              <button
                type="button"
                onClick={onOpenExternalDeposit}
                className="w-full py-3 rounded-2xl font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Open Full Deposit Desk</span>
              </button>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: SEND ACCOUNT-TO-ACCOUNT TRANSFER */}
        {/* ===================================================================== */}
        {tab === 'SEND' && (
          <form onSubmit={handleSendTransfer} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* In-App QR Scanner (Camera + Upload) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cameraOpen ? stopCamera : handleStartCamera}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    cameraOpen
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-100/70'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>{cameraOpen ? 'Close Camera Scanner' : 'Scan QR with Camera'}</span>
                </button>

                <label className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Upload QR Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {cameraOpen && (
                <div
                  className={`p-3 rounded-2xl bg-slate-950 border relative overflow-hidden space-y-2 transition-all duration-300 ${
                    cameraCaptureLock
                      ? 'border-emerald-400 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.35)]'
                      : 'border-emerald-500/40'
                  }`}
                >
                  <div className="relative w-full h-56 rounded-xl overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Viewfinder targeting guide */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div
                        className={`w-44 h-44 rounded-2xl border-2 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] relative transition-all duration-300 ${
                          cameraCaptureLock
                            ? 'scale-105 border-emerald-400 bg-emerald-500/20'
                            : 'border-emerald-400/80'
                        }`}
                      >
                        <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                        <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                        <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                        {/* Animated laser scan line while searching */}
                        {!cameraCaptureLock && (
                          <div className="absolute inset-x-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* Instant Lock-On Capture Overlay inside Camera Viewfinder */}
                    {cameraCaptureLock && (
                      <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.8)] mb-2.5 animate-bounce">
                          <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                        </div>
                        <div className="text-sm font-black uppercase tracking-wider text-white">
                          QR Code Captured!
                        </div>
                        {capturedQrInfo?.account && (
                          <div className="mt-1.5 px-3 py-1 rounded-full bg-black/50 border border-emerald-400/50 text-emerald-300 font-mono text-xs font-bold">
                            {capturedQrInfo.account}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-1">
                    <div className="text-[11px] text-emerald-400 font-mono font-bold truncate">
                      {scannerStatus || 'Point your camera at an Avora Account QR Code...'}
                    </div>
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 shrink-0 transition-colors cursor-pointer"
                    >
                      Switch Camera
                    </button>
                  </div>
                </div>
              )}

              {/* Persistent QR Captured Confirmation Banner */}
              {capturedQrInfo && !cameraOpen && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/10 border-2 border-emerald-500/50 dark:border-emerald-500/40 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/30 mt-0.5">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-emerald-800 dark:text-emerald-200">
                            QR Code Captured
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            {capturedQrInfo.source === 'CAMERA'
                              ? 'Camera Scan'
                              : capturedQrInfo.source === 'IMAGE'
                                ? 'Uploaded Image'
                                : 'QR Link'}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-black text-slate-900 dark:text-white bg-white/80 dark:bg-slate-900/90 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            {capturedQrInfo.account}
                          </span>
                          {capturedQrInfo.amount && (
                            <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                              • Amount: ${capturedQrInfo.amount}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300/90 font-medium">
                          {lookupLoading ? (
                            <span className="inline-flex items-center gap-1.5 animate-pulse">
                              Verifying recipient account details...
                            </span>
                          ) : verifiedRecipient ? (
                            <span>
                              Matched to <strong>{verifiedRecipient.fullName}</strong> — ready to enter amount below
                            </span>
                          ) : (
                            <span>Account populated from QR code</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartCamera}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white/80 hover:bg-white dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0 transition-colors cursor-pointer"
                    >
                      Rescan
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Recipient Account Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Recipient Avora Account Number or Registered Email
                </label>
                {capturedQrInfo && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Auto-filled from QR
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. AVR-2488-6560 or client@domain.com"
                  value={recipientInput}
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    setVerifiedRecipient(null);
                    setCapturedQrInfo(null);
                  }}
                  className={`w-full px-4 py-2.5 rounded-2xl text-xs border bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold transition-all ${
                    capturedQrInfo
                      ? 'border-emerald-500/70 ring-2 ring-emerald-500/15'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        executeLookup(text);
                      }
                    } catch (e) {
                      // clipboard permission denied
                    }
                  }}
                  title="Paste from clipboard"
                  className="px-3 py-2.5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 cursor-pointer shadow-sm transition-all flex items-center gap-1"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Paste</span>
                </button>
                <button
                  type="button"
                  disabled={lookupLoading || !recipientInput.trim()}
                  onClick={handleLookup}
                  className="px-4 py-2.5 rounded-2xl font-bold text-xs bg-slate-900 dark:bg-emerald-600 text-white shrink-0 disabled:opacity-50 hover:bg-black dark:hover:bg-emerald-500 cursor-pointer shadow-sm transition-all"
                >
                  {lookupLoading ? 'Checking...' : 'Verify'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Enter an Avora Account Number (`AVR-...`), registered email, or scan/paste any Avora QR link.
              </p>
            </div>

            {/* Verified Counterparty Badge */}
            {verifiedRecipient && (
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-1.5 animate-in fade-in">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Recipient Verified</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold">
                    {verifiedRecipient.kycStatus === 'APPROVED' ? 'KYC Verified' : 'Registered Client'}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {verifiedRecipient.fullName}
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Account: <strong>{verifiedRecipient.accountNumber}</strong> • {verifiedRecipient.emailMasked}
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Amount to Send (USD)
                </label>
                <div className="flex items-center gap-1">
                  {['50', '100', '500', '1000'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSendAmount(val)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer"
                    >
                      +${val}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-base font-bold text-slate-400">$</span>
                <input
                  ref={amountInputRef}
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="0.00"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-2xl text-base font-black font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Memo Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Memo / Reference Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Account transfer, invoice settlement..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
              />
            </div>

            {/* 2FA if enabled */}
            {user?.twoFactorEnabled && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  6-Digit Authenticator (2FA) Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl text-center text-base font-mono tracking-widest border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Submit Transfer Button */}
            <button
              type="submit"
              disabled={sendLoading || !verifiedRecipient || !sendAmount}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sendLoading ? 'Executing Transfer...' : 'Send Account Transfer (0% Fee)'}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
