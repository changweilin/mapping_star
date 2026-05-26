import { LocateFixed, MapPin } from "lucide-react";
import type { LatLng, PlaceSearchResult } from "../types";

export const PlaceCandidateList = ({
  candidates,
  selectedCandidateId,
  disabled,
  formatCoordinate,
  onGoToCandidate,
  onSetCandidate
}: {
  candidates: PlaceSearchResult[];
  selectedCandidateId: string | null;
  disabled: boolean;
  formatCoordinate: (center: LatLng) => string;
  onGoToCandidate: (candidate: PlaceSearchResult) => void;
  onSetCandidate: (candidate: PlaceSearchResult) => void;
}) => (
  <div className="place-candidate-list" aria-label="候選地點">
    {candidates.map((candidate, index) => {
      const isSelected = selectedCandidateId === candidate.id;

      return (
        <article
          className={`place-candidate ${
            isSelected ? "place-candidate--selected" : ""
          }`}
          key={`${candidate.id}-${index}`}
        >
          <div className="place-candidate__body">
            <strong>{candidate.label}</strong>
            {candidate.detail && <span>{candidate.detail}</span>}
            <small>{formatCoordinate(candidate.center)}</small>
          </div>
          <div className="place-candidate__actions">
            <button
              className="secondary-button"
              type="button"
              title={`前往 ${candidate.label}`}
              onClick={() => onGoToCandidate(candidate)}
              disabled={disabled}
            >
              <LocateFixed size={16} />
              <span>前往地點</span>
            </button>
            <button
              className="primary-button"
              type="button"
              title={`前往並設置 ${candidate.label}`}
              onClick={() => onSetCandidate(candidate)}
              disabled={disabled}
            >
              <MapPin size={16} />
              <span>前往並設置</span>
            </button>
          </div>
        </article>
      );
    })}
  </div>
);
