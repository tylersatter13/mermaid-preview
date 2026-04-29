import * as path from 'path';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as http from 'http';

export interface ParsedSvg {
  body: string;
  width: number;
  height: number;
}

export function parseSvg(svgString: string): ParsedSvg {
  const bodyMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const body = bodyMatch ? bodyMatch[1].trim() : '';

  const widthAttr = svgString.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/i);
  const heightAttr = svgString.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/i);

  if (widthAttr && heightAttr) {
    return { body, width: Math.round(parseFloat(widthAttr[1])), height: Math.round(parseFloat(heightAttr[1])) };
  }

  const viewBoxMatch = svgString.match(/<svg[^>]*\sviewBox="[\d.]+\s[\d.]+\s([\d.]+)\s([\d.]+)"/i);
  if (viewBoxMatch) {
    return { body, width: Math.round(parseFloat(viewBoxMatch[1])), height: Math.round(parseFloat(viewBoxMatch[2])) };
  }

  return { body, width: 24, height: 24 };
}

export function groupIconsByPrefix(icons: Record<string, string>): Record<string, Record<string, string>> {
  const groups: Record<string, Record<string, string>> = {};
  for (const [key, value] of Object.entries(icons)) {
    const colonIndex = key.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }
    const prefix = key.substring(0, colonIndex);
    const name = key.substring(colonIndex + 1);
    if (!groups[prefix]) {
      groups[prefix] = {};
    }
    groups[prefix][name] = value;
  }
  return groups;
}

export interface IconifyPack {
  prefix: string;
  icons: Record<string, ParsedSvg>;
}

export function buildIconifyPack(prefix: string, resolvedIcons: Record<string, ParsedSvg>): IconifyPack {
  return { prefix, icons: resolvedIcons };
}

export async function fetchSvgFromUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchSvgFromUrl(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function resolveIconPath(iconPath: string, workspaceRoot: string | undefined, cacheDir: string): Promise<string | undefined> {
  if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
    const cacheKey = Buffer.from(iconPath).toString('base64url');
    const cachePath = path.join(cacheDir, `${cacheKey}.svg`);
    try {
      return await fs.readFile(cachePath, 'utf-8');
    } catch {
      // Not cached
    }
    try {
      const svg = await fetchSvgFromUrl(iconPath);
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(cachePath, svg, 'utf-8');
      return svg;
    } catch (err) {
      console.warn(`Failed to fetch icon from ${iconPath}:`, err);
      return undefined;
    }
  }

  const absolutePath = path.isAbsolute(iconPath)
    ? iconPath
    : workspaceRoot
      ? path.resolve(workspaceRoot, iconPath)
      : undefined;

  if (!absolutePath) {
    console.warn(`Cannot resolve relative path "${iconPath}" without a workspace`);
    return undefined;
  }

  try {
    return await fs.readFile(absolutePath, 'utf-8');
  } catch (err) {
    console.warn(`Failed to read icon file at ${absolutePath}:`, err);
    return undefined;
  }
}

export async function resolveAllIcons(
  icons: Record<string, string>,
  workspaceRoot: string | undefined,
  cacheDir: string,
): Promise<IconifyPack[]> {
  const groups = groupIconsByPrefix(icons);
  const packs: IconifyPack[] = [];

  for (const [prefix, entries] of Object.entries(groups)) {
    const resolvedIcons: Record<string, ParsedSvg> = {};
    for (const [name, iconPath] of Object.entries(entries)) {
      const svgString = await resolveIconPath(iconPath, workspaceRoot, cacheDir);
      if (svgString) {
        resolvedIcons[name] = parseSvg(svgString);
      }
    }
    if (Object.keys(resolvedIcons).length > 0) {
      packs.push(buildIconifyPack(prefix, resolvedIcons));
    }
  }

  return packs;
}
