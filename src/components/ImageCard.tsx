import React, { useState } from 'react';
import { X, Check, AlertCircle, Loader2, Download, Play, ChevronDown, ChevronUp } from 'lucide-react';
import type { FileQueueItem } from '../types';
import { formatFileSize } from '../utils/converter';

interface ImageCardProps {
  item: FileQueueItem;
  onRemove: (id: string) => void;
  onConvertSingle: (id: string) => void;
  onDownloadSingle: (item: FileQueueItem) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  item,
  onRemove,
  onConvertSingle,
  onDownloadSingle,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSavingPercentage = () => {
    if (!item.convertedSize) return null;
    const original = item.file.size;
    const converted = item.convertedSize;
    const diff = original - converted;
    const percent = Math.round((diff / original) * 100);
    return percent;
  };

  const savingPercent = getSavingPercentage();

  return (
    <div className={`image-card ${item.status} ${isExpanded ? 'expanded' : ''}`}>
      <div className="card-main-row">
        {/* Thumbnail Preview */}
        <div className="card-preview-container">
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="card-preview-image"
              loading="lazy"
            />
          ) : (
            <div className="card-preview-placeholder">
              <span>{item.originalType}</span>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="card-info">
          <div className="card-header-row">
            <h4 className="card-filename" title={item.file.name}>
              {item.file.name}
            </h4>
            <span className="card-format-tag">{item.originalType}</span>
          </div>

          <div className="card-metadata-grid">
            <div className="metadata-item">
              <span className="metadata-label">Size:</span>
              <span className="metadata-val">{item.originalSizeStr}</span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Dimensions:</span>
              <span className="metadata-val">
                {item.dimensions
                  ? `${item.dimensions.width} × ${item.dimensions.height}`
                  : 'Reading...'}
              </span>
            </div>
          </div>

          {/* Dynamic Status Display */}
          {item.status === 'converting' && (
            <div className="status-indicator converting">
              <Loader2 className="spinner-icon" size={14} />
              <span>Converting...</span>
            </div>
          )}

          {item.status === 'success' && item.convertedSize && (
            <div className="status-row">
              <div className="status-indicator success">
                <Check size={14} />
                <span>
                  {item.convertedFormat || 'JPG'}: {formatFileSize(item.convertedSize)}{' '}
                  {savingPercent !== null && savingPercent > 0 && (
                    <span className="saving-badge" title="File size savings">Size -{savingPercent}%</span>
                  )}
                  {savingPercent !== null && savingPercent <= 0 && (
                    <span className="saving-badge negative" title="File size increase">
                      Size +{Math.abs(savingPercent)}%
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                className="btn-text-action"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <>
                    <span>Hide Details</span>
                    <ChevronUp size={12} />
                  </>
                ) : (
                  <>
                    <span>View Details</span>
                    <ChevronDown size={12} />
                  </>
                )}
              </button>
            </div>
          )}

          {item.status === 'error' && (
            <div className="status-indicator error" title={item.errorMsg}>
              <AlertCircle size={14} />
              <span>{item.errorMsg || 'Conversion failed'}</span>
            </div>
          )}
        </div>

        {/* Actions Panel */}
        <div className="card-actions">
          {item.status === 'idle' && (
            <button
              className="btn-action btn-convert"
              onClick={() => onConvertSingle(item.id)}
              title="Convert"
              aria-label={`Convert ${item.file.name}`}
              disabled={!item.dimensions}
            >
              <Play size={16} />
            </button>
          )}
          
          {item.status === 'success' && (
            <button
              className="btn-action btn-download"
              onClick={() => onDownloadSingle(item)}
              title="Download"
              aria-label={`Download converted ${item.file.name}`}
            >
              <Download size={16} />
            </button>
          )}

          <button
            className="btn-action btn-remove"
            onClick={() => onRemove(item.id)}
            title="Remove from list"
            aria-label={`Remove ${item.file.name} from list`}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Expandable Details Panel */}
      {isExpanded && item.status === 'success' && (
        <div className="card-details-panel">
          <div className="details-grid">
            <div className="details-col">
              <span className="details-lbl">Original File:</span>
              <span className="details-val">{item.file.name} ({item.originalType})</span>
            </div>
            <div className="details-col">
              <span className="details-lbl">Original Size:</span>
              <span className="details-val">{item.originalSizeStr}</span>
            </div>
            <div className="details-col">
              <span className="details-lbl">Original Resolution:</span>
              <span className="details-val">
                {item.dimensions ? `${item.dimensions.width} × ${item.dimensions.height}` : 'N/A'}
              </span>
            </div>
            <div className="details-col">
              <span className="details-lbl">Output Format:</span>
              <span className="details-val">{item.convertedFormat || 'JPG'}</span>
            </div>
            <div className="details-col">
              <span className="details-lbl">Output Size:</span>
              <span className="details-val">
                {item.convertedSize ? formatFileSize(item.convertedSize) : 'N/A'}
              </span>
            </div>
            <div className="details-col">
              <span className="details-lbl">Output Resolution:</span>
              <span className="details-val">
                {item.outputDimensions ? `${item.outputDimensions.width} × ${item.outputDimensions.height}` : 'N/A'}
              </span>
            </div>
            <div className="details-col">
              <span className="details-lbl">Quality Used:</span>
              <span className="details-val">
                {item.convertedQuality !== undefined ? `${item.convertedQuality}%` : '100%'}
              </span>
            </div>
            <div className="details-col">
              <span className="details-lbl">Size Reduction:</span>
              <span className="details-val">
                {savingPercent !== null ? `${savingPercent}% saved` : 'N/A'}
              </span>
            </div>
            {item.rawProcessingDetails && (
              <div className="details-col full-width">
                <span className="details-lbl">RAW Processing:</span>
                <span className="details-val">
                  {item.rawProcessingDetails.fullDecoding ? 'Full RAW Demosaic' : 'Embedded Preview Extracted'}
                  {` (Decoded Preview: ${item.rawProcessingDetails.decodedWidth} × ${item.rawProcessingDetails.decodedHeight})`}
                </span>
              </div>
            )}
            {item.cameraModel && (
              <div className="details-col full-width">
                <span className="details-lbl">Camera Model:</span>
                <span className="details-val">{item.cameraModel}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
