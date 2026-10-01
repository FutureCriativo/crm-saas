// Prepara a logo: só PNG/JPEG/WebP (SVG fica de fora de propósito, pode carregar script), reduzida para caber no banco
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use uma imagem PNG, JPG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Imagem muito grande (máximo 5 MB).');
  const bitmap = await createImageBitmap(file);
  const max = 256;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  let url = canvas.toDataURL('image/png');
  if (url.length > 280000) url = canvas.toDataURL('image/jpeg', 0.85);
  if (url.length > 280000) throw new Error('Imagem ainda muito pesada. Tente uma logo mais simples.');
  return url;
}
