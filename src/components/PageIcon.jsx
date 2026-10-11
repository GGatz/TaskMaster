import Icon from './Icon.jsx';

export default function PageIcon({ icon, type = 'page', size = 18 }) {
  if (icon) return <span className="page-icon" style={{ fontSize: size * 0.92, width: size, height: size }}>{icon}</span>;
  return (
    <span className="page-icon muted" style={{ width: size, height: size }}>
      <Icon name={type === 'database' ? 'table' : 'page'} size={size - 2} />
    </span>
  );
}
