#!/usr/bin/env node
/**
 * Converts a directory of SVG icons into an Iconify-format JSON icon pack.
 *
 * Usage:
 *   node scripts/build-icon-pack.js <icons-dir> <prefix> [output-file]
 *
 * Example:
 *   node scripts/build-icon-pack.js \
 *     ~/Downloads/Azure_Public_Service_Icons-3/Icons \
 *     azure \
 *     azure-icons.json
 *
 * The output JSON follows the Iconify icon set format:
 *   { prefix, icons: { name: { body, width, height } } }
 *
 * Icon names are derived from filenames:
 *   "10021-icon-service-Virtual-Machine.svg" → "virtual-machine"
 */

const fs = require('fs');
const path = require('path');

function parseSvg(svg) {
  const bodyMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const body = bodyMatch ? bodyMatch[1].trim() : '';

  const wAttr = svg.match(/<svg[^>]*\swidth="([\d.]+)"/i);
  const hAttr = svg.match(/<svg[^>]*\sheight="([\d.]+)"/i);
  if (wAttr && hAttr) {
    return { body, width: Math.round(parseFloat(wAttr[1])), height: Math.round(parseFloat(hAttr[1])) };
  }

  const vb = svg.match(/<svg[^>]*\sviewBox="[\d.]+\s[\d.]+\s([\d.]+)\s([\d.]+)"/i);
  if (vb) {
    return { body, width: Math.round(parseFloat(vb[1])), height: Math.round(parseFloat(vb[2])) };
  }

  return { body, width: 24, height: 24 };
}

function slugify(filename) {
  // Strip numeric prefix, "icon-service-" marker, and extension
  // "10021-icon-service-Virtual-Machine.svg" → "Virtual-Machine"
  let name = path.basename(filename, '.svg');
  name = name.replace(/^\d+-icon-service-/i, '');
  // Also handle files without "icon-service-" prefix
  name = name.replace(/^\d+-/, '');
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function collectSvgFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSvgFiles(full));
    } else if (entry.name.endsWith('.svg')) {
      results.push(full);
    }
  }
  return results;
}

// --- Main ---
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node build-icon-pack.js <icons-dir> <prefix> [output-file]');
  process.exit(1);
}

const iconsDir = path.resolve(args[0]);
const prefix = args[1];
const outputFile = args[2] ? path.resolve(args[2]) : path.join(process.cwd(), `${prefix}-icons.json`);

const svgFiles = collectSvgFiles(iconsDir);
console.log(`Found ${svgFiles.length} SVG files in ${iconsDir}`);

const icons = {};
const seen = new Set();

for (const file of svgFiles) {
  const svg = fs.readFileSync(file, 'utf-8');
  let name = slugify(path.basename(file));

  // Deduplicate: if same name appears in multiple categories, prefix with category
  if (seen.has(name)) {
    const category = slugify(path.basename(path.dirname(file)));
    name = `${category}-${name}`;
  }
  seen.add(name);

  const parsed = parseSvg(svg);
  if (parsed.body) {
    icons[name] = parsed;
  }
}

const pack = { prefix, icons };
fs.writeFileSync(outputFile, JSON.stringify(pack), 'utf-8');
console.log(`Wrote ${Object.keys(icons).length} icons to ${outputFile}`);
console.log(`\nTo use in your previewer, add to settings.json:`);
console.log(`  "mermaidPreview.iconPacks": ["file://${outputFile}"]`);
console.log(`\nOr host the file and use an http(s) URL.`);
