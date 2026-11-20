import * as UTIF from 'utif';
import heic2any from 'heic2any';
import ExifReader from 'exifreader';

export interface ConversionResult {
  blob: Blob;
  width: number;
  height: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  previewWidth: number;
  previewHeight: number;
  previewUrl: string;
  cameraModel?: string;
}

const RAW_EXTENSIONS = ['cr2', 'cr3', 'nef', 'arw', 'raf', 'dng', 'orf', 'rw2', 'pef', 'sr2', 'raw'];

/**
 * Normalizes file type names for display.
 */
export function formatFileType(fileName: string, mimeType: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (extension) {
    if (RAW_EXTENSIONS.includes(extension)) {
      return extension.toUpperCase();
    }
    return extension.toUpperCase();
  }
  
  // Fallback to mime type mapping
  if (mimeType.includes('/')) {
    const parts = mimeType.split('/');
    const sub = parts[1].toUpperCase();
    if (sub === 'JPEG') return 'JPG';
    return sub;
  }
  return 'UNKNOWN';
}

/**
 * Formats file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Helper to determine the exact length of a JPEG stream by parsing its structural markers.
 * This skips nested EXIF thumbnails (like those in APP1 headers) to find the true full-resolution EOI.
 */
function parseJpegLength(bytes: Uint8Array, start: number): number {
  let offset = start;
  if (bytes[offset] !== 0xFF || bytes[offset + 1] !== 0xD8) {
    return -1;
  }
  offset += 2;

  const len = bytes.length;
  while (offset < len - 2) {
    // Skip any padding 0xFF bytes
    while (offset < len && bytes[offset] === 0xFF) {
      offset++;
    }
    if (offset >= len) return -1;
    
    const marker = bytes[offset];
    offset++; // advance past marker byte

    // Reject lossless JPEG markers (SOF3 = 0xC3, SOF7 = 0xC7, SOF11 = 0xCB, SOF15 = 0xCF)
    // standard browsers do not support lossless jpeg format used in RAW sensor data.
    if (marker === 0xC3 || marker === 0xC7 || marker === 0xCB || marker === 0xCF) {
      return -1;
    }
    
    // EOI (End of Image)
    if (marker === 0xD9) {
      return offset - start;
    }

    // SOS (Start of Scan)
    if (marker === 0xDA) {
      if (offset + 2 > len) return -1;
      const sosLen = (bytes[offset] << 8) | bytes[offset + 1];
      let scanOffset = offset + sosLen;

      // Find the next FF D9
      let eoiOffset = bytes.indexOf(0xFF, scanOffset);
      while (eoiOffset !== -1 && eoiOffset < len - 1) {
        if (bytes[eoiOffset + 1] === 0xD9) {
          return eoiOffset + 2 - start;
        }
        eoiOffset = bytes.indexOf(0xFF, eoiOffset + 1);
      }
      return -1;
    }

    // Markers without length
    if ((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      continue;
    }

    // Standard segments with 2-byte length
    if (offset + 2 > len) return -1;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    offset += segmentLength;
  }

  return -1;
}

/**
 * Fast binary search scan to locate the largest embedded JPEG sequence (FF D8 FF to FF D9).
 * Highly efficient for extracting full-resolution previews from RAW camera formats in the browser.
 */
export async function extractRawJpeg(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  try {
    const bytes = new Uint8Array(buffer);
    const len = bytes.length;
    let largestStart = -1;
    let largestLength = -1;

    for (let i = 0; i < len - 4; ) {
      const nextFF = bytes.indexOf(0xFF, i);
      if (nextFF === -1 || nextFF > len - 4) {
        break;
      }
      i = nextFF;
      
      if (bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
        // Candidate SOI found. Parse its structural length to locate the EOI marker.
        const length = parseJpegLength(bytes, i);
        if (length > largestLength) {
          largestStart = i;
          largestLength = length;
        }
        
        // Skip ahead
        if (length > 0) {
          i += length;
        } else {
          i += 3;
        }
      } else {
        i++;
      }
    }

    if (largestStart !== -1 && largestLength > 0) {
      const jpegData = bytes.subarray(largestStart, largestStart + largestLength);
      return new Blob([jpegData], { type: 'image/jpeg' });
    }
  } catch (e) {
    console.error('Binary JPEG scanning failed, checking ExifReader fallback:', e);
  }

  // Fallback to ExifReader for standard EXIF thumbnail extraction
  try {
    const tags = await ExifReader.load(file);
    if (tags && tags['Thumbnail'] && tags['Thumbnail'].image) {
      const thumbnailBytes = tags['Thumbnail'].image;
      return new Blob([thumbnailBytes as any], { type: 'image/jpeg' });
    }
  } catch (e) {
    console.error('ExifReader thumbnail extraction failed:', e);
  }

  throw new Error('No embedded JPEG preview could be extracted from this RAW camera file.');
}

/**
 * Reads an image's dimensions and creates a browser-compatible preview URL.
 * Handles standard formats natively, and TIFF / HEIC / RAW via client-side libraries.
 */
export async function getFileMetadata(file: File): Promise<ImageMetadata> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type.toLowerCase();

  let originalWidth = 0;
  let originalHeight = 0;
  let cameraModel = '';
  
  try {
    const tags = await ExifReader.load(file);
    if (tags && tags['Model'] && tags['Model'].description) {
      cameraModel = tags['Model'].description;
    }
    
    if (tags && tags['Image Width']) {
      originalWidth = Number(tags['Image Width'].value);
    } else if (tags && tags['PixelXDimension']) {
      originalWidth = Number(tags['PixelXDimension'].value);
    }
    
    if (tags && tags['Image Height']) {
      originalHeight = Number(tags['Image Height'].value);
    } else if (tags && tags['PixelYDimension']) {
      originalHeight = Number(tags['PixelYDimension'].value);
    }
  } catch (e) {
    console.warn('ExifReader metadata tags extraction failed:', e);
  }

  // 1. RAW formats (Canon CR2/CR3, Nikon NEF, Sony ARW, Fujifilm RAF, DNG, etc.)
  const isRaw = RAW_EXTENSIONS.includes(extension) || mimeType.startsWith('image/x-');
  if (isRaw) {
    try {
      const jpegBlob = await extractRawJpeg(file);
      const previewUrl = URL.createObjectURL(jpegBlob);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            width: originalWidth || img.naturalWidth,
            height: originalHeight || img.naturalHeight,
            previewWidth: img.naturalWidth,
            previewHeight: img.naturalHeight,
            previewUrl,
            cameraModel,
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(previewUrl);
          reject(new Error('Failed to parse dimensions of RAW preview JPEG.'));
        };
        img.src = previewUrl;
      });
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'Failed to extract RAW preview.');
    }
  }

  // 2. TIFF Format
  if (extension === 'tif' || extension === 'tiff' || mimeType === 'image/tiff') {
    const arrayBuffer = await file.arrayBuffer();
    const ifds = UTIF.decode(arrayBuffer);
    if (!ifds || ifds.length === 0) {
      throw new Error('Invalid or empty TIFF file.');
    }
    UTIF.decodeImage(arrayBuffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const width = ifds[0].width;
    const height = ifds[0].height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not create 2D canvas context for TIFF preview.');
    }
    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({
            width: originalWidth || width,
            height: originalHeight || height,
            previewWidth: width,
            previewHeight: height,
            previewUrl: URL.createObjectURL(blob),
            cameraModel,
          });
        } else {
          reject(new Error('Failed to generate preview from TIFF.'));
        }
      }, 'image/png');
    });
  }

  // 3. HEIC / HEIF Format
  if (
    extension === 'heic' ||
    extension === 'heif' ||
    mimeType === 'image/heic' ||
    mimeType === 'image/heif'
  ) {
    try {
      const converted = await heic2any({
        blob: file,
        toType: 'image/png',
      });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      const previewUrl = URL.createObjectURL(blob);

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            width: originalWidth || img.naturalWidth,
            height: originalHeight || img.naturalHeight,
            previewWidth: img.naturalWidth,
            previewHeight: img.naturalHeight,
            previewUrl,
            cameraModel,
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(previewUrl);
          reject(new Error('Failed to parse dimensions of converted HEIC image.'));
        };
        img.src = previewUrl;
      });
    } catch (err) {
      console.error('HEIC conversion error: ', err);
      throw new Error('Failed to decode HEIC file. It may be corrupted or unsupported.');
    }
  }

  // 4. Standard Formats (PNG, WebP, GIF, BMP, SVG, AVIF, JPEG)
  const previewUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: originalWidth || img.naturalWidth,
        height: originalHeight || img.naturalHeight,
        previewWidth: img.naturalWidth,
        previewHeight: img.naturalHeight,
        previewUrl,
        cameraModel,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error('Failed to load image. Format may be unsupported or file is corrupted.'));
    };
    img.src = previewUrl;
  });
}

/**
 * Converts standard formats using HTML5 Canvas.
 */
function convertStandardImage(
  file: File,
  quality: number,
  outputFormat: 'JPG' | 'WEBP'
): Promise<ConversionResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to initialize canvas context.'));
        return;
      }
      
      // Draw white background only for JPG (removes transparent alphas in PNG/SVG/WEBP cleanly)
      if (outputFormat === 'JPG') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      const mimeType = outputFormat === 'JPG' ? 'image/jpeg' : 'image/webp';
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
          } else {
            reject(new Error(`Failed to render canvas image to ${outputFormat} blob.`));
          }
        },
        mimeType,
        quality / 100
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image for ${outputFormat} encoding.`));
    };
    img.src = objectUrl;
  });
}

/**
 * Converts HEIC/HEIF files to JPG or WEBP.
 */
async function convertHeicToFormat(
  file: File,
  quality: number,
  outputFormat: 'JPG' | 'WEBP'
): Promise<ConversionResult> {
  try {
    const converted = await heic2any({
      blob: file,
      toType: 'image/png',
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to initialize canvas context for HEIC conversion.'));
          return;
        }

        if (outputFormat === 'JPG') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);

        const mimeType = outputFormat === 'JPG' ? 'image/jpeg' : 'image/webp';
        canvas.toBlob(
          (outBlob) => {
            if (outBlob) {
              resolve({
                blob: outBlob,
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
            } else {
              reject(new Error(`Failed to render HEIC to ${outputFormat} blob.`));
            }
          },
          mimeType,
          quality / 100
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load converted HEIC image.'));
      };
      img.src = objectUrl;
    });
  } catch (err) {
    console.error(err);
    throw new Error(`Failed to convert HEIC to ${outputFormat}.`);
  }
}

/**
 * Converts TIFF to JPG or WEBP.
 */
async function convertTiffToFormat(
  file: File,
  quality: number,
  outputFormat: 'JPG' | 'WEBP'
): Promise<ConversionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const ifds = UTIF.decode(arrayBuffer);
    if (!ifds || ifds.length === 0) {
      throw new Error('Empty or invalid TIFF file.');
    }
    UTIF.decodeImage(arrayBuffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const width = ifds[0].width;
    const height = ifds[0].height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to construct canvas for TIFF conversion.');
    }

    if (outputFormat === 'JPG') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData, 0, 0);

    return new Promise((resolve, reject) => {
      const mimeType = outputFormat === 'JPG' ? 'image/jpeg' : 'image/webp';
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, width, height });
          } else {
            reject(new Error(`Failed to render TIFF to ${outputFormat} Blob.`));
          }
        },
        mimeType,
        quality / 100
      );
    });
  } catch (err) {
    console.error(err);
    throw new Error(`Failed to convert TIFF to ${outputFormat}.`);
  }
}

/**
 * Main Orchestrator: Converts any supported image format to JPG or WEBP.
 */
export async function convertImage(
  file: File,
  quality: number,
  outputFormat: 'JPG' | 'WEBP'
): Promise<ConversionResult> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type.toLowerCase();

  // RAW conversion path
  const isRaw = RAW_EXTENSIONS.includes(extension) || mimeType.startsWith('image/x-');
  if (isRaw) {
    const jpegBlob = await extractRawJpeg(file);
    
    // Direct pass-through optimization for JPG format with high quality
    if (outputFormat === 'JPG' && quality >= 90) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(jpegBlob);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({
            blob: jpegBlob,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load extracted JPEG preview.'));
        };
        img.src = objectUrl;
      });
    }

    // Convert the extracted JPEG to output format (applying quality or converting to WEBP)
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(jpegBlob);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error(`Failed to construct canvas for RAW to ${outputFormat} conversion.`));
          return;
        }
        if (outputFormat === 'JPG') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);

        const mimeType = outputFormat === 'JPG' ? 'image/jpeg' : 'image/webp';
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
            } else {
              reject(new Error(`Failed to render RAW preview to ${outputFormat} Blob.`));
            }
          },
          mimeType,
          quality / 100
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load extracted JPEG preview.'));
      };
      img.src = objectUrl;
    });
  }

  // Direct pass-through optimizations for standard images to prevent generation loss
  const isJpeg = extension === 'jpg' || extension === 'jpeg' || mimeType === 'image/jpeg';
  const isWebp = extension === 'webp' || mimeType === 'image/webp';
  
  if (isJpeg && outputFormat === 'JPG' && quality >= 95) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          blob: file,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load JPEG dimensions.'));
      };
      img.src = objectUrl;
    });
  }

  if (isWebp && outputFormat === 'WEBP' && quality >= 95) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          blob: file,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load WEBP dimensions.'));
      };
      img.src = objectUrl;
    });
  }

  // TIFF conversion path
  if (extension === 'tif' || extension === 'tiff' || mimeType === 'image/tiff') {
    return convertTiffToFormat(file, quality, outputFormat);
  }

  // HEIC/HEIF conversion path
  if (
    extension === 'heic' ||
    extension === 'heif' ||
    mimeType === 'image/heic' ||
    mimeType === 'image/heif'
  ) {
    return convertHeicToFormat(file, quality, outputFormat);
  }

  // Standard path
  return convertStandardImage(file, quality, outputFormat);
}
