// Optimuse export artwork.
// Transparent margins cropped, resized proportionally to 96 px and embedded for offline export.
export const EXPORT_BRAND = {
  brandName: 'Optimuse',
  // QR generated from downloadUrl with toqr 0.1.1: EC M, 4-module quiet zone, 8 px/module.
  // Regenerate the embedded PNG whenever the URL changes; exports work offline.
  downloadUrl: 'https://github.com/artishade/Assistant',
  qrCodeDataUrl: '',
  logoDataUrl: '',
} as const;
