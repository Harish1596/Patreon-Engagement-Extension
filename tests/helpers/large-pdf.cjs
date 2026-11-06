// Deterministic synthetic image data; no private collection content is used.
function largePdfFixture() {
  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(400, 240), context = canvas.getContext('2d');
  const image = context.createImageData(400, 240); let seed = 123456789;
  for (let n = 0; n < image.data.length; n += 4) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    image.data[n] = seed & 255; image.data[n + 1] = (seed >>> 8) & 255;
    image.data[n + 2] = (seed >>> 16) & 255; image.data[n + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  const chapters = Array.from({ length: 75 }, (_, n) => ({ version: 1, title: `Chapter ${n + 1}`,
    author: 'Fixture Creator', language: 'en', downloadedAt: 'Today',
    sourceUrl: `https://www.patreon.com/posts/${101 + n}`, assets: [{ dataUrl }],
    body: { tag: 'div', children: [{ tag: 'p', children: [`Body ${n + 1}${n === 37 ? ' Ḫ 𒀭 天' : ''}`] }, { tag: 'img', image: 0 }] }
  }));
  const book = { title: 'Larger collection', source: 'https://www.patreon.com/collection/500', downloadedAt: 'Today' };
  return { chapters, book };
}
module.exports = { largePdfFixture };
