import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('SignalForge brand icons', () => {
  it('keeps the browser and application icons on the same SVG brand mark', async () => {
    const [publicMark, appIcon] = await Promise.all([
      fs.readFile(path.join(root, 'public', 'quantpilot-mark.svg'), 'utf8'),
      fs.readFile(path.join(root, 'src', 'app', 'icon.svg'), 'utf8'),
    ]);

    for (const svg of [publicMark, appIcon]) {
      expect(svg).toContain('#167A6A');
      expect(svg).toContain('#FFFFFF');
      expect(svg).toContain('<path d="M140 312L208 246L264 282L376 170"');
      expect(svg).toContain('SignalForge');
    }
  });

  it.each([
    ['public/favicon-16.png', 16],
    ['public/favicon-32.png', 32],
    ['public/favicon.png', 128],
    ['public/apple-touch-icon.png', 180],
    ['public/icons/quantpilot-192.png', 192],
    ['public/icons/quantpilot-512.png', 512],
    ['public/QuantPilot_Icon.png', 512],
  ])('provides %s at %ipx', async (relativePath, size) => {
    const metadata = await sharp(path.join(root, relativePath)).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(size);
    expect(metadata.height).toBe(size);
    expect(metadata.hasAlpha).toBe(true);
  });
});
