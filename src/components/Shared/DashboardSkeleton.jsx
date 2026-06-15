import React from "react";

/**
 * A sleek, modern skeleton loader for the B2B dashboard.
 * Designed to mimic the layout of RevenueSources hero cards and the property table.
 */
export default function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse p-2">
      {/* Date Toggle Skeleton */}
      <div className="flex justify-end mb-6">
        <div className="h-10 w-48 bg-gray-200 rounded-xl" />
      </div>

      {/* Hero Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 h-40 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-8 w-12 bg-blue-50/50 rounded-lg" />
            </div>
            <div className="h-8 w-32 bg-gray-200 rounded-lg mb-4" />
            <div className="h-4 w-40 bg-gray-100 rounded" />
            
            {/* Shimmer line for sparkline position */}
            <div className="absolute top-4 right-4 h-12 w-20 bg-gray-50 rounded italic flex items-center justify-center text-[10px] text-gray-200">
              ~~~
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Large Chart Area */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-8 h-[400px] shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <div className="space-y-2">
              <div className="h-5 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-48 bg-gray-100 rounded" />
            </div>
            <div className="h-8 w-8 bg-gray-100 rounded-full" />
          </div>
          <div className="w-full h-64 bg-gray-50 rounded-xl flex items-end justify-between px-6 pb-6">
            {[...Array(10)].map((_, idx) => (
              <div 
                key={idx} 
                className="w-8 bg-gray-100 rounded-t-md" 
                style={{ height: `${Math.random() * 60 + 20}%`, opacity: 0.5 }}
              />
            ))}
          </div>
        </div>

        {/* Categories / Side Stats */}
        <div className="bg-white rounded-2xl border border-gray-100 p-8 h-[400px] shadow-sm">
          <div className="h-5 w-32 bg-gray-200 rounded mb-8" />
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-3 w-2/3 bg-gray-50 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Table Skeleton */}
      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <div className="h-5 w-48 bg-gray-200 rounded mb-8" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 w-full bg-gray-50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
