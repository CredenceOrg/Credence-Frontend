import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isExternalUrl } from './isExternalUrl';

describe('isExternalUrl', () => {
  const originalLocation = window.location

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
    // Restore to original JSDOM location descriptor so other test files are unaffected.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: globalThis.location,
    });
  });

  // -------------------------------------------------------------------------
  // Protocol-specific contract tests (the primary lock-in for this module)
  // -------------------------------------------------------------------------

  describe('javascript: protocol — always blocked', () => {
    it('returns_false_for_javascript_colon_bare', () => {
      expect(isExternalUrl('javascript:')).toBe(false);
    });

    it('returns_false_for_javascript_colon_void_expression', () => {
      expect(isExternalUrl('javascript:void(0)')).toBe(false);
    });

    it('returns_false_for_javascript_colon_alert_xss_payload', () => {
      expect(isExternalUrl('javascript:alert(1)')).toBe(false);
    });

    it('returns_false_for_javascript_colon_with_encoded_colon', () => {
      // URL-encoding should not bypass the check — new URL() normalises it.
      expect(isExternalUrl('javascript%3Aalert(1)')).toBe(false);
    });
  });

  describe('https: protocol — allowed for cross-origin URLs', () => {
    it('returns_true_for_https_url_on_different_domain', () => {
      expect(isExternalUrl('https://example.com')).toBe(true);
    });

    it('returns_true_for_https_url_with_path', () => {
      expect(isExternalUrl('https://example.com/some/path')).toBe(true);
    });

    it('returns_true_for_https_url_on_different_subdomain', () => {
      expect(isExternalUrl('https://sub.credence.org')).toBe(true);
    });

    it('returns_false_for_https_url_on_same_origin', () => {
      expect(isExternalUrl('https://app.credence.org/about')).toBe(false);
    });

    it('returns_false_for_https_url_on_same_origin_root', () => {
      expect(isExternalUrl('https://app.credence.org/')).toBe(false);
    });
  });

  describe('http: protocol — allowed for cross-origin URLs', () => {
    it('returns_true_for_http_url_on_different_domain', () => {
      expect(isExternalUrl('http://example.com')).toBe(true);
    });
  });

  describe('mailto: protocol — allowed (opens system mail client)', () => {
    it('returns_true_for_mailto_with_address', () => {
      expect(isExternalUrl('mailto:support@credence.org')).toBe(true);
    });

    it('returns_true_for_mailto_with_subject_query', () => {
      expect(isExternalUrl('mailto:support@credence.org?subject=Hello')).toBe(true);
    });

    it('returns_true_for_bare_mailto_colon', () => {
      expect(isExternalUrl('mailto:')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Relative and in-app paths — never external
  // -------------------------------------------------------------------------

  describe('relative paths — always internal', () => {
    it('returns_false_for_absolute_path', () => {
      expect(isExternalUrl('/docs')).toBe(false);
    });

    it('returns_false_for_nested_absolute_path', () => {
      expect(isExternalUrl('/dashboard/settings')).toBe(false);
    });

    it('returns_false_for_dot_relative_path', () => {
      expect(isExternalUrl('./relative')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge / safety cases
  // -------------------------------------------------------------------------

  describe('edge cases — safe fallbacks', () => {
    it('returns_false_for_empty_string', () => {
      expect(isExternalUrl('')).toBe(false);
    });

    it('returns_false_for_undefined', () => {
      expect(isExternalUrl(undefined)).toBe(false);
    });

    it('returns_false_for_hash_placeholder', () => {
      expect(isExternalUrl('#')).toBe(false);
    });

    it('returns_false_for_unparseable_string', () => {
      expect(isExternalUrl('not-a-real-url:something')).toBe(false);
    });
  });
});
