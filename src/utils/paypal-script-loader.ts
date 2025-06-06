
class PayPalScriptLoader {
  private scriptId = 'paypal-sdk-script';
  private loadingPromise: Promise<void> | null = null;
  private isLoaded = false;
  private retryCount = 0;
  private maxRetries = 3;

  async loadScript(clientId: string, currency = 'USD'): Promise<void> {
    // Return existing promise if already loading
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Return immediately if already loaded
    if (this.isLoaded && this.isScriptPresent()) {
      return Promise.resolve();
    }

    this.loadingPromise = this.loadScriptWithRetry(clientId, currency);
    return this.loadingPromise;
  }

  private async loadScriptWithRetry(clientId: string, currency: string): Promise<void> {
    try {
      // Remove any existing script
      this.removeExistingScript();
      
      // Create and load new script
      const script = document.createElement('script');
      script.id = this.scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&components=buttons`;
      script.async = true;
      script.defer = true;

      // Add timeout for script loading
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('PayPal script loading timeout'));
        }, 30000); // 30 second timeout

        script.onload = () => {
          clearTimeout(timeout);
          this.isLoaded = true;
          this.retryCount = 0;
          resolve();
        };

        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load PayPal SDK'));
        };
      });

      document.head.appendChild(script);
      await loadPromise;
      
      // Verify PayPal object is available
      if (!window.paypal) {
        throw new Error('PayPal SDK loaded but paypal object not available');
      }

      return;
    } catch (error) {
      this.removeExistingScript();
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying PayPal script load (${this.retryCount}/${this.maxRetries})`);
        await this.delay(2000 * this.retryCount); // Exponential backoff
        return this.loadScriptWithRetry(clientId, currency);
      }
      
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
    return !!document.getElementById(this.scriptId) && !!window.paypal;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reset(): void {
    this.removeExistingScript();
    this.loadingPromise = null;
    this.isLoaded = false;
    this.retryCount = 0;
  }
}

export const paypalScriptLoader = new PayPalScriptLoader();
