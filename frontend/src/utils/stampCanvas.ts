/**
 * HTML Canvas로 빨간색 원형 도장 이미지를 생성해 data URL로 반환
 */
const STAMP_COLOR = '#c41e3a';
const STAMP_BG = 'rgba(196, 30, 58, 0.08)';

export function createStampDataUrl(name: string, size: number = 120): string {
  if (!name.trim()) return '';

  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const scale = dpr;
  ctx.scale(scale, scale);

  const center = size / 2;
  const radius = center - 6;

  ctx.fillStyle = STAMP_BG;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = STAMP_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center, center, radius - 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = STAMP_COLOR;
  ctx.font = `bold ${name.length <= 3 ? 28 : name.length <= 5 ? 22 : 18}px "Malgun Gothic", "Apple SD Gothic Neo", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.trim(), center, center);

  return canvas.toDataURL('image/png');
}
