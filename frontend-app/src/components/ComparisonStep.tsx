import React, { useState } from 'react';
import { ConnectionInfo, OracleObject, DDLComparison } from '../types';
import { DDLCompareView } from './DDLCompareView';

const API_BASE = "http://localhost:8080/api";

interface ComparisonStepProps {
  connInfo: ConnectionInfo;
  selectedObjects: OracleObject[];
  onContinue: () => void;
  onBack: () => void;
}

export function ComparisonStep({ connInfo, selectedObjects, onContinue, onBack }: ComparisonStepProps) {
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(-1);  // Start with no selection
  const [comparison, setComparison] = useState<DDLComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentObject = selectedObjectIndex >= 0 ? selectedObjects[selectedObjectIndex] : null;

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
