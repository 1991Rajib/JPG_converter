import React from 'react';
import { Settings, Play, Download, Trash2, Loader2 } from 'lucide-react';
import type { FileQueueItem } from '../types';

interface ConversionSettingsProps {
  files: FileQueueItem[];
  quality: number;
  onQualityChange: (value: number) => void;
  outputFormat: 'JPG' | 'WEBP';
  onFormatChange: (value: 'JPG' | 'WEBP') => void;
  onConvertAll: () => void;
  onDownloadAll: () => void;
  onClearQueue: () => void;
  isConverting: boolean;
}

export const ConversionSettings: React.FC<ConversionSettingsProps> = ({
  files,
  quality,
  onQualityChange,
  outputFormat,
  onFormatChange,
  onConvertAll,
  onDownloadAll,
  onClearQueue,
  isConverting,
}) => {
  const totalCount = files.length;
  const convertedCount = files.filter((f) => f.status === 'success').length;
  const failedCount = files.filter((f) => f.status === 'error').length;
  const isFinished = convertedCount + failedCount === totalCount && totalCount > 0;

  // Calculate percentage of conversion progress
  const progressPercent = totalCount > 0 
    ? Math.round(((convertedCount + failedCount) / totalCount) * 100) 
    : 0;

  const hasConversions = convertedCount > 0;
  const allIdle = files.every((f) => f.status === 'idle');

  return (
    <div className="conversion-settings-panel">
      {/* Output Format Selector */}
      <div className="format-selector-container">
        <span className="format-selector-label">Output Format</span>
        <div className="format-toggle-group">
          <button
            type="button"
            className={`btn-toggle ${outputFormat === 'JPG' ? 'active' : ''}`}
            onClick={() => onFormatChange('JPG')}
            disabled={isConverting}
          >
            JPG
          </button>
          <button
            type="button"
            className={`btn-toggle ${outputFormat === 'WEBP' ? 'active' : ''}`}
            onClick={() => onFormatChange('WEBP')}
            disabled={isConverting}
          >
            WEBP
          </button>
        </div>
      </div>

      <div className="settings-divider"></div>

      {/* Slider Header */}
      <div className="settings-header">
        <div className="settings-title-wrapper">
          <Settings className="settings-icon" size={16} />
          <h3>Compression Settings</h3>
        </div>
        <div className="quality-value">
          Quality: <span className="quality-number">{quality}%</span>
        </div>
      </div>

      {/* Quality Slider */}
      <div className="slider-container">
        <input
          type="range"
          min="1"
          max="100"
          value={quality}
          onChange={(e) => onQualityChange(Number(e.target.value))}
          disabled={isConverting}
          className="quality-slider"
          aria-label="Compression Quality Slider"
        />
        <div className="slider-labels">
          <span>Smaller File (1%)</span>
          <span>Balanced (80%)</span>
          <span>Best Quality (100%)</span>
        </div>
      </div>

      {/* Queue Summary / Stats */}
      <div className="settings-divider"></div>
      
      <div className="queue-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Images</span>
          <span className="stat-val">{totalCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Converted</span>
          <span className="stat-val success">{convertedCount}</span>
        </div>
        {failedCount > 0 && (
          <div className="stat-card">
            <span className="stat-label">Failed</span>
            <span className="stat-val error">{failedCount}</span>
          </div>
        )}
      </div>

      {/* Dynamic Conversion Progress Bar */}
      {isConverting && (
        <div className="progress-container">
          <div className="progress-header">
            <span>Processing queue...</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="progress-track">
            <div 
              className="progress-bar" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Action CTA Buttons */}
      <div className="actions-button-group">
        {allIdle ? (
          <button
            className="btn btn-primary"
            onClick={onConvertAll}
            disabled={isConverting || totalCount === 0}
          >
            {isConverting ? (
              <>
                <Loader2 className="spinner-icon" size={16} />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Convert All to {outputFormat}</span>
              </>
            )}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={onConvertAll}
            disabled={isConverting || totalCount === 0 || isFinished}
          >
            {isConverting ? (
              <>
                <Loader2 className="spinner-icon" size={16} />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Convert Remaining</span>
              </>
            )}
          </button>
        )}

        <button
          className="btn btn-secondary"
          onClick={onDownloadAll}
          disabled={isConverting || !hasConversions}
        >
          <Download size={16} />
          <span>{convertedCount > 1 ? `Download All (ZIP)` : `Download ${outputFormat}`}</span>
        </button>

        <button
          className="btn btn-tertiary"
          onClick={onClearQueue}
          disabled={isConverting || totalCount === 0}
          title="Clear all images"
        >
          <Trash2 size={16} />
          <span>Clear Queue</span>
        </button>
      </div>
    </div>
  );
};
