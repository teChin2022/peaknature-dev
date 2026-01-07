/**
 * Shared Validation Schemas
 * 
 * Centralized validation schemas for consistent security across the app
 */

import { z } from 'zod'

/**
 * Strong password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character (!@#$%^&*)')

/**
 * Email validation
 */
export const emailSchema = z.string()
  .email('Please enter a valid email address')
  .min(5, 'Email is too short')
  .max(254, 'Email is too long')

/**
 * Phone number validation (Thai format)
 */
export const phoneSchema = z.string()
  .min(9, 'Phone number must be at least 9 digits')
  .max(15, 'Phone number is too long')
  .regex(/^[0-9+\-\s()]+$/, 'Phone number can only contain digits, +, -, spaces, and parentheses')

/**
 * Tenant slug validation
 */
export const slugSchema = z.string()
  .min(3, 'URL must be at least 3 characters')
  .max(30, 'URL must be less than 30 characters')
  .regex(/^[a-z0-9-]+$/, 'URL can only contain lowercase letters, numbers, and hyphens')
  .refine(
    (val) => !val.startsWith('-') && !val.endsWith('-'),
    'URL cannot start or end with a hyphen'
  )

/**
 * Hex color validation
 */
export const colorSchema = z.string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (must be #RRGGBB)')

/**
 * Full name validation
 */
export const fullNameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name is too long')
  .regex(/^[a-zA-Z\u0E00-\u0E7F\s'-]+$/, 'Name contains invalid characters')

/**
 * Helper: Create a password confirmation schema
 */
export function createPasswordConfirmSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(
    (data) => {
      const d = data as { password?: string; confirmPassword?: string }
      return d.password === d.confirmPassword
    },
    {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }
  )
}

/**
 * Sanitize input to prevent XSS
 * Use this for user-generated content that will be displayed
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}

/**
 * Validate redirect URL to prevent open redirect attacks
 */
export function isValidRedirectUrl(url: string, allowedPrefixes: string[] = ['/']): boolean {
  // Must start with / but not //
  if (!url.startsWith('/') || url.startsWith('//')) {
    return false
  }
  
  // Block URLs that could redirect externally
  try {
    const decoded = decodeURIComponent(url)
    if (decoded.startsWith('//') || decoded.includes('://')) {
      return false
    }
  } catch {
    // If URL can't be decoded, reject it
    return false
  }
  
  // Check if URL starts with an allowed prefix
  if (allowedPrefixes.length > 0) {
    return allowedPrefixes.some(prefix => url.startsWith(prefix))
  }
  
  return true
}

