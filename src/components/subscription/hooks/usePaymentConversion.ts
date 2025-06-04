
export function usePaymentConversion() {
  // Fixed USD to KWD conversion rates
  const getKWDAmount = (usdAmount: number) => {
    const conversionRates: { [key: number]: number } = {
      55: 15,
      65: 20,
      80: 25,
      100: 30
    };
    
    return conversionRates[usdAmount] || (usdAmount * 0.3);
  };

  return {
    getKWDAmount
  };
}
