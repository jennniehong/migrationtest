/**
 * @fileoverview Data Export Step Component
 * Allows users to select tables and export data as PostgreSQL COPY format files.
 * 
 * 데이터 내보내기 단계 컴포넌트
 * 사용자가 테이블을 선택하고 PostgreSQL COPY 형식 파일로 데이터를 내보낼 수 있습니다.
 */
import React, { useState } from 'react';
import { ConnectionInfo, OracleObject } from '../types';

const API_BASE = "http://localhost:8080/api";

/**
 * Props for the DataMigrationStep component.
 * DataMigrationStep 컴포넌트의 Props입니다.
 */
interface DataMigrationStepProps {
  /** Oracle connection information / Oracle 연결 정보 */
  connInfo: ConnectionInfo;
  /** List of available Oracle objects / 사용 가능한 Oracle 객체 목록 */
  objects: OracleObject[];
  /** List of already selected objects / 이미 선택된 객체 목록 */
  selectedObjects: OracleObject[];
  /** Preferred output format (SQL/CSV) / 선호하는 출력 형식 */
  outputFormat: string;
  /** Callback when job starts / 작업 시작 시 콜백 */
  onJobStarted: (jobId: string) => void;
  /** Callback to navigate back / 뒤로 가기 콜백 */
  onBack: () => void;
}

/**
 * Data Export Step Component
 * Displays a table selection interface for exporting Oracle data as PostgreSQL COPY format.
 * 
 * 데이터 내보내기 단계 컴포넌트
 * Oracle 데이터를 PostgreSQL COPY 형식으로 내보내기 위한 테이블 선택 인터페이스를 표시합니다.
 * 
 * @param props - Component props / 컴포넌트 props
 * @returns JSX element / JSX 요소
 */
export function DataMigrationStep({ connInfo, objects, selectedObjects, outputFormat, onJobStarted, onBack }: DataMigrationStepProps) {
  // Filter only TABLE type objects / TABLE 타입 객체만 필터링
  const tables = objects.filter(obj => obj.type === 'TABLE');
  
  // Selected table names for export / 내보내기용 선택된 테이블 이름들
  // Initialize with tables that were already selected in the Selection step
  const [selectedTables, setSelectedTables] = useState<string[]>(() => {
    return selectedObjects
      .filter(obj => obj.type === 'TABLE')
      .map(obj => obj.name);
  });
  // Batch size for data processing / 데이터 처리 배치 크기
  const [batchSize, setBatchSize] = useState(1000);
  // Local output format for data export / 데이터 내보내기용 로컬 출력 형식
  const [localFormat, setLocalFormat] = useState(outputFormat);
  // Job ID after export starts / 내보내기 시작 후 작업 ID
  const [jobId, setJobId] = useState<string | null>(null);
  // Loading state / 로딩 상태
  const [loading, setLoading] = useState(false);
  // Error message / 오류 메시지
  const [error, setError] = useState<string | null>(null);

  /**
   * Toggle selection state of a table.
   * 테이블의 선택 상태를 토글합니다.
   * @param tableName - Name of the table to toggle / 토글할 테이블 이름
   */
  const toggleTable = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  /**
   * Toggle selection of all tables.
   * 모든 테이블의 선택을 토글합니다.
   */
  const toggleAll = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(tables.map(t => t.name));
    }
  };

  /**
   * Start the data export job.
   * Calls the API to begin extracting data from selected tables.
   * 
   * 데이터 내보내기 작업을 시작합니다.
   * 선택한 테이블에서 데이터 추출을 시작하는 API를 호출합니다.
   */
  const startDataMigration = async () => {
    if (selectedTables.length === 0) {
      setError('Please select at least one table');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/jobs/data-migration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: connInfo,
          tables: selectedTables,
          batch_size: batchSize,
          outputFormat: localFormat
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start data migration');
      }

      const data = await response.json();
      setJobId(data.jobId);
      onJobStarted(data.jobId);
    } catch (err: any) {
      setError(err.message || 'Failed to start data migration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="step-container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold m-0">Data Export</h3>
          <p className="text-sm text-muted mt-1">
            Extract table data as PostgreSQL COPY format files for manual import
          </p>
        </div>
        <button className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
      </div>

      {!jobId ? (
        <>
          {/* Configuration Panel */}
          <div className="card mb-4" style={{ padding: '1rem' }}>
            <div className="flex gap-12 items-center">
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
          </div>

          {/* Table Selection */}
          <div className="card">
            <div className="flex justify-between items-center p-4 border-bottom">
              <h4 className="m-0">
                Select Tables ({selectedTables.length} of {tables.length} selected)
              </h4>
              <button className="btn-secondary btn-sm" onClick={toggleAll}>
                {selectedTables.length === tables.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '1rem' }}>
              {tables.length === 0 ? (
                <p className="text-muted text-center p-4">No tables available for data migration</p>
              ) : (
                <div className="grid gap-2">
                  {tables.map(table => (
                    <label 
                      key={table.name}
                      className="flex items-center gap-3 p-3 rounded hover-bg cursor-pointer"
                      style={{ border: '1px solid #e2e8f0' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(table.name)}
                        onChange={() => toggleTable(table.name)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span className="font-medium">{table.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-top">
              {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-300 rounded" style={{ color: '#c53030' }}>
                  {error}
                </div>
              )}
              <button 
                className="btn-primary w-full"
                onClick={startDataMigration}
                disabled={loading || selectedTables.length === 0}
              >
                {loading ? 'Starting...' : `Export Data (${selectedTables.length} tables)`}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="card p-6 text-center">
          <div className="step-circle active mb-4">✓</div>
          <h4 className="mb-2">Data Export Started</h4>
          <p className="text-muted mb-4">Job ID: {jobId}</p>
          <p className="text-sm">
            Data export job started. Once completed, download the ZIP file and use PostgreSQL's COPY command to import.
          </p>
        </div>
      )}
    </div>
  );
}
