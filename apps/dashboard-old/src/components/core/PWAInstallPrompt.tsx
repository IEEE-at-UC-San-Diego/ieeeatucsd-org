import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Prompt Component
 * 
 * Features:
 * - Detects when the app is installable
 * - Shows install prompt for Chrome/Edge (beforeinstallprompt)
 * - Shows iOS-specific instructions for Safari
 * - Remembers if user dismissed the prompt
 * - Responsive design with smooth animations
 */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isInStandaloneMode = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://')
      );
    };

    // Check if iOS
    const checkIsIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };

    // Check if mobile device (not desktop)
    const checkIsMobile = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      // Check for mobile devices (phones and tablets)
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent) ||
        // Also check screen width as a fallback
        window.innerWidth <= 768;
    };

    const standalone = isInStandaloneMode();
    const iOS = checkIsIOS();
    const mobile = checkIsMobile();

    setIsStandalone(standalone);
    setIsIOS(iOS);

    // Don't show prompt if already installed
    if (standalone) {
      return;
    }

    // Don't show prompt if not on mobile device
    if (!mobile) {
      return;
    }

    // Check if user previously dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show prompt again after 7 days
    if (daysSinceDismissed < 7) {
      return;
    }

    // For iOS devices
    if (iOS && !standalone) {
      // Show iOS prompt after a short delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // For Chrome/Edge - listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after a short delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't render if already installed or prompt shouldn't be shown
  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[9999] animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-gradient-to-br from-ieee-blue-100 to-blue-600 text-white rounded-2xl shadow-2xl p-5 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-full transition-colors z-10"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative">
          {/* Icon */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <img
                src="/android-chrome-192x192.png"
                alt="IEEE UCSD"
                className="w-10 h-10 rounded-lg"
              />
            </div>
            <div>
              <h3 className="font-bold text-lg">Install IEEE UCSD</h3>
              <p className="text-sm text-white/90">Quick access from your home screen</p>
            </div>
          </div>

          {/* iOS Instructions */}
          {isIOS ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-white/95">
                To install this app on your iOS device:
              </p>
              <ol className="text-sm space-y-2 text-white/90">
                <li className="flex items-start gap-2">
                  <span className="font-bold min-w-[20px]">1.</span>
                  <span>
                    Tap the <Share className="inline w-4 h-4 mx-1" /> Share button in Safari
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold min-w-[20px]">2.</span>
                  <span>
                    Scroll down and tap <Plus className="inline w-4 h-4 mx-1" /> "Add to Home Screen"
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold min-w-[20px]">3.</span>
                  <span>Tap "Add" in the top right corner</span>
                </li>
              </ol>
              <button
                onClick={handleDismiss}
                className="w-full mt-4 bg-white/20 hover:bg-white/30 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors backdrop-blur-sm"
              >
                Got it!
              </button>
            </div>
          ) : (
            /* Chrome/Edge Install Button */
            <div className="mt-4 space-y-2">
              <p className="text-sm text-white/95 mb-3">
                Install for faster access, offline support, and a native app experience.
              </p>
              <button
                onClick={handleInstallClick}
                className="w-full bg-white text-ieee-blue-100 hover:bg-white/90 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <Download className="w-5 h-5" />
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-xl transition-colors text-sm"
              >
                Maybe later
              </button>
            </div>
          )}

          {/* Features */}
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="grid grid-cols-3 gap-2 text-xs text-white/90">
              <div className="text-center">
                <div className="font-semibold">⚡ Fast</div>
                <div className="text-white/70">Instant load</div>
              </div>
              <div className="text-center">
                <div className="font-semibold">📱 Native</div>
                <div className="text-white/70">App-like</div>
              </div>
              <div className="text-center">
                <div className="font-semibold">🔒 Offline</div>
                <div className="text-white/70">Works offline</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

