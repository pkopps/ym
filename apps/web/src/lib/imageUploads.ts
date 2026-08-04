const MAX_IMAGE_EDGE_PX = 1600;
const MAX_DATA_URL_LENGTH = 1_900_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.addEventListener("load", () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read that image."));
    });
    image.src = objectUrl;
  });
}

export async function readEvidenceImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a photo file to continue.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE_PX / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare that image for upload.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return dataUrl;
    }
  }

  throw new Error("That photo is still too large. Try a closer crop.");
}
