// src/app/page.tsx
import Link from "next/link";

const skills = [
  { key: "reading", label: "Reading（読む）" },
  { key: "listening", label: "Listening（聞く）" },
  { key: "speaking", label: "Speaking（話す）" },
  { key: "writing", label: "Writing（書く）" },
  { key: "vocab", label: "Vocab（単語）" },
];

export default function Page() {
  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <h1 className="text-2xl font-bold">今日は何を勉強する？</h1>
      <div className="grid grid-cols-2 gap-3">
        {skills.map((s) => (
          <Link
            key={s.key}
            href={`/timer?skill=${s.key}`}
            className="rounded-xl border p-4 text-center shadow hover:bg-gray-50"
          >
            {s.label}
          </Link>
        ))}
      </div>
      <p className="text-sm text-gray-500">※ボタンを押すとストップウォッチが始まるよ</p>
    </main>
  );
}

