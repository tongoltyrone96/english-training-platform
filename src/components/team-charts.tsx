"use client";

import { Bar, BarChart, Cell, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LeaderboardRow } from "@/lib/analytics/leaderboard";

const colors = ["#6263cf", "#63ba6c", "#62abe0", "#e657a5", "#ffc14f", "#f2655b", "#48b8aa", "#9b6ed5", "#ef8d4d", "#7b8fae"];

export function TeamCharts({ leaderboard, presentations }: { leaderboard: LeaderboardRow[]; presentations: Array<{ presenterId: string; presenter: string; average: number | null; ratingCount: number; evaluatorCount: number }> }) {
  const pieData = leaderboard.map((row) => ({ name: row.name, average: row.trainingAverage, value: row.trainingAverage || 0.05 }));
  const final = leaderboard[0]?.formal ?? false;
  const assessmentData = leaderboard.map((member) => {
    const result = presentations.find((item) => item.presenterId === member.userId);
    return { userId: member.userId, presenter: member.name, average: result?.average ?? null, ratingCount: result?.ratingCount ?? 0, evaluatorCount: result?.evaluatorCount ?? Math.max(leaderboard.length - 1, 0) };
  });
  return <div className="analytics-layout"><div className="chart-card weekly-pie-card"><h3>{final ? "Final weekly average" : "Live weekly average"}</h3>{pieData.length ? <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="46%" outerRadius={92} stroke="#fff" strokeWidth={2} label={({ name, average }) => `${name} ${Number(average).toFixed(2)}`} labelLine>{pieData.map((row, index) => <Cell key={row.name} fill={row.average ? colors[index % colors.length] : "#d8d9e5"} />)}</Pie><Tooltip formatter={(_, __, item) => [`${Number(item.payload.average).toFixed(2)} / 5.00`, "Weekly average"]} /><Legend /></PieChart></ResponsiveContainer> : <div className="chart-empty">No team members</div>}</div><div className="chart-card"><h3>Sci-Tech presentation scores</h3>{assessmentData.length ? <ResponsiveContainer width="100%" height={280}><BarChart data={assessmentData} margin={{ top: 12, right: 10, left: -20, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="presenter" interval={0} angle={-25} textAnchor="end" height={58} tick={{ fontSize: 10 }} /><YAxis domain={[0,5]} /><Tooltip formatter={(value, _, item) => value == null ? ["Not assessed", "Average"] : [`${Number(value).toFixed(2)} / 5.00 (${item.payload.ratingCount}/${item.payload.evaluatorCount} submitted)`, "Average"]} /><Bar dataKey="average" barSize={16} maxBarSize={16} fill="#6263cf" radius={[5,5,0,0]}>{assessmentData.map((item, index) => <Cell key={item.userId} fill={colors[index % colors.length]} />)}</Bar></BarChart></ResponsiveContainer> : <div className="chart-empty">No team members</div>}</div></div>;
}
