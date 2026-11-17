const sharp = require('sharp');
// Always retain the oriented original as an OCR candidate. Enhancements are
// alternatives, never destructive replacements of previously readable text.
exports.orient = async buffer => sharp(buffer, { limitInputPixels: 20000000, failOn: 'error' }).rotate().png().toBuffer();
exports.enhance = async buffer => {
  const image = sharp(buffer, { limitInputPixels: 20000000 });
  const metadata = await image.metadata();
  return image.resize({ width: Math.min(2200, Math.max(metadata.width, Math.min(1600, metadata.width * 2))), height: 3200, withoutEnlargement: false, fit: 'inside' })
    .grayscale().normalise({ lower: 1, upper: 99 }).median(3).sharpen({ sigma: .7 }).png().toBuffer();
};
exports.rotate = (buffer, angle) => sharp(buffer, { limitInputPixels: 20000000 }).rotate(angle).png().toBuffer();
