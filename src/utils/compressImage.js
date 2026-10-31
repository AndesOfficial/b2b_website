const MAX_PX = 800;
const JPEG_QUALITY = 0.8;

/**
 * Shrinks an image before upload: longest side at most 800 px, JPEG unless
 * it's a PNG (which may be transparent). Returns the original file when the
 * result isn't smaller or the browser can't process it.
 */
export async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const ext = type === "image/png" ? "png" : "jpg";
    const name = `${file.name.replace(/\.[^.]+$/, "")}.${ext}`;
    return new File([blob], name, { type });
  } catch {
    return file;
  }
}
