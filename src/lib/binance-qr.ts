import QRCode from 'qrcode';

/**
 * Genera el código QR oficial de Binance Pay idéntico a las aplicaciones de Binance y pasarelas de apuestas:
 * - Nivel de corrección de error 'H' (High: tolera hasta un 30% de cobertura sin perder legibilidad).
 * - Fondo blanco y módulos de alta definición.
 * - Caja central redondeada con el logo del diamante oficial de Binance (#F0B90B).
 */
export async function generateBinancePayQr(url: string): Promise<string> {
  if (typeof window === 'undefined') return '';

  const canvas = document.createElement('canvas');
  const size = 360;
  canvas.width = size;
  canvas.height = size;

  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: 'H',
    width: size,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  // Tamaño del badge central: ~21.6% del ancho total (dentro del límite de tolerancia H)
  const boxSize = 78;
  const x = (size - boxSize) / 2;
  const y = (size - boxSize) / 2;

  // Fondo blanco con esquinas redondeadas
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, boxSize, boxSize, 12);
  } else {
    ctx.rect(x, y, boxSize, boxSize);
  }
  ctx.fill();

  // Logo diamante oficial de Binance (#F0B90B)
  const logoPath = new Path2D(
    'M16.624 13.92l2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0l2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.717-2.716L11.989.011z'
  );

  ctx.save();
  const targetLogoSize = 54;
  const scale = targetLogoSize / 24;
  const pad = (boxSize - targetLogoSize) / 2;
  ctx.translate(x + pad, y + pad);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#F0B90B';
  ctx.fill(logoPath);
  ctx.restore();

  return canvas.toDataURL('image/png');
}
