const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function processLogo() {
  const src = 'C:/Users/Equipo/.gemini/antigravity/brain/18af6208-e6b9-4f04-9384-089f69958d7b/.user_uploaded/media_1790195922641.jpg';
  
  const meta = await sharp(src).metadata();
  const w = meta.width; // 968
  const h = meta.height; // 944
  
  // Center is approx (480, 468), radius is approx 460
  // Let's create an exact circular mask of 512x512
  const targetSize = 512;
  const radius = 248; // Leaves a tiny 8px padding
  const center = 256;

  const circleSvg = `<svg width="${targetSize}" height="${targetSize}">
    <circle cx="${center}" cy="${center}" r="${radius}" fill="#ffffff" />
  </svg>`;

  const resized = await sharp(src)
    .resize(targetSize, targetSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  const mask = await sharp(Buffer.from(circleSvg))
    .png()
    .toBuffer();

  const result = await sharp(resized)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ quality: 100 })
    .toBuffer();

  // Save to public/club5logo.png and public/club5logo-transparent.png
  fs.writeFileSync('public/club5logo.png', result);
  fs.writeFileSync('public/club5logo-transparent.png', result);
  console.log('Logo successfully masked with clean circular alpha channel!');
}

processLogo().catch(console.error);
