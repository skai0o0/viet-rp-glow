import imageCompression from "browser-image-compression";

/**
 * Compress and convert an image to WebP format.
 * Target: ≤200KB, max 512px, output as WebP.
 */
export async function compressAvatar(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 512,
    useWebWorker: true,
    fileType: "image/webp" as const,
  };

  const compressed = await imageCompression(file, options);
  // Ensure the file has a .webp extension
  const webpFile = new File([compressed], file.name.replace(/\.\w+$/, ".webp"), {
    type: "image/webp",
  });
  return webpFile;
}
