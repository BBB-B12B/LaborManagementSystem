interface WatermarkOptions {
  lat: number;
  lon: number;
  timestamp: Date;
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/**
 * Draws a GPS + timestamp stamp onto a canvas frame, scaled relative to canvas width
 * so it stays legible at any capture resolution. Pure/stateless — no DOM or React dependency.
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: WatermarkOptions
): void {
  const fontSize = Math.max(14, Math.round(width * 0.028));
  const padding = Math.round(fontSize * 0.6);
  const lineHeight = Math.round(fontSize * 1.4);
  const bandHeight = lineHeight * 2 + padding * 2;

  ctx.save();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, height - bandHeight, width, bandHeight);

  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';

  const line1 = formatTimestamp(opts.timestamp);
  const line2 = `${formatCoords(opts.lat, opts.lon)}`;

  ctx.fillText(line1, padding, height - bandHeight + padding);
  ctx.fillText(line2, padding, height - bandHeight + padding + lineHeight);

  ctx.restore();
}
