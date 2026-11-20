import { useState, useEffect } from 'react';
import { UploadZone } from './components/UploadZone';
import { ImageCard } from './components/ImageCard';
import { ConversionSettings } from './components/ConversionSettings';
import type { FileQueueItem } from './types';
import { getFileMetadata, convertImage, formatFileSize, formatFileType } from './utils/converter';
import JSZip from 'jszip';
import { Shield, Smartphone, Layers } from 'lucide-react';

const RAW_EXTENSIONS = ['cr2', 'cr3', 'nef', 'arw', 'raf', 'dng', 'orf', 'rw2', 'pef', 'sr2', 'raw'];

function App() {
  const [files, setFiles] = useState<FileQueueItem[]>([]);
  const [quality, setQuality] = useState<number>(100);
  const [outputFormat, setOutputFormat] = useState<'JPG' | 'WEBP'>('JPG');
  const [isConverting, setIsConverting] = useState<boolean>(false);

  // Auto clean-up object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  const handleFilesSelected = (selectedFiles: File[]) => {
    // Create queue items
    const newItems: FileQueueItem[] = selectedFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
      file,
      previewUrl: '', // Will load asynchronously
      originalType: formatFileType(file.name, file.type),
      originalSizeStr: formatFileSize(file.size),
      status: 'idle',
    }));

    setFiles((prev) => [...prev, ...newItems]);

    // Load dimensions and previews asynchronously
    newItems.forEach((item) => {
      getFileMetadata(item.file)
        .then(({ width, height, previewWidth, previewHeight, previewUrl, cameraModel }) => {
          setFiles((prev) =>
            prev.map((f) => {
              if (f.id !== item.id) return f;
              
              const extension = f.file.name.split('.').pop()?.toLowerCase() || '';
              const isRawFile = RAW_EXTENSIONS.includes(extension);
              
              return { 
                ...f, 
                dimensions: { width, height }, 
                previewUrl,
                cameraModel,
                rawProcessingDetails: isRawFile ? {
                  fullDecoding: false,
                  previewExtracted: true,
                  decodedWidth: previewWidth,
                  decodedHeight: previewHeight
                } : undefined
              };
            })
          );
        })
        .catch((err) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: 'error',
                    errorMsg: err.message || 'Failed to read image details.',
                  }
                : f
            )
          );
        });
    });
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleClearQueue = () => {
    files.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setFiles([]);
  };

  const handleConvertSingle = async (id: string) => {
    const item = files.find((f) => f.id === id);
    if (!item || item.status === 'converting') return;

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'converting', errorMsg: undefined } : f))
    );

    try {
      const result = await convertImage(item.file, quality, outputFormat);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: 'success',
                convertedBlob: result.blob,
                convertedSize: result.blob.size,
                outputDimensions: { width: result.width, height: result.height },
                convertedFormat: outputFormat,
                convertedQuality: quality,
              }
            : f
        )
      );
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: 'error', errorMsg: err.message || 'Conversion failed.' } : f
        )
      );
    }
  };

  const handleConvertAll = async () => {
    if (isConverting) return;
    setIsConverting(true);

    // Filter items that are idle or in error state (retry them)
    const pendingItems = files.filter((f) => f.status === 'idle' || f.status === 'error');

    for (const item of pendingItems) {
      // Mark as converting
      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'converting', errorMsg: undefined } : f))
      );

      try {
        const result = await convertImage(item.file, quality, outputFormat);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'success',
                  convertedBlob: result.blob,
                  convertedSize: result.blob.size,
                  outputDimensions: { width: result.width, height: result.height },
                  convertedFormat: outputFormat,
                  convertedQuality: quality,
                }
              : f
          )
        );
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'error', errorMsg: err.message || 'Conversion failed.' }
              : f
          )
        );
      }
    }

    setIsConverting(false);
  };

  const handleDownloadSingle = (item: FileQueueItem) => {
    if (!item.convertedBlob) return;
    
    const url = URL.createObjectURL(item.convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    
    const baseName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) || item.file.name;
    const ext = item.convertedFormat?.toLowerCase() || 'jpg';
    a.download = `${baseName}.${ext}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const successItems = files.filter((f) => f.status === 'success' && f.convertedBlob);
    if (successItems.length === 0) return;

    if (successItems.length === 1) {
      handleDownloadSingle(successItems[0]);
      return;
    }

    // ZIP multiple images
    const zip = new JSZip();
    
    successItems.forEach((item) => {
      const baseName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) || item.file.name;
      const ext = item.convertedFormat?.toLowerCase() || 'jpg';
      zip.file(`${baseName}.${ext}`, item.convertedBlob!);
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${outputFormat.toLowerCase()}-conversions-${Date.now()}.zip`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate ZIP file:', err);
      alert('Failed to package conversions into ZIP.');
    }
  };

  return (
    <div className="app-container">
      <header className="hero-section">
        <h1 className="hero-title">Image to JPG & WEBP Converter</h1>
        <p className="hero-subtitle">
          Convert PNG, WEBP, HEIC, TIFF, RAW (CR2, CR3, RW2, NEF, ARW, SR2, RAF, ORF, PEF) and more.
        </p>
      </header>

      <main className="main-content">
        <UploadZone onFilesSelected={handleFilesSelected} />

        {files.length > 0 ? (
          <div className="workspace-grid">
            {/* Queue List */}
            <div className="queue-list-container">
              <h2 className="section-title">Upload Queue ({files.length})</h2>
              <div className="queue-list">
                {files.map((item) => (
                  <ImageCard
                    key={item.id}
                    item={item}
                    onRemove={handleRemove}
                    onConvertSingle={handleConvertSingle}
                    onDownloadSingle={handleDownloadSingle}
                  />
                ))}
              </div>
            </div>

            {/* Control Sidebar */}
            <div className="settings-sidebar">
              <ConversionSettings
                files={files}
                quality={quality}
                onQualityChange={setQuality}
                outputFormat={outputFormat}
                onFormatChange={setOutputFormat}
                onConvertAll={handleConvertAll}
                onDownloadAll={handleDownloadAll}
                onClearQueue={handleClearQueue}
                isConverting={isConverting}
              />
            </div>
          </div>
        ) : (
          /* Feature/Value Cards when queue is empty */
          <div className="features-grid">
            <div className="feature-card">
              <Shield className="feature-icon" size={20} />
              <h4>100% Client-Side</h4>
              <p>Your files never leave your device. Privacy and security are guaranteed by design.</p>
            </div>
            <div className="feature-card">
              <Layers className="feature-icon" size={20} />
              <h4>Batch Conversion</h4>
              <p>Upload and convert dozens of images simultaneously. Download them in one click.</p>
            </div>
            <div className="feature-card">
              <Smartphone className="feature-icon" size={20} />
              <h4>Universal Formats</h4>
              <p>Convert TIFF, HEIC, WEBP, AVIF, SVG, PNG, and camera RAW formats directly in your browser.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="footer-section">
        <p>© {new Date().getFullYear()} Image to JPG & WEBP Converter. Built with React, TypeScript & Canvas.</p>
      </footer>
    </div>
  );
}

export default App;
