import React, { useEffect, useState } from 'react';
import { Download, Wifi, WifiOff, CheckCircle2, Smartphone, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [swReady, setSwReady] = useState<boolean>(false);

  useEffect(() => {
    // Register service worker for offline asset caching
    try {
      registerSW({
        immediate: true,
        onOfflineReady() {
          setSwReady(true);
        },
        onRegistered() {
          setSwReady(true);
        },
      });
    } catch {
      // Ignore if running in an environment where SW registration is restricted
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    swReady,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, swReady, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  return (
    <div className="flex items-center gap-2">
      {/* Live Offline / Online Status Pill */}
      <div
        data-hw-title={isOnline ? 'OFFLINE-READY STUDIO ENGINE' : 'OFFLINE MODE ACTIVE'}
        data-hw-func={
          isOnline
            ? 'All synthesizer voices, electric bass guitars, 64 MPC drum pads, and beat sequences are generated via Web Audio API and auto-saved to local storage so the studio works 100% offline.'
            : 'You are currently offline. All instruments, beat recording, MIDI/Audio export, and local patch storage continue to work without internet.'
        }
        data-hw-state={isOnline ? (swReady ? 'CACHED FOR OFFLINE' : 'LOCAL ENGINE READY') : 'WORKING OFFLINE'}
        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono-tabular font-semibold flex items-center gap-1.5 transition-all select-none ${
          isOnline
            ? 'bg-[#111318] border-emerald-500/35 text-emerald-300'
            : 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Offline Ready</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Offline Mode</span>
          </>
        )}
      </div>

      {/* Install App Button (Hidden when already installed in standalone mode) */}
      {!isInstalled && (
        <>
          {isInstallable ? (
            <button
              type="button"
              onClick={install}
              data-hw-title="INSTALL OFFLINE STUDIO APP (PWA)"
              data-hw-func="Installs AKAI MPK mini Studio as a standalone desktop or mobile application for instant offline launch."
              data-hw-state="READY TO INSTALL"
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-600 border border-zinc-700 hover:border-red-500 text-xs font-bold text-zinc-100 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-red-400" />
              <span>Install App</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              data-hw-title="INSTALL FOR OFFLINE USE"
              data-hw-func="Shows how to install AKAI MPK mini Studio to your desktop or home screen for standalone offline use."
              data-hw-state={isIOS ? 'iOS SAFARI GUIDE' : 'OFFLINE APP GUIDE'}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Smartphone className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">
                {isIOS ? 'Install on iOS' : 'Offline App'}
              </span>
            </button>
          )}
        </>
      )}

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl bg-[#16181e] border border-zinc-700 p-5 shadow-2xl text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Offline Studio Mode &amp; App Installation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                <strong className="text-white">100% Web Audio Synthesis (Zero Cloud Dependency):</strong>{' '}
                All 8 keyboard instruments (4 Electric Bass Guitars + 4 Poly Synths), 64 MPC drum pads,
                multi-track beat recording, and MIDI/Audio exports run locally in your browser and
                auto-save to your device&apos;s local storage.
              </p>

              {isIOS ? (
                <div className="rounded-lg bg-zinc-900/90 border border-zinc-800 p-3">
                  <div className="font-bold text-white mb-1">Install on iPhone / iPad (Safari):</div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-300">
                    <li>Tap the <strong>Share</strong> button in the Safari toolbar.</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                    <li>Launch <strong>MPK Studio</strong> anytime — even in Airplane Mode.</li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-lg bg-zinc-900/90 border border-zinc-800 p-3">
                  <div className="font-bold text-white mb-1">Install on Desktop / Android:</div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-300">
                    <li>
                      Open this app in its full tab (or click the install icon in your browser&apos;s address bar).
                    </li>
                    <li>
                      Select <strong>Install AKAI MPK mini Studio</strong> to add it to your desktop or home screen for instant offline access.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full rounded-lg bg-red-600 hover:bg-red-500 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-lg bg-amber-500/95 border border-amber-300 px-3.5 py-2 text-xs font-bold text-zinc-950 shadow-xl">
      <span className="h-2 w-2 rounded-full bg-zinc-950 animate-ping" />
      <span>Offline Mode — Local Web Audio Engine &amp; Device Storage Active</span>
    </div>
  );
};
