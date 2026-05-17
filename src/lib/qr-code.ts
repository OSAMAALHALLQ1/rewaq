const VERSION = 4;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;

type Cell = boolean | null;

const ALIGNMENT_CENTER = 26;

export function createQrSvg(text: string, options: { size?: number; margin?: number } = {}) {
  const modules = createQrModules(text);
  const pixelSize = options.size ?? 176;
  const margin = options.margin ?? 4;
  const viewSize = SIZE + margin * 2;
  const cells: string[] = [];

  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        cells.push(`<rect x="${x + margin}" y="${y + margin}" width="1" height="1"/>`);
      }
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#0f172a">${cells.join("")}</g></svg>`;
}

export function createQrDataUrl(text: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createQrSvg(text))}`;
}

function createQrModules(text: string) {
  const data = encodeData(text);
  const ecc = reedSolomonCompute(data, ECC_CODEWORDS);
  const codewords = [...data, ...ecc];
  let bestMatrix: boolean[][] | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < 8; mask += 1) {
    const { matrix, reserved } = createBaseMatrix();
    drawCodewords(matrix, reserved, codewords, mask);
    drawFormatBits(matrix, mask);
    const penalty = getPenalty(matrix);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = matrix;
    }
  }

  return bestMatrix ?? createBaseMatrix().matrix;
}

function encodeData(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }

  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < DATA_CODEWORDS) {
    data.push(pads[padIndex % 2]);
    padIndex += 1;
  }

  if (data.length > DATA_CODEWORDS) {
    throw new Error("QR payload is too long for the built-in invoice code.");
  }

  return data;
}

function createBaseMatrix() {
  const matrix: Cell[][] = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
  const reserved: boolean[][] = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => false));

  drawFinder(matrix, reserved, 0, 0);
  drawFinder(matrix, reserved, SIZE - 7, 0);
  drawFinder(matrix, reserved, 0, SIZE - 7);
  drawTiming(matrix, reserved);
  drawAlignment(matrix, reserved, ALIGNMENT_CENTER, ALIGNMENT_CENTER);
  setCell(matrix, reserved, 8, SIZE - 8, true);
  reserveFormatAreas(reserved);

  return {
    matrix: matrix.map((row) => row.map((cell) => Boolean(cell))),
    reserved,
  };
}

function drawFinder(matrix: Cell[][], reserved: boolean[][], x: number, y: number) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      if (!inBounds(xx, yy)) continue;
      const dark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setCell(matrix, reserved, xx, yy, dark);
    }
  }
}

function drawTiming(matrix: Cell[][], reserved: boolean[][]) {
  for (let i = 8; i < SIZE - 8; i += 1) {
    setCell(matrix, reserved, i, 6, i % 2 === 0);
    setCell(matrix, reserved, 6, i, i % 2 === 0);
  }
}

function drawAlignment(matrix: Cell[][], reserved: boolean[][], cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setCell(matrix, reserved, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function reserveFormatAreas(reserved: boolean[][]) {
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][SIZE - 1 - i] = true;
    reserved[SIZE - 1 - i][8] = true;
  }
}

function drawCodewords(matrix: boolean[][], reserved: boolean[][], codewords: number[], mask: number) {
  const bits = codewords.flatMap((codeword) => Array.from({ length: 8 }, (_, i) => (codeword >>> (7 - i)) & 1));
  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let dx = 0; dx < 2; dx += 1) {
        const x = right - dx;
        if (reserved[y][x]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        matrix[y][x] = bit !== getMask(mask, x, y);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function drawFormatBits(matrix: boolean[][], mask: number) {
  const bits = getFormatBits(mask);
  for (let i = 0; i <= 5; i += 1) matrix[8][i] = getBit(bits, i);
  matrix[8][7] = getBit(bits, 6);
  matrix[8][8] = getBit(bits, 7);
  matrix[7][8] = getBit(bits, 8);
  for (let i = 9; i < 15; i += 1) matrix[14 - i][8] = getBit(bits, i);
  for (let i = 0; i < 8; i += 1) matrix[SIZE - 1 - i][8] = getBit(bits, i);
  for (let i = 8; i < 15; i += 1) matrix[8][SIZE - 15 + i] = getBit(bits, i);
}

function getFormatBits(mask: number) {
  const data = (0b01 << 3) | mask;
  let value = data << 10;
  const generator = 0x537;
  for (let i = 14; i >= 10; i -= 1) {
    if (((value >>> i) & 1) !== 0) value ^= generator << (i - 10);
  }
  return ((data << 10) | value) ^ 0x5412;
}

function getBit(value: number, index: number) {
  return ((value >>> index) & 1) !== 0;
}

function getMask(mask: number, x: number, y: number) {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function reedSolomonCompute(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree);
  const result = Array.from({ length: degree }, () => 0);
  data.forEach((byte) => {
    const factor = byte ^ result.shift()!;
    result.push(0);
    generator.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  });
  return result;
}

function reedSolomonGenerator(degree: number) {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = Array.from({ length: result.length + 1 }, () => 0);
    result.forEach((coefficient, index) => {
      next[index] ^= gfMultiply(coefficient, 1);
      next[index + 1] ^= gfMultiply(coefficient, gfPow(2, i));
    });
    result = next;
  }
  return result.slice(1);
}

function gfMultiply(x: number, y: number) {
  let result = 0;
  for (let i = 0; i < 8; i += 1) {
    if ((y & 1) !== 0) result ^= x;
    const carry = (x & 0x80) !== 0;
    x = (x << 1) & 0xff;
    if (carry) x ^= 0x1d;
    y >>>= 1;
  }
  return result;
}

function gfPow(x: number, power: number) {
  let result = 1;
  for (let i = 0; i < power; i += 1) result = gfMultiply(result, x);
  return result;
}

function getPenalty(matrix: boolean[][]) {
  let penalty = 0;
  for (let y = 0; y < SIZE; y += 1) {
    penalty += getRunPenalty(matrix[y]);
  }
  for (let x = 0; x < SIZE; x += 1) {
    penalty += getRunPenalty(matrix.map((row) => row[x]));
  }
  for (let y = 0; y < SIZE - 1; y += 1) {
    for (let x = 0; x < SIZE - 1; x += 1) {
      const color = matrix[y][x];
      if (matrix[y][x + 1] === color && matrix[y + 1][x] === color && matrix[y + 1][x + 1] === color) penalty += 3;
    }
  }
  const dark = matrix.flat().filter(Boolean).length;
  const ratio = Math.abs((dark * 100) / (SIZE * SIZE) - 50);
  return penalty + Math.floor(ratio / 5) * 10;
}

function getRunPenalty(row: boolean[]) {
  let penalty = 0;
  let runColor = row[0];
  let runLength = 1;
  for (let i = 1; i < row.length; i += 1) {
    if (row[i] === runColor) {
      runLength += 1;
    } else {
      if (runLength >= 5) penalty += 3 + (runLength - 5);
      runColor = row[i];
      runLength = 1;
    }
  }
  if (runLength >= 5) penalty += 3 + (runLength - 5);
  return penalty;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function setCell(matrix: Cell[][], reserved: boolean[][], x: number, y: number, dark: boolean) {
  if (!inBounds(x, y)) return;
  matrix[y][x] = dark;
  reserved[y][x] = true;
}

function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
}
