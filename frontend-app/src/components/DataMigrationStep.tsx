import React, { useState } from 'react';
import { ConnectionInfo, OracleObject } from '../types';

const API_BASE = "http://localhost:8080/api";

interface DataMigrationStepProps {
  connInfo: ConnectionInfo;
  objects: OracleObject[];
  onBack: () => void;
}

export function DataMigrationStep({ connInfo, objects, onBack }: DataMigrationStepProps) {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [batchSize, setBatchSize] = useState(1000);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter only TABLE type objects
  const tables = objects.filter(obj => obj.type === 'TABLE');

  const toggleTable = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const toggleAll = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(tables.map(t => t.name));
    }
  };

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
          batch_size: batchSize
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start data migration');
      }

      const data = await response.json();
      setJobId(data.jobId);
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
          <h3 className="text-xl font-bold m-0">Data Migration</h3>
          <p className="text-sm text-muted mt-1">
            Select tables to migrate data from Oracle to PostgreSQL
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
            <div className="flex gap-6 items-center">
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
              <div className="flex-1">
                <p className="text-sm text-muted">
                  Number of rows to process per batch. Lower values use less memory but may be slower.
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
                {loading ? 'Starting...' : `Start Data Migration (${selectedTables.length} tables)`}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="card p-6 text-center">
          <div className="step-circle active mb-4">✓</div>
          <h4 className="mb-2">Data Migration Started</h4>
          <p className="text-muted mb-4">Job ID: {jobId}</p>
          <p className="text-sm">
            Your data migration job has been started. You can monitor progress in the sidebar's job history.
          </p>
        </div>
      )}
    </div>
  );
}
