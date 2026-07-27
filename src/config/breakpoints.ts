/**
 * Responsive breakpoint constants
 * Centralized configuration for consistent responsive design across the application
 */

export const BREAKPOINTS = {
  // Extra small devices (very small phones)
  XS: 360,
  // Small devices (landscape phones, small tablets)
  SM: 640,
  // Medium devices (tablets, large phones)
  MD: 768,
  // Large devices (desktops)
  LG: 1024,
  // Extra large devices (large desktops)
  XL: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Media query helpers for use in CSS-in-JS or dynamic styles
 */
export const mediaQueries = {
  xs: `@media (max-width: ${BREAKPOINTS.XS - 1}px)`,
  sm: `@media (max-width: ${BREAKPOINTS.SM - 1}px)`,
  md: `@media (max-width: ${BREAKPOINTS.MD - 1}px)`,
  lg: `@media (max-width: ${BREAKPOINTS.LG - 1}px)`,
  xl: `@media (max-width: ${BREAKPOINTS.XL - 1}px)`,
  
  // Min-width queries
  smMin: `@media (min-width: ${BREAKPOINTS.SM}px)`,
  mdMin: `@media (min-width: ${BREAKPOINTS.MD}px)`,
  lgMin: `@media (min-width: ${BREAKPOINTS.LG}px)`,
  xlMin: `@media (min-width: ${BREAKPOINTS.XL}px)`,
} as const;
