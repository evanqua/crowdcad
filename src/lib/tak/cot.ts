import type { CotDetail, CotEvent, CotPoint } from './types';
import { COT_UNKNOWN } from './types';

/**
 * Escape the five XML special characters, in an order that avoids
 * double-escaping: '&' is replaced FIRST, before any of the other
 * replacements (which themselves insert literal '&' characters as part of
 * '&lt;', '&gt;', etc). Escaping in any other order would re-escape those
 * inserted ampersands.
 *
 * Also strips characters that are illegal in XML 1.0 regardless of
 * escaping (C0 control characters other than tab/LF/CR, and DEL) — XML 1.0
 * simply has no valid representation for them, escaped or not.
 *
 * Callsigns and post names are free-text user input and reach this function
 * completely unfiltered — this is the only sanitization boundary they pass
 * through before being embedded in CoT XML that gets broadcast to every
 * connected TAK client and federated partner server.
 */
export function escapeXml(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex -- intentionally matching illegal XML 1.0 control chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Reverse of escapeXml's entity substitutions. Non-ampersand entities are
 * decoded first, and '&amp;' last, mirroring the encode order so a literal
 * '&' produced by decoding '&amp;' is never re-interpreted as the start of
 * another entity.
 */
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** ISO-8601 UTC with milliseconds and a trailing 'Z', e.g. 2026-08-15T12:00:00.000Z. */
export function formatCotTime(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function parseCotTime(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function attrBlock(name: string, value: string | undefined): string {
  return value !== undefined ? ` ${name}="${escapeXml(value)}"` : '';
}

function buildDetailXml(detail: CotDetail | undefined): string {
  if (!detail) return '';
  const parts: string[] = [];

  if (detail.callsign !== undefined) {
    parts.push(`    <contact${attrBlock('callsign', detail.callsign)}/>`);
  }
  if (detail.groupName !== undefined || detail.groupRole !== undefined) {
    parts.push(
      `    <__group${attrBlock('name', detail.groupName)}${attrBlock('role', detail.groupRole)}/>`
    );
  }
  if (detail.geopointsrc !== undefined || detail.altsrc !== undefined) {
    parts.push(
      `    <precisionlocation${attrBlock('geopointsrc', detail.geopointsrc)}${attrBlock('altsrc', detail.altsrc)}/>`
    );
  }
  if (detail.remarks !== undefined) {
    parts.push(`    <remarks>${escapeXml(detail.remarks)}</remarks>`);
  }

  return parts.join('\n');
}

/**
 * Serialize a CotEvent to CoT XML. String-templated with strict manual
 * escaping (via escapeXml) — no XML library involved. Missing point
 * hae/ce/le are emitted as COT_UNKNOWN, never 0. Detail child elements
 * whose backing value is entirely absent are omitted.
 */
export function buildCotXml(e: CotEvent): string {
  const point: Required<Pick<CotPoint, 'lat' | 'lon' | 'hae' | 'ce' | 'le'>> = {
    lat: e.point.lat,
    lon: e.point.lon,
    hae: e.point.hae ?? COT_UNKNOWN,
    ce: e.point.ce ?? COT_UNKNOWN,
    le: e.point.le ?? COT_UNKNOWN,
  };

  const eventAttrs =
    ` version="2.0"` +
    attrBlock('uid', e.uid) +
    attrBlock('type', e.type) +
    attrBlock('how', e.how) +
    attrBlock('time', formatCotTime(e.time)) +
    attrBlock('start', formatCotTime(e.start)) +
    attrBlock('stale', formatCotTime(e.stale));

  const pointAttrs =
    ` lat="${point.lat}" lon="${point.lon}" hae="${point.hae}" ce="${point.ce}" le="${point.le}"`;

  const detailChildren = buildDetailXml(e.detail);
  const detailXml = detailChildren ? `\n  <detail>\n${detailChildren}\n  </detail>` : '';

  return `<event${eventAttrs}>\n  <point${pointAttrs}/>${detailXml}\n</event>`;
}

function extractAttr(attrsBlob: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`);
  const m = attrsBlob.match(re);
  return m ? unescapeXml(m[1]) : undefined;
}

/**
 * Parse CoT XML of the shape emitted by buildCotXml above (and the shape
 * CoT devices commonly send: an <event> with a self-closing <point/> and a
 * <detail> block containing <contact>, <__group>, <precisionlocation>, and
 * <remarks>).
 *
 * This is a deliberately NARROW, regex/scan-based extractor — NOT a general
 * XML parser. It does not handle CDATA, namespaces, comments, entity
 * references beyond the five basic XML entities, repeated/nested detail
 * elements, or attribute values containing an unescaped '>' or newline. If
 * a real TAK server turns out to emit materially richer CoT than this
 * module produces, the intended escape hatch is to add the MIT-licensed
 * `fast-xml-parser` package as a dependency and replace this implementation
 * — this parser is not meant to be extended ad hoc to cover new shapes.
 *
 * Returns null — never throws, never returns a half-populated object — for
 * malformed, truncated, or empty input, or input missing a required field
 * (uid, type, time/start/stale, or point lat/lon).
 */
export function parseCotXml(xml: string): CotEvent | null {
  if (typeof xml !== 'string' || xml.length === 0) return null;

  const eventMatch = xml.match(/<event\b([^>]*)>/);
  if (!eventMatch) return null;
  const eventAttrs = eventMatch[1];

  const uid = extractAttr(eventAttrs, 'uid');
  const type = extractAttr(eventAttrs, 'type');
  const how = extractAttr(eventAttrs, 'how');
  const timeStr = extractAttr(eventAttrs, 'time');
  const startStr = extractAttr(eventAttrs, 'start');
  const staleStr = extractAttr(eventAttrs, 'stale');

  if (!uid || !type || !timeStr || !startStr || !staleStr) return null;

  const time = parseCotTime(timeStr);
  const start = parseCotTime(startStr);
  const stale = parseCotTime(staleStr);
  if (time === null || start === null || stale === null) return null;

  const pointMatch = xml.match(/<point\b([^>]*)\/>/);
  if (!pointMatch) return null;
  const pointAttrs = pointMatch[1];

  const latStr = extractAttr(pointAttrs, 'lat');
  const lonStr = extractAttr(pointAttrs, 'lon');
  if (latStr === undefined || lonStr === undefined) return null;
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const point: CotPoint = { lat, lon };
  const haeStr = extractAttr(pointAttrs, 'hae');
  const ceStr = extractAttr(pointAttrs, 'ce');
  const leStr = extractAttr(pointAttrs, 'le');
  if (haeStr !== undefined && Number.isFinite(Number(haeStr))) point.hae = Number(haeStr);
  if (ceStr !== undefined && Number.isFinite(Number(ceStr))) point.ce = Number(ceStr);
  if (leStr !== undefined && Number.isFinite(Number(leStr))) point.le = Number(leStr);

  const result: CotEvent = { uid, type, time, start, stale, point };
  if (how !== undefined) result.how = how;

  const detailMatch = xml.match(/<detail>([\s\S]*?)<\/detail>/);
  if (detailMatch) {
    const detailXml = detailMatch[1];
    const detail: CotDetail = {};

    const contactMatch = detailXml.match(/<contact\b([^>]*)\/>/);
    if (contactMatch) {
      const callsign = extractAttr(contactMatch[1], 'callsign');
      if (callsign !== undefined) detail.callsign = callsign;
    }

    const groupMatch = detailXml.match(/<__group\b([^>]*)\/>/);
    if (groupMatch) {
      const name = extractAttr(groupMatch[1], 'name');
      const role = extractAttr(groupMatch[1], 'role');
      if (name !== undefined) detail.groupName = name;
      if (role !== undefined) detail.groupRole = role;
    }

    const precisionMatch = detailXml.match(/<precisionlocation\b([^>]*)\/>/);
    if (precisionMatch) {
      const geopointsrc = extractAttr(precisionMatch[1], 'geopointsrc');
      const altsrc = extractAttr(precisionMatch[1], 'altsrc');
      if (geopointsrc !== undefined) detail.geopointsrc = geopointsrc;
      if (altsrc !== undefined) detail.altsrc = altsrc;
    }

    const remarksMatch = detailXml.match(/<remarks>([\s\S]*?)<\/remarks>/);
    if (remarksMatch) {
      detail.remarks = unescapeXml(remarksMatch[1]);
    }

    if (Object.keys(detail).length > 0) {
      result.detail = detail;
    }
  }

  return result;
}
