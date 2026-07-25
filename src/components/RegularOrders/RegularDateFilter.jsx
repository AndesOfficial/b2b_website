import { useState, useRef, useEffect } from 'react';
import { FiCalendar, FiChevronDown } from 'react-icons/fi';
import { getTodayString, formatDateString } from '../../utils/dateUtils';

const PRESETS = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Custom'];

export default function RegularDateFilter({ dateFrom, dateTo, setDateFrom, setDateTo, compact = false }) {
  const [activePreset, setActivePreset] = useState('Daily');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click (compact mode only)
  useEffect(() => {
    if (!compact || !isDropdownOpen) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [compact, isDropdownOpen]);

  const handlePresetClick = (preset) => {
    setActivePreset(preset);
    setIsDropdownOpen(false);
    
    let newFrom = dateFrom;
    let newTo = getTodayString();

    switch(preset) {
      case 'Daily':
        newFrom = getTodayString();
        break;
      case 'Weekly':
        newFrom = formatDateString(-7);
        break;
      case 'Monthly':
        newFrom = formatDateString(-30);
        break;
      case 'Quarterly':
        newFrom = formatDateString(-90);
        break;
      case 'Yearly':
        newFrom = formatDateString(-365);
        break;
      case 'Custom':
        // Leave dates as is, user will pick
        return; 
    }

    if (preset !== 'Custom') {
        setDateFrom(newFrom);
        setDateTo(newTo);
    }
  };

  /* ─── Custom Date Pickers (Shared) ─── */
  const customDateInputs = activePreset === 'Custom' && (
    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
      <input 
        type="date" 
        value={dateFrom} 
        onChange={(e) => setDateFrom(e.target.value)}
        className="bg-transparent text-[12px] font-bold text-slate-700 outline-none px-1.5 py-0.5"
      />
      <span className="text-slate-300 text-[12px]">—</span>
      <input 
        type="date" 
        value={dateTo} 
        onChange={(e) => setDateTo(e.target.value)}
        className="bg-transparent text-[12px] font-bold text-slate-700 outline-none px-1.5 py-0.5"
      />
    </div>
  );

  /* ─── Compact Dropdown Mode ─── */
  if (compact) {
    return (
      <div className="relative flex items-center gap-2" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(prev => !prev)}
          className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-xl border border-gray-200 text-[13px] font-bold text-slate-700 hover:border-gray-300 transition-all shadow-sm"
        >
          <FiCalendar size={14} className="text-blue-500" />
          <span>{activePreset}</span>
          <FiChevronDown size={14} className={`text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1.5 bg-white rounded-xl border border-gray-200 shadow-xl z-50 py-1.5 min-w-[160px]">
            {PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={`w-full text-left px-4 py-2 text-[13px] font-bold transition-all ${
                  activePreset === preset
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        )}

        {customDateInputs}
      </div>
    );
  }

  /* ─── Default Full-Width Mode ─── */
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(preset => (
          <button
            key={preset}
            onClick={() => handlePresetClick(preset)}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
              activePreset === preset
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      
      {customDateInputs}
    </div>
  );
}
