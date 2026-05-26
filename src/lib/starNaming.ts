import type { StarResult } from "../types";
import { starModeLabel } from "./starPatterns";

export { starModeLabel };

export const formatStarNameDistance = (meters: number) => {
  const kilometers = Math.max(0, meters / 1000);
  const precision = kilometers >= 10 ? 0 : 1;
  return `${kilometers.toFixed(precision).replace(/\.0$/, "")}km`;
};

const starModeNamePattern = "(?:五芒星|六芒星|十字星|八卦圖)";
const trailingStarNamePattern = new RegExp(
  `\\s+(?:(?:${starModeNamePattern})\\s+半徑\\d+(?:\\.\\d+)?km\\s+角度\\d+(?:\\.\\d+)?°\\s+誤差\\d+(?:\\.\\d+)?°|\\d+(?:\\.\\d+)?km\\s+${starModeNamePattern})$`
);
const coordinateNamePattern =
  /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

const cleanNamePart = (value: string) => {
  const coordinateMatch = value.match(coordinateNamePattern);
  if (coordinateMatch) return `${coordinateMatch[1]},${coordinateMatch[2]}`;

  return value
    .split(",")[0]
    .replace(trailingStarNamePattern, "")
    .replace(/\s+/g, " ")
    .trim();
};

const formatDegrees = (degrees: number, precision = 0) =>
  `${degrees.toFixed(precision).replace(/\.0$/, "")}°`;

export const makeAutomaticStarName = ({
  centerName,
  star
}: {
  centerName: string;
  star: StarResult;
}) => {
  const baseName = cleanNamePart(centerName) || "中心點";

  return `${baseName} ${starModeLabel(star.mode)} 半徑${formatStarNameDistance(
    star.radiusMeanMeters
  )} 角度${formatDegrees(star.rotationDeg)} 誤差${formatDegrees(
    star.angleErrorDeg,
    1
  )}`;
};
