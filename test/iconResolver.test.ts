import { describe, it, expect } from 'vitest';
import { parseSvg, groupIconsByPrefix, buildIconifyPack, ParsedSvg } from '../src/iconResolver';

describe('parseSvg', () => {
  it('extracts body, width, and height from SVG string', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#4a9eff"/></svg>';
    const result = parseSvg(svg);
    expect(result).toEqual({
      body: '<circle cx="12" cy="12" r="10" fill="#4a9eff"/>',
      width: 24,
      height: 24,
    });
  });

  it('extracts dimensions from viewBox when width/height attributes are missing', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16"><rect width="32" height="16"/></svg>';
    const result = parseSvg(svg);
    expect(result).toEqual({
      body: '<rect width="32" height="16"/>',
      width: 32,
      height: 16,
    });
  });

  it('defaults to 24x24 when no dimensions are found', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/></svg>';
    const result = parseSvg(svg);
    expect(result.width).toBe(24);
    expect(result.height).toBe(24);
  });
});

describe('groupIconsByPrefix', () => {
  it('groups icon entries by prefix', () => {
    const icons: Record<string, string> = {
      'aws:s3': './icons/s3.svg',
      'aws:lambda': 'https://example.com/lambda.svg',
      'custom:database': './icons/db.svg',
    };
    const result = groupIconsByPrefix(icons);
    expect(result).toEqual({
      aws: { 's3': './icons/s3.svg', 'lambda': 'https://example.com/lambda.svg' },
      custom: { 'database': './icons/db.svg' },
    });
  });

  it('skips entries without a colon separator', () => {
    const icons: Record<string, string> = { 'nocolon': './icons/bad.svg' };
    const result = groupIconsByPrefix(icons);
    expect(result).toEqual({});
  });
});

describe('buildIconifyPack', () => {
  it('builds Iconify JSON format from prefix and resolved SVGs', () => {
    const resolvedIcons: Record<string, ParsedSvg> = {
      database: { body: '<circle cx="12" cy="12" r="10"/>', width: 24, height: 24 },
      api: { body: '<rect width="16" height="16"/>', width: 16, height: 16 },
    };
    const result = buildIconifyPack('custom', resolvedIcons);
    expect(result).toEqual({
      prefix: 'custom',
      icons: {
        database: { body: '<circle cx="12" cy="12" r="10"/>', width: 24, height: 24 },
        api: { body: '<rect width="16" height="16"/>', width: 16, height: 16 },
      },
    });
  });
});
