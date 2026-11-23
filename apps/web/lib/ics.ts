import type { Program } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIcsDate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function escapeIcs(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

export function downloadDeadlineIcs(program: Program): boolean {
  if (program.isAlwaysOpen || !program.deadline) return false;
  const deadline = new Date(program.deadline);
  const nextDay = new Date(deadline.getTime() + 24 * 60 * 60 * 1000);
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const descriptionParts = [
    `주관: ${program.provider}`,
    `신청 방법: ${program.applyInfo.method}`,
    program.applyInfo.phone ? `문의: ${program.applyInfo.phone}` : "",
    program.applyInfo.url ? `링크: ${program.applyInfo.url}` : "",
  ].filter(Boolean);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DORAN//Public Resource Reminder//KO",
    "BEGIN:VEVENT",
    `UID:doran-${program.id}@doran.local`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${toIcsDate(deadline)}`,
    `DTEND;VALUE=DATE:${toIcsDate(nextDay)}`,
    `SUMMARY:[도란도란 마감] ${escapeIcs(program.title)}`,
    `DESCRIPTION:${escapeIcs(descriptionParts.join("\n"))}`,
    program.address ? `LOCATION:${escapeIcs(program.address)}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-P3D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(program.title)} 마감 3일 전입니다.`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `doran-deadline-${program.id.slice(-6)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
