import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isExternalUrl } from './isExternalUrl';

describe('isExternalUrl', () => {
  const originalLocation = window.location;

  beforeAll(() => {
    // @ts-expect-error - location is non-optional
    delete window.location;
    window.location = {
      ...originalLocation,
      origin: 'https://app.credence.org',
      href: 'https://app.credence.org/dashboard',
      protocol: 'https:',
    };
  });

  afterAll(() => {
    window.location = originalLocation;
  });

  it('returns true for external URLs', () => {
    expect(isExternalUrl('https://google.com')).toBe(true);
    expect(isExternalUrl('http://example.com')).toBe(true);
    expect(isExternalUrl('https://sub.credence.org')).toBe(true);
  });

  it('returns false for in-app relative links', () => {
    expect(isExternalUrl('/docs')).toBe(false);
    expect(isExternalUrl('/dashboard/settings')).toBe(false);
    expect(isExternalUrl('./relative')).toBe(false);
  });

  it('returns false for absolute same-origin URLs', () => {
    expect(isExternalUrl('https://app.credence.org/about')).toBe(false);
    expect(isExternalUrl('https://app.credence.org/')).toBe(false);
  });

  it('returns false for placeholder or empty', () => {
    expect(isExternalUrl('#')).toBe(false);
    expect(isExternalUrl('')).toBe(false);
    expect(isExternalUrl(undefined)).toBe(false);
  });

  it('returns false for malformed URLs safely', () => {
    expect(isExternalUrl('not-a-real-url:something')).toBe(false);
    expect(isExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isExternalUrl('mailto:test@example.com')).toBe(false);
  });
});
