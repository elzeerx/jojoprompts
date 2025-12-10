import { useState, useEffect } from 'react';

/**
 * GCC country timezones for geo-detection
 * Privacy-friendly: Uses timezone detection instead of IP geolocation
 */
const GCC_TIMEZONES = [
  'Asia/Kuwait',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Asia/Muscat'
];

export type DetectedRegion = 'gcc' | 'international';

interface GeoDetectionResult {
  detectedRegion: DetectedRegion | null;
  isGCC: boolean;
  loading: boolean;
  timezone: string | null;
}

/**
 * Hook to detect user's region based on timezone
 * Used to recommend payment gateway (Upayments for GCC, PayPal for international)
 * 
 * Privacy notes:
 * - No API calls or IP tracking
 * - Uses browser's Intl API for timezone detection
 * - Fallback to 'international' if detection fails
 */
export function useGeoDetection(): GeoDetectionResult {
  const [detectedRegion, setDetectedRegion] = useState<DetectedRegion | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(userTimezone);
      
      const isGCC = GCC_TIMEZONES.includes(userTimezone);
      setDetectedRegion(isGCC ? 'gcc' : 'international');
    } catch (error) {
      console.warn('Geo detection failed, defaulting to international:', error);
      setDetectedRegion('international');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    detectedRegion,
    isGCC: detectedRegion === 'gcc',
    loading,
    timezone
  };
}
