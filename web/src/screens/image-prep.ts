/**
 * Shared client-side OCR preprocessing.
 *
 * The game renders screenshots at a stable portrait aspect ratio. Crop the relevant
 * OCR regions before uploading; all original bytes stay in the browser.
 * Server only receives one or two narrow mosaics instead of ten full screenshots.
 */
export type ScreenshotMode = 'clan' | 'ranking';

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreparedScreenshots {
  parts: Blob[];
  headerHeight: number;
}

export const regions: Record<ScreenshotMode, { rows: CropRegion; header?: CropRegion }> = {
  // Calibrated against actual clan-roster previews. The left edge excludes
  // player avatars but leaves complete nicknames; the right edge stops before
  // Leader/Captain/Member labels. The bottom avoids the empty tab/button area.
  // The first screenshot contributes only Power/Tier/Type/Members from its header.
  clan: {
    rows: { x: 0.26, y: 0.47, width: 0.35, height: 0.3 },
    header: { x: 0.13, y: 0.375, width: 0.75, height: 0.085 },
  },
  // Existing ranking OCR looked for ranks between 39% and 80% screen height.
  ranking: {
    rows: { x: 0, y: 0.375, width: 1, height: 0.445 },
  },
};

// Narrow clan crops need fewer pixels to keep each five-screenshot mosaic
// around the original height while slightly enlarging the OCR text.
export const MOSAIC_WIDTH: Record<ScreenshotMode, number> = { clan: 420, ranking: 600 };
const PAGE_SIZE = 5;
const SEPARATOR = 24;

export function screenshotAspectSupported(width: number, height: number) {
  return width > 0 && height > 0 && width / height >= 0.435 && width / height <= 0.51;
}

function scaledHeight(bitmap: ImageBitmap, crop: CropRegion, width: number): number {
  return Math.round((width * bitmap.height * crop.height) / (bitmap.width * crop.width));
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  crop: CropRegion,
  top: number,
  width: number,
): number {
  const height = scaledHeight(image, crop, width);
  ctx.drawImage(
    image,
    Math.round(crop.x * image.width),
    Math.round(crop.y * image.height),
    Math.round(crop.width * image.width),
    Math.round(crop.height * image.height),
    0,
    top,
    width,
    height,
  );
  return height;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to prepare the screenshot for OCR'));
      },
      'image/jpeg',
      0.87,
    );
  });
}

export async function prepareScreenshots(
  files: File[],
  mode: ScreenshotMode,
): Promise<PreparedScreenshots> {
  if (files.length < 1 || files.length > 10) {
    throw new Error('Choose 1–10 screenshots');
  }
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const file of files) {
      const bitmap = await createImageBitmap(file);
      if (!screenshotAspectSupported(bitmap.width, bitmap.height)) {
        throw new Error('Screenshots must use the portrait clan/game layout');
      }
      bitmaps.push(bitmap);
    }

    const profile = regions[mode];
    const targetWidth = MOSAIC_WIDTH[mode];
    const parts: Blob[] = [];
    let firstHeaderHeight = 0;

    for (let start = 0; start < bitmaps.length; start += PAGE_SIZE) {
      const current = bitmaps.slice(start, start + PAGE_SIZE);
      const includeHeader = mode === 'clan' && start === 0 && profile.header;
      const headerHeight = includeHeader ? scaledHeight(current[0], profile.header!, targetWidth) : 0;
      const headerGap = headerHeight ? SEPARATOR : 0;
      const height =
        headerHeight +
        headerGap +
        current.reduce(
          (sum, image) => sum + scaledHeight(image, profile.rows, targetWidth) + SEPARATOR,
          0,
        );
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas is unavailable');
      ctx.fillStyle = '#101015';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let y = 0;
      if (includeHeader) {
        y += drawRegion(ctx, current[0], profile.header!, y, targetWidth);
        firstHeaderHeight = y;
        y += SEPARATOR;
      }
      for (const bitmap of current) {
        y += drawRegion(ctx, bitmap, profile.rows, y, targetWidth);
        y += SEPARATOR;
      }
      parts.push(await toJpeg(canvas));
    }

    return { parts, headerHeight: firstHeaderHeight };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}
