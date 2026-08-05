import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_EVIDENCE_IMAGE_BYTES,
  validateEvidenceImageDataUrl
} from "../src/media/imageValidation";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Av7czgAAAABJRU5ErkJggg==",
  "base64"
);

test("evidence image validation checks decoded type and dimensions", () => {
  const result = validateEvidenceImageDataUrl(`data:image/png;base64,${onePixelPng.toString("base64")}`);
  assert.equal(result.contentType, "image/png");
  assert.equal(result.width, 1);
  assert.equal(result.height, 1);
  assert.deepEqual(result.bytes, onePixelPng);
});

test("evidence image validation rejects fake or type-mismatched payloads", () => {
  assert.throws(
    () => validateEvidenceImageDataUrl("data:image/jpeg;base64,bm90LWFuLWltYWdl"),
    /valid image matching its declared type/
  );
  assert.throws(
    () => validateEvidenceImageDataUrl(`data:image/jpeg;base64,${onePixelPng.toString("base64")}`),
    /valid image matching its declared type/
  );
});

test("evidence image validation enforces the decoded byte limit", () => {
  const oversized = Buffer.concat([
    onePixelPng,
    Buffer.alloc(MAX_EVIDENCE_IMAGE_BYTES - onePixelPng.length + 1)
  ]);
  assert.throws(
    () => validateEvidenceImageDataUrl(`data:image/png;base64,${oversized.toString("base64")}`),
    /bytes or fewer/
  );
});
