// Makes the app icons for Lifeline and TechDeck OS from one design ("dark with green glow"), so the pair stays matched.
// Run from the repo root:
//   npm i --no-save @resvg/resvg-js@2.6.2
//   node docs/app-icon/make-icons.mjs "C:\path\to\TechDeck-OS"     (leave the path off to skip the iPad app)
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const lifeline = path.resolve(here, '../..');
const techdeckOs = process.argv[2];

const DEFS = `
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#a6e36c"/><stop offset=".55" stop-color="#73bf43"/><stop offset="1" stop-color="#3f7322"/>
  </linearGradient>
  <radialGradient id="bg" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="#25331d"/><stop offset="1" stop-color="#0c110a"/></radialGradient>`;

// The symbols, centered in a 100x100 tile. mono = one-color version for Android's themed icons (white = shown).
const RECEIPT_LINES = '<rect x="17" y="28" width="17" height="4" rx="2"/><rect x="17" y="36" width="17" height="4" rx="2"/><rect x="17" y="44" width="11" height="4" rx="2"/>';
const HANDSET = 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z';

const glyphs = {
  // register: receipt coming out the back, screen on a stand, base
  techdeck: mono => `<g transform="translate(7.86 6.57) scale(.86)">
    ${mono ? `<mask id="m" maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200"><rect x="-50" y="-50" width="200" height="200" fill="#fff"/><g fill="#000">${RECEIPT_LINES}</g></mask>` : ''}
    <g ${mono ? 'mask="url(#m)" fill="#fff"' : ''}>
      <path d="M12 22 l4.5 -5 l4.5 5 l4.5 -5 l4.5 5 l4.5 -5 l4.5 5 V62 H12 Z" ${mono ? '' : 'fill="#fff"'}/>
      ${mono ? '' : `<g fill="#4d812c">${RECEIPT_LINES}</g>`}
      <rect x="58" y="48" width="12" height="12" ${mono ? '' : 'fill="#4d812c"'}/>
      <rect x="10" y="58" width="78" height="26" rx="10" ${mono ? '' : 'fill="url(#g)"'}/>
      <rect x="42" y="18" width="44" height="32" rx="9" ${mono ? '' : 'fill="url(#g)"'}/>
    </g></g>`,
  // phone handset with call waves
  lifeline: mono => `<g transform="translate(5.76 12.24) scale(.82)">
    <path transform="translate(15.2 15.2) scale(2.9)" d="${HANDSET}" fill="${mono ? '#fff' : 'url(#g)'}"/>
    <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round">
      <path d="M55.8 32.6 A11.6 11.6 0 0 1 67.4 44.2"/><path d="M55.8 19 A25.2 25.2 0 0 1 81 44.2"/>
    </g></g>`,
};

const svg = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><defs>${DEFS}</defs>${body}</svg>`;
const tile = app => `<rect width="100" height="100" fill="url(#bg)"/>${glyphs[app](false)}`;
const art = {
  square: app => svg('0 0 100 100', tile(app)), // iOS: full square, the system rounds the corners
  rounded: app => svg('-4 -4 108 108', `<clipPath id="c"><rect width="100" height="100" rx="20"/></clipPath><g clip-path="url(#c)">${tile(app)}</g>`),
  circle: app => svg('-2 -2 104 104', `<clipPath id="c"><circle cx="50" cy="50" r="50"/></clipPath><g clip-path="url(#c)">${tile(app)}</g>`),
  // Android adaptive layers: 108dp canvas, of which the middle 72dp shows (tile = 72dp, so the symbol sits in the safe zone)
  background: () => svg('0 0 108 108', '<rect width="108" height="108" fill="url(#bg)"/>'),
  foreground: app => svg('0 0 108 108', `<g transform="translate(18 18) scale(.72)">${glyphs[app](false)}</g>`),
  monochrome: app => svg('0 0 108 108', `<g transform="translate(18 18) scale(.72)">${glyphs[app](true)}</g>`),
};

const render = (svgText, size) => new Resvg(svgText, { fitTo: { mode: 'width', value: size } }).render();
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); console.log(path.relative(process.cwd(), file)); };
const png = (file, svgText, size) => write(file, render(svgText, size).asPng());

// App Store icons must have no transparency: write the opaque square as plain RGB.
function opaquePng(file, svgText, size) {
  const img = render(svgText, size), { width: w, height: h } = img, px = img.pixels;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.copy(raw, y * (w * 3 + 1) + 1 + x * 3, (y * w + x) * 4, (y * w + x) * 4 + 3);
  const chunk = (type, data) => {
    const td = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(4 + td.length + 4);
    out.writeUInt32BE(data.length, 0); td.copy(out, 4); out.writeUInt32BE(zlib.crc32(td), 4 + td.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  write(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// Masters, for looking at and editing
for (const app of ['lifeline', 'techdeck']) write(path.join(here, `${app}.svg`), art.square(app));

// Lifeline, Android
const res = path.join(lifeline, 'android/app/src/main/res');
for (const [dpi, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  const dir = path.join(res, `mipmap-${dpi}`);
  png(path.join(dir, 'ic_launcher.png'), art.rounded('lifeline'), 48 * scale);
  png(path.join(dir, 'ic_launcher_round.png'), art.circle('lifeline'), 48 * scale);
  png(path.join(dir, 'ic_launcher_background.png'), art.background(), 108 * scale);
  png(path.join(dir, 'ic_launcher_foreground.png'), art.foreground('lifeline'), 108 * scale);
  png(path.join(dir, 'ic_launcher_monochrome.png'), art.monochrome('lifeline'), 108 * scale);
}
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@mipmap/ic_launcher_background"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
write(path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
write(path.join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);

// Lifeline, iPhone (one 1024 icon; Xcode makes the other sizes)
const iosIcons = path.join(lifeline, 'ios/TechResQPhone/Images.xcassets/AppIcon.appiconset');
opaquePng(path.join(iosIcons, 'AppIcon-1024.png'), art.square('lifeline'), 1024);
write(path.join(iosIcons, 'Contents.json'), JSON.stringify({
  images: [{ filename: 'AppIcon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
  info: { author: 'xcode', version: 1 },
}, null, 2) + '\n');

// TechDeck OS, iPad
if (techdeckOs) opaquePng(path.join(techdeckOs, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), art.square('techdeck'), 1024);
