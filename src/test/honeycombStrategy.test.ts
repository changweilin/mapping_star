import { describe, expect, it } from "vitest";
import { getHoneycombSearchProfile } from "../lib/honeycombStrategy";

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
});
