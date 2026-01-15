import React, { useState } from 'react';
import { OracleObject } from '../types';

interface SelectionStepProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterTypes: Set<string>;
  setFilterTypes: React.Dispatch<React.SetStateAction<Set<string>>>;
  outputFormat: string;
  setOutputFormat: (format: string) => void;
  selectedObjects: OracleObject[];
  setSelectedObjects: React.Dispatch<React.SetStateAction<OracleObject[]>>;
  uniqueTypes: string[];
  filteredObjects: OracleObject[];
  loading: boolean;
  onStartJob: () => void;
  onBack: () => void;
}

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
  loading,
  onStartJob,
  onBack
}) => {
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const isSelected = (obj: OracleObject) => selectedObjects.some(s => s.name === obj.name && s.type === obj.type);

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
            {filteredObjects.map(obj => (
              <tr key={`${obj.type}-${obj.name}`}>
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
                <td>{obj.name}</td>
                <td>
                  <span className="status-badge bg-white/10 text-muted">{obj.type}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center gap-4 mt-4 pt-4 border-t border-border">
        <button className="btn-secondary" onClick={onBack}>
          ← Back to Connection
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">
            {selectedObjects.length === 0 ? 'Select objects to proceed' : `${selectedObjects.length} object(s) ready`}
          </span>
          <button className="btn-primary" onClick={onStartJob} disabled={loading || selectedObjects.length === 0}>
            {loading ? 'Starting...' : 'Continue to Comparison →'}
          </button>
        </div>
      </div>
    </div>
  );
};
