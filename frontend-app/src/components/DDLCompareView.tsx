import React from 'react';
import { DDLComparison } from '../types';

interface DDLCompareViewProps {
  comparison: DDLComparison | null;
  loading: boolean;
  error: string | null;
  mode?: 'full' | 'mini';
}

export function DDLCompareView({ 
  comparison, 
  loading, 
  error, 
  mode = 'full' 
}: DDLCompareViewProps) {
  const [copiedSource, setCopiedSource] = React.useState(false);
  const [copiedTarget, setCopiedTarget] = React.useState(false);
  
  const handleCopy = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (loading) {
    return (
      <div className={`ddl-compare-status ${mode === 'mini' ? 'p-4 bg-black/10' : 'p-8 text-center'}`}>
        <div className={mode === 'mini' ? 'loading-spinner-small mx-auto mb-2' : 'step-circle active loading-spinner'}>
          {mode === 'mini' ? '' : '↻'}
        </div>
        <p className={mode === 'mini' ? 'text-xs text-muted mb-0' : 'mt-4'}>
          {mode === 'mini' ? 'Converting DDL...' : 'Loading DDL comparison...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-400/5 border border-red-400/20 rounded-lg text-red-400 ${mode === 'mini' ? 'text-xs' : ''}`}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!comparison) return null;

  const containerClass = mode === 'mini' ? 'grid-2 mt-2' : 'ddl-comparison-container';
  const panelClass = mode === 'mini' ? 'ddl-panel-mini' : 'ddl-panel';
  const headerClass = mode === 'mini' ? 'ddl-panel-header-mini' : 'ddl-panel-header';
  const contentClass = mode === 'mini' ? 'ddl-content-mini' : 'ddl-content';

  return (
    <div className={containerClass}>
      {/* Source Panel */}
      <div className={panelClass}>
        <div className={headerClass}>
          <div className="flex items-center gap-2">
            <h4 className="m-0 text-sm font-semibold">Oracle Source DDL</h4>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted text-[10px] uppercase tracking-wider">{comparison.objectType}</span>
            <button 
              className="copy-btn"
              onClick={() => handleCopy(comparison.sourceDDL, setCopiedSource)}
            >
              {copiedSource ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        <pre className={contentClass}>
          {comparison.sourceDDL}
        </pre>
      </div>

      {/* Target Panel */}
      <div className={panelClass}>
        <div className={headerClass}>
          <div className="flex items-center gap-2">
            <h4 className="m-0 text-sm font-semibold text-primary">PostgreSQL Converted</h4>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted text-[10px] uppercase tracking-wider">Converted by ora2pg</span>
            <button 
              className="copy-btn copy-btn-primary"
              onClick={() => handleCopy(comparison.convertedDDL || '', setCopiedTarget)}
            >
              {copiedTarget ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        <pre className={`${contentClass} ${mode === 'mini' ? 'text-primary-light' : 'text-primary-light'}`}>
          {comparison.convertedDDL || '-- No conversion available'}
        </pre>
      </div>
    </div>
  );
}
