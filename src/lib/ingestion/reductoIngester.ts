/**
 * Orchestrates document parsing through the Reducto API route proxy.
 *
 * Reads the binary file from IndexedDB, sends it to our API route
 * (which forwards to Reducto), and updates the document with the
 * parsed markdown content.
 */

import { getApiKey } from "@/lib/settings";
import { getBinaryAsset, updateDocument } from "@/lib/db/operations";
import { isApiError } from "@/types/api";

export async function processWithReducto(
  documentId: string,
  binaryAssetId: string
): Promise<void> {
  const apiKey = getApiKey("reducto");
  if (!apiKey) {
    await updateDocument(documentId, {
      status: "error",
      errorMessage: "Reducto API key not configured. Add it in Settings.",
    });
    return;
  }

  const asset = await getBinaryAsset(binaryAssetId);
  if (!asset) {
    await updateDocument(documentId, {
      status: "error",
      errorMessage: "Binary file not found in local storage.",
    });
    return;
  }

  await updateDocument(documentId, { status: "processing" });

  try {
    // Convert blob to base64 for the API route
    const buffer = await asset.blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    // Use OCR mode for images and scanned PDFs (field notes, handwritten docs)
    const isImageOrScan = asset.mimeType.startsWith("image/") || asset.mimeType === "application/pdf";

    const response = await fetch("/api/reducto/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Reducto-Key": apiKey,
      },
      body: JSON.stringify({
        fileBase64: base64,
        fileName: `document.${asset.mimeType.split("/")[1] ?? "pdf"}`,
        mimeType: asset.mimeType,
        extractionMode: isImageOrScan ? "ocr" : "hybrid",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const message =
        errorData && isApiError(errorData)
          ? errorData.error
          : `Reducto processing failed (${response.status})`;

      await updateDocument(documentId, {
        status: "error",
        errorMessage: message,
      });
      return;
    }

    const result = await response.json();

    await updateDocument(documentId, {
      status: "ready",
      content: result.markdown,
      errorMessage: null,
    });
  } catch (err) {
    await updateDocument(documentId, {
      status: "error",
      errorMessage:
        err instanceof Error ? err.message : "Processing failed unexpectedly",
    });
  }
}
