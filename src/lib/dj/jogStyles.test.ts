import { describe, expect, it } from "vitest";
import { JOG_STYLES, normalizeJogStyle } from "@/hooks/useDjSettings";

describe("requested platter selection", () => {
  it("offers only the retained styles without djay vinyl", () => {
    expect(JOG_STYLES.map(style => style.key)).toEqual(["silver", "neonDisc3d", "pioneer3d", "combatLight", "combatDark", "extended"]);
  });
  it("replaces withdrawn styles with silver", () => {
    expect(normalizeJogStyle("vinyl")).toBe("silver");
    expect(normalizeJogStyle("army")).toBe("silver");
    expect(normalizeJogStyle("combatLight")).toBe("combatLight");
  });
});