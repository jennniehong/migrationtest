/**
 * @fileoverview Object Selection Step Component
 * Provides an interface for selecting Oracle objects to migrate with filtering and preview.
 * 
 * 객체 선택 단계 컴포넌트
 * 필터링 및 미리보기 기능을 갖춘 마이그레이션할 Oracle 객체 선택 인터페이스를 제공합니다.
 */
import React, { useState } from 'react';
import { OracleObject, ConnectionInfo, DDLComparison } from '../types';
import { DDLCompareView } from './DDLCompareView';

/** API base URL / API 기본 URL */
const API_BASE = "http://localhost:8080/api";

/**
 * Props for the SelectionStep component.
 * SelectionStep 컴포넌트의 Props입니다.
 */
interface SelectionStepProps {
  /** Search term for filtering objects / 객체 필터링용 검색어 */
  searchTerm: string;
  /** Callback to update search term / 검색어 업데이트 콜백 */
  setSearchTerm: (term: string) => void;
  /** Set of object types to filter by / 필터링할 객체 타입 집합 */
  filterTypes: Set<string>;
  /** Callback to update filter types / 필터 타입 업데이트 콜백 */
  setFilterTypes: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Output format preference / 출력 형식 선호도 */
  outputFormat: string;
  /** Callback to update output format / 출력 형식 업데이트 콜백 */
  setOutputFormat: (format: string) => void;
  /** Currently selected objects / 현재 선택된 객체들 */
  selectedObjects: OracleObject[];
  /** Callback to update selected objects / 선택된 객체 업데이트 콜백 */
  setSelectedObjects: React.Dispatch<React.SetStateAction<OracleObject[]>>;
  /** List of unique object types available / 사용 가능한 고유 객체 타입 목록 */
  uniqueTypes: string[];
  /** Filtered list of objects based on search/filter / 검색/필터 기반 필터링된 객체 목록 */
  filteredObjects: OracleObject[];
  /** Oracle connection info for DDL preview / DDL 미리보기용 Oracle 연결 정보 */
  connInfo: ConnectionInfo;
  /** Loading state indicator / 로딩 상태 표시 */
  loading: boolean;
  /** Callback to start DDL migration job / DDL 마이그레이션 작업 시작 콜백 */
  onStartMigration: () => void;
  /** Callback when data export job starts / 데이터 내보내기 작업 시작 시 콜백 */
  onDataExportStarted: (jobId: string) => void;
  /** Callback to go back to previous step / 이전 단계로 돌아가기 콜백 */
  onBack: () => void;
}

/**
 * Object Selection Step Component
 * Displays a filterable list of Oracle objects with multi-select capability.
 * Includes inline DDL preview functionality and type-based filtering.
 * 
 * 객체 선택 단계 컴포넌트
 * 다중 선택 기능이 있는 필터 가능한 Oracle 객체 목록을 표시합니다.
 * 인라인 DDL 미리보기 기능과 타입 기반 필터링을 포함합니다.
 * 
 * @param props - Component props / 컴포넌트 props
 * @returns JSX element / JSX 요소
 */
export const SelectionStep: React.FC<SelectionStepProps> = ({
  searchTerm,
  setSearchTerm,
  filterTypes,
  setFilterTypes,
  outputFormat,
  setOutputFormat,
  selectedObjects,
  setSelectedObjects,
  uniqueTypes,
  filteredObjects,
  connInfo,
  loading,
  onStartMigration,
  onDataExportStarted,
  onBack
}) => {
  // Data export accordion state / 데이터 내보내기 아코디언 상태
  const [dataExportExpanded, setDataExportExpanded] = useState(false);
  const [batchSize, setBatchSize] = useState(1000);
  const [localFormat, setLocalFormat] = useState(outputFormat);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Dropdown state for type filter / 타입 필터 드롭다운 상태
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  // Set of expanded rows showing DDL preview / DDL 미리보기를 표시하는 확장된 행 집합
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  // Cache for DDL comparison data / DDL 비교 데이터 캐시
  const [ddlCache, setDdlCache] = useState<Record<string, DDLComparison>>({});
  // Set of objects currently loading DDL / 현재 DDL을 로딩 중인 객체 집합
  const [loadingDDL, setLoadingDDL] = useState<Set<string>>(new Set());

  /**
   * Check if an object is currently selected.
   * 객체가 현재 선택되어 있는지 확인합니다.
   */
  const isSelected = (obj: OracleObject) => selectedObjects.some(s => s.name === obj.name && s.type === obj.type);

  const togglePreview = async (obj: OracleObject) => {
    const rowKey = `${obj.type}:${obj.name}`;
    const newExpandedRows = new Set(expandedRows);

    if (newExpandedRows.has(rowKey)) {
      newExpandedRows.delete(rowKey);
      setExpandedRows(newExpandedRows);
      return;
    }

    // Expand
    newExpandedRows.add(rowKey);
    setExpandedRows(newExpandedRows);

    // If not in cache, fetch it
    if (!ddlCache[rowKey]) {
      setLoadingDDL(prev => new Set(prev).add(rowKey));
      try {
        const response = await fetch(`${API_BASE}/convert/ddl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: connInfo,
            object_name: obj.name,
            object_type: obj.type
          })
        });

        if (response.ok) {
          const data: DDLComparison = await response.json();
          setDdlCache(prev => ({ ...prev, [rowKey]: data }));
        }
      } catch (err) {
        console.error("Failed to fetch DDL preview", err);
      } finally {
        setLoadingDDL(prev => {
          const next = new Set(prev);
          next.delete(rowKey);
          return next;
        });
      }
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const toAdd = filteredObjects.filter(obj => !isSelected(obj));
      setSelectedObjects([...selectedObjects, ...toAdd]);
    } else {
      const visibleKeys = new Set(filteredObjects.map(o => `${o.name}|${o.type}`));
      setSelectedObjects(selectedObjects.filter(s => !visibleKeys.has(`${s.name}|${s.type}`)));
    }
  };

  return (
    <div className="card card-full-height">
      
      <div className="card-header-bordered">
        <div className="flex justify-between items-center mb-4">
          <div>
              <h2 className="text-xl m-0 font-semibold">2. Select Objects</h2>
              <p className="text-xs text-muted mt-1">Filter and choose the database objects to migrate.</p>
          </div>
          <div className="selection-badge-container">
            <span className="text-primary font-bold text-lg">{selectedObjects.length}</span>
            <span className="text-xs ml-2">selected</span>
          </div>
        </div>

        <div className="toolbar m-0">
          <div className="toolbar-left">
            <div className="search-input-container flex-1">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                className="search-input"
                placeholder="Search objects..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="multi-select-container">
              <button 
                className="multi-select-trigger"
                onClick={(e) => { e.stopPropagation(); setIsTypeDropdownOpen(!isTypeDropdownOpen); }}
                style={{ minWidth: '180px' }}
              >
                {filterTypes.has('ALL') ? 'All Types' : `${filterTypes.size} Types Selected`}
              </button>
              {isTypeDropdownOpen && (
                <div className="multi-select-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="multi-select-item" onClick={() => {
                      setFilterTypes(new Set(['ALL']));
                      setIsTypeDropdownOpen(false);
                  }}>
                    <input type="checkbox" checked={filterTypes.has('ALL')} readOnly />
                    <span>Select All</span>
                  </div>
                  <div className="bg-border my-1 h-px"></div>
                  {uniqueTypes.filter(t => t !== 'ALL').map(t => (
                    <div 
                      key={t} 
                      className="multi-select-item"
                      onClick={() => {
                        const newSet = new Set(filterTypes);
                        if (newSet.has('ALL')) newSet.delete('ALL');
                        
                        if (newSet.has(t)) {
                          newSet.delete(t);
                          if (newSet.size === 0) newSet.add('ALL');
                        } else {
                          newSet.add(t);
                        }
                        setFilterTypes(newSet);
                      }}
                    >
                      <input type="checkbox" checked={filterTypes.has(t)} readOnly />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              )}
              {isTypeDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={(e) => { e.stopPropagation(); setIsTypeDropdownOpen(false); }}
                />
              )}
            </div>
          </div>

          <div className="toolbar-right">
            <label className="m-0 text-sm font-medium whitespace-nowrap">Output:</label>
            <select 
              className="custom-select"
              style={{ minWidth: '100px' }}
              value={outputFormat} 
              onChange={(e) => setOutputFormat(e.target.value)}
            >
              <option value="SQL">SQL</option>
              <option value="CSV">CSV</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-container border-none flex-1">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-center w-[50px]">
                <input 
                  type="checkbox" 
                  checked={filteredObjects.length > 0 && filteredObjects.every(isSelected)}
                  onChange={(e) => handleSelectAll(e.target.checked)} 
                />
              </th>
              <th>Name ({filteredObjects.length})</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {filteredObjects.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-muted">
                  No objects found matching filter.
                </td>
              </tr>
            )}
            {filteredObjects.map(obj => {
              const rowKey = `${obj.type}:${obj.name}`;
              const isExpanded = expandedRows.has(rowKey);
              const comparison = ddlCache[rowKey];
              const isLoading = loadingDDL.has(rowKey);

              return (
                <React.Fragment key={rowKey}>
                  <tr className={isExpanded ? 'bg-white/5' : ''}>
                    <td className="text-center">
                      <input 
                        type="checkbox" 
                        checked={isSelected(obj)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedObjects([...selectedObjects, obj]);
                          else setSelectedObjects(selectedObjects.filter(o => !(o.name === obj.name && o.type === obj.type)));
                        }}
                      />
                    </td>
                    <td>
                      <div className="flex items-center justify-between group">
                        <span>{obj.name}</span>
                        <button 
                          className={`btn-icon-tiny ${isExpanded ? 'active' : ''}`}
                          onClick={() => togglePreview(obj)}
                          title="Preview DDL Conversion"
                        >
                          {isExpanded ? '▼ Close' : '👁 Preview'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className="status-badge bg-white/10 text-muted">{obj.type}</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-white/[0.02]">
                      <td colSpan={3} className="p-0 border-none">
                        <div className="ddl-preview-accordion px-4 pb-4 animate-fadeIn">
                          <DDLCompareView 
                            comparison={comparison} 
                            loading={isLoading} 
                            error={null} 
                            mode="mini" 
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Data Export Accordion */}
      {dataExportExpanded && (
        <div className="card mt-4" style={{ background: 'var(--bg-dark)', border: '2px solid var(--primary)' }}>
          <div className="p-4">
            <h4 className="text-lg font-semibold mb-4">Data Export Configuration</h4>
            
            <div className="flex gap-8 items-center mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Batch Size:</label>
                <input
                  type="number"
                  className="input-field"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 1000)}
                  min={100}
                  max={10000}
                  step={100}
                  style={{ width: '150px' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Output Format:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="dataOutputFormat" 
                      value="SQL" 
                      checked={localFormat === 'SQL'} 
                      onChange={() => setLocalFormat('SQL')}
                    />
                    <span>SQL (COPY)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="dataOutputFormat" 
                      value="CSV" 
                      checked={localFormat === 'CSV'} 
                      onChange={() => setLocalFormat('CSV')}
                    />
                    <span>CSV</span>
                  </label>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted">
                  SQL format uses standard PostgreSQL COPY. CSV is suitable for external tools.
                </p>
              </div>
            </div>

            {exportError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-300 rounded" style={{ color: '#c53030' }}>
                {exportError}
              </div>
            )}

            <div className="flex gap-3">
              <button 
                className="btn-secondary"
                onClick={() => setDataExportExpanded(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={async () => {
                  const tablesToExport = selectedObjects.filter(obj => obj.type === 'TABLE');
                  if (tablesToExport.length === 0) {
                    setExportError('No tables selected for data export');
                    return;
                  }

                  setExportLoading(true);
                  setExportError(null);

                  try {
                    const actualFormat = localFormat === 'SQL' ? 'COPY' : localFormat;
                    const response = await fetch(`${API_BASE}/jobs/data-migration`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        connection: connInfo,
                        tables: tablesToExport.map(t => t.name),
                        batch_size: batchSize,
                        outputFormat: actualFormat
                      })
                    });

                    if (!response.ok) {
                      throw new Error('Failed to start data export');
                    }

                    const data = await response.json();
                    onDataExportStarted(data.jobId);
                  } catch (err: any) {
                    setExportError(err.message || 'Failed to start data export');
                  } finally {
                    setExportLoading(false);
                  }
                }}
                disabled={exportLoading || selectedObjects.filter(obj => obj.type === 'TABLE').length === 0}
              >
                {exportLoading ? 'Starting...' : `🚀 Start Data Export (${selectedObjects.filter(obj => obj.type === 'TABLE').length} tables)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center gap-4 mt-4 pt-4 border-t border-border">
        <button className="btn-secondary" onClick={onBack}>
          ← Back to Connection
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted mr-2">
            {selectedObjects.length === 0 ? 'Select objects to proceed' : `${selectedObjects.length} object(s) selected`}
          </span>
          <button 
            className="btn-secondary" 
            onClick={() => setDataExportExpanded(!dataExportExpanded)} 
            disabled={loading || selectedObjects.length === 0}
            title="Configure data export for selected tables"
          >
            {dataExportExpanded ? '▼ Hide Data Export' : '📊 Prepare Data Export'}
          </button>
          <button 
            className="btn-primary" 
            onClick={onStartMigration} 
            disabled={loading || selectedObjects.length === 0}
            title="Download DDL migration files"
          >
            {loading ? 'Starting...' : '📥 Download DDL'}
          </button>
        </div>
      </div>
    </div>
  );
};
