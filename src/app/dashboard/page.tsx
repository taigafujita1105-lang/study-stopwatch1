// src/app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// === JST（日本時間）で週範囲（月曜0:00〜翌月曜0:00） ===
const JST_MINUTES = 9 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

function toJst(d: Date) {
  return new Date(d.getTime() + JST_MINUTES * 60 * 1000);
}
function fromJst(d: Date) {
  return new Date(d.getTime() - JST_MINUTES * 60 * 1000);
}
function getWeekRangeJST(anchor = new Date()) {
  const j = toJst(anchor);
  const j0 = new Date(j);
  j0.setHours(0, 0, 0, 0);
  const day = j0.getDay(); // 0=Sun
  const diffToMonday = (day + 6) % 7; // Mon=0
  const startJ = new Date(j0.getTime() - diffToMonday * DAY_MS);
  const endJ = new Date(startJ.getTime() + 7 * DAY_MS);
  return {
    startJst: startJ,
    endJst: endJ,
    startIsoUtc: fromJst(startJ).toISOString(),
    endIsoUtc: fromJst(endJ).toISOString(),
  };
}
const youbi = ["日", "月", "火", "水", "木", "金", "土"];

type Session = {
  id: string;
  student_name: string;
  skill: "reading" | "listening" | "speaking" | "writing" | "vocab";
  started_at: string;
  ended_at: string;
  seconds: number;
  notes: string | null;
};

type Goals = {
  reading: number;
  listening: number;
  speaking: number;
  writing: number;
  vocab: number;
  total: number;
};

const DEFAULT_GOALS: Goals = {
  reading: 120,
  listening: 120,
  speaking: 60,
  writing: 60,
  vocab: 60,
  total: 360, // 合計（分）
};

export default function DashboardPage() {
  const supabase = createClient();

  // 週の切替・絞り込み
  const [weekOffset, setWeekOffset] = useState(0);
  const [studentFilter, setStudentFilter] = useState("");

  // 週の範囲（JST）
  const { startJst, endJst, startIsoUtc, endIsoUtc } = useMemo(() => {
    const base = new Date(Date.now() + weekOffset * 7 * DAY_MS);
    return getWeekRangeJST(base);
  }, [weekOffset]);

  // データフェッチ
  const [rows, setRows] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("study_sessions")
        .select("*")
        .gte("started_at", startIsoUtc)
        .lt("started_at", endIsoUtc)
        .order("started_at", { ascending: false })
        .limit(200);

      if (studentFilter.trim()) {
        q = q.ilike("student_name", `%${studentFilter.trim()}%`);
      }

      const { data, error } = await q;
      if (error) {
        console.error(error);
        setRows([]);
      } else {
        setRows((data as Session[]) ?? []);
      }
      setLoading(false);
    })();
  }, [supabase, startIsoUtc, endIsoUtc, studentFilter]);

  // 集計（分）
  const { totalMinutes, skillPie, dailyBars, minutesBySkill } = useMemo(() => {
    const skillMap = new Map<string, number>();
    const dayMap = new Map<number, number>();
    for (let i = 0; i < 7; i++) dayMap.set(i, 0);

    let total = 0;

    rows.forEach((r) => {
      const minutes = r.seconds / 60;
      total += minutes;
      skillMap.set(r.skill, (skillMap.get(r.skill) ?? 0) + minutes);

      const d = toJst(new Date(r.started_at));
      const mon0 = new Date(startJst);
      const dayIndex = Math.floor((d.getTime() - mon0.getTime()) / DAY_MS);
      if (dayIndex >= 0 && dayIndex < 7) {
        dayMap.set(dayIndex, (dayMap.get(dayIndex) ?? 0) + minutes);
      }
    });

    const pie = [
      { name: "Reading", key: "reading" },
      { name: "Listening", key: "listening" },
      { name: "Speaking", key: "speaking" },
      { name: "Writing", key: "writing" },
      { name: "Vocab", key: "vocab" },
    ].map(({ name, key }) => ({
      name,
      value: Math.round((skillMap.get(key) ?? 0) * 10) / 10,
    })).filter(d => d.value > 0);

    const bars = Array.from({ length: 7 }).map((_, i) => {
      const day = new Date(startJst.getTime() + i * DAY_MS);
      const label = `${youbi[day.getDay()]}`;
      const v = Math.round((dayMap.get(i) ?? 0) * 10) / 10;
      return { day: label, minutes: v };
    });

    const minutesBySkillObj: Goals = {
      reading: Math.round((skillMap.get("reading") ?? 0)),
      listening: Math.round((skillMap.get("listening") ?? 0)),
      speaking: Math.round((skillMap.get("speaking") ?? 0)),
      writing: Math.round((skillMap.get("writing") ?? 0)),
      vocab: Math.round((skillMap.get("vocab") ?? 0)),
      total: Math.round(total),
    };

    return {
      totalMinutes: Math.round(total),
      skillPie: pie,
      dailyBars: bars,
      minutesBySkill: minutesBySkillObj,
    };
  }, [rows, startJst]);

  // ===== 週の目標（ローカル保存） =====
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  useEffect(() => {
    const k = `ss_goals_v1`;
    const raw = localStorage.getItem(k);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Goals;
        setGoals({ ...DEFAULT_GOALS, ...parsed });
      } catch {}
    }
  }, []);
  const saveGoals = () => {
    localStorage.setItem("ss_goals_v1", JSON.stringify(goals));
    alert("目標を保存しました（このPCのブラウザに保存）");
  };

  const weekLabel = `${startJst.getMonth() + 1}/${startJst.getDate()}（${youbi[startJst.getDay()]}）〜 ${endJst.getMonth() + 1}/${endJst.getDate()}（${youbi[endJst.getDay()]}）`;

  const Progress = ({ now, goal }: { now: number; goal: number }) => {
    if (!goal || goal <= 0) {
      return <div className="text-sm text-gray-500">目標未設定</div>;
    }
    const pct = Math.max(0, Math.min(100, Math.round((now / goal) * 100)));
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span>{Math.round(now)} / {goal} 分</span>
          <span>{pct}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-black"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">先生ダッシュボード</h1>

      {/* 週範囲・絞り・合計 */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="text-gray-700">
          <div className="text-sm text-gray-500">対象週（JST）</div>
          <div className="text-lg">{weekLabel}</div>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="rounded-lg border px-3 py-2 shadow hover:bg-gray-50">← 前の週</button>
          <button onClick={() => setWeekOffset(0)} className="rounded-lg border px-3 py-2 shadow hover:bg-gray-50">今週</button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="rounded-lg border px-3 py-2 shadow hover:bg-gray-50">次の週 →</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:w-64">
          <label className="block text-sm text-gray-600">生徒名で絞り込み（部分一致）</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder="例：Sato / Tanaka / A"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
          />
        </div>
        <div className="flex-1 rounded-xl border p-4 shadow">
          <div className="text-sm text-gray-500">週の合計時間</div>
          <div className="text-3xl font-bold">{Math.round(totalMinutes)} 分</div>
        </div>
      </div>

      {/* 週の目標（分） */}
      <div className="rounded-xl border p-4 shadow space-y-3">
        <div className="font-medium">週の目標（分）</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(["reading","listening","speaking","writing","vocab"] as const).map(k => (
            <label key={k} className="text-sm">
              <span className="block mb-1 capitalize">{k}</span>
              <input
                type="number"
                min={0}
                className="w-full rounded-md border px-3 py-2"
                value={goals[k]}
                onChange={(e) => setGoals(g => ({ ...g, [k]: Number(e.target.value) }))}
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="block mb-1">Total</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-md border px-3 py-2"
              value={goals.total}
              onChange={(e) => setGoals(g => ({ ...g, total: Number(e.target.value) }))}
            />
          </label>
        </div>
        <button onClick={saveGoals} className="rounded-lg border px-3 py-2 shadow hover:bg-gray-50">目標を保存</button>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-sm font-medium">技能別 達成状況</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-600">Reading</div>
                <Progress now={minutesBySkill.reading} goal={goals.reading} />
              </div>
              <div>
                <div className="text-xs text-gray-600">Listening</div>
                <Progress now={minutesBySkill.listening} goal={goals.listening} />
              </div>
              <div>
                <div className="text-xs text-gray-600">Speaking</div>
                <Progress now={minutesBySkill.speaking} goal={goals.speaking} />
              </div>
              <div>
                <div className="text-xs text-gray-600">Writing</div>
                <Progress now={minutesBySkill.writing} goal={goals.writing} />
              </div>
              <div>
                <div className="text-xs text-gray-600">Vocab</div>
                <Progress now={minutesBySkill.vocab} goal={goals.vocab} />
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">合計 達成状況</div>
            <Progress now={minutesBySkill.total} goal={goals.total} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 技能別ドーナツ */}
        <div className="rounded-xl border p-4 shadow">
          <div className="font-medium mb-2">技能別の配分（分）</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={skillPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {skillPie.map((_, i) => <Cell key={i} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 日別合計（棒グラフ） */}
        <div className="rounded-xl border p-4 shadow">
          <div className="font-medium mb-2">日別の合計（分）</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="minutes" name="分">
                  {dailyBars.map((_, i) => <Cell key={i} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* この週の履歴 */}
      <div className="rounded-xl border p-4 shadow">
        <div className="font-medium mb-2">この週の履歴（最大20件）</div>
        {loading ? (
          <p>読み込み中...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-500">まだ記録がありません。</p>
        ) : (
          <ul className="space-y-3">
            {rows.slice(0, 20).map((r) => (
              <li key={r.id} className="rounded-lg border p-3">
                <div className="flex justify-between">
                  <div className="font-medium">{r.student_name}</div>
                  <div className="text-sm text-gray-500">
                    {toJst(new Date(r.started_at)).toLocaleString("ja-JP")}
                  </div>
                </div>
                <div className="text-sm mt-1">
                  技能：{r.skill} ／ {Math.ceil(r.seconds / 60)}分（{r.seconds}秒）
                </div>
                {r.notes && <div className="text-sm text-gray-700 mt-1">メモ：{r.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
// Removed duplicate default export TimerPage