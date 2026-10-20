import jsQR from "jsqr";

export function decodeQrFrame(imageData: Uint8ClampedArray, width: number, height: number): string | undefined {
  return jsQR(imageData, width, height, { inversionAttempts: "attemptBoth" })?.data;
}
