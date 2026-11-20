import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
}

const ACCEPTED_EXTENSIONS = [
  'png', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'heic', 'heif', 'svg', 'avif', 'jpg', 'jpeg',
  'cr2', 'cr3', 'nef', 'arw', 'raf', 'dng', 'orf', 'rw2', 'pef', 'sr2', 'raw'
];

export const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const selectedFiles: File[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const mimeType = file.type.toLowerCase();
      
      const isValidExtension = ACCEPTED_EXTENSIONS.includes(extension);
      const isValidMime = mimeType.startsWith('image/') || 
                          mimeType === 'image/heic' || 
                          mimeType === 'image/heif' || 
                          mimeType === 'image/tiff';
      
      if (isValidExtension || isValidMime) {
        selectedFiles.push(file);
      } else {
        console.warn(`File rejected (unsupported type): ${file.name}`);
      }
    }
    
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={onButtonClick}
      tabIndex={0}
      role="button"
      aria-label="Upload images. Drag and drop files here or click to select files"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onButtonClick();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".png,.webp,.gif,.bmp,.tiff,.tif,.heic,.heif,.svg,.avif,.jpg,.jpeg,.cr2,.cr3,.nef,.arw,.raf,.dng,.orf,.rw2,.pef,.sr2,.raw,image/png,image/webp,image/gif,image/bmp,image/tiff,image/heic,image/heif,image/svg+xml,image/avif,image/jpeg"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      
      <div className="upload-content">
        <div className="upload-icon-wrapper">
          <Upload className="upload-icon" size={28} />
        </div>
        <p className="upload-title">
          Drag & drop your images here, or <span className="upload-link">browse</span>
        </p>
        <p className="upload-subtitle">
          Supports PNG, WEBP, HEIC, TIFF, RAW (CR2/CR3, NEF, ARW, SR2, RAF, DNG, RAW), SVG, AVIF, GIF, BMP, JPG
        </p>
      </div>
    </div>
  );
};
