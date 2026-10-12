import { describe, expect, it } from "vitest";
import {
  ARDUINO_FIT_HALF_HEIGHT,
  ARDUINO_FIT_HALF_WIDTH,
  ARDUINO_FOV,
  arduinoCameraDistance,
  arduinoPixelsPerWorldUnit,
} from "../arduino-model";

const tanHalfFov = Math.tan((ARDUINO_FOV * Math.PI) / 360);

describe("arduinoCameraDistance", () => {
  it("keeps on-screen scale when the hero frame gets taller (width-bound)", () => {
    // Typical desktop hero: 7/12 of a 90rem column is well under the
    // aspect where the height floor takes over (64/35 ≈ 1.83).
    const width = 826;
    const short = arduinoPixelsPerWorldUnit(width, 656);
    const tall = arduinoPixelsPerWorldUnit(width, 752);
    expect(short).toBeCloseTo(width / (2 * ARDUINO_FIT_HALF_WIDTH), 8);
    expect(tall).toBeCloseTo(short, 8);
  });

  it("does not shrink the model when only height increases", () => {
    const width = 400;
    const before = arduinoPixelsPerWorldUnit(width, 400);
    const after = arduinoPixelsPerWorldUnit(width, 520);
    expect(after).toBeCloseTo(before, 8);
  });

  it("uses the height floor on a very wide, short canvas", () => {
    const width = 1600;
    const height = 400;
    const distance = arduinoCameraDistance(width, height);
    expect(distance).toBeCloseTo(ARDUINO_FIT_HALF_HEIGHT / tanHalfFov, 8);
  });
});
