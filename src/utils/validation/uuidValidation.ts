// UUID validation utilities
export class UUIDValidator {
  // Enhanced UUID validation
  static isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Basic UUID validation (legacy method)  
  static isValidBasicUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    return uuid.length === 36 && uuid.split('-').length === 5;
  }
}