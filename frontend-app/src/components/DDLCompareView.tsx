/**
 * @fileoverview DDL Comparison View Component
 * Displays side-by-side comparison of Oracle source DDL and PostgreSQL converted DDL.
 * 
 * DDL 비교 뷰 컴포넌트
 * Oracle 소스 DDL과 PostgreSQL 변환 DDL을 나란히 비교하여 표시합니다.
 */
import React from 'react';
import { DDLComparison } from '../types';

/**
 * Props for the DDLCompareView component.
 * DDLCompareView 컴포넌트의 Props입니다.
 */
interface DDLCompareViewProps {
  /** DDL comparison data / DDL 비교 데이터 */
  comparison: DDLComparison | null;
  /** Loading state / 로딩 상태 */
  loading: boolean;
  /** Error message if any / 오류 메시지 (있는 경우) */
  error: string | null;
  /** Display mode: 'full' for standalone view, 'mini' for accordion / 표시 모드 */
  mode?: 'full' | 'mini';
}

/**
 * DDL Comparison View Component
 * Renders a side-by-side view of Oracle and PostgreSQL DDL with copy functionality.
 * Supports both full-screen and mini (accordion) display modes.
 * 
 * DDL 비교 뷰 컴포넌트
 * Oracle과 PostgreSQL DDL을 나란히 표시하고 복사 기능을 제공합니다.
 * 전체 화면 및 미니(아코디언) 표시 모드를 모두 지원합니다.
 * 
 * @param props - Component props / 컴포넌트 props
 * @returns JSX element or null / JSX 요소 또는 null
 */
export function DDLCompareView({ 
  comparison, 
  loading, 
  error, 
  mode = 'full' 
}: DDLCompareViewProps) {
  // Copy state for source DDL / 소스 DDL 복사 상태
  const [copiedSource, setCopiedSource] = React.useState(false);
  // Copy state for target DDL / 대상 DDL 복사 상태
  const [copiedTarget, setCopiedTarget] = React.useState(false);
  
  /**
   * Copy text to clipboard and show feedback.
   * 텍스트를 클립보드에 복사하고 피드백을 표시합니다.
   * 
   * @param text - Text to copy / 복사할 텍스트
   * @param setCopied - State setter for copy feedback / 복사 피드백용 상태 설정자
   */
  const handleCopy = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Loading state UI / 로딩 상태 UI
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

  // Error state UI / 오류 상태 UI
  if (error) {
    return (
      <div className={`p-4 bg-red-400/5 border border-red-400/20 rounded-lg text-red-400 ${mode === 'mini' ? 'text-xs' : ''}`}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!comparison) return null;

  // Dynamic class names based on mode / 모드에 따른 동적 클래스 이름
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
