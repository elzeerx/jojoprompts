
class TapScriptLoader {
  private scriptId = 'tap-sdk-script';
  private loadingPromise: Promise<void> | null = null;
  private isLoaded = false;

  async loadScript(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    if (this.isLoaded && this.isScriptPresent()) {
      return Promise.resolve();
    }

    this.loadingPromise = this.loadScriptInternal();
    return this.loadingPromise;
  }

  private async loadScriptInternal(): Promise<void> {
    try {
      this.removeExistingScript();
      
      const script = document.createElement('script');
      script.id = this.scriptId;
      script.src = 'https://tap.company/js/pay.js';
      script.async = true;

      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tap script loading timeout'));
        }, 30000);

        script.onload = () => {
          clearTimeout(timeout);
          // Verify Tap object is available
          if (window.Tapjsli) {
            this.isLoaded = true;
            resolve();
          } else {
            reject(new Error('Tap SDK loaded but Tapjsli object not available'));
          }
        };

        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load Tap SDK'));
        };
      });

      document.head.appendChild(script);
      await loadPromise;
    } catch (error) {
      this.removeExistingScript();
      this.loadingPromise = null;
      throw error;
    }
  }

  private removeExistingScript(): void {
    const existingScript = document.getElementById(this.scriptId);
    if (existingScript) {
      existingScript.remove();
    }
    this.isLoaded = false;
  }

  private isScriptPresent(): boolean {
    return !!document.getElementById(this.scriptId) && !!window.Tapjsli;
  }

  reset(): void {
    this.removeExistingScript();
    this.loadingPromise = null;
    this.isLoaded = false;
  }
}

export const tapScriptLoader = new TapScriptLoader();
