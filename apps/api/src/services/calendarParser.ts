import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import type { ExternalCalendarBlock } from "@yardmatch/contracts";
import { HttpError } from "../http";
import { MAX_CALENDAR_BYTES } from "../integrations/calendarFeed";

const parserModulePath = createRequire(import.meta.url).resolve("node-ical");

// Keep untrusted recurrence expansion off the API event loop, with hard time/memory limits.
const workerSource = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const ical = require(workerData.parserModulePath);
try {
  const { icsBody, timeZone, now } = workerData;
  new Intl.DateTimeFormat('en', { timeZone }).format();
  let unfolded = icsBody.replace(/\r?\n[ \t]/g, '');
  const allDayDurations = new Map();
  unfolded = unfolded.replace(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g, component => {
    const uid = /^UID:(.+)$/m.exec(component)?.[1]?.trim();
    const start = /^DTSTART;VALUE=DATE:([0-9]{8})\s*$/m.exec(component)?.[1];
    if (!uid || !start) return component;
    const midnight = value => Date.UTC(+value.slice(0,4), +value.slice(4,6)-1, +value.slice(6,8));
    let end = /^DTEND;VALUE=DATE:([0-9]{8})\s*$/m.exec(component)?.[1];
    if (!end) {
      end = new Date(midnight(start)+86400000).toISOString().slice(0,10).replaceAll('-','');
      component = component.replace('END:VEVENT','DTEND;VALUE=DATE:'+end+'\nEND:VEVENT');
    }
    allDayDurations.set(uid, (midnight(end)-midnight(start))/86400000);
    return component;
  });
  if (!/^BEGIN:VCALENDAR\s*$/m.test(unfolded) || !/^END:VCALENDAR\s*$/m.test(unfolded)) throw Error('Expected an iCalendar document.');
  if (/^RRULE:.*FREQ=(SECONDLY|MINUTELY|HOURLY)/mi.test(unfolded)) throw Error('Calendar recurrence more frequent than daily is unsupported.');
  // Floating and all-day appointments use the provider timezone, never the server timezone.
  const normalized = unfolded.split(/\r?\n/).map(line => {
    const date = /^(DTSTART|DTEND|RECURRENCE-ID|EXDATE|RDATE);VALUE=DATE:(.+)$/i.exec(line);
    if (date) return date[1] + ';TZID=' + timeZone + ':' + date[2].split(',').map(value => value + 'T000000').join(',');
    const floating = /^(DTSTART|DTEND|RECURRENCE-ID|EXDATE|RDATE)(?:;VALUE=DATE-TIME)?:([0-9T,]+)$/i.exec(line);
    return floating ? floating[1] + ';TZID=' + timeZone + ':' + floating[2] : line;
  }).join('\r\n');
  for (const match of normalized.matchAll(/;TZID=([^:;]+)[;:]/g)) {
    new Intl.DateTimeFormat('en', { timeZone: match[1].replaceAll('"','') }).format();
  }
  const events = ical.sync.parseICS(normalized);
  const parseDate = (value, parameters = '') => {
    const parsed = ical.sync.parseICS('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:date\r\nDTSTART'+parameters+':'+value+'\r\nEND:VEVENT\r\nEND:VCALENDAR');
    if (!(parsed.date?.start instanceof Date) || !Number.isFinite(parsed.date.start.getTime())) throw Error('Invalid recurrence date.');
    return parsed.date.start;
  };
  const blocks = [];
  const text = value => typeof value === 'string' ? value : value?.val ?? '';
  for (const event of Object.values(events)) {
    if (event.type !== 'VEVENT' || event.status === 'CANCELLED' || event.transparency === 'TRANSPARENT') continue;
    if (event.rdate) {
      const values = Array.isArray(event.rdate) ? event.rdate : [event.rdate];
      const additions = values.flatMap(item => {
        const raw = typeof item === 'string' ? item : item.val;
        if (item.params?.VALUE === 'PERIOD' || raw.includes('/')) throw Error('RDATE periods are unsupported; supply date-time occurrences.');
        const parameters = item.params?.TZID ? ';TZID='+item.params.TZID : '';
        return raw.split(',').map(value => parseDate(value,parameters));
      });
      const originalRule = event.rrule;
      event.rrule = { between: (from,to,inclusive) => {
        const dates = [...(originalRule ? originalRule.between(from,to,inclusive) : [event.start]),...additions];
        return [...new Map(dates.filter(date=>date>=from && date<=to).map(date=>[date.getTime(),date])).values()].sort((a,b)=>a-b);
      } };
    }
    if (!(event.start instanceof Date) || !(event.end instanceof Date) || !(event.end > event.start)) throw Error('Each calendar event needs a valid start and end.');
    for (const instance of ical.expandRecurringEvent(event, { from: new Date(now - 86400000), to: new Date(now + 366 * 86400000), includeOverrides: true, excludeExdates: true, expandOngoing: true })) {
      if (instance.event.status === 'CANCELLED') continue;
      const allDayDays = allDayDurations.get(event.uid);
      if (allDayDays && !instance.isOverride) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instance.start).map(part=>[part.type,part.value]));
        const endDay = new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day+allDayDays)).toISOString().slice(0,10).replaceAll('-','');
        instance.end = parseDate(endDay+'T000000',';TZID='+timeZone);
      }
      blocks.push({ uid: event.uid, title: text(instance.summary), notes: text(instance.event.description), startIso: instance.start.toISOString(), endIso: instance.end.toISOString() });
      if (blocks.length > 10000) throw Error('Calendar contains too many occurrences.');
    }
  }
  parentPort.postMessage({ blocks });
} catch (error) { parentPort.postMessage({ error: error.message }); }
`;

export async function parseCalendarFeed(input: { icsBody: string; subscriptionId: string; title: string; timeZone?: string; now?: number }): Promise<ExternalCalendarBlock[]> {
  if (Buffer.byteLength(input.icsBody) > MAX_CALENDAR_BYTES) throw new HttpError(400, "Calendar feed is too large.");
  const rows = await new Promise<Array<{ uid: string; title: string; notes: string; startIso: string; endIso: string }>>((resolve, reject) => {
    const worker = new Worker(workerSource, { eval: true, workerData: { ...input, parserModulePath, timeZone: input.timeZone ?? "America/New_York", now: input.now ?? Date.now() }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new HttpError(400, "Calendar is too complex to import safely.")); }, 3000);
    worker.once("message", (message) => {
      clearTimeout(timer);
      void worker.terminate();
      if (message.error) reject(new HttpError(400, `Calendar could not be imported: ${message.error}`));
      else resolve(message.blocks);
    });
    worker.once("error", (error) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); });
    worker.once("exit", (code) => { clearTimeout(timer); if (code !== 0) reject(new HttpError(400, "Calendar parser could not finish safely.")); });
  });
  return rows.map((row): ExternalCalendarBlock => ({ id: `${input.subscriptionId}:${row.uid}:${row.startIso}`, title: row.title.trim() || input.title,
    notes: row.notes || `Imported from ${input.title}`, startIso: row.startIso, endIso: row.endIso,
    blockType: "off-platform-client", source: "calendar-import", subscriptionId: input.subscriptionId, createdAt: new Date().toISOString()
  })).sort((a, b) => a.startIso.localeCompare(b.startIso));
}
