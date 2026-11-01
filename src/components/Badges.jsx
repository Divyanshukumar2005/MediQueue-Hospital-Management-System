const TOKEN = {
  waiting: ['badge-yellow', '⏳', 'Waiting'],
  called: ['badge-blue', '📢', 'Called'],
  completed: ['badge-green', '✅', 'Completed'],
  cancelled: ['badge-red', '❌', 'Cancelled'],
};
const APPT = {
  pending: ['badge-yellow', '⏳', 'Pending'],
  confirmed: ['badge-blue', '✅', 'Confirmed'],
  visited: ['badge-green', '🏥', 'Visited'],
  cancelled: ['badge-red', '❌', 'Cancelled'],
};
const MED = {
  pending: ['med-status-pending', '⏳', 'Pending'],
  preparing: ['med-status-preparing', '🔄', 'Preparing'],
  ready: ['med-status-ready', '✅', 'Ready for Pickup'],
  dispensed: ['med-status-dispensed', '📦', 'Dispensed'],
};

function Badge({ map, status }) {
  const [cls, icon, label] = map[status] || ['badge-gray', '❔', status];
  return (
    <span className={`badge ${cls}`}>
      <span>{icon}</span>
      {label}
    </span>
  );
}
export const StatusBadge = ({ status }) => <Badge map={TOKEN} status={status} />;
export const ApptStatusBadge = ({ status }) => <Badge map={APPT} status={status} />;
export function MedStatusBadge({ status }) {
  const [cls, icon, label] = MED[status] || MED.pending;
  return <span className={cls}>{icon} {label}</span>;
}
