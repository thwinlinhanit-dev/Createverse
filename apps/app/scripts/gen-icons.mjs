// @ 주석: apps/app/public/icons/에 PWA 아이콘(192, 512, maskable)을 생성한다.
// 아이콘은 앱 정체성을 나타내는 단순 마크(숫자 “1” 뱃지 + 둥근 프레임)로,
// 오프라인에서 빠르게 로드되도록 벡터 느낌의 단색 PNG로 렌더링한다.
// 이미지 라이브러리는 쓰지 않고, Node의 Canvas 없이도 돌아가는 순수 픽셀 라이터로 그린다.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, "..");
const ICON_DIR = join(APP_ROOT, "public", "icons");
mkdirSync(ICON_DIR, { recursive: true });

// PNG 시그니처 + 청크 헬퍼. (순수 JS PNG Writer)
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

// CRC-32 (ISO/ITU) for PNG chunk integrity.
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (0xedb88320 & (-(c & 1)));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(1, 8); // bit depth
  data.writeUInt8(2, 9); // color type: RGB
  data.writeUInt8(0, 10); // compression
  data.writeUInt8(0, 11); // filter
  data.writeUInt8(0, 12); // interlace
  return chunk("IHDR", data);
}

// RGB 팔레트 + 디더링 없는 안티앨리어싱 없이 그리는 단순 비트맵 라이터.
// 그림: 둥근 사각형 프레임(앱 브랜드 색 프레임) + 중앙의 큰 “1” 글자 뱃지.
// 색은 토큰 기반 브랜드 색을 하드코딩하지 않고, PWA 실루엣용으로 차분한 청록 계열을 쓴다.
// (아이콘 자체 색은 여기서 고정해도 무방 — manifest 아이콘은 masked로 활용하고, 앱 내 색은 토큰로만 쓴다.)

const FRAME_RGB = [15, 118, 110]; // #0F766E 토큰 primary와 동일한 값(시각 정체성용)
const FILL_RGB = [255, 255, 255];

function fillPixel(row, x, y, w, h, buf) {
  // rgba 순서로 저장 (8bit)
  const idx = (y * w + x) * 4;
  buf[idx] = row[0];
  buf[idx + 1] = row[1];
  buf[idx + 2] = row[2];
  buf[idx + 3] = 255;
}

function roundRect(buf, w, h, r, color) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      if (dx >= r && dy >= r) {
        fillPixel(color, x, y, w, h, buf);
      } else {
        // 모서리는 안쪽 원 안에 있을 때만 채움
        if (dx * dx + dy * dy <= r * r) {
          fillPixel(color, x, y, w, h, buf);
        }
      }
    }
  }
}

function drawNumber(buf, w, h, color, numChar, scale) {
  // 굵은 산세리프 느낌의 “1” 픽셀 폰트 (단순 5x7 그리드 확대).
  // 여기서는 직관적으로 세로 막대 + 상단/하단 가로 막대 + 세리프를 그린다.
  const cx = Math.floor(w / 2);
  const top = Math.floor(h * 0.18);
  const bottom = Math.floor(h * 0.82);

  const thickness = Math.max(3, Math.round(w * 0.09 * scale));
  const cap = Math.max(thickness, Math.round(w * 0.12 * scale));

  // 세로 획
  for (let y = top; y < bottom; y++) {
    for (let x = cx - cap; x <= cx + cap; x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) fillPixel(color, x, y, w, h, buf);
    }
  }
  // 상단 가로 획
  for (let y = top; y < top + thickness; y++) {
    for (let x = cx - cap - Math.round(w * 0.1 * scale); x <= cx + cap + Math.round(w * 0.1 * scale); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) fillPixel(color, x, y, w, h, buf);
    }
  }
  // 하단 가로 획
  for (let y = bottom - thickness; y <= bottom; y++) {
    for (let x = cx - cap - Math.round(w * 0.1 * scale); x <= cx + cap + Math.round(w * 0.1 * scale); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) fillPixel(color, x, y, w, h, buf);
    }
  }
}

function makeIcon(width, height, opts = {}) {
  const buf = Buffer.alloc(width * height * 4);
  const bg = opts.bg ?? [255, 255, 255];

  // 배경 채우기
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      fillPixel(bg, x, y, width, height, buf);
    }
  }

  // 프레임(둥근 사각형)
  const framePad = Math.max(4, Math.round(Math.min(width, height) * 0.06));
  roundRect(buf, width, height, height / 2 - framePad, FRAME_RGB);

  // 배경 다시 칠해 프레임을 남김 — 프레임 내부는 흰색
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      if (dx * dx + dy * dy <= (height / 2 - framePad) * (height / 2 - framePad)) {
        fillPixel(bg, x, y, width, height, buf);
      }
    }
  }

  // 안쪽 원(앱 마크) — 약간 작은 원
  const innerR = Math.floor(Math.min(width, height) * 0.16);
  const innerX = width / 2;
  const innerY = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ddx = x - innerX;
      const ddy = y - innerY;
      if (ddx * ddx + ddy * ddy <= (innerR) * (innerR)) {
        fillPixel(FRAME_RGB, x, y, width, height, buf);
      }
    }
  }

  // 중앙에 “1” 뱃지
  drawNumber(buf, width, height, FILL_RGB, "1", 1);

  return buf;
}

function bufToPng(width, height, rgbBuf) {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    raw.writeUInt8(0, y * (width * 3) * 1); // filter none per row 시작 — 올바르게 처리
  }
  // 필터 바이트 포함 raw 스트림 재구성
  const rawWithFilters = Buffer.alloc(width * height * 3 + height);
  for (let y = 0; y < height; y++) {
    rawWithFilters.writeUInt8(0, y * (width * 3 + 1)); // filter byte
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (width * 3 + 1) + 1 + x * 3;
      rawWithFilters.writeUInt8(rgbBuf[src], dst);
      rawWithFilters.writeUInt8(rgbBuf[src + 1], dst + 1);
      rawWithFilters.writeUInt8(rgbBuf[src + 2], dst + 2);
    }
  }

  const deflated = deflateSync(rawWithFilters);
  const idat = chunk("IDAT", deflated);
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([PNG_SIGNATURE, ihdr(width, height), idat, iend]);
}

// 최소한의 zlib inflate/deflate 대신, Node의 zlib을 사용하지 않고 순수하게 구현할 수 없으므로
// Node 내장 zlib을 사용한다. (Node 스크립트는 허용되며, 이미지 라이브러리 의존은 없다.)
import { deflateSync } from "node:zlib";

const SIZES = [
  { name: "icon-192.png", width: 192, height: 192 },
  { name: "icon-512.png", width: 512, height: 512 },
  // maskable: 안전 영역을 위해 여유 있는 큰 아이콘
  { name: "icon-512-maskable.png", width: 512, height: 512, bg: [245, 239, 228] },
];

for (const { name, width, height, bg } of SIZES) {
  const rgb = makeIcon(width, height, { bg });
  const png = bufToPng(width, height, rgb);
  const outPath = join(ICON_DIR, name);
  writeFileSync(outPath, png);
  console.info(`icon written: ${outPath}`);
}

console.info(`icons written: ${ICON_DIR}`);
