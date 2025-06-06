
declare global {
  interface Window {
    paypal?: {
      Buttons: (config: any) => {
        render: (container: HTMLElement) => Promise<void>;
      };
    };
    Tapjsli?: (config: any) => void;
  }
}

export {};
