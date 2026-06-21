import React from "react";

import { EmptyStateIllustration } from "./EmptyStateIllustration";

export type EmptyStateType = "bond" | "trust" | "dispute" | "attestation" | "activity";

export interface EmptyStateProps {
  type: EmptyStateType;
  title: string;
  description: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type, title, description }) => {
  return (
    <div className="empty-state">
      <EmptyStateIllustration type={type} />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
};