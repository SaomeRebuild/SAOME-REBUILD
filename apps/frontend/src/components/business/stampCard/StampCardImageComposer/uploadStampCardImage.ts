/**
 * `uploadStampCardImage` — frontend service for `PUT /api/templates/:id/stamp-images/:fillCount`.
 *
 * Encapsulates the base64 encoding, the auth header, and the response
 * validation. The CardBuilder Step 3 trigger and the future Scanner both
 * call this single function; any error mapping (e.g. SaomeError
 * classification) belongs in the composer's hook layer, not here.
 *
 * 2026-10-13 — Created with the stamp card image composition plan.
 * Sibling of `tableCardExportService.uploadToR2` (same pattern).
 */

import type {
  UploadStampCardImageRequest,
  UploadStampCardImageResponse,
} from '@saome/shared/schemas/stampCard';
import { uploadStampCardImageRequestSchema } from '@saome/shared/schemas/stampCard';

/** Endpoint base; override via `VITE_API_BASE_URL` in dev. */
function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '';
}

export class UploadStampCardImageError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'UploadStampCardImageError';
  }
}

/**
 * Convert a Blob to a base64 string (without the `data:...;base64,` prefix).
 * Uses FileReader for browser compatibility (large blobs).
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader did not return a string'));
        return;
      }
      // Strip the `data:image/png;base64,` prefix if present.
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload a rendered stamp card image to the backend.
 *
 * The backend decodes the base64, validates the PNG magic, and writes
 * the bytes to R2 at `tenants/{tenantId}/templates/{templateId}/stamp-{fillCount}.png`.
 *
 * @param templateId The template UUID.
 * @param fillCount  Number of stamped cells in the image. Must be in
 *                   `[0, STAMP_FILL_CAP]`; the request schema rejects out-of-range.
 * @param blob       The PNG blob produced by `composeStampCardImage`.
 * @param authToken  The current auth token (Bearer). Required.
 * @returns The upload response (R2 key, byte hash, byte length).
 * @throws `UploadStampCardImageError` on non-2xx, network failure, or
 *         schema mismatch.
 */
export async function uploadStampCardImage(
  templateId: string,
  fillCount: number,
  blob: Blob,
  authToken: string,
): Promise<UploadStampCardImageResponse> {
  const imageBase64 = await blobToBase64(blob);
  const body: UploadStampCardImageRequest = uploadStampCardImageRequestSchema.parse({
    fillCount,
    imageBase64,
  });

  const url = `${apiBaseUrl()}/api/templates/${encodeURIComponent(templateId)}/stamp-images/${fillCount}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let details: unknown = undefined;
    try {
      details = await response.json();
    } catch {
      // ignore — non-JSON error response
    }
    throw new UploadStampCardImageError(
      `[uploadStampCardImage] HTTP ${response.status} ${response.statusText}`,
      response.status,
      details,
    );
  }

  const json = (await response.json()) as UploadStampCardImageResponse;
  if (!json.r2Key || !json.byteHash) {
    throw new UploadStampCardImageError(
      '[uploadStampCardImage] response missing r2Key or byteHash',
      response.status,
      json,
    );
  }
  return json;
}
