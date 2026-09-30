import DashboardCards from './DashboardCards';
import GrowthComparison from './GrowthComparison';
import GraphsTrends from './GraphsTrends';

export default function OverviewDashboard({ analytics }) {
  if (!analytics) return null;

  return (
    <div className="animate-fade-in space-y-6">
      <DashboardCards analytics={analytics} />
      <GrowthComparison analytics={analytics} />
      <GraphsTrends analytics={analytics} />
    </div>
  );
}
