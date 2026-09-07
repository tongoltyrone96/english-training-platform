import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { scheduleSciTechPresentationAction, toggleInvitationAction, updateUserAction } from "./actions";
import { DocxImporter } from "@/components/admin/docx-importer";
import { SettingsForm } from "@/components/admin/settings-form";
import { InvitationForm } from "@/components/admin/invitation-form";
import { SciTechPresentationForm } from "@/components/admin/sci-tech-presentation-form";
import { PresentationHistory } from "@/components/admin/presentation-history";
import { DailyTrainingManager } from "@/components/admin/daily-training-manager";
import { dateOnlyUtc, zonedDateParts } from "@/lib/time";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ trainingDate?: string }> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const [settings, imports, logs, users, invitations, presentations] = await Promise.all([
    db.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    db.documentImport.findMany({ orderBy: { createdAt: "desc" }, take: 3 }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true } } } }),
    db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, status: true } }),
    db.invitation.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    db.sciTechPresentation.findMany({ orderBy: { localDate: "desc" }, include: { presenter: { select: { name: true } }, ratings: { select: { score: true } }, files: { where: { active: true }, orderBy: { version: "desc" }, take: 1 } } }),
  ]);
  const now = zonedDateParts(new Date(), settings.timeZone); const fallbackDate = `${now.year}-${String(now.month).padStart(2,"0")}-${String(now.day).padStart(2,"0")}`; const trainingDate = /^\d{4}-\d{2}-\d{2}$/.test(params.trainingDate ?? "") ? params.trainingDate! : fallbackDate; const [year, month, day] = trainingDate.split("-").map(Number); const selectedTrainingDate = dateOnlyUtc(year, month, day);
  const [dailyProgress, dailyEvaluations] = await Promise.all([
    db.dailyProgress.findMany({ where: { localDate: selectedTrainingDate } }),
    db.evaluationResult.findMany({ where: { trainingAttempt: { sessionItem: { session: { localDate: selectedTrainingDate } } } }, select: { finalScore: true, trainingAttempt: { select: { userId: true } } } }),
  ]);
  const dailyRows = users.map((member) => { const progress = dailyProgress.find((item) => item.userId === member.id); const scores = dailyEvaluations.filter((item) => item.trainingAttempt?.userId === member.id).map((item) => Number(item.finalScore)); return { id: member.id, name: member.name, email: member.email, assigned: progress?.assignedCount ?? 0, passed: progress?.passedCount ?? 0, actualPassed: progress?.goalAchieved ?? false, actualScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 100) / 100 : null, adminPassed: progress?.adminPassed ?? null, adminScore: progress?.adminScore == null ? null : Number(progress.adminScore) }; });
  const activeEvaluatorCount = Math.max(users.filter((member) => member.status === "ACTIVE").length - 1, 0);
  const history = presentations.map((item) => { const evaluatorCount = item.eligibleEvaluatorCount ?? activeEvaluatorCount; const total = item.ratings.reduce((sum, rating) => sum + Number(rating.score), 0); return { id: item.id, date: item.localDate.toISOString().slice(0,10), weekday: new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(item.localDate), presenter: item.presenter.name, title: item.title, submittedAt: item.submittedAt?.toISOString() ?? null, fileName: item.files[0]?.originalName ?? null, ratingCount: item.ratings.length, evaluatorCount, average: evaluatorCount ? Math.round(total / evaluatorCount * 100) / 100 : 0 }; });
  return <main className="dashboard figma-dashboard admin-dashboard"><header className="admin-title"><div><p className="eyebrow">ADMIN CONSOLE</p><h1>Workspace settings</h1><p>Manage training content, team access and daily presentation settings.</p></div><div className="admin-title-mark">A</div></header><div className="admin-sections">
    <section className="panel admin-section daily-training-panel"><header className="panel-heading"><div><p className="eyebrow">DAILY TRAINING CONTROL</p><h2>Team training results</h2></div><span className="status-badge">All dates · Editable</span></header><DailyTrainingManager date={trainingDate} rows={dailyRows} /></section>
    <section className="panel admin-section"><header className="panel-heading"><div><p className="eyebrow">SCI-TECH ASSESSMENT</p><h2>Weekly presentation schedule</h2></div><span className="status-badge">One presenter per day</span></header><SciTechPresentationForm users={users.filter((member) => member.status === "ACTIVE").map(({ id, name }) => ({ id, name }))} action={scheduleSciTechPresentationAction} /></section>
    <section className="panel admin-section presentation-history-panel"><header className="panel-heading"><div><p className="eyebrow">PRESENTATION ARCHIVE</p><h2>Presentation history</h2></div><span className="status-badge">Weekly · Monthly</span></header><PresentationHistory rows={history} /></section>
    <section className="panel admin-section"><header className="panel-heading"><div><p className="eyebrow">DOCX IMPORT</p><h2>문장 가져오기</h2></div><span className="status-badge">.docx · 5MB</span></header><DocxImporter />{imports.length > 0 && <div className="import-history">{imports.map((item) => <span key={item.id}>{item.fileName} · {item.status} · {item.importedCount}개</span>)}</div>}</section>
    <section className="panel admin-section"><header className="panel-heading"><div><p className="eyebrow">TRAINING RULES</p><h2>전역 설정</h2></div></header><SettingsForm settings={{ ...settings, trainingPassScore: settings.trainingPassScore.toString() }} /></section>
    <section className="panel admin-section"><header className="panel-heading"><div><p className="eyebrow">TEAM ACCESS</p><h2>사용자와 초대코드</h2></div></header><InvitationForm /><div className="invitation-list">{invitations.map((invitation) => <form action={toggleInvitationAction} key={invitation.id}><span><strong>{invitation.label}</strong><small>{invitation.uses}/{invitation.maxUses}회 · {invitation.active ? "활성" : "비활성"}</small></span><input type="hidden" name="id" value={invitation.id} /><button className="ghost-button">{invitation.active ? "중지" : "활성화"}</button></form>)}</div><div className="user-list">{users.map((member) => <form action={updateUserAction} key={member.id}><span><strong>{member.name}{member.id === admin.id ? " (현재 사용자)" : ""}</strong><small>{member.email}</small></span><input type="hidden" name="id" value={member.id} /><select name="role" defaultValue={member.role} disabled={member.id === admin.id}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select><select name="status" defaultValue={member.status} disabled={member.id === admin.id}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select><button className="ghost-button" disabled={member.id === admin.id}>저장</button></form>)}</div></section>
    <section className="panel admin-section"><header className="panel-heading"><div><p className="eyebrow">AUDIT</p><h2>최근 관리자 작업</h2></div></header><div className="audit-list">{logs.length === 0 ? <p className="muted">기록이 없습니다.</p> : logs.map((log) => <div key={log.id}><strong>{log.action}</strong><span>{log.actor.name} · {log.createdAt.toLocaleString("ko-KR")}</span></div>)}</div></section></div>
  </main>;
}
