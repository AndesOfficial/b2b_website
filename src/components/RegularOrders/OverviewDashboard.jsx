import UserOrderCards from './UserOrderCards';
import GraphsTrends from './GraphsTrends';

export default function OverviewDashboard({ analytics, registeredUserIds }) {
  if (!analytics) return null;

  return (
    <div className="animate-fade-in space-y-6">
      <UserOrderCards analytics={analytics} registeredUserIds={registeredUserIds} />
      <GraphsTrends analytics={analytics} />
    </div>
  );
}
