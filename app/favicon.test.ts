import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { expect, it } from "vitest";

it("uses correctly sized Marketing Hub artwork in every ICO entry", async () => {
  const icon = readFileSync(resolve("app/favicon.ico"));
  expect(icon.readUInt16LE(0)).toBe(0);
  expect(icon.readUInt16LE(2)).toBe(1);
  expect(icon.readUInt16LE(4)).toBe(2);

  for (const [index, size] of [16, 32].entries()) {
    const entry = 6 + index * 16;
    expect(icon[entry]).toBe(size);
    expect(icon[entry + 1]).toBe(size);
    const length = icon.readUInt32LE(entry + 8);
    const offset = icon.readUInt32LE(entry + 12);
    const image = icon.subarray(offset, offset + length);
    const metadata = await sharp(image).metadata();
    expect(metadata.width).toBe(size);
    expect(metadata.height).toBe(size);
    const artwork = await sharp(resolve(`public/favicon-${size}.png`))
      .resize(size, size)
      .ensureAlpha()
      .raw()
      .toBuffer();
    const pixels = await sharp(image).ensureAlpha().raw().toBuffer();
    expect(pixels.equals(artwork)).toBe(true);
  }
});
