import React from "react";
import { EmptyStateProps } from "./types";

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  subtitle,
  illustration = "bond",
  actionLabel,
  onAction,
}) => {
  const illustrationMap: Record<string, string> = {
    bond: "🔒",
    trust: "⭐",
    dispute: "⚖️",
    attestation: "📄",
    activity: "📊",
  };

  const IllustrationIcon = () => {
    const emoji = illustrationMap[illustration] || illustrationMap.bond;
    return (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text x="12" y="18" text-anchor="middle" font-size="24">
          {emoji}
        </text>
      </svg>
    );
  };

  return (
    <div className="empty-state">
      <IllustrationIcon />
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
      {actionLabel && (
        <button onClick={onAction} className="btn">
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;