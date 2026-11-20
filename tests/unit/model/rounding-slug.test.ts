import { roundDeg, roundFraction, roundMm, roundPt } from "../../../src/model/rounding";
import { slugify, uniqueSlug } from "../../../src/model/slug";
import { ID_PATTERN, newId } from "../../../src/model/ids";

describe("Rundung", () => {
  test("mm, 0,1°, 0,1 pt, 0,01", () => {
    expect(roundMm(4259.5)).toBe(4260);
    expect(roundMm(-0.4)).toBe(0);
    expect(Object.is(roundMm(-0.4), -0)).toBe(false);
    expect(roundDeg(1.54)).toBe(1.5);
    expect(roundDeg(-0.04)).toBe(0);
    expect(roundPt(102.43)).toBe(102.4);
    expect(roundFraction(0.505)).toBeCloseTo(0.51, 10);
    expect(roundFraction(0.5)).toBe(0.5);
  });
});

describe("Slug", () => {
  test("Umlaute und Kleinschreibung", () => {
    expect(slugify("Dachgeschoß Süd")).toBe("dachgeschoss-sued");
    expect(slugify("Ö/Ä")).toBe("oe-ae");
  });
  test("Sonderzeichen, mehrere Bindestriche, Rand", () => {
    expect(slugify("  EG (alt) -- 2  ")).toBe("eg-alt-2");
  });
  test("leerer Name", () => {
    expect(slugify("")).toBe("geschoss");
    expect(slugify("!!!")).toBe("geschoss");
  });
  test("Kollision", () => {
    expect(uniqueSlug("EG", new Set(["eg"]))).toBe("eg-2");
    expect(uniqueSlug("EG", new Set(["eg", "eg-2"]))).toBe("eg-3");
    expect(uniqueSlug("OG", new Set(["eg"]))).toBe("og");
  });
});

test("IDs: 8 Zeichen aus [0-9a-z], ohne vorhandene", () => {
  const taken = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const id = newId(taken);
    expect(id).toMatch(ID_PATTERN);
    expect(taken.has(id)).toBe(false);
    taken.add(id);
  }
});
