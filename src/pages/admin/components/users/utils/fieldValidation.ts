import { UserUpdateData } from "@/types/user";

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateUserProfileFields(data: UserUpdateData): ValidationResult {
  const errors: Record<string, string> = {};

  // Validate first name
  if (data.first_name !== undefined) {
    if (data.first_name && data.first_name.length < 2) {
      errors.first_name = "First name must be at least 2 characters";
    }
    if (data.first_name && data.first_name.length > 50) {
      errors.first_name = "First name must be less than 50 characters";
    }
    if (data.first_name && !/^[a-zA-Z\s'-]+$/.test(data.first_name)) {
      errors.first_name = "First name can only contain letters, spaces, hyphens, and apostrophes";
    }
  }

  // Validate last name
  if (data.last_name !== undefined) {
    if (data.last_name && data.last_name.length < 2) {
      errors.last_name = "Last name must be at least 2 characters";
    }
    if (data.last_name && data.last_name.length > 50) {
      errors.last_name = "Last name must be less than 50 characters";
    }
    if (data.last_name && !/^[a-zA-Z\s'-]+$/.test(data.last_name)) {
      errors.last_name = "Last name can only contain letters, spaces, hyphens, and apostrophes";
    }
  }

  // Validate username
  if (data.username !== undefined && data.username) {
    if (data.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }
    if (data.username.length > 30) {
      errors.username = "Username must be less than 30 characters";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
      errors.username = "Username can only contain letters, numbers, underscores, and hyphens";
    }
  }

  // Validate email
  if (data.email !== undefined && data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.email = "Please enter a valid email address";
    }
    if (data.email.length > 254) {
      errors.email = "Email address is too long";
    }
  }

  // Validate phone number
  if (data.phone_number !== undefined && data.phone_number) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(data.phone_number.replace(/[\s()-]/g, ''))) {
      errors.phone_number = "Please enter a valid phone number";
    }
  }

  // Validate bio
  if (data.bio !== undefined && data.bio) {
    if (data.bio.length > 500) {
      errors.bio = "Bio must be less than 500 characters";
    }
  }

  // Validate country
  if (data.country !== undefined && data.country) {
    if (data.country.length < 2) {
      errors.country = "Country name must be at least 2 characters";
    }
    if (data.country.length > 100) {
      errors.country = "Country name must be less than 100 characters";
    }
    if (!/^[a-zA-Z\s'-]+$/.test(data.country)) {
      errors.country = "Country name can only contain letters, spaces, hyphens, and apostrophes";
    }
  }

  // Validate timezone
  if (data.timezone !== undefined && data.timezone) {
    if (data.timezone.length > 50) {
      errors.timezone = "Timezone must be less than 50 characters";
    }
  }

  // Validate avatar URL
  if (data.avatar_url !== undefined && data.avatar_url) {
    try {
      new URL(data.avatar_url);
    } catch {
      errors.avatar_url = "Please enter a valid URL";
    }
  }

  // Validate role
  if (data.role !== undefined) {
    const validRoles = ['user', 'admin', 'jadmin', 'prompter'];
    if (!validRoles.includes(data.role)) {
      errors.role = "Invalid role selected";
    }
  }

  // Validate membership tier
  if (data.membership_tier !== undefined) {
    const validTiers = ['free', 'basic', 'premium', 'enterprise'];
    if (!validTiers.includes(data.membership_tier)) {
      errors.membership_tier = "Invalid membership tier selected";
    }
  }

  // Validate social links
  if (data.social_links !== undefined && data.social_links) {
    Object.entries(data.social_links).forEach(([platform, url]) => {
      if (url) {
        try {
          new URL(url);
        } catch {
          errors[`social_${platform}`] = `Invalid URL for ${platform}`;
        }
      }
    });
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateUsername(username: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(username) && username.length >= 3 && username.length <= 30;
}