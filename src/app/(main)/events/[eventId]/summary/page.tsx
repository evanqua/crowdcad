"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { Event, Call, TeamLogEntry, CallLogEntry, InteractionSession } from '@/app/types';
import dynamic from 'next/dynamic';
import { Button, Card, CardBody } from '@heroui/react';
import { DiagonalStreaks } from '@/components/ui/diagonal-streaks';

const SummaryCharts = dynamic(() => import('./SummaryCharts'), { ssr: false, loading: () => <div className="rounded-2xl p-6 bg-surface-deep border border-surface-liner">Loading charts...</div> });

// --- TIME WINDOW [posting window ± 2h]; falls back to logs if missing ---
const TWO_HOURS = 2 * 60 * 60 * 1000;
function getScheduleWindow(event: Event): { start: number; end: number } {
  const getNum = (v: unknown): number | undefined => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const parsed = Date.parse(v);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  };

  // Adjust these keys if your event stores posting window differently
  const startFields = ['postingStart', 'scheduleStart', 'startTime', 'start'];
  const endFields   = ['postingEnd',   'scheduleEnd',   'endTime',   'end'];

  const starts = startFields
  .map(k => getNum(event[k as keyof Event]))
  .filter(Boolean) as number[];

  const ends = endFields
    .map(k => getNum(event[k as keyof Event]))
    .filter(Boolean) as number[];

  // Fallback: derive from logs
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  for (const call of event.calls || []) {
    for (const entry of call.log || []) {
      if (typeof entry.timestamp === 'number') {
        if (entry.timestamp < minTs) minTs = entry.timestamp;
        if (entry.timestamp > maxTs) maxTs = entry.timestamp;
      }
    }
  }
  const derivedStart = Number.isFinite(minTs) ? minTs : Date.now();
  const derivedEnd = Number.isFinite(maxTs) ? maxTs : derivedStart + 4 * 60 * 60 * 1000;

  const start = (starts.length ? Math.min(...starts) : derivedStart) - TWO_HOURS;
  const end   = (ends.length   ? Math.max(...ends)   : derivedEnd)   + TWO_HOURS;
  return { start, end };
}

// --- Build hourly series between [start, end] at 1-hour bins ---
function buildHourlySeries(event: Event, start: number, end: number) {
  const hour = 60 * 60 * 1000;
  const s = Math.floor(start / hour) * hour;
  const e = Math.ceil(end / hour) * hour;
  const buckets: { ts: number; label: string; count: number }[] = [];

  const pad2 = (n: number) => String(n).padStart(2, '0');

  for (let t = s; t <= e; t += hour) {
    const d = new Date(t);
    const label = `${pad2(d.getHours())}:00`; // 24h label
    buckets.push({ ts: t, label, count: 0 });
  }

  // Count a call by its first log timestamp
  for (const call of event.calls || []) {
    const firstTs = (call.log || []).reduce<number | null>((min, e) => {
      if (typeof e.timestamp !== 'number') return min;
      return min == null ? e.timestamp : Math.min(min, e.timestamp);
    }, null);
    if (firstTs == null || firstTs < s || firstTs > e) continue;
    const idx = Math.floor((firstTs - s) / hour);
    if (idx >= 0 && idx < buckets.length) buckets[idx].count += 1;
  }
  return buckets;
}


// Reuse your callsByTeam helper to build Recharts-friendly pie data
function teamPieData(event: Event) {
  return callsByTeam(event).map(d => ({ name: d.team || 'Unassigned', value: d.count }));
}


// Count 1 call per team for each call that team is involved in
function callsByTeam(event: Event) {
  const counts: Record<string, number> = {};
  for (const call of event.calls || []) {
    const assigned = call.assignedTeam ?? [];
    const detached = (call.detachedTeams ?? []).map(d => d.team);
    const involved = new Set([...assigned, ...detached].filter(Boolean));

    // If your schema sometimes stores a single team differently, you can add a fallback:
    // if (!involved.size && (call as any).team) involved.add((call as any).team);

    for (const t of involved) counts[t] = (counts[t] ?? 0) + 1;
  }
  return Object.entries(counts).map(([team, count]) => ({ team, count }));
}

// Simple donut via stroked arcs
// function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
//   const rad = ((angleDeg - 90) * Math.PI) / 180;
//   return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
// }

// function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
//   const start = polarToCartesian(cx, cy, r, endAngle);
//   const end = polarToCartesian(cx, cy, r, startAngle);
//   const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
//   return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
// }

// Bucket one count per call based on the earliest log timestamp (first seen hour)
// function callsPerHour(event: Event) {
//   const counts: Record<number, number> = {};
//   for (const call of event.calls || []) {
//     const firstTs =
//       (call.log || []).reduce<number | null>((min, e) => {
//         if (typeof e.timestamp !== 'number') return min;
//         return min == null ? e.timestamp : Math.min(min, e.timestamp);
//       }, null) ?? null;
//     if (firstTs == null) continue;
//     const hour = new Date(firstTs).getHours(); // 0–23 local hour
//     counts[hour] = (counts[hour] ?? 0) + 1;
//   }
//   // normalize to 24 keys so the chart is stable
//   return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: counts[h] ?? 0 }));
// }

// Parse team + status from your existing message format, but keep real timestamps for math
// function parseTeamAndStatus(message: string): { team: string; status: string } | null {
//   // Examples: "1330 - Team 1 En Route", "1342 - Team 1 On Scene"
//   const m = message.match(/^\d{4}\s*-\s*(.+?)\s+([A-Za-z][\w\s]+)$/);
//   if (!m) return null;
//   const team = m[1].trim();
//   const status = m[2].trim().toLowerCase();
//   return { team, status };
// }

// type RespStats = {
//   averageMs: number | null;
//   fastestMs: number | null;
//   slowestMs: number | null;
//   samples: number;
// };

// Compute en route → on scene deltas (ms), across all teams/calls
// function computeResponseTimeStats(event: Event): RespStats {
//   const deltas: number[] = [];

//   for (const call of event.calls || []) {
//     // Group logs by team so we can find the pair for each team
//     const byTeam: Record<string, { enRoute?: number; onScene?: number }> = {};

//     for (const entry of call.log || []) {
//       if (typeof entry.timestamp !== 'number' || !entry.message) continue;
//       const parsed = parseTeamAndStatus(entry.message);
//       if (!parsed) continue;
//       const key = parsed.team;

//       if (!byTeam[key]) byTeam[key] = {};
//       if (parsed.status === 'en route') byTeam[key].enRoute = entry.timestamp;
//       if (parsed.status === 'on scene') byTeam[key].onScene = entry.timestamp;
//     }

//     // For each team, if both stamps exist and order is valid, add delta
//     for (const t of Object.values(byTeam)) {
//       if (t.enRoute && t.onScene && t.onScene > t.enRoute) {
//         deltas.push(t.onScene - t.enRoute);
//       }
//     }
//   }

//   if (deltas.length === 0) return { averageMs: null, fastestMs: null, slowestMs: null, samples: 0 };

//   const sum = deltas.reduce((a, b) => a + b, 0);
//   return {
//     averageMs: sum / deltas.length,
//     fastestMs: Math.min(...deltas),
//     slowestMs: Math.max(...deltas),
//     samples: deltas.length,
//   };
// }

// function msToMinSec(ms: number | null): string {
//   if (ms == null) return '—';
//   const totalSec = Math.round(ms / 1000);
//   const m = Math.floor(totalSec / 60);
//   const s = totalSec % 60;
//   return `${m}m ${s}s`;
// }

// function Collapsible({
//   title,
//   children,
// }: { title: string; children: React.ReactNode }) {
//   const [open, setOpen] = useState(false);
//   return (
//     <div className="rounded-2xl border border-surface-liner bg-surface-deep">
//       <button
//         onClick={() => setOpen(o => !o)}
//         className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-surface-deepest transition"
//       >
//         <span className="font-semibold">{title}</span>
//         <span className="text-xl">{open ? '▾' : '▸'}</span>
//       </button>
//       {open && <div className="px-4 pb-4">{children}</div>}
//     </div>
//   );
// }

export default function SummaryPage() {
  const params = useParams();
  // router is intentionally unused in this summary page; keep for potential future navigation
  // const router = useRouter();
  const { eventId } = params as { eventId?: string };

  const [openStaff, setOpenStaff] = useState(false);
  const [openCalls,  setOpenCalls]  = useState(false);
  const [event, setEvent]         = useState<Event | null>(null);
  const [openDataCollection, setOpenDataCollection] = useState(false);


  useEffect(() => {
    const fetchData = async () => {
      if (!eventId) return;
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      setEvent(eventDoc.exists() ? (eventDoc.data() as Event) : null);
    };
    fetchData();
  }, [eventId]);

  // Keep hooks stable even before `event` is loaded by declaring
  // memoized values with guards here. This prevents conditional
  // hook usage and preserves hook order across renders.
  const scheduleWindow = useMemo(() => {
    if (!event) {
      const now = Date.now();
      return { start: now - TWO_HOURS, end: now + 4 * 60 * 60 * 1000 };
    }
    return getScheduleWindow(event);
  }, [event]);

  const perHourSeries = useMemo(() => {
    if (!event) return [];
    return buildHourlySeries(event, scheduleWindow.start, scheduleWindow.end);
  }, [event, scheduleWindow.start, scheduleWindow.end]);

  const pieSeries = useMemo(() => {
    if (!event) return [];
    return teamPieData(event);
  }, [event]);

  const interactionSessions = useMemo<InteractionSession[]>(() => event?.interactionSessions || [], [event?.interactionSessions]);

  const interactionTimeline = useMemo(() => interactionSessions.map(session => ({
    sessionId: session.sessionId,
    startTime: new Date(session.startTime).toLocaleTimeString(),
    duration: ((session.endTime || Date.now()) - session.startTime) / 1000 / 60, // minutes
    clicks: session.mouseClicks.length,
    keystrokes: session.keyStrokes.length,
  })), [interactionSessions]);

  if (!event) {
    return (
      <div className="p-6 text-surface-light bg-surface-deepest rounded-2xl m-6">
        Loading summary...
      </div>
    );
  }

  // Delivered to Clinic (robust: use status OR clinic flag)
  // After the "if (!event) return ..." guard
  const totalDeliveredToClinic =
    event.calls.filter(c => c.status === 'Delivered' || c.clinic === true).length;

  const totalTransported =
    event.calls.filter(c => c.outcome === 'Rolled from Clinic' || c.status === 'Rolled from Scene').length;

  // const respStats = computeResponseTimeStats(event as Event); // assert non-null
  // const avgResp = msToMinSec(respStats.averageMs);


  const formatTimestamp = (timestamp: number) => {
    // Check if this looks like elapsed seconds (< 86400 = 24 hours in seconds)
    // if (timestamp < 86400) {
      // This is elapsed seconds with 2 decimal places for milliseconds
      return timestamp.toFixed(2);
    // } 
    // else {
    //   // This is a Unix timestamp in milliseconds, format as date/time
    //   const date = new Date(timestamp);
    //   return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    // }
  };

  // Utility to generate full log text for CSV
  const generateCSVData = () => {
    if (!event) return '';

    const csvRows: string[] = [];

    // Headers
    csvRows.push('Log Type,Team/Call ID,Timestamp,Message');

    // Staff Logs
    event.staff.forEach((team) => {
      (team.log || []).forEach((entry: TeamLogEntry) => {
        csvRows.push(`Staff,${team.team},${formatTimestamp(entry.timestamp)},"${entry.message}"`);
      });
    });

    // Call Logs
    event.calls.forEach((call) => {
      (call.log || []).forEach((entry: CallLogEntry) => {
        csvRows.push(`Call,${call.id},${formatTimestamp(entry.timestamp)},"${entry.message}"`);
      });
    });

    return csvRows.join('\n');
  };

  const handleCSVDownload = () => {
    const csvContent = generateCSVData();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', `${event?.name || eventId}_Summary.csv`);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleDataCollectionCSVDownload = () => {
    const csvContent = generateDataCollectionCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', `${event?.name || eventId}_TestingData.csv`);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  // Helpers to transform logs and events into analytics
  function parseLogTime(message: string): { team: string; status: string; time: number } | null {
    const match = message.match(/^(\d{4}) - (.+?) (\w[\w\s]+?)$/i);
    if (!match) return null;
    const [, hhmm, teamRaw, statusRaw] = match;
    const time = parseInt(hhmm.slice(0, 2)) * 60 + parseInt(hhmm.slice(2));
    const team = teamRaw.trim();
    const status = statusRaw.trim().toLowerCase();
    return { team, status, time };
  }

  const teamCallCounts: { [team: string]: number } = {};
  const teamCallDurations: { [team: string]: number } = {};
  const locationCounts: { [loc: string]: number } = {};
  const complaintCounts: { [complaint: string]: number } = {};

  if (event?.calls) {
    event.calls.forEach((call) => {
      // Combine assigned and detached teams
      const assignedTeams = call.assignedTeam || [];
      const detachedTeams = call.detachedTeams?.map(dt => dt.team) || [];
      const involvedTeams = [...new Set([...assignedTeams, ...detachedTeams])];

      // Count calls per team
      involvedTeams.forEach(team => {
        teamCallCounts[team] = (teamCallCounts[team] || 0) + 1;
      });

      // Count location and complaints
      if (call.location) {
        locationCounts[call.location] = (locationCounts[call.location] || 0) + 1;
      }

      if (call.chiefComplaint) {
        complaintCounts[call.chiefComplaint] = (complaintCounts[call.chiefComplaint] || 0) + 1;
      }

      // Calculate duration per team
      for (const team of involvedTeams) {
        const logs = (call.log || []).filter(l => l.message.includes(team));
        let start: number | null = null;
        let end: number | null = null;

        for (const l of logs) {
          const parsed = parseLogTime(l.message);
          if (!parsed || parsed.team !== team) continue;

          if (parsed.status === 'on scene') start = parsed.time;
          if (['delivered to clinic', 'refused medical care', 'no medical merit', 'detached'].includes(parsed.status)) {
            end = parsed.time;
          }
        }

        if (start != null && end != null && end > start) {
          teamCallDurations[team] = (teamCallDurations[team] || 0) + (end - start);
        }
      }
    });
  }

  // Sort and select top entries
  // const topTeamsByCalls = Object.entries(teamCallCounts)
  //   .sort((a, b) => b[1] - a[1])
  //   .slice(0, 3);

  // const topTeamsByDuration = Object.entries(teamCallDurations)
  //   .sort((a, b) => b[1] - a[1])
  //   .slice(0, 3);

  // const topLocations = Object.entries(locationCounts)
  //   .sort((a, b) => b[1] - a[1])
  //   .slice(0, 3);

  // const topComplaints = Object.entries(complaintCounts)
  //   .sort((a, b) => b[1] - a[1])
  //   .slice(0, 3);

  // const perHour = callsPerHour(event);
  const totalCalls = event.calls?.length ?? 0;
  const eventDate = new Date(event.date);
  // const teamSlices = callsByTeam(event);
  // const teamTotal = teamSlices.reduce((s, d) => s + d.count, 0);


  // chart sizing
  // const maxCount = Math.max(1, ...perHour.map(d => d.count));
  // const chartHeight = 160; // px
  // const barGap = 4;
  // const barWidth = 18;
  // const chartWidth = perHour.length * (barWidth + barGap) + barGap;

  const THEME = {
    tick: '#cfd5ea',        // light tick labels
    tickStrong: '#e7ebf6',  // brighter ticks
    axis: '#3eb1fdff',        // axis line + tick marks
    grid: '#3eb1fdff',        // grid lines
    tooltipBg: 'var(--surface-deepest, #0b0f14)',
    tooltipBorder: '#3eb1fdff',
    tooltipText: '#e7ebf6',
    barFill: '#3eb1fdff',          // default bar color
    barHoverFill: '#3eb1fdff',     // same as default since no hover
  };

  // True gradient from accent blue (#3eb1fdff) to red (rgb(240, 28, 28)) - 10 colors
  const PIE_COLORS = [
    '#3eb1fdff',  // Start: accent blue (62, 177, 253)
    '#60a4f0',    // (82, 164, 240)
    '#a47ed1',    // (164, 126, 209)
    '#e54d8c',    // (229, 77, 140)
    '#ed4070',    // (237, 64, 112)
    '#f23554',    // (242, 53, 84)
    '#f01c1c',    // End: red (240, 28, 28)
  ];
  
  
  
  const generateDataCollectionCSV = () => {
    if (!event || !interactionSessions.length) return '';

    const csvRows: string[] = [];
    
    // Find the earliest session start time to use as reference point
    const sessionStartTimestamp = Math.min(...interactionSessions.map(s => s.startTime));
    
    // Convert timestamp to seconds after session start
    const convertTimestamp = (timestamp: number) => {
      const elapsedMs = timestamp - sessionStartTimestamp;
      return (elapsedMs / 1000).toFixed(2);
    };
    
    // Headers for interaction data
    csvRows.push('Session ID,Event ID,Session Start,Session End,Duration (ms),Mouse Clicks,Key Strokes,Clicks Per Minute,Keys Per Minute');
    
    interactionSessions.forEach(session => {
      const duration = (session.endTime || Date.now()) - session.startTime;
      const durationMinutes = duration / (1000 * 60);
      const clicksPerMinute = durationMinutes > 0 ? (session.mouseClicks.length / durationMinutes).toFixed(2) : '0';
      const keysPerMinute = durationMinutes > 0 ? (session.keyStrokes.length / durationMinutes).toFixed(2) : '0';
      
      csvRows.push([
        session.sessionId,
        session.eventId,
        convertTimestamp(session.startTime),
        session.endTime ? convertTimestamp(session.endTime) : 'Ongoing',
        duration.toString(),
        session.mouseClicks.length.toString(),
        session.keyStrokes.length.toString(),
        clicksPerMinute,
        keysPerMinute
      ].map(field => `"${field}"`).join(','));
    });

    // Add detailed click data with proper headers
    csvRows.push(''); // Empty line separator
    csvRows.push('Detailed Mouse Clicks:');
    csvRows.push('Session ID,Timestamp');
    
    interactionSessions.forEach(session => {
      session.mouseClicks.forEach(click => {
        csvRows.push([
          session.sessionId,
          convertTimestamp(click.timestamp)
        ].map(field => `"${field}"`).join(','));
      });
    });

    // Add detailed keystroke data with proper headers  
    csvRows.push(''); // Empty line separator
    csvRows.push('Detailed Key Strokes:');
    csvRows.push('Session ID,Timestamp');
    
    interactionSessions.forEach(session => {
      session.keyStrokes.forEach(stroke => {
        csvRows.push([
          session.sessionId,
          convertTimestamp(stroke.timestamp)
        ].map(field => `"${field}"`).join(','));
      });
    });

    return csvRows.join('\n');
  };

  // const generateFullCSVData = () => {
  //   if (!event) return '';

  //   const eventCsv = generateCSVData(); // Your existing function
  //   const dataCollectionCsv = generateDataCollectionCSV();
    
  //   return eventCsv + '\n\n--- DATA COLLECTION METRICS ---\n' + dataCollectionCsv;
  // };

  // const handleFullCSVDownload = () => {
  //   const csvContent = generateFullCSVData();
  //   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  //   const url = URL.createObjectURL(blob);

  //   const anchor = document.createElement('a');
  //   anchor.href = url;
  //   anchor.setAttribute('download', `${event?.name || eventId}_Complete_Analysis.csv`);
  //   document.body.appendChild(anchor);
  //   anchor.click();
  //   document.body.removeChild(anchor);
  // };

  // Data collection analytics
  const totalSessions = interactionSessions.length;
  const totalMouseClicks = interactionSessions.reduce((sum, session) => sum + session.mouseClicks.length, 0);
  const totalKeyStrokes = interactionSessions.reduce((sum, session) => sum + session.keyStrokes.length, 0);
  const avgSessionDuration = totalSessions > 0 
    ? interactionSessions.reduce((sum, session) => {
        const duration = (session.endTime || Date.now()) - session.startTime;
        return sum + duration;
      }, 0) / totalSessions / 1000 / 60 // Convert to minutes
    : 0;

  // Create chronological call numbers based on first log entry time
  const getChronologicalCallNumber = (call: Call) => {
    const sortedCalls = [...(event.calls || [])].sort((a, b) => {
      const aFirstTs = (a.log || []).reduce<number | null>((min, e) => {
        if (typeof e.timestamp !== 'number') return min;
        return min == null ? e.timestamp : Math.min(min, e.timestamp);
      }, null) || 0;
      const bFirstTs = (b.log || []).reduce<number | null>((min, e) => {
        if (typeof e.timestamp !== 'number') return min;
        return min == null ? e.timestamp : Math.min(min, e.timestamp);
      }, null) || 0;
      return aFirstTs - bFirstTs;
    });
    return sortedCalls.findIndex(c => c.id === call.id) + 1;
  };

  return (
    <main className="relative min-h-screen bg-surface-deepest text-surface-light scroll-smooth">
      <DiagonalStreaks />
      <div className="relative z-10 px-6 md:px-20 py-8">
        <div className="max-w-[1200px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <h1 className="text-3xl md:text-4xl font-bold">
              Event Summary: {event.name}{' '}
              <span className="font-normal text-surface-light/70 text-xl md:text-2xl">
                ({eventDate.toLocaleDateString()})
              </span>
            </h1>
            <div className="flex gap-2 shrink-0">
              <Button
                onPress={handleCSVDownload}
                variant="flat"
                radius="lg"
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-white font-semibold"
              >
                Export Logs
              </Button>
              {totalSessions > 0 && (
                <Button
                  onPress={handleDataCollectionCSVDownload}
                  variant="flat"
                  radius="lg"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Export Testing Data
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* BIG totals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card isBlurred className="bg-surface-deep/60 border border-default-200">
            <CardBody className="p-6">
              <div className="text-sm opacity-70">Total Calls</div>
              <div className="text-6xl md:text-7xl font-extrabold leading-none mt-1">{totalCalls}</div>
            </CardBody>
          </Card>

          <Card isBlurred className="bg-surface-deep/60 border border-default-200">
            <CardBody className="p-6">
              <div className="text-sm opacity-70">Delivered to Clinic</div>
              <div className="text-6xl md:text-7xl font-extrabold leading-none mt-1">{totalDeliveredToClinic}</div>
            </CardBody>
          </Card>

          <Card isBlurred className="bg-surface-deep/60 border border-default-200">
            <CardBody className="p-6">
              <div className="text-sm opacity-70">Transported</div>
              <div className="text-6xl md:text-7xl font-extrabold leading-none mt-1">{totalTransported}</div>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SummaryCharts
              perHourSeries={perHourSeries}
              pieSeries={pieSeries}
              interactionTimeline={interactionTimeline}
              THEME={THEME}
              PIE_COLORS={PIE_COLORS}
            />
        </div>
        {totalSessions > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card isBlurred className="bg-surface-deep/60 border border-default-200">
              <CardBody className="p-6">
                <div className="text-sm opacity-70">Active Sessions</div>
                <div className="text-4xl md:text-5xl font-extrabold leading-none mt-1">{totalSessions}</div>
              </CardBody>
            </Card>
            
            <Card isBlurred className="bg-surface-deep/60 border border-default-200">
              <CardBody className="p-6">
                <div className="text-sm opacity-70">Total Mouse Clicks</div>
                <div className="text-4xl md:text-5xl font-extrabold leading-none mt-1">{totalMouseClicks}</div>
              </CardBody>
            </Card>

            <Card isBlurred className="bg-surface-deep/60 border border-default-200">
              <CardBody className="p-6">
                <div className="text-sm opacity-70">Total Keystrokes</div>
                <div className="text-4xl md:text-5xl font-extrabold leading-none mt-1">{totalKeyStrokes}</div>
              </CardBody>
            </Card>

            <Card isBlurred className="bg-surface-deep/60 border border-default-200">
              <CardBody className="p-6">
                <div className="text-sm opacity-70">Avg Session (min)</div>
                <div className="text-4xl md:text-5xl font-extrabold leading-none mt-1">{avgSessionDuration.toFixed(1)}</div>
              </CardBody>
            </Card>
          </div>
        )}
        {/* Data collection charts are rendered in the client-only SummaryCharts component above. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Staff Logs (HeroUI) */}
          <Card isBlurred className="bg-surface-deep/60 border border-default-200">
            <CardBody className="p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-semibold">Staff Logs</span>
                  <div className="text-sm text-surface-faint">{event.staff.length} teams</div>
                </div>
                <div>
                  <Button size="sm" variant="flat" onPress={() => setOpenStaff(v => !v)}>
                    {openStaff ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
              {openStaff && (
                <div className="px-4 pb-4 space-y-4">
                  {event.staff.map((team) => (
                    <div key={team.team} className="bg-surface-deepest rounded-lg p-3">
                      <div className="flex items-baseline justify-between">
                        <h4 className="font-semibold">{team.team}</h4>
                        <div className="text-sm text-surface-faint">{(team.log || []).length} entries</div>
                      </div>
                      <div className="mt-2 text-sm space-y-1">
                        {(team.log || []).map((entry, idx) => (
                          <div key={idx}>
                            {entry.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Call Logs (HeroUI) */}
          <Card isBlurred className="bg-surface-deep/60 border border-default-200">
            <CardBody className="p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-semibold">Call Logs</span>
                  <div className="text-sm text-surface-faint">{event.calls.length} calls</div>
                </div>
                <div>
                  <Button size="sm" variant="flat" onPress={() => setOpenCalls(v => !v)}>
                    {openCalls ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
              {openCalls && (
                <div className="px-4 pb-4 space-y-4">
                  {event.calls.map((call) => (
                    <div key={call.id} className="bg-surface-deepest rounded-lg p-3">
                      <div className="flex items-baseline justify-between">
                        <div className="font-semibold">Call #{getChronologicalCallNumber(call)} — {call.chiefComplaint}</div>
                        <div className="text-sm text-surface-faint">{call.location || 'No location'}</div>
                      </div>
                      <div className="mt-2 text-sm space-y-1">
                        {(call.log || []).map((entry, idx) => (
                          <div key={idx}>
                            {entry.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
          {/* NEW: Data Collection Details */}
          {totalSessions > 0 && (
            <Card isBlurred className="bg-surface-deep/60 border border-default-200">
              <CardBody className="p-0">
                <button
                  onClick={() => setOpenDataCollection(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-surface-deepest/50 transition"
                >
                  <span className="font-semibold">Data Collection Sessions</span>
                  <span className="text-xl">{openDataCollection ? '▾' : '▸'}</span>
                </button>
                {openDataCollection && (
                  <div className="px-4 pb-4">
                    {interactionSessions.map((session) => (
                      <div key={session.sessionId} className="mb-4 p-3 bg-surface-deepest rounded-lg">
                        <h4 className="font-semibold mb-2">Session {session.sessionId}</h4>
                        <div className="text-sm space-y-1">
                          <p><strong>Started:</strong> {formatTimestamp(session.startTime)}</p>
                          {session.endTime && <p><strong>Ended:</strong> {formatTimestamp(session.endTime)}</p>}
                          <p><strong>Duration:</strong> {((session.endTime || Date.now()) - session.startTime) / 1000 / 60} minutes</p>
                          <p><strong>Mouse Clicks:</strong> {session.mouseClicks.length}</p>
                          <p><strong>Keystrokes:</strong> {session.keyStrokes.length}</p>
                          <p><strong>Clicks/min:</strong> {(session.mouseClicks.length / (((session.endTime || Date.now()) - session.startTime) / 1000 / 60)).toFixed(2)}</p>
                          <p><strong>Keys/min:</strong> {(session.keyStrokes.length / (((session.endTime || Date.now()) - session.startTime) / 1000 / 60)).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
      </div>
    </main>
  );}
