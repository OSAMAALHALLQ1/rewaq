/**
 * ZATCA E-Invoicing Phase 1 Compliance
 * Generates Base64 encoded TLV (Tag-Length-Value) QR code payload for simplified tax invoices.
 */

export function generateZatcaTlv(
  sellerName: string,
  vatNumber: string,
  timestamp: string,
  invoiceTotal: string,
  vatTotal: string
): string {
  const encoder = new TextEncoder();

  const getTlvRow = (tag: number, value: string): Uint8Array => {
    const valBytes = encoder.encode(value);
    const row = new Uint8Array(2 + valBytes.length);
    row[0] = tag;
    row[1] = valBytes.length;
    row.set(valBytes, 2);
    return row;
  };

  const tag1 = getTlvRow(1, sellerName);
  const tag2 = getTlvRow(2, vatNumber);
  const tag3 = getTlvRow(3, timestamp);
  const tag4 = getTlvRow(4, invoiceTotal);
  const tag5 = getTlvRow(5, vatTotal);

  const totalLength = tag1.length + tag2.length + tag3.length + tag4.length + tag5.length;
  const tlvBytes = new Uint8Array(totalLength);

  let offset = 0;
  for (const tagBytes of [tag1, tag2, tag3, tag4, tag5]) {
    tlvBytes.set(tagBytes, offset);
    offset += tagBytes.length;
  }

  return uint8ArrayToBase64(tlvBytes);
}

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  // btoa is globally available in modern browsers and Node.js environment
  return btoa(binary);
}
