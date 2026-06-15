import { useState } from 'react';
import { getTodayString, getYesterdayString, formatDateString } from '../../utils/dateUtils';

const PRESETS = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Custom'];

export default function RegularDateFilter({ dateFrom, dateTo, setDateFrom, setDateTo }) {
  const [activePreset, setActivePreset] = useState('Monthly'); // Default or could be prop

  const handlePresetClick = (preset) => {
    setActivePreset(preset);
    
    const today = new Date();
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
      
      {activePreset === 'Custom' && (
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-[13px] font-bold text-slate-700 outline-none px-2 py-1"
            />
            <span className="text-slate-300">—</span>
            <input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-[13px] font-bold text-slate-700 outline-none px-2 py-1"
            />
        </div>
      )}
    </div>
  );
}
