import Link from "next/link";

export type CalendarStatus = { training?: "IN_PROGRESS" | "ACHIEVED" };
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function targetMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthCalendar({ year, month, todayKey, selectedKey, statuses }: { year: number; month: number; todayKey: string; selectedKey: string; statuses: Record<string, CalendarStatus> }) {
  const firstOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return <section className="panel calendar-panel"><header className="panel-heading"><h2>{monthNames[month - 1]} <strong>{year}</strong></h2><div className="calendar-nav" aria-label="Calendar navigation"><Link href={`/dashboard?month=${targetMonth(year, month, -1)}`} aria-label="Previous month">‹</Link><Link href={`/dashboard?month=${targetMonth(year, month, 1)}`} aria-label="Next month">›</Link></div></header><div className="calendar-grid">{weekdays.map((day) => <div key={day} className="weekday">{day}</div>)}{Array.from({ length: firstOffset }, (_, i) => <div key={`blank-${i}`} />)}{Array.from({ length: days }, (_, i) => {
    const day = i + 1; const dateKey = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`; const isSunday = new Date(`${dateKey}T00:00:00Z`).getUTCDay() === 0; const status = statuses[dateKey];
    const label = isSunday ? "Rest day" : status?.training === "ACHIEVED" ? "Goal achieved" : status?.training === "IN_PROGRESS" ? "In progress" : "Not started";
    return <Link href={`/dashboard?month=${year}-${String(month).padStart(2,"0")}&date=${dateKey}`} key={dateKey} aria-label={`${dateKey}, ${label}`} className={`calendar-day ${dateKey === todayKey ? "today" : ""} ${dateKey === selectedKey ? "selected" : ""} ${isSunday ? "sunday" : ""} ${status?.training === "ACHIEVED" ? "achieved" : ""}`}><span>{day}</span><small>{label}</small></Link>;
  })}</div></section>;
}
