#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const backupPath = process.argv[2] || "test-fixtures/studio-log-backup-2026-05-07.json";
const projectQuery = (process.argv[3] || "Sky arts cheeks").toLowerCase();
const outDir = process.argv[4] || "alignment-debug";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampDecimal(value, min, max) {
  return Math.min(max, Math.max(min, Number(value.toFixed(3))));
}

function grayAt(data, width, x, y) {
  const index = (y * width + x) * 4;
  return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Expected a base64 data URL image.");
  return Buffer.from(match[2], "base64");
}

async function loadImage(dataUrl, maxSide = 220) {
  const normalized = await sharp(dataUrlToBuffer(dataUrl), { limitInputPixels: false }).rotate().toBuffer();
  const source = sharp(normalized, { limitInputPixels: false });
  const metadata = await source.metadata();
  const scale = Math.min(1, maxSide / Math.max(metadata.width, metadata.height));
  const width = Math.max(1, Math.round(metadata.width * scale));
  const height = Math.max(1, Math.round(metadata.height * scale));
  const raw = await source.resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  return { raw, width, height, scale, naturalWidth: metadata.width, naturalHeight: metadata.height };
}

function traceMaskFromRaw(image, threshold) {
  const { raw, width, height, scale } = image;
  const edgeSamples = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = grayAt(raw, width, x, y);
      const right = grayAt(raw, width, x + 1, y);
      const down = grayAt(raw, width, x, y + 1);
      const diag = grayAt(raw, width, x + 1, y + 1);
      const edge = Math.abs(center - right) + Math.abs(center - down) + Math.abs(center - diag) * 0.5;
      edgeSamples.push({ x, y, edge });
    }
  }
  const resolvedThreshold = Number.isFinite(Number(threshold)) ? Number(threshold) : adaptiveEdgeThreshold(edgeSamples);
  const points = edgeSamples.filter((sample) => sample.edge > resolvedThreshold).map((sample) => ({ x: sample.x, y: sample.y }));
  const filteredPoints = filterSubjectPoints(points, width, height);
  const bounds = pointBounds(filteredPoints);
  return {
    width,
    height,
    scale,
    points: filteredPoints,
    threshold: resolvedThreshold,
    rawPoints: points.length,
    set: pointSet(filteredPoints),
    distance: distanceField(filteredPoints, width, height),
    bounds,
    anchor: { x: bounds.cx, y: bounds.cy },
  };
}

function adaptiveEdgeThreshold(edgeSamples) {
  if (!edgeSamples.length) return 38;
  const edges = edgeSamples.map((sample) => sample.edge).sort((a, b) => a - b);
  const index = clamp(Math.floor(edges.length * 0.82), 0, edges.length - 1);
  return Math.max(18, Math.min(90, edges[index]));
}

function pointSet(points) {
  const set = new Set();
  points.forEach((point) => set.add(`${Math.round(point.x)},${Math.round(point.y)}`));
  return set;
}

function filterSubjectPoints(points, width, height) {
  const densityFiltered = removeDenseAxisArtifacts(points, width, height);
  const components = pointComponents(densityFiltered, width, height);
  const kept = [];
  components.forEach((component) => {
    const bounds = pointBounds(component);
    const relWidth = bounds.width / width;
    const relHeight = bounds.height / height;
    const centerX = bounds.cx / width;
    const centerY = bounds.cy / height;
    const lineLike = (relWidth > 0.58 && relHeight < 0.1) || (relHeight > 0.58 && relWidth < 0.1);
    const borderLike = lineLike && (centerY < 0.18 || centerY > 0.74 || centerX < 0.16 || centerX > 0.84);
    const lowerTextLike = relWidth > 0.32 && relHeight < 0.18 && centerY > 0.66;
    const tinyEdgeNoise = component.length < 5;
    if (borderLike || lowerTextLike || tinyEdgeNoise) return;
    kept.push(...component);
  });
  return kept.length >= 24 ? kept : densityFiltered;
}

function removeDenseAxisArtifacts(points, width, height) {
  const rowCounts = new Map();
  const colCounts = new Map();
  points.forEach((point) => {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    rowCounts.set(y, (rowCounts.get(y) || 0) + 1);
    colCounts.set(x, (colCounts.get(x) || 0) + 1);
  });
  const badRows = new Set();
  const badCols = new Set();
  rowCounts.forEach((count, y) => {
    if (count > width * 0.72) {
      for (let offset = -1; offset <= 1; offset += 1) badRows.add(y + offset);
    }
  });
  colCounts.forEach((count, x) => {
    if (count > height * 0.72) {
      for (let offset = -1; offset <= 1; offset += 1) badCols.add(x + offset);
    }
  });
  const filtered = points.filter((point) => !badRows.has(Math.round(point.y)) && !badCols.has(Math.round(point.x)));
  return filtered.length >= 24 ? filtered : points;
}

function pointComponents(points, width, height) {
  const set = pointSet(points);
  const seen = new Set();
  const components = [];
  const neighborOffsets = [-1, 0, 1];
  points.forEach((start) => {
    const startKey = `${Math.round(start.x)},${Math.round(start.y)}`;
    if (seen.has(startKey)) return;
    const queue = [start];
    const component = [];
    seen.add(startKey);
    while (queue.length) {
      const point = queue.pop();
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      component.push({ x, y });
      neighborOffsets.forEach((dy) => {
        neighborOffsets.forEach((dx) => {
          if (!dx && !dy) return;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return;
          const key = `${nextX},${nextY}`;
          if (!set.has(key) || seen.has(key)) return;
          seen.add(key);
          queue.push({ x: nextX, y: nextY });
        });
      });
    }
    components.push(component);
  });
  return components;
}

function pointBounds(points) {
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 1, height: 1, cx: 0, cy: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function pointCentroid(points) {
  if (!points.length) return { x: 0, y: 0 };
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function uniqueNumbers(values) {
  const numbers = [];
  values.forEach((value) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    if (!numbers.some((existing) => Math.abs(existing - next) < 0.01)) numbers.push(next);
  });
  return numbers;
}

function distanceField(points, width, height) {
  const maxDistance = 9999;
  const distances = new Uint16Array(width * height);
  distances.fill(maxDistance);
  points.forEach((point) => {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    if (x >= 0 && y >= 0 && x < width && y < height) distances[y * width + x] = 0;
  });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let best = distances[index];
      if (x > 0) best = Math.min(best, distances[index - 1] + 10);
      if (y > 0) best = Math.min(best, distances[index - width] + 10);
      if (x > 0 && y > 0) best = Math.min(best, distances[index - width - 1] + 14);
      if (x < width - 1 && y > 0) best = Math.min(best, distances[index - width + 1] + 14);
      distances[index] = best;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      let best = distances[index];
      if (x < width - 1) best = Math.min(best, distances[index + 1] + 10);
      if (y < height - 1) best = Math.min(best, distances[index + width] + 10);
      if (x < width - 1 && y < height - 1) best = Math.min(best, distances[index + width + 1] + 14);
      if (x > 0 && y < height - 1) best = Math.min(best, distances[index + width - 1] + 14);
      distances[index] = best;
    }
  }
  return distances;
}

function searchTraceAlignment(referenceMask, artworkMask, baseScale, baseCenterX, baseCenterY, rotations, scaleMultipliers, shiftStep, shiftRadius, baseRotate = 0) {
  let best = null;
  rotations.forEach((rotateOffset) => {
    const rotate = baseRotate + rotateOffset;
    scaleMultipliers.forEach((scaleMultiplier) => {
      const scale = baseScale * scaleMultiplier;
      for (let dy = -shiftRadius; dy <= shiftRadius; dy += 1) {
        for (let dx = -shiftRadius; dx <= shiftRadius; dx += 1) {
          const centerX = baseCenterX + dx * shiftStep;
          const centerY = baseCenterY + dy * shiftStep;
          const score = scoreTraceAlignment(referenceMask, artworkMask, scale, centerX, centerY, rotate);
          if (!best || score > best.score) best = { score, scale, centerX, centerY, rotate };
        }
      }
    });
  });
  return best;
}

function scoreTraceAlignment(referenceMask, artworkMask, scale, centerX, centerY, rotate) {
  const radians = (rotate * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const sampleStep = Math.max(1, Math.floor(referenceMask.points.length / 900));
  const sampleCount = Math.ceil(referenceMask.points.length / sampleStep);
  let close = 0;
  let inBounds = 0;
  let distanceTotal = 0;
  let sampleWeightTotal = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < referenceMask.points.length; index += sampleStep) {
    const point = referenceMask.points[index];
    const weight = portraitFeatureWeight(point, referenceMask.bounds);
    sampleWeightTotal += weight;
    const scaledX = (point.x - referenceMask.anchor.x) * scale;
    const scaledY = (point.y - referenceMask.anchor.y) * scale;
    const x = Math.round(centerX + scaledX * cos - scaledY * sin);
    const y = Math.round(centerY + scaledX * sin + scaledY * cos);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (x < 0 || y < 0 || x >= artworkMask.width || y >= artworkMask.height) continue;
    inBounds += weight;
    const distance = artworkMask.distance[y * artworkMask.width + x] / 10;
    distanceTotal += Math.min(distance, 24) * weight;
    if (distance <= 2.2) close += weight;
  }
  if (!inBounds || !sampleWeightTotal || inBounds / sampleWeightTotal < 0.35) return -1000 + inBounds;
  const averageDistance = distanceTotal / inBounds;
  const transformedBounds = {
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
  const artworkBounds = artworkMask.bounds;
  const widthPenalty = Math.abs(Math.log(transformedBounds.width / Math.max(1, artworkBounds.width))) * 28;
  const heightPenalty = Math.abs(Math.log(transformedBounds.height / Math.max(1, artworkBounds.height))) * 28;
  const centerPenalty = (Math.hypot(transformedBounds.cx - artworkBounds.cx, transformedBounds.cy - artworkBounds.cy) / Math.max(artworkMask.width, artworkMask.height)) * 32;
  return (close / inBounds) * 130 + (inBounds / sampleWeightTotal) * 35 - averageDistance * 7 - widthPenalty - heightPenalty - centerPenalty;
}

function portraitFeatureWeight(point, bounds) {
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const xRel = (point.x - bounds.cx) / (width / 2);
  const yRel = (point.y - bounds.minY) / height;
  const absX = Math.abs(xRel);
  let weight = 1;
  if (absX < 0.62 && yRel > 0.18 && yRel < 0.74) weight += 0.9;
  if (absX < 0.42 && yRel > 0.28 && yRel < 0.68) weight += 1.1;
  if (absX < 0.72 && yRel > 0.25 && yRel < 0.48) weight += 0.55;
  if (yRel > 0.78 || absX > 0.9) weight *= 0.65;
  return weight;
}

function align(referenceMask, artworkMask) {
  const referenceBounds = pointBounds(referenceMask.points);
  const artworkBounds = pointBounds(artworkMask.points);
  const artworkCentroid = pointCentroid(artworkMask.points);
  const baseScales = uniqueNumbers([
    1,
    artworkBounds.width / Math.max(1, referenceBounds.width),
    artworkBounds.height / Math.max(1, referenceBounds.height),
    Math.min(artworkBounds.width / Math.max(1, referenceBounds.width), artworkBounds.height / Math.max(1, referenceBounds.height)),
  ]).map((scale) => clampDecimal(scale, 0.35, 2.4));
  const centerSeeds = [
    { x: artworkBounds.cx, y: artworkBounds.cy },
    artworkCentroid,
    { x: artworkMask.width / 2, y: artworkMask.height / 2 },
  ];
  let best = null;
  centerSeeds.forEach((center) => {
    baseScales.forEach((scale) => {
      const coarse = searchTraceAlignment(referenceMask, artworkMask, scale, center.x, center.y, [-12, -6, 0, 6, 12], [0.86, 0.94, 1, 1.08, 1.2, 1.38], 10, 5);
      if (!best || (coarse && coarse.score > best.score)) best = coarse;
    });
  });
  if (!best) return null;
  best = searchTraceAlignment(referenceMask, artworkMask, best.scale, best.centerX, best.centerY, [-4, 0, 4], [0.96, 1, 1.04, 1.1], 3, 4, best.rotate) || best;
  best = searchTraceAlignment(referenceMask, artworkMask, best.scale, best.centerX, best.centerY, [-1, 0, 1], [0.99, 1, 1.02], 1, 3, best.rotate) || best;
  return best;
}

function drawTrace(mask, color) {
  const out = Buffer.alloc(mask.width * mask.height * 4, 255);
  mask.points.forEach((point) => {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    const index = (y * mask.width + x) * 4;
    out[index] = color[0];
    out[index + 1] = color[1];
    out[index + 2] = color[2];
    out[index + 3] = 255;
  });
  return sharp(out, { raw: { width: mask.width, height: mask.height, channels: 4 } }).png();
}

async function drawComposite(referenceMask, artworkMask, best, file) {
  const out = Buffer.alloc(artworkMask.width * artworkMask.height * 4, 255);
  artworkMask.points.forEach((point) => {
    const index = (Math.round(point.y) * artworkMask.width + Math.round(point.x)) * 4;
    out[index] = 30;
    out[index + 1] = 120;
    out[index + 2] = 255;
    out[index + 3] = 255;
  });
  const radians = (best.rotate * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  referenceMask.points.forEach((point) => {
    const scaledX = (point.x - referenceMask.anchor.x) * best.scale;
    const scaledY = (point.y - referenceMask.anchor.y) * best.scale;
    const x = Math.round(best.centerX + scaledX * cos - scaledY * sin);
    const y = Math.round(best.centerY + scaledX * sin + scaledY * cos);
    if (x < 0 || y < 0 || x >= artworkMask.width || y >= artworkMask.height) return;
    const index = (y * artworkMask.width + x) * 4;
    out[index] = 255;
    out[index + 1] = 40;
    out[index + 2] = 40;
    out[index + 3] = 255;
  });
  await sharp(out, { raw: { width: artworkMask.width, height: artworkMask.height, channels: 4 } }).png().toFile(file);
}

async function main() {
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  const artworks = Array.isArray(backup) ? backup : backup.artworks || [];
  const artwork = artworks.find((item) => String(item.title || "").toLowerCase().includes(projectQuery));
  if (!artwork) throw new Error(`No project matched "${projectQuery}".`);
  const reference = (artwork.images || []).find((image) => image.name === "Reference" && image.dataUrl);
  const final = (artwork.images || []).find((image) => image.name !== "Reference" && image.dataUrl);
  if (!reference || !final) throw new Error(`Project "${artwork.title}" needs a reference and artwork image.`);
  fs.mkdirSync(outDir, { recursive: true });
  const referenceImage = await loadImage(reference.dataUrl);
  const artworkImage = await loadImage(final.dataUrl);
  const referenceMask = traceMaskFromRaw(referenceImage);
  const artworkMask = traceMaskFromRaw(artworkImage);
  const best = align(referenceMask, artworkMask);
  if (!best) throw new Error("No alignment found.");
  await drawTrace(referenceMask, [255, 40, 40]).toFile(path.join(outDir, "reference-trace.png"));
  await drawTrace(artworkMask, [30, 120, 255]).toFile(path.join(outDir, "artwork-trace.png"));
  await drawComposite(referenceMask, artworkMask, best, path.join(outDir, "alignment-composite.png"));
  fs.writeFileSync(path.join(outDir, "alignment-result.json"), JSON.stringify({
    project: artwork.title,
    reference: { naturalWidth: referenceImage.naturalWidth, naturalHeight: referenceImage.naturalHeight, points: referenceMask.points.length, threshold: referenceMask.threshold, bounds: referenceMask.bounds },
    artwork: { naturalWidth: artworkImage.naturalWidth, naturalHeight: artworkImage.naturalHeight, points: artworkMask.points.length, threshold: artworkMask.threshold, bounds: artworkMask.bounds },
    alignment: best,
  }, null, 2));
  console.log(JSON.stringify({ project: artwork.title, best, outDir }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
