export const ResultMetric = ({
  label,
  value
}: {
  label: string;
  value: string;
}) => (
  <span className="metric">
    <span>{label}</span>
    <strong>{value}</strong>
  </span>
);
