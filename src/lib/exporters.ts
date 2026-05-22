import type { FavoriteItem, Poi, StarResult } from "../types";
import { starLineSequences } from "./solver";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const uniquePois = (pois: Poi[], stars: StarResult[]) => {
  const byId = new Map<string, Poi>();
  for (const poi of pois) byId.set(poi.id, poi);
  for (const star of stars) {
    for (const poi of star.points) byId.set(poi.id, poi);
  }
  return [...byId.values()];
};

const starName = (star: StarResult, index: number) =>
  star.name ?? `${star.mode === 5 ? "五芒星" : "六芒星"} ${index + 1}`;

export const exportGpx = (
  name: string,
  pois: Poi[],
  stars: StarResult[]
) => {
  const waypoints = uniquePois(pois, stars)
    .map(
      (poi) => `  <wpt lat="${poi.lat}" lon="${poi.lng}">
    <name>${escapeXml(poi.name)}</name>
    <type>${escapeXml(poi.categoryLabel)}</type>
  </wpt>`
    )
    .join("\n");

  const routes = stars
    .flatMap((star, starIndex) =>
      starLineSequences(star.mode).map((sequence, sequenceIndex) => {
        const points = sequence
          .map((pointIndex) => star.points[pointIndex])
          .map(
            (poi) => `    <rtept lat="${poi.lat}" lon="${poi.lng}">
      <name>${escapeXml(poi.name)}</name>
    </rtept>`
          )
          .join("\n");

        return `  <rte>
    <name>${escapeXml(starName(star, starIndex))}${
          star.mode === 6 ? `-${sequenceIndex + 1}` : ""
        }</name>
${points}
  </rte>`;
      })
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mapping Star" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
${waypoints}
${routes}
</gpx>
`;
};

export const exportKml = (
  name: string,
  pois: Poi[],
  stars: StarResult[]
) => {
  const pointPlacemarks = uniquePois(pois, stars)
    .map(
      (poi) => `    <Placemark>
      <name>${escapeXml(poi.name)}</name>
      <description>${escapeXml(poi.categoryLabel)}</description>
      <Point><coordinates>${poi.lng},${poi.lat},0</coordinates></Point>
    </Placemark>`
    )
    .join("\n");

  const linePlacemarks = stars
    .flatMap((star, starIndex) =>
      starLineSequences(star.mode).map((sequence, sequenceIndex) => {
        const coordinates = sequence
          .map((pointIndex) => star.points[pointIndex])
          .map((poi) => `${poi.lng},${poi.lat},0`)
          .join(" ");

        return `    <Placemark>
      <name>${escapeXml(starName(star, starIndex))}${
          star.mode === 6 ? `-${sequenceIndex + 1}` : ""
        }</name>
      <Style>
        <LineStyle><color>ff2d42d6</color><width>3</width></LineStyle>
      </Style>
      <LineString><tessellate>1</tessellate><coordinates>${coordinates}</coordinates></LineString>
    </Placemark>`;
      })
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
${pointPlacemarks}
${linePlacemarks}
  </Document>
</kml>
`;
};

export const splitFavorites = (favorites: FavoriteItem[]) => ({
  pois: favorites
    .filter((favorite): favorite is Extract<FavoriteItem, { type: "poi" }> =>
      favorite.type === "poi"
    )
    .map((favorite) => favorite.poi),
  stars: favorites
    .filter((favorite): favorite is Extract<FavoriteItem, { type: "star" }> =>
      favorite.type === "star"
    )
    .map((favorite) => favorite.star)
});
