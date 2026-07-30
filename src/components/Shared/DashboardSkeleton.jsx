import React from "react";

/**
 * A sleek skeleton loader with shimmer sweep animation.
 * Mimics the layout of KPI hero cards and the property table.
 */

function ShimmerBlock({ className = "" }) {
  return (
    <div className={`relative overflow-hidden bg-gray-100 rounded ${className}`}>
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s infinite",
        }}
      />
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div className="space-y-8 p-2">
        {/* Date Toggle Skeleton */}
        <div className="flex justify-end mb-6">
          <ShimmerBlock className="h-10 w-48 rounded-xl" />
        </div>

        {/* Hero KPI Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 h-40 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px]">
                <ShimmerBlock className="h-full w-full rounded-none" />
              </div>
              <div className="flex justify-between items-start mb-4 mt-2">
                <ShimmerBlock className="h-3.5 w-24 rounded-md" />
                <ShimmerBlock className="h-8 w-8 rounded-full" />
              </div>
              <ShimmerBlock className="h-8 w-32 rounded-lg mb-3" />
              <ShimmerBlock className="h-3 w-40 rounded-md" />
            </div>
          ))}
        </div>

        {/* Main Content Area Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Large Chart Area */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-8 h-[400px] shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-10">
              <div className="space-y-2">
                <ShimmerBlock className="h-5 w-32 rounded-md" />
                <ShimmerBlock className="h-3 w-48 rounded-md" />
              </div>
              <ShimmerBlock className="h-8 w-8 rounded-full" />
            </div>
            {/* Bar chart skeleton */}
            <div className="w-full h-52 flex items-end justify-between gap-2 px-2">
              {[65, 40, 80, 55, 90, 45, 70, 35, 60, 75].map((h, idx) => (
                <ShimmerBlock
                  key={idx}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Side Stats */}
          <div className="bg-white rounded-2xl border border-gray-100 p-8 h-[400px] shadow-sm">
            <ShimmerBlock className="h-5 w-32 rounded-md mb-8" />
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <ShimmerBlock className="h-10 w-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <ShimmerBlock className="h-4 w-full rounded-md" />
                    <ShimmerBlock className="h-3 w-2/3 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <ShimmerBlock className="h-5 w-48 rounded-md mb-8" />
          <div className="space-y-3">
            {/* Table header */}
            <div className="flex gap-4 pb-3 border-b border-gray-100">
              {[120, 80, 100, 80, 60].map((w, i) => (
                <ShimmerBlock key={i} className="h-3 rounded-md" style={{ width: w }} />
              ))}
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 py-3">
                {[120, 80, 100, 80, 60].map((w, j) => (
                  <ShimmerBlock key={j} className="h-4 rounded-md" style={{ width: w, opacity: 1 - i * 0.12 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
