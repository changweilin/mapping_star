import { describe, expect, it } from "vitest";
import { getHoneycombSearchProfile } from "../lib/honeycombStrategy";
import { ZODIAC_CONSTELLATIONS } from "../lib/magicCircle";

describe("honeycomb search profiles", () => {
  it("keeps regular star searches on the configured radius band", () => {
    const profile = getHoneycombSearchProfile({
      shape: "star",
      variantId: "5",
      mode: 5
    });

    expect(profile.ignoreInnerRadius).toBe(false);
    expect(profile.priorityRings).toBe(2);
    expect(profile.targetBands).toEqual([
      { id: "perimeter", slots: 5, radius: "target" }
    ]);
  });

  it("uses denser perimeter search for higher point star variants", () => {
    const profile = getHoneycombSearchProfile({
      shape: "star",
      variantId: "8",
      mode: 8
    });

    expect(profile.ignoreInnerRadius).toBe(false);
    expect(profile.priorityRings).toBe(3);
    expect(profile.fastCandidatesPerSlot).toBeGreaterThan(4);
    expect(profile.targetBands[0]).toMatchObject({ slots: 8 });
  });

  it("allows interior points for bagua searches", () => {
    const profile = getHoneycombSearchProfile({
      shape: "bagua",
      variantId: "8",
      mode: 8
    });

    expect(profile.ignoreInnerRadius).toBe(true);
    expect(profile.priorityRings).toBe(3);
    expect(profile.targetBands.some((band) => band.id === "inner-gates")).toBe(
      true
    );
    expect(
      profile.targetBands.some((band) => band.id === "center-cardinals")
    ).toBe(true);
  });

  it("scales rose and Sierpinski profiles from their numeric variants", () => {
    const rose = getHoneycombSearchProfile({
      shape: "rose",
      variantId: "k-9",
      mode: 5
    });
    const sierpinski = getHoneycombSearchProfile({
      shape: "sierpinski",
      variantId: "d-4",
      mode: 5
    });

    expect(rose.ignoreInnerRadius).toBe(true);
    expect(rose.priorityRings).toBe(4);
    expect(rose.targetBands.every((band) => band.slots === 9)).toBe(true);
    expect(sierpinski.ignoreInnerRadius).toBe(true);
    expect(sierpinski.priorityRings).toBe(4);
    expect(
      sierpinski.targetBands.some((band) => band.id === "inner-triangles")
    ).toBe(true);
  });

  it("anchors new magic profiles to explicit feature target nodes", () => {
    const rose = getHoneycombSearchProfile({
      shape: "rose",
      variantId: "k-4",
      mode: 5
    });
    const sierpinski = getHoneycombSearchProfile({
      shape: "sierpinski",
      variantId: "d-4",
      mode: 5
    });
    const zodiac = getHoneycombSearchProfile({
      shape: "zodiac",
      variantId: "2",
      mode: 5
    });

    expect(rose.targetNodes).toHaveLength(8);
    expect(rose.targetNodes.map((node) => node.bearingDeg)).toContain(45);
    expect(rose.rotationSpanDeg).toBe(45);
    expect(rose.targetNodes.every((node) => node.radiusScale === 0.56)).toBe(
      true
    );

    expect(sierpinski.targetNodes).toHaveLength(15);
    expect(sierpinski.rotationSpanDeg).toBe(120);
    expect(
      sierpinski.targetNodes.some((node) => node.radiusScale > 0.8)
    ).toBe(true);

    expect(zodiac.targetNodes).toHaveLength(
      ZODIAC_CONSTELLATIONS[1].points.length
    );
    expect(zodiac.targetNodes[0].id).toBe("zodiac-taurus-1");
    expect(zodiac.initialCellCount).toBe(zodiac.targetNodes.length);
    expect(zodiac.targetBands).toEqual([]);
    expect(zodiac.rotationSpanDeg).toBe(360);
    expect(new Set(zodiac.targetNodes.map((node) => node.radiusScale)).size).toBeGreaterThan(
      1
    );
  });
});
