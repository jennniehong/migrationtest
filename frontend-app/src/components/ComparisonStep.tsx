/**
 * @fileoverview DDL Comparison Step Component
 * Displays a full-screen DDL comparison view for selected objects before migration.
 * 
 * DDL 비교 단계 컴포넌트
 * 마이그레이션 전 선택한 객체의 전체 화면 DDL 비교 뷰를 표시합니다.
 */
import React, { useState } from 'react';
import { ConnectionInfo, OracleObject, DDLComparison } from '../types';
import { DDLCompareView } from './DDLCompareView';

/** API base URL / API 기본 URL */
const API_BASE = "http://localhost:8080/api";

/**
 * Props for the ComparisonStep component.
 * ComparisonStep 컴포넌트의 Props입니다.
 */
interface ComparisonStepProps {
  /** Oracle connection information / Oracle 연결 정보 */
  connInfo: ConnectionInfo;
  /** List of selected objects to compare / 비교할 선택된 객체 목록 */
  selectedObjects: OracleObject[];
  /** Callback to continue to next step / 다음 단계로 진행 콜백 */
  onContinue: () => void;
  /** Callback to go back to previous step / 이전 단계로 돌아가기 콜백 */
  onBack: () => void;
}

/**
 * DDL Comparison Step Component
 * Allows users to view Oracle vs PostgreSQL DDL comparisons before starting migration.
 * Users can select objects from a list and view detailed DDL side-by-side.
 * 
 * DDL 비교 단계 컴포넌트
 * 마이그레이션 시작 전 Oracle과 PostgreSQL DDL 비교를 볼 수 있습니다.
 * 목록에서 객체를 선택하고 상세 DDL을 나란히 볼 수 있습니다.
 * 
 * @param props - Component props / 컴포넌트 props
 * @returns JSX element / JSX 요소
 */
export function ComparisonStep({ connInfo, selectedObjects, onContinue, onBack }: ComparisonStepProps) {
  // Currently selected object index (-1 means no selection) / 현재 선택된 객체 인덱스 (-1은 미선택)
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(-1);
  // DDL comparison data / DDL 비교 데이터
  const [comparison, setComparison] = useState<DDLComparison | null>(null);
  // Loading state / 로딩 상태
  const [loading, setLoading] = useState(false);
  // Error message / 오류 메시지
  const [error, setError] = useState<string | null>(null);

  // Currently selected object or null / 현재 선택된 객체 또는 null
  const currentObject = selectedObjectIndex >= 0 ? selectedObjects[selectedObjectIndex] : null;

  /**
   * Fetch DDL comparison data from API for the current object.
   * 현재 객체에 대한 DDL 비교 데이터를 API에서 가져옵니다.
   */
  const fetchComparison = async () => {
    if (!currentObject) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/convert/ddl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: connInfo,
          object_name: currentObject.name,
          object_type: currentObject.type
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch DDL comparison');
      }

      const data = await response.json();
      setComparison(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load comparison');
    } finally {
      setLoading(false);
    }
  };

  const handleObjectChange = (index: number) => {
    setSelectedObjectIndex(index);
    setComparison(null);
  };

  React.useEffect(() => {
    if (currentObject) {
      fetchComparison();
    }
  }, [selectedObjectIndex]);

  return (
    <div className="step-container">
      <div className="mb-6">
        <h3 className="text-xl font-bold m-0">DDL Comparison</h3>
        <p className="text-sm text-muted mt-1">
          Compare Oracle source DDL with converted PostgreSQL DDL
        </p>
      </div>

      {/* Object Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Object:</label>
        <select 
          className="input-field"
          value={selectedObjectIndex}
          onChange={(e) => handleObjectChange(parseInt(e.target.value))}
          style={{ width: '400px' }}
        >
          <option value="-1" disabled>-- Select an object to compare --</option>
          {selectedObjects.map((obj, index) => (
            <option key={index} value={index}>
              {obj.type}: {obj.name}
            </option>
          ))}
        </select>
      </div>

      {!loading && !error && !comparison && selectedObjectIndex === -1 && (
        <div className="text-center p-12" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h4 className="m-0 mb-2">Select an Object</h4>
          <p className="text-muted">Choose an object from the dropdown above to view DDL comparison</p>
        </div>
      )}

      <DDLCompareView 
        comparison={comparison} 
        loading={loading} 
        error={error} 
        mode="full" 
      />

      {/* Navigation Footer */}
      <div className="flex justify-between items-center gap-4 mt-6">
        <button className="btn-secondary" onClick={onBack}>
          ← Back to Selection
        </button>
        <button className="btn-primary" onClick={onContinue}>
          Start Migration →
        </button>
      </div>
    </div>
  );
}
