"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, key);
};

type Session = {
  id: string;
  student_name: string;
  skill: string;
  started_at: string;
  ended_at: string;
  seconds: number;
  notes: string | null;
};

export default function HistoryPage() {
  const [rows, setRows] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (!error && data) setRows(data as Session[]);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-xl font-bold">履歴（最新20件）</h1>
      {loading && <p>読み込み中...</p>}
      {!loading && rows.length === 0 && <p>まだ記録がありません。</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border p-4 shadow">
            <div className="flex justify-between">
              <div className="font-medium">{r.student_name}</div>
              <div className="text-sm text-gray-500">
                {new Date(r.started_at).toLocaleString()}
              </div>
            </div>
            <div className="text-sm mt-1">
              技能：{r.skill} ／ 時間：{Math.ceil(r.seconds / 60)}分（{r.seconds}秒）
            </div>
            {r.notes && <div className="text-sm text-gray-700 mt-1">メモ：{r.notes}</div>}
          </li>
        ))}
      </ul>
      <Link href="/" className="text-sm text-gray-500 hover:underline">← ホームへ</Link>
      <Link href="/" className="text-sm text-gray-500 hover:underline">← ホームへ</Link>
    </main>
  );
}
