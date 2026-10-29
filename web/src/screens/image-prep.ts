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

const regions: Record<ScreenshotMode, { rows: CropRegion; header?: CropRegion }> = {
  // Include the first and last visible card (up to y≈1360 on a 1536px screen).
  // A narrow crop lost lower members and truncated long nicknames near x≈440.
  // Avoid the right-side role labels and the bottom game navigation.
  clan: {
    rows: { x: 0.23, y: 0.468, width: 0.50, height: 0.417 },
    header: { x: 0.15, y: 0.244, width: 0.7, height: 0.224 },
  },
  // Existing ranking OCR looked for ranks between 39% and 80% screen height.
  ranking: {
    rows: { x: 0, y: 0.375, width: 1, height: 0.445 },
  },
};

const IMAGE_WIDTH = 600;
const PAGE_SIZE = 5;
const SEPARATOR = 24;

export function screenshotAspectSupported(width: number, height: number) {
  return width > 0 && height > 0 && width / height >= 0.435 && width / height <= 0.51;
}

function scaledHeight(bitmap: ImageBitmap, crop: CropRegion): number {
  return Math.round((IMAGE_WIDTH * bitmap.height * crop.height) / (bitmap.width * crop.width));
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  crop: CropRegion,
  top: number,
): number {
  const height = scaledHeight(image, crop);
  ctx.drawImage(
    image,
    Math.round(crop.x * image.width),
    Math.round(crop.y * image.height),
    Math.round(crop.width * image.width),
    Math.round(crop.height * image.height),
    0,
    top,
    IMAGE_WIDTH,
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
    const parts: Blob[] = [];
    let firstHeaderHeight = 0;

    for (let start = 0; start < bitmaps.length; start += PAGE_SIZE) {
      const current = bitmaps.slice(start, start + PAGE_SIZE);
      const includeHeader = mode === 'clan' && start === 0 && profile.header;
      const headerHeight = includeHeader ? scaledHeight(current[0], profile.header!) : 0;
      const headerGap = headerHeight ? SEPARATOR : 0;
      const height =
        headerHeight +
        headerGap +
        current.reduce((sum, image) => sum + scaledHeight(image, profile.rows) + SEPARATOR, 0);
      const canvas = document.createElement('canvas');
      canvas.width = IMAGE_WIDTH;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas is unavailable');
      ctx.fillStyle = '#101015';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let y = 0;
      if (includeHeader) {
        y += drawRegion(ctx, current[0], profile.header!, y);
        firstHeaderHeight = y;
        y += SEPARATOR;
      }
      for (const bitmap of current) {
        y += drawRegion(ctx, bitmap, profile.rows, y);
        y += SEPARATOR;
      }
      parts.push(await toJpeg(canvas));
    }

    return { parts, headerHeight: firstHeaderHeight };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}
