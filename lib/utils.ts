import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the base app URL, ensuring no trailing slash
 * This prevents double-slash issues in URL construction
 */
export function getAppBaseUrl(): string {
  const baseUrl = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin)
    : (process.env.NEXT_PUBLIC_APP_URL || '')
  
  // Remove trailing slash if present
  return baseUrl.replace(/\/$/, '')
}

/**
 * Remove trailing slash from a URL
 */
export function removeTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}
