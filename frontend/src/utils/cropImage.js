// frontend/src/utils/cropImage.js
// returns a Blob of PNG from image dataUrl and cropped area pixels
export default function getCroppedImg(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    if (!imageSrc || !pixelCrop) return reject(new Error("Missing args"));
    const image = new Image();
    image.setAttribute("crossOrigin", "anonymous");
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Canvas is empty"));
        resolve(blob);
      }, "image/png");
    };
    image.onerror = (err) => reject(err);
    image.src = imageSrc;
  });
}
