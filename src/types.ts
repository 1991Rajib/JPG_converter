export interface FileQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  originalType: string;
  originalSizeStr: string;
  dimensions?: { width: number; height: number };
  status: 'idle' | 'converting' | 'success' | 'error';
  errorMsg?: string;
  convertedBlob?: Blob;
  convertedSize?: number;
  outputDimensions?: { width: number; height: number };
  convertedFormat?: 'JPG' | 'WEBP';
  convertedQuality?: number;
  rawProcessingDetails?: {
    fullDecoding: boolean;
    previewExtracted: boolean;
    decodedWidth: number;
    decodedHeight: number;
  };
  cameraModel?: string;
}
