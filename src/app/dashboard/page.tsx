import { MonthCalendar, type CalendarStatus } from "@/components/month-calendar";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { dateOnlyUtc, getAppTimeZone, monthBounds, zonedDateParts } from "@/lib/time";
import { submitSciTechRatingAction } from "./actions";
import { getWeeklyTeamStats } from "@/lib/analytics/weekly";
import { TeamCharts } from "@/components/team-charts";
import { SciTechAssessment } from "@/components/sci-tech-assessment";
import { PresentationCenter } from "@/components/presentation-center";
import { PresentationAlert } from "@/components/presentation-alert";

function validMonth(value: string | undefined) { const match = /^(\d{4})-(\d{2})$/.exec(value ?? ""); if (!match) return null; const month = Number(match[2]); return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null; }
function key(date: Date) { return date.toISOString().slice(0, 10); }

const notices: Record<string, string> = {
  "rest-day": "Sunday is a rest day, so training cannot be started.",
  "no-sentences": "There are no active training sentences. Please contact an administrator.",
  "start-failed": "The training session could not be started. Please try again.",
  "presentation-uploaded": "Your presentation file was uploaded successfully.",
  "presentation-file-required": "Choose a presentation file to upload.",
  "presentation-upload-forbidden": "You cannot upload a file for this presentation.",
  "presentation-deadline-passed": "The upload deadline has passed. Contact an administrator.",
  "presentation-invalid-file": "Upload a valid PPT, PPTX or PDF file.",
  "presentation-file-size": "The presentation file must be 30 MB or smaller.",
  "presentation-upload-failed": "The presentation file could not be stored.",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string; notice?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await db.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const weekly = await getWeeklyTeamStats(new Date(), settings.timeZone);
  const today = zonedDateParts(new Date(), settings.timeZone || getAppTimeZone());
  const todayDate = dateOnlyUtc(today.year, today.month, today.day);
  const todayPresentation = await db.sciTechPresentation.findUnique({ where: { localDate: todayDate }, select: { id: true, presenterId: true, presenter: { select: { name: true } }, ratings: { where: { evaluatorId: user.id }, select: { id: true } } } });
  const upcomingPresentations = await db.sciTechPresentation.findMany({ where: { localDate: { gte: todayDate } }, orderBy: { localDate: "asc" }, take: 8, include: { presenter: { select: { name: true } }, files: { where: { active: true }, orderBy: { version: "desc" }, take: 1 } } });
  const presentationCards = upcomingPresentations.map((item) => ({ id: item.id, title: item.title, description: item.description, date: item.localDate.toISOString().slice(0,10), deadline: item.submissionDeadline?.toLocaleString("en-GB", { timeZone: settings.timeZone, dateStyle: "medium", timeStyle: "short" }) ?? null, presenter: item.presenter.name, isMine: item.presenterId === user.id, canUpload: !item.submissionDeadline || new Date() <= item.submissionDeadline, file: item.files[0] ? { name: item.files[0].originalName, uploadedAt: item.files[0].uploadedAt.toISOString() } : null }));
  const missingMine = presentationCards.find((item) => item.isMine && !item.file);
  const viewed = validMonth(params.month) ?? { year: today.year, month: today.month };
  const todayKey = `${today.year}-${String(today.month).padStart(2,"0")}-${String(today.day).padStart(2,"0")}`;
  const selectedKey = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : todayKey;
  const bounds = monthBounds(viewed.year, viewed.month);
  const progress = await db.dailyProgress.findMany({ where: { userId: user.id, localDate: { gte: bounds.start, lt: bounds.end } } });
  const statuses: Record<string, CalendarStatus> = {};
  for (const item of progress) statuses[key(item.localDate)] = { training: (item.adminPassed ?? item.goalAchieved) ? "ACHIEVED" : item.passedCount > 0 ? "IN_PROGRESS" : undefined };
  const selected = statuses[selectedKey];
  const weekday = today.weekday;
  const teamAverage = weekly.leaderboard.length ? weekly.leaderboard.reduce((sum, row) => sum + row.trainingAverage, 0) / weekly.leaderboard.length : 0;
  const achievedDays = weekly.leaderboard.reduce((sum,row) => sum + row.completionDays,0);

  return <main className="dashboard figma-dashboard">
    {missingMine && <PresentationAlert id={missingMine.id} message={`Your presentation “${missingMine.title}” is scheduled for ${missingMine.date}. Upload your presentation by ${missingMine.deadline ?? "the previous day"}.`} />}
    <header className="dashboard-title"><div><p className="eyebrow">OVERVIEW</p><h1>Dashboard</h1></div><div className="date-chip"><span>Selected date</span><strong>{selectedKey}</strong></div></header>
    {params.notice && notices[params.notice] && <p className="form-error" role="alert">{notices[params.notice]}</p>}
    <div className="figma-dashboard-grid">
      <div className="dashboard-main-column">
        <section className="dashboard-hero-card">
          <div><p className="eyebrow">TODAY&apos;S SESSION</p><h2>{weekday === "Sun" ? "Take time to recharge" : `Welcome back, ${user.name}`}</h2><p>{weekday === "Sun" ? "Review your progress and get ready for a new week." : `${settings.trainingQuestionCount} sentences · ${settings.trainingTimeLimitSec} seconds each · ${settings.trainingPassScore.toString()} pass score`}</p></div>
          <div className="hero-actions"><form action="/training/start" method="post"><button disabled={weekday === "Sun"}>{selected?.training === "IN_PROGRESS" ? "Continue training" : "Start training"} <span>→</span></button></form><SciTechAssessment presentation={todayPresentation ? { id: todayPresentation.id, presenterName: todayPresentation.presenter.name, canRate: todayPresentation.presenterId !== user.id && todayPresentation.ratings.length === 0, reason: todayPresentation.presenterId === user.id ? "You cannot rate your own presentation." : "Your score has already been submitted and cannot be changed." } : { id: "", presenterName: "today's presenter", canRate: false, reason: "No presenter has been scheduled for today. Ask an administrator to schedule one." }} action={submitSciTechRatingAction} /></div>
        </section>
        <PresentationCenter presentations={presentationCards} />
        <section className="dashboard-activity panel">
          <header className="activity-heading"><div><p className="eyebrow">TEAM PULSE · {weekly.weekKey}</p><h2>Weekly performance</h2></div><span className="status-badge">{weekly.formal ? "Final ranking" : "Live ranking"}</span></header>
          <div className="summary-strips"><div><span>Team average</span><strong>{teamAverage.toFixed(2)}</strong></div><div><span>Goals achieved</span><strong>{achievedDays}</strong></div><div><span>Participants</span><strong>{weekly.leaderboard.length}</strong></div></div>
          <TeamCharts leaderboard={weekly.leaderboard} presentations={weekly.presentationAverages} />
          <div className="leaderboard"><h3>Leaderboard</h3>{weekly.leaderboard.map((row) => <article key={row.userId}><strong className="rank">{row.rank}</strong><span>{row.name} <i className={row.change === null ? "flat" : row.change >= 0 ? "up" : "down"}>{row.change === null ? "—" : `${row.change >= 0 ? "▲" : "▼"} ${Math.abs(row.change).toFixed(2)}`}</i></span><small>Training {row.trainingAverage.toFixed(2)} · {row.completionDays} days completed</small><b>{row.overall.toFixed(1)}</b></article>)}</div>
        </section>
      </div>
      <aside className="dashboard-right-column">
        <MonthCalendar year={viewed.year} month={viewed.month} todayKey={todayKey} selectedKey={selectedKey} statuses={statuses} />
        <section className="profile-card panel"><div className="profile-avatar">{user.name.slice(0,1).toUpperCase()}</div><strong>{user.name}</strong><span>{user.role === "ADMIN" ? "Administrator" : "English learner"}</span><div className="profile-actions"><span>⌕</span><span>✉</span><span>■</span></div></section>
      </aside>
    </div>
  </main>;
}
