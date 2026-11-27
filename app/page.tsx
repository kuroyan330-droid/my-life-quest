"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, PointerEvent, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabase";

/* =========================================================
   型定義
========================================================= */

type Difficulty = "EASY" | "NORMAL" | "HARD" | "VERY_HARD" | "EXPERT";

type Status = "未着手" | "進行中" | "審査待ち" | "修正依頼" | "承認済み";

type Requirement = {
  id: number;
  text: string;
  completed: boolean;
};

type HistoryItem = {
  date: string;
  action: string;
  comment: string;
};

type Mission = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  xp: number;
  cashReward: number;
  requirements: Requirement[]; // 達成条件
  status: Status;
  evidence: string;
  reviewComment: string;
  paymentStatus: "未払い" | "支払済み";
  approvedAt?: string; // 承認日時（週間グラフの集計に使用）
  paidAt?: string;
  history: HistoryItem[];
};

type Settings = {
  online: boolean;
  weeklyGoal: number;
  openingDate: string; // YYYY-MM-DD
};

type QuestData = {
  missions: Mission[];
  deletedMissions: Mission[];
  xp: number;
  settings: Settings;
};

type MissionInput = {
  title: string;
  description: string;
  difficulty: Difficulty;
  cashReward: number;
  requirements: Requirement[];
};

type Tab = "home" | "offers" | "active" | "earnings" | "manage";

type MissionActions = {
  start: (id: string) => void;
  toggleRequirement: (id: string, requirementId: number, checked: boolean) => void;
  submit: (id: string, evidence: string) => void;
  approve: (id: string) => void;
  requestRevision: (id: string, comment: string) => void;
  cancelApproval: (id: string) => void;
  markPaid: (id: string) => void;
  edit: (id: string) => void;
  remove: (id: string) => void;
};

/* =========================================================
   定数
========================================================= */

const STORAGE_KEY = "myLifeQuest";
const BACKUP_KEY = "myLifeQuest_backup";

const DIFFICULTIES: Difficulty[] = ["EASY", "NORMAL", "HARD", "VERY_HARD", "EXPERT"];

const DIFFICULTY: Record<Difficulty, { label: string; xp: number; stars: number; badge: string }> = {
  EASY: { label: "EASY", xp: 20, stars: 1, badge: "bg-emerald-100 text-emerald-800" },
  NORMAL: { label: "NORMAL", xp: 50, stars: 2, badge: "bg-sky-100 text-sky-800" },
  HARD: { label: "HARD", xp: 100, stars: 3, badge: "bg-orange-100 text-orange-800" },
  VERY_HARD: { label: "VERY HARD", xp: 200, stars: 4, badge: "bg-red-100 text-red-800" },
  EXPERT: { label: "EXPERT", xp: 300, stars: 5, badge: "bg-purple-100 text-purple-800" },
};

const STATUS_BADGE: Record<Status, string> = {
  未着手: "bg-slate-100 text-slate-700",
  進行中: "bg-sky-100 text-sky-800",
  審査待ち: "bg-amber-100 text-amber-800",
  修正依頼: "bg-orange-100 text-orange-800",
  承認済み: "bg-emerald-100 text-emerald-800",
};

const DEFAULT_SETTINGS: Settings = {
  online: false,
  weeklyGoal: 3,
  openingDate: "",
};

const INITIAL_DATA: QuestData = {
  missions: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      title: "税理士候補を3事務所調査する",
      description: "医療機関の支援実績・費用・サービス内容を比較表にまとめる",
      difficulty: "NORMAL",
      xp: 50,
      cashReward: 3000,
      requirements: [],
      status: "未着手",
      evidence: "",
      reviewComment: "",
      paymentStatus: "未払い",
      history: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      title: "クリニック理念の資料を完成させる",
      description: "兄の考えを反映したクリニックの理念・基本方針を資料にまとめる",
      difficulty: "HARD",
      xp: 100,
      cashReward: 10000,
      requirements: [],
      status: "未着手",
      evidence: "",
      reviewComment: "",
      paymentStatus: "未払い",
      history: [],
    },
  ],
  deletedMissions: [],
  xp: 0,
  settings: DEFAULT_SETTINGS,
};

/* =========================================================
   共通関数
========================================================= */

function yen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // http://192.168.x.x などでスマホ確認する場合の代替
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

function withHistory(mission: Mission, action: string, comment: string): Mission {
  return {
    ...mission,
    history: [...mission.history, { date: new Date().toLocaleString("ja-JP"), action, comment }],
  };
}

function parseJapaneseDate(text: string | undefined): string | undefined {
  const match = text?.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).toISOString();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// 週の始まりは月曜日
function startOfWeek(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function isApprovedBetween(mission: Mission, from: Date, to: Date) {
  if (mission.status !== "承認済み" || !mission.approvedAt) return false;
  const time = new Date(mission.approvedAt).getTime();
  return time >= from.getTime() && time < to.getTime();
}

function sumReward(missions: Mission[]) {
  return missions.reduce((total, m) => total + m.cashReward, 0);
}

function isUnpaid(m: Mission) {
  return m.status === "承認済み" && m.paymentStatus === "未払い";
}

function canEdit(m: Mission) {
  return (
    (m.status === "未着手" || m.status === "進行中" || m.status === "修正依頼") &&
    m.paymentStatus === "未払い"
  );
}

function canDelete(m: Mission) {
  return m.status !== "承認済み" && m.paymentStatus !== "支払済み";
}

// 保存データ（旧バージョン含む）を安全な形に整える
function normalizeMission(raw: unknown): Mission | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<Mission>;
  const difficulty: Difficulty =
    m.difficulty && DIFFICULTIES.includes(m.difficulty) ? m.difficulty : "NORMAL";
  const status: Status =
    m.status && Object.keys(STATUS_BADGE).includes(m.status) ? m.status : "未着手";
  const history = Array.isArray(m.history) ? m.history : [];
  const approvalEntry = [...history].reverse().find((h) => h.action === "承認");

  return {
    id: m.id ? String(m.id) : newId(),
    title: m.title ?? "無題のクエスト",
    description: m.description ?? "",
    difficulty,
    xp: m.xp ?? DIFFICULTY[difficulty].xp,
    cashReward: m.cashReward ?? 3000,
    requirements: Array.isArray(m.requirements) ? m.requirements : [],
    status,
    evidence: m.evidence ?? "",
    reviewComment: m.reviewComment ?? "",
    paymentStatus: m.paymentStatus ?? "未払い",
    approvedAt:
      status === "承認済み"
        ? m.approvedAt ?? parseJapaneseDate(approvalEntry?.date) ?? parseJapaneseDate(m.paidAt)
        : undefined,
    paidAt: m.paidAt,
    history,
  };
}

function normalizeData(raw: unknown): QuestData {
  if (!raw || typeof raw !== "object") throw new Error("データ形式が正しくありません");
  const data = raw as Partial<QuestData>;
  if (!Array.isArray(data.missions)) throw new Error("クエスト一覧がありません");

  const clean = (list: unknown[]) =>
    list.map(normalizeMission).filter((m): m is Mission => m !== null);

  return {
    missions: clean(data.missions),
    deletedMissions: Array.isArray(data.deletedMissions) ? clean(data.deletedMissions) : [],
    xp: typeof data.xp === "number" ? data.xp : 0,
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
  };
}

/* =========================================================
   共通UI部品
========================================================= */

const ICON_PATHS = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v10h13V10",
  offers: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  active: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  earnings: "M6 4l6 8 6-8M12 12v8M8 13h8M8 17h8",
  manage: "M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5v5M8 14.5v5",
  close: "M6 6l12 12M18 6 6 18",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "M5 12.5 10 17l9-10",
  plus: "M12 5v14M5 12h14",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
};

function Icon({ name, className = "h-6 w-6" }: { name: keyof typeof ICON_PATHS; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${className}`}>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>
      {children}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function Sheet({
  title,
  onClose,
  closeOnBackdrop = true,
  children,
}: {
  title: string;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      onClick={() => closeOnBackdrop && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-full bg-slate-100 p-2"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-8 pt-4">{children}</div>
      </div>
    </div>
  );
}

// 右へスワイプして確定するボタン（キーボードはEnterで実行）
function SlideButton({ label, onComplete }: { label: string; onComplete: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number | null>(null);
  const [x, setX] = useState(0);

  const maxX = () => Math.max(0, (trackRef.current?.clientWidth ?? 0) - 64);
  const clamp = (value: number) => Math.min(maxX(), Math.max(0, value));

  const handleDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = e.clientX;
  };

  const handleMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (startRef.current === null) return;
    setX(clamp(e.clientX - startRef.current));
  };

  const handleUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (startRef.current === null) return;
    const distance = clamp(e.clientX - startRef.current);
    startRef.current = null;
    setX(0);
    if (maxX() > 0 && distance >= maxX() * 0.8) onComplete();
  };

  return (
    <div ref={trackRef} className="relative h-16 select-none overflow-hidden rounded-full bg-emerald-600">
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center pl-10 font-black text-white">
        {label}
      </span>
      <button
        type="button"
        aria-label={label}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => {
          startRef.current = null;
          setX(0);
        }}
        onClick={(e) => {
          if (e.detail === 0) onComplete(); // キーボード操作
        }}
        className="absolute left-1 top-1 flex h-14 w-14 cursor-grab touch-none items-center justify-center rounded-full bg-white text-emerald-700 shadow-lg"
        style={{ transform: `translateX(${x}px)` }}
      >
        <Icon name="arrow" />
      </button>
    </div>
  );
}

function Stepper({ mission }: { mission: Mission }) {
  const steps = ["受注", "作業", "審査", "承認", "入金"];
  const current =
    mission.paymentStatus === "支払済み"
      ? 5
      : mission.status === "承認済み"
        ? 4
        : mission.status === "審査待ち"
          ? 2
          : mission.status === "未着手"
            ? 0
            : 1;

  return (
    <ol className="flex">
      {steps.map((step, index) => (
        <li key={step} className="relative flex flex-1 flex-col items-center">
          {index > 0 && (
            <span
              className={`absolute right-1/2 top-[11px] h-0.5 w-full ${
                index <= current ? "bg-emerald-500" : "bg-slate-200"
              }`}
            />
          )}
          <span
            className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              index < current
                ? "bg-emerald-500 text-white"
                : index === current
                  ? "bg-slate-900 text-white"
                  : "bg-slate-200 text-slate-500"
            }`}
          >
            {index < current ? <Icon name="check" className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <span className="mt-1 text-[11px] text-slate-500">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function MissionCard({
  mission,
  onOpen,
  children,
}: {
  mission: Mission;
  onOpen: () => void;
  children?: ReactNode;
}) {
  const done = mission.requirements.filter((r) => r.completed).length;

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <p className="text-3xl font-black tracking-tight">{yen(mission.cashReward)}</p>
          <Badge className={STATUS_BADGE[mission.status]}>
            {mission.paymentStatus === "支払済み" ? "支払済み" : mission.status}
          </Badge>
        </div>
        <p className="mt-2 break-words font-bold">{mission.title}</p>
        {mission.description && (
          <p className="mt-1 line-clamp-2 break-words text-sm text-slate-500">{mission.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge className={DIFFICULTY[mission.difficulty].badge}>
            {DIFFICULTY[mission.difficulty].label} {"★".repeat(DIFFICULTY[mission.difficulty].stars)}
          </Badge>
          <span className="font-bold">+{mission.xp} XP</span>
          {mission.requirements.length > 0 && (
            <span>
              達成条件 {done}/{mission.requirements.length}
            </span>
          )}
        </div>
      </button>
      {children && <div className="mt-4">{children}</div>}
    </article>
  );
}

/* =========================================================
   クエスト詳細
========================================================= */

function MissionDetail({
  mission,
  reviewer,
  actions,
}: {
  mission: Mission;
  reviewer: boolean;
  actions: MissionActions;
}) {
  const [evidence, setEvidence] = useState(mission.evidence);
  const [comment, setComment] = useState("");

  const working = mission.status === "進行中" || mission.status === "修正依頼";
  const done = mission.requirements.filter((r) => r.completed).length;
  const allDone = done === mission.requirements.length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-4xl font-black">{yen(mission.cashReward)}</p>
        <p className="mt-2 break-words text-lg font-bold">{mission.title}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">
          {mission.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className={STATUS_BADGE[mission.status]}>{mission.status}</Badge>
          <Badge className={DIFFICULTY[mission.difficulty].badge}>
            {DIFFICULTY[mission.difficulty].label}
          </Badge>
          <Badge className="bg-slate-100 text-slate-700">+{mission.xp} XP</Badge>
          <Badge className="bg-slate-100 text-slate-700">支払い：{mission.paymentStatus}</Badge>
        </div>
      </div>

      <Stepper mission={mission} />

      {mission.reviewComment && (
        <div
          className={`rounded-xl p-4 ${
            mission.status === "修正依頼" ? "bg-orange-50" : "bg-sky-50"
          }`}
        >
          <p className="text-xs font-bold text-slate-500">審査コメント</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{mission.reviewComment}</p>
        </div>
      )}

      {mission.requirements.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-bold">
            <span>達成条件</span>
            <span>
              {done} / {mission.requirements.length}
            </span>
          </div>
          <ProgressBar value={done} max={mission.requirements.length} />
          {mission.requirements.map((requirement) => (
            <label
              key={requirement.id}
              className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm"
            >
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-emerald-600"
                checked={requirement.completed}
                disabled={!working || reviewer}
                onChange={(e) =>
                  actions.toggleRequirement(mission.id, requirement.id, e.target.checked)
                }
              />
              <span
                className={`break-words ${requirement.completed ? "text-slate-400 line-through" : ""}`}
              >
                {requirement.text}
              </span>
            </label>
          ))}
        </div>
      )}

      {mission.evidence && !(working && !reviewer) && (
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-500">提出した成果物</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{mission.evidence}</p>
        </div>
      )}

      {/* ---------- 作業者の操作 ---------- */}
      {!reviewer && mission.status === "未着手" && (
        <SlideButton label="スワイプして受注・作業開始" onComplete={() => actions.start(mission.id)} />
      )}

      {!reviewer && working && (
        <div className="space-y-3">
          <label className="block text-sm font-bold">
            成果物の内容・ファイルの保存先
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={3}
              placeholder="例：共有フォルダ「税理士比較表」"
              className="mt-2 w-full rounded-xl bg-slate-100 p-3 text-base font-normal"
            />
          </label>
          {allDone && evidence.trim() ? (
            <SlideButton
              label={mission.status === "修正依頼" ? "スワイプして再提出" : "スワイプして提出"}
              onComplete={() => actions.submit(mission.id, evidence)}
            />
          ) : (
            <p className="rounded-full bg-slate-200 p-5 text-center text-sm font-bold text-slate-500">
              {!allDone ? "すべての達成条件を完了してください" : "成果物を入力してください"}
            </p>
          )}
        </div>
      )}

      {!reviewer && mission.status === "審査待ち" && (
        <p className="rounded-xl bg-amber-50 p-4 text-center text-sm font-bold text-amber-800">
          審査待ちです。承認者は「管理」タブから審査してください。
        </p>
      )}

      {/* ---------- 承認者の操作 ---------- */}
      {reviewer && mission.status === "審査待ち" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => actions.approve(mission.id)}
            className="w-full rounded-full bg-emerald-600 p-4 font-black text-white"
          >
            承認する
          </button>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="修正してほしい内容"
            className="w-full rounded-xl bg-slate-100 p-3"
          />
          <button
            type="button"
            disabled={!comment.trim()}
            onClick={() => actions.requestRevision(mission.id, comment)}
            className="w-full rounded-full bg-orange-500 p-4 font-black text-white disabled:bg-slate-300"
          >
            修正を依頼する
          </button>
        </div>
      )}

      {!reviewer && isUnpaid(mission) && (
        <p className="rounded-xl bg-amber-50 p-4 text-center text-sm font-bold text-amber-800">
          振込待ちです。振込の記録は「管理」タブから行います。
        </p>
      )}

      {reviewer && isUnpaid(mission) && (
        <div className="space-y-3">
          <SlideButton label="スワイプして振込完了" onComplete={() => actions.markPaid(mission.id)} />
          <button
            type="button"
            onClick={() => actions.cancelApproval(mission.id)}
            className="w-full rounded-full p-3 text-sm font-bold text-red-600 ring-1 ring-red-200"
          >
            承認を取り消す
          </button>
        </div>
      )}

      {mission.paymentStatus === "支払済み" && (
        <p className="rounded-xl bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">
          振込完了{mission.paidAt ? `（${mission.paidAt}）` : ""}
        </p>
      )}

      {(canEdit(mission) || canDelete(mission)) && (
        <div className="flex gap-2">
          {canEdit(mission) && (
            <button
              type="button"
              onClick={() => actions.edit(mission.id)}
              className="flex-1 rounded-full bg-slate-100 p-3 text-sm font-bold"
            >
              編集
            </button>
          )}
          {canDelete(mission) && (
            <button
              type="button"
              onClick={() => actions.remove(mission.id)}
              className="flex-1 rounded-full bg-slate-100 p-3 text-sm font-bold text-red-600"
            >
              削除
            </button>
          )}
        </div>
      )}

      {mission.history.length > 0 && (
        <details className="rounded-xl bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-bold">
            操作履歴（{mission.history.length}件）
          </summary>
          <ul className="mt-3 space-y-3">
            {mission.history.map((item, index) => (
              <li key={index} className="border-l-2 border-emerald-500 pl-3">
                <p className="text-xs text-slate-500">{item.date}</p>
                <p className="text-sm font-bold">{item.action}</p>
                <p className="break-words text-sm text-slate-600">{item.comment}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* =========================================================
   クエスト作成・編集フォーム
========================================================= */

function MissionForm({
  initial,
  onSave,
}: {
  initial?: Mission;
  onSave: (input: MissionInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "NORMAL");
  const [cash, setCash] = useState(String(initial?.cashReward ?? 3000));
  const [requirements, setRequirements] = useState<Requirement[]>(initial?.requirements ?? []);
  const [draft, setDraft] = useState("");

  const addRequirement = () => {
    if (!draft.trim()) return;
    setRequirements((prev) => [...prev, { id: Date.now(), text: draft.trim(), completed: false }]);
    setDraft("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // 「追加」を押し忘れた達成条件も含めて保存
    const all = draft.trim()
      ? [...requirements, { id: Date.now(), text: draft.trim(), completed: false }]
      : requirements;

    onSave({
      title: title.trim(),
      description: description.trim(),
      difficulty,
      cashReward: Math.max(0, Math.floor(Number(cash) || 0)),
      requirements: all.filter((r) => r.text.trim()),
    });
  };

  const field = "w-full rounded-xl bg-slate-100 p-3 text-base";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block text-sm font-bold">
        クエスト名
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="例：開業候補地を3件調べる"
          className={`mt-2 font-normal ${field}`}
        />
      </label>

      <label className="block text-sm font-bold">
        説明
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`mt-2 font-normal ${field}`}
        />
      </label>

      <div className="space-y-2">
        <p className="text-sm font-bold">達成条件</p>
        {requirements.map((requirement) => (
          <div key={requirement.id} className="flex gap-2">
            <input
              value={requirement.text}
              aria-label="達成条件"
              onChange={(e) =>
                setRequirements((prev) =>
                  prev.map((r) => (r.id === requirement.id ? { ...r, text: e.target.value } : r))
                )
              }
              className={`min-w-0 flex-1 ${field}`}
            />
            <button
              type="button"
              onClick={() => setRequirements((prev) => prev.filter((r) => r.id !== requirement.id))}
              className="rounded-xl px-3 text-sm font-bold text-red-600"
            >
              削除
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // 日本語変換中のEnterは無視する
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addRequirement();
              }
            }}
            placeholder="達成条件を入力"
            className={`min-w-0 flex-1 ${field}`}
          />
          <button
            type="button"
            onClick={addRequirement}
            className="rounded-xl bg-slate-900 px-4 text-sm font-bold text-white"
          >
            追加
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold">難易度</p>
        <div className="grid grid-cols-2 gap-2">
          {DIFFICULTIES.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={difficulty === key}
              onClick={() => setDifficulty(key)}
              className={`rounded-xl p-3 text-left text-sm font-bold ${
                difficulty === key ? "bg-slate-900 text-white" : "bg-slate-100"
              }`}
            >
              {DIFFICULTY[key].label}
              <span className="block text-xs font-normal opacity-70">
                {"★".repeat(DIFFICULTY[key].stars)}　{DIFFICULTY[key].xp} XP
              </span>
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm font-bold">
        現金報酬（円）
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          className={`mt-2 text-2xl font-black ${field}`}
        />
      </label>

      <button type="submit" className="w-full rounded-full bg-emerald-600 p-4 font-black text-white">
        {initial ? "変更を保存する" : "クエストを追加する"}
      </button>
    </form>
  );
}

/* =========================================================
   認証画面の共通部品
========================================================= */

// Supabaseの英語エラーを日本語にする
function authErrorText(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) return "メールアドレスかパスワードが違います。";
  if (text.includes("email not confirmed")) return "メールアドレスの確認が完了していません。";
  if (text.includes("not authorized")) {
    return "このアドレスには送信できません。Supabaseのメール設定を確認してください。";
  }
  if (text.includes("rate limit") || text.includes("for security purposes")) {
    return "回数の制限にかかりました。時間をおいて試してください。";
  }
  if (text.includes("already registered")) return "このメールアドレスは登録済みです。";
  if (text.includes("should be different")) return "今と違うパスワードを入力してください。";
  return message;
}

function newPasswordProblem(password: string, confirmation: string) {
  if (password.length < 8) return "新しいパスワードは8文字以上にしてください。";
  if (password !== confirmation) return "確認用のパスワードが一致しません。";
  return "";
}

const AUTH_FIELD = "w-full rounded-xl bg-white/10 p-4 text-white placeholder:text-slate-400";
const AUTH_PRIMARY =
  "w-full rounded-full bg-emerald-500 p-4 font-black text-slate-950 disabled:opacity-50";
const AUTH_SECONDARY = "w-full rounded-full p-4 font-bold ring-1 ring-white/30 disabled:opacity-50";
const AUTH_LINK = "w-full p-2 text-sm font-bold text-slate-300 underline disabled:opacity-50";

function AuthLayout({
  subtitle,
  onSubmit,
  children,
}: {
  subtitle: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col justify-end bg-slate-950 p-6 text-white">
      <form
        noValidate
        className="mx-auto w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <p className="text-sm font-bold tracking-widest text-emerald-400">CLINIC OPENING PROJECT</p>
        <h1 className="text-5xl font-black leading-tight">
          MY LIFE
          <br />
          QUEST
        </h1>
        <p className="pb-6 text-slate-400">{subtitle}</p>
        {children}
      </form>
    </main>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  isNew = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isNew?: boolean;
}) {
  return (
    <input
      type="password"
      autoComplete={isNew ? "new-password" : "current-password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      aria-label={label}
      className={AUTH_FIELD}
    />
  );
}

/* =========================================================
   ログイン・新規登録・パスワード変更
========================================================= */

type AuthMode = "login" | "change" | "forgot";

function LoginScreen({
  notice,
  onHold,
  onPasswordChanged,
}: {
  notice: string;
  onHold: (hold: boolean) => void;
  onPasswordChanged: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState(notice);
  const [canResend, setCanResend] = useState(false);
  const [busy, setBusy] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setPassword("");
    setNewPassword("");
    setConfirmation("");
    setMessage("");
    setCanResend(false);
  };

  // 通信中の二重送信防止とエラー表示をまとめる
  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch {
      setMessage("通信に失敗しました。接続を確認してください。");
      onHold(false);
    } finally {
      setBusy(false);
    }
  };

  const login = () =>
    run(async () => {
      if (!email || !password) {
        setMessage("メールアドレスとパスワードを入力してください。");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage("ログインに失敗しました：" + authErrorText(error.message));
        setCanResend(error.message.toLowerCase().includes("email not confirmed"));
      }
    });

  const signup = () =>
    run(async () => {
      if (!email || password.length < 8) {
        setMessage("メールアドレスと、8文字以上のパスワードを入力してください。");
        return;
      }
      const { data: result, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage("登録に失敗しました：" + authErrorText(error.message));
      } else if (result.user && result.user.identities?.length === 0) {
        // 登録済みの場合、成功のように返るがメールは送られない
        setMessage(
          "このメールアドレスは登録済みの可能性があります。ログインするか「パスワードを忘れた」を使ってください。"
        );
      } else if (!result.session) {
        setMessage("確認メールを送信しました。届かない場合は迷惑メールフォルダも確認してください。");
        setCanResend(true);
      }
      // sessionがある場合（メール確認がオフ）は、そのままログインします
    });

  const resend = () =>
    run(async () => {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      setMessage(
        error
          ? "再送に失敗しました：" + authErrorText(error.message)
          : "確認メールの再送を受け付けました。"
      );
    });

  // 今のパスワードを使って変更（メール不要）
  const changePassword = () =>
    run(async () => {
      if (!email || !password) {
        setMessage("メールアドレスと今のパスワードを入力してください。");
        return;
      }
      const problem = newPasswordProblem(newPassword, confirmation);
      if (problem) {
        setMessage(problem);
        return;
      }

      onHold(true); // 変更が終わるまでこの画面にとどまる
      const signedIn = await supabase.auth.signInWithPassword({ email, password });
      if (signedIn.error) {
        setMessage("確認に失敗しました：" + authErrorText(signedIn.error.message));
        onHold(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        await supabase.auth.signOut({ scope: "local" });
        setMessage("変更に失敗しました：" + authErrorText(error.message));
      } else {
        onPasswordChanged();
      }
      onHold(false);
    });

  // 再設定メールを送る
  const sendResetMail = () =>
    run(async () => {
      if (!email) {
        setMessage("メールアドレスを入力してください。");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?reset=1`,
      });
      setMessage(
        error
          ? "送信に失敗しました：" + authErrorText(error.message)
          : "登録があるアドレスには再設定メールが届きます。メール内のリンクは、このブラウザで開いてください。"
      );
    });

  const submit = mode === "login" ? login : mode === "change" ? changePassword : sendResetMail;

  const subtitle =
    mode === "login"
      ? "クエストをこなして、開業へ近づこう。"
      : mode === "change"
        ? "パスワードを変更します。"
        : "パスワード再設定用のメールを送ります。";

  return (
    <AuthLayout subtitle={subtitle} onSubmit={submit}>
      <input
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレス"
        aria-label="メールアドレス"
        className={AUTH_FIELD}
      />
      {mode !== "forgot" && (
        <PasswordInput
          label={mode === "change" ? "今のパスワード" : "パスワード"}
          value={password}
          onChange={setPassword}
        />
      )}
      {mode === "change" && (
        <>
          <PasswordInput
            label="新しいパスワード（8文字以上）"
            value={newPassword}
            onChange={setNewPassword}
            isNew
          />
          <PasswordInput
            label="新しいパスワード（確認）"
            value={confirmation}
            onChange={setConfirmation}
            isNew
          />
        </>
      )}

      {message && (
        <p role="status" className="text-sm text-amber-300">
          {message}
        </p>
      )}
      {canResend && (
        <button type="button" disabled={busy} onClick={resend} className={AUTH_LINK}>
          確認メールを再送する
        </button>
      )}

      <button type="submit" disabled={busy} className={AUTH_PRIMARY}>
        {busy
          ? "処理中..."
          : mode === "login"
            ? "ログイン"
            : mode === "change"
              ? "パスワードを変更する"
              : "再設定メールを送る"}
      </button>

      {mode === "login" ? (
        <>
          <button type="button" disabled={busy} onClick={signup} className={AUTH_SECONDARY}>
            新規登録
          </button>
          <div className="flex">
            <button
              type="button"
              disabled={busy}
              onClick={() => switchMode("change")}
              className={AUTH_LINK}
            >
              パスワードを変更
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => switchMode("forgot")}
              className={AUTH_LINK}
            >
              パスワードを忘れた
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => switchMode("login")}
          className={AUTH_LINK}
        >
          ログイン画面に戻る
        </button>
      )}
    </AuthLayout>
  );
}

// 再設定メールのリンクから開いたときの画面
function ResetPasswordScreen({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    const problem = newPasswordProblem(newPassword, confirmation);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) setMessage("変更に失敗しました：" + authErrorText(error.message));
      else onDone();
    } catch {
      setMessage("通信に失敗しました。接続を確認してください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout subtitle="新しいパスワードを設定してください。" onSubmit={save}>
      <PasswordInput
        label="新しいパスワード（8文字以上）"
        value={newPassword}
        onChange={setNewPassword}
        isNew
      />
      <PasswordInput
        label="新しいパスワード（確認）"
        value={confirmation}
        onChange={setConfirmation}
        isNew
      />
      {message && (
        <p role="status" className="text-sm text-amber-300">
          {message}
        </p>
      )}
      <button type="submit" disabled={busy} className={AUTH_PRIMARY}>
        {busy ? "処理中..." : "新しいパスワードを保存"}
      </button>
      <button type="button" disabled={busy} onClick={onCancel} className={AUTH_LINK}>
        キャンセル
      </button>
    </AuthLayout>
  );
}

/* =========================================================
   メイン画面
========================================================= */

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<QuestData>(INITIAL_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [detail, setDetail] = useState<{ id: string; reviewer: boolean } | null>(null);
  const [form, setForm] = useState<{ id: string | null } | null>(null);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [sortByReward, setSortByReward] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [toast, setToast] = useState("");
  const [authHold, setAuthHold] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [authNotice, setAuthNotice] = useState("");

  /* ---------- 認証 ---------- */
  useEffect(() => {
    // 再設定メールのリンクから開いたかどうか
    const fromResetLink = new URLSearchParams(window.location.search).get("reset") === "1";

    supabase.auth
      .getUser()
      .then(({ data: result }) => {
        setUser(result.user);
        if (!fromResetLink) return;
        if (result.user) {
          setRecovery(true);
        } else {
          setAuthNotice(
            "再設定リンクが無効か期限切れです。「パスワードを忘れた」からもう一度送ってください。"
          );
          window.history.replaceState({}, "", window.location.pathname);
        }
      })
      .catch((error) => console.error("認証確認エラー:", error))
      .finally(() => setAuthReady(true));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* ---------- 保存データの読み込み・保存 ---------- */
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setData(normalizeData(JSON.parse(saved)));
    } catch (error) {
      console.error("保存データの読み込みに失敗しました", error);
      // 上書きで消えないように元データを退避する
      if (saved) localStorage.setItem(BACKUP_KEY, saved);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("データの保存に失敗しました", error);
    }
  }, [data, isLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ---------- 更新処理 ---------- */
  const updateMission = (
    id: string,
    allowed: (m: Mission) => boolean,
    change: (m: Mission) => Mission,
    xpDelta = 0
  ) => {
    setData((prev) => {
      const target = prev.missions.find((m) => m.id === id);
      if (!target || !allowed(target)) return prev;
      return {
        ...prev,
        xp: Math.max(0, prev.xp + xpDelta * target.xp),
        missions: prev.missions.map((m) => (m.id === id ? change(m) : m)),
      };
    });
  };

  const updateSettings = (patch: Partial<Settings>) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  };

  const actions: MissionActions = {
    start: (id) => {
      updateMission(
        id,
        (m) => m.status === "未着手",
        (m) => withHistory({ ...m, status: "進行中" }, "作業開始", "クエストへの取り組みを開始しました。")
      );
      setDetail(null);
      setTab("active");
      setToast("受注しました。作業を始めましょう！");
    },

    toggleRequirement: (id, requirementId, checked) => {
      updateMission(
        id,
        (m) => m.status === "進行中" || m.status === "修正依頼",
        (m) => {
          const target = m.requirements.find((r) => r.id === requirementId);
          return withHistory(
            {
              ...m,
              requirements: m.requirements.map((r) =>
                r.id === requirementId ? { ...r, completed: checked } : r
              ),
            },
            checked ? "達成条件クリア" : "達成条件のチェック解除",
            `「${target?.text ?? ""}」を${checked ? "完了" : "未完了"}に変更しました。`
          );
        }
      );
    },

    submit: (id, evidence) => {
      if (!evidence.trim()) return;
      updateMission(
        id,
        (m) =>
          (m.status === "進行中" || m.status === "修正依頼") &&
          m.requirements.every((r) => r.completed),
        (m) =>
          withHistory(
            { ...m, status: "審査待ち", evidence: evidence.trim() },
            "成果物提出",
            evidence.trim()
          )
      );
      setDetail(null);
      setToast("提出しました。審査を待ちましょう。");
    },

    approve: (id) => {
      updateMission(
        id,
        (m) => m.status === "審査待ち",
        (m) =>
          withHistory(
            {
              ...m,
              status: "承認済み",
              approvedAt: new Date().toISOString(),
              reviewComment: "成果物を承認しました。",
            },
            "承認",
            "成果物を承認しました。"
          ),
        1
      );
      setDetail(null);
      setToast("承認しました。XPを獲得！");
    },

    requestRevision: (id, comment) => {
      if (!comment.trim()) return;
      updateMission(
        id,
        (m) => m.status === "審査待ち",
        (m) =>
          withHistory(
            { ...m, status: "修正依頼", reviewComment: comment.trim() },
            "修正依頼",
            comment.trim()
          )
      );
      setDetail(null);
      setToast("修正を依頼しました。");
    },

    cancelApproval: (id) => {
      if (!window.confirm("このクエストの承認を取り消しますか？\n獲得したXPも差し引かれます。")) return;
      const message = "承認が取り消されました。再審査が必要です。";
      updateMission(
        id,
        isUnpaid,
        (m) =>
          withHistory(
            { ...m, status: "審査待ち", approvedAt: undefined, reviewComment: message },
            "承認取消",
            message
          ),
        -1
      );
      setDetail(null);
    },

    markPaid: (id) => {
      if (!window.confirm("銀行振込が完了しましたか？")) return;
      updateMission(id, isUnpaid, (m) =>
        withHistory(
          { ...m, paymentStatus: "支払済み", paidAt: new Date().toLocaleDateString("ja-JP") },
          "振込完了",
          "銀行振込が完了しました。"
        )
      );
      setDetail(null);
      setToast("振込完了を記録しました。");
    },

    edit: (id) => {
      setDetail(null);
      setForm({ id });
    },

    remove: (id) => {
      const mission = data.missions.find((m) => m.id === id);
      if (!mission || !canDelete(mission)) return;
      if (!window.confirm(`「${mission.title}」を本当に削除しますか？`)) return;
      setData((prev) => ({
        ...prev,
        missions: prev.missions.filter((m) => m.id !== id),
        deletedMissions: [
          ...prev.deletedMissions.filter((m) => m.id !== id),
          withHistory(mission, "ミッション削除", "削除済み一覧へ移動しました。"),
        ],
      }));
      setDetail(null);
      setToast("削除済みへ移動しました。");
    },
  };

  const saveForm = (input: MissionInput) => {
    const xp = DIFFICULTY[input.difficulty].xp;
    const editingId = form?.id ?? null;

    if (editingId) {
      updateMission(editingId, canEdit, (m) =>
        withHistory({ ...m, ...input, xp }, "ミッション編集", "クエスト内容を更新しました。")
      );
    } else {
      const mission: Mission = {
        id: newId(),
        ...input,
        xp,
        status: "未着手",
        evidence: "",
        reviewComment: "",
        paymentStatus: "未払い",
        history: [],
      };
      setData((prev) => ({ ...prev, missions: [...prev.missions, mission] }));
    }
    setForm(null);
    setToast(editingId ? "変更を保存しました。" : "クエストを追加しました。");
  };

  const restoreMission = (mission: Mission) => {
    if (!window.confirm(`「${mission.title}」を復元しますか？`)) return;
    setData((prev) => ({
      ...prev,
      missions: [
        ...prev.missions.filter((m) => m.id !== mission.id),
        withHistory(mission, "ミッション復元", "削除済み一覧から復元しました。"),
      ],
      deletedMissions: prev.deletedMissions.filter((m) => m.id !== mission.id),
    }));
  };

  const permanentlyDelete = (mission: Mission) => {
    if (!window.confirm(`「${mission.title}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    setData((prev) => ({
      ...prev,
      deletedMissions: prev.deletedMissions.filter((m) => m.id !== mission.id),
    }));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-life-quest-backup.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const next = normalizeData(JSON.parse(await file.text()));
      if (window.confirm("現在のデータをバックアップの内容で上書きしますか？")) {
        setData(next);
        setToast("データを復元しました。");
      }
    } catch {
      window.alert("バックアップファイルを読み込めませんでした。");
    }
    input.value = "";
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) window.alert("ログアウトに失敗しました：" + error.message);
  };

  /* ---------- 画面表示の準備 ---------- */
  if (!authReady || !isLoaded) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 font-black text-white">
        読み込み中...
      </main>
    );
  }

  const finishRecovery = () => {
    window.history.replaceState({}, "", window.location.pathname);
    setRecovery(false);
    setAuthNotice("");
  };

  if (!user || authHold) {
    return (
      <LoginScreen
        notice={authNotice}
        onHold={setAuthHold}
        onPasswordChanged={() => setToast("パスワードを変更しました。")}
      />
    );
  }

  if (recovery) {
    return (
      <ResetPasswordScreen
        onDone={() => {
          finishRecovery();
          setToast("パスワードを変更しました。");
        }}
        onCancel={async () => {
          await supabase.auth.signOut({ scope: "local" });
          finishRecovery();
        }}
      />
    );
  }

  const { missions, deletedMissions, xp, settings } = data;

  const offers = missions.filter((m) => m.status === "未着手");
  const sortedOffers = sortByReward
    ? [...offers].sort((a, b) => b.cashReward - a.cashReward)
    : offers;
  const nextOffer = offers.find((m) => !skippedIds.includes(m.id));
  const revisions = missions.filter((m) => m.status === "修正依頼");
  const inProgress = missions.filter((m) => m.status === "進行中");
  const reviewing = missions.filter((m) => m.status === "審査待ち");
  const approved = missions.filter((m) => m.status === "承認済み");
  const unpaid = missions.filter(isUnpaid);
  const paid = missions.filter((m) => m.paymentStatus === "支払済み");
  const current = revisions[0] ?? inProgress[0];

  const today = startOfDay(new Date());
  const thisWeek = startOfWeek(today);
  const todayDone = missions.filter((m) => isApprovedBetween(m, today, addDays(today, 1)));
  const weekDone = missions.filter((m) => isApprovedBetween(m, thisWeek, addDays(thisWeek, 7)));

  const shownWeek = addDays(thisWeek, weekOffset * 7);
  const days = ["月", "火", "水", "木", "金", "土", "日"].map((label, index) => {
    const date = addDays(shownWeek, index);
    const list = missions.filter((m) => isApprovedBetween(m, date, addDays(date, 1)));
    return { label, date, total: sumReward(list) };
  });
  const shownTotal = days.reduce((total, d) => total + d.total, 0);
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  const level = Math.floor(xp / 100) + 1;
  const levelXp = xp % 100;

  const daysToOpening = settings.openingDate
    ? Math.round(
        (new Date(`${settings.openingDate}T00:00:00`).getTime() - today.getTime()) / 86400000
      )
    : null;

  const detailMission = detail ? missions.find((m) => m.id === detail.id) : undefined;
  const editingMission = form?.id ? missions.find((m) => m.id === form.id) : undefined;

  const open = (id: string, reviewer = false) => setDetail({ id, reviewer });

  const list = (items: Mission[], emptyText: string, reviewer = false) =>
    items.length === 0 ? (
      <Empty>{emptyText}</Empty>
    ) : (
      <div className="space-y-3">
        {items.map((m) => (
          <MissionCard key={m.id} mission={m} onOpen={() => open(m.id, reviewer)} />
        ))}
      </div>
    );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "home", label: "ホーム", count: 0 },
    { key: "offers", label: "依頼", count: offers.length },
    { key: "active", label: "進行中", count: revisions.length + inProgress.length },
    { key: "earnings", label: "報酬", count: 0 },
    { key: "manage", label: "管理", count: reviewing.length },
  ];

  const offline = (
    <Card className="text-center">
      <p className="text-lg font-black">現在オフラインです</p>
      <p className="mt-1 text-sm text-slate-500">稼働を開始すると新しい依頼を受けられます。</p>
      <button
        type="button"
        onClick={() => updateSettings({ online: true })}
        className="mt-4 w-full rounded-full bg-slate-900 p-4 font-black text-white"
      >
        稼働を開始する
      </button>
    </Card>
  );

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      {/* ---------- ヘッダー ---------- */}
      <header className="sticky top-0 z-20 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400">MY LIFE QUEST</p>
            <p className="text-sm font-black">LEVEL {level}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.online}
            onClick={() => updateSettings({ online: !settings.online })}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black ${
              settings.online ? "bg-emerald-500 text-slate-950" : "bg-white/10 text-white"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                settings.online ? "animate-pulse bg-slate-950" : "bg-slate-500"
              }`}
            />
            {settings.online ? "稼働中" : "オフライン"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        {/* ---------- ホーム ---------- */}
        {tab === "home" && (
          <>
            <button
              type="button"
              onClick={() => setTab("earnings")}
              className="block w-full rounded-3xl bg-slate-950 p-6 text-left text-white"
            >
              <p className="text-sm text-slate-400">今日の報酬（承認ベース）</p>
              <p className="mt-1 text-5xl font-black">{yen(sumReward(todayDone))}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                <div>
                  <p className="text-xs text-slate-400">今週</p>
                  <p className="text-xl font-black">{yen(sumReward(weekDone))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">振込待ち（{unpaid.length}件）</p>
                  <p className="text-xl font-black text-amber-400">{yen(sumReward(unpaid))}</p>
                </div>
              </div>
            </button>

            {current && (
              <div className="space-y-2">
                <h2 className="font-black">
                  {current.status === "修正依頼" ? "修正依頼が届いています" : "進行中のクエスト"}
                </h2>
                <MissionCard mission={current} onOpen={() => open(current.id)}>
                  <Stepper mission={current} />
                  <button
                    type="button"
                    onClick={() => open(current.id)}
                    className="mt-4 w-full rounded-full bg-slate-900 p-3 font-black text-white"
                  >
                    作業を続ける
                  </button>
                </MissionCard>
              </div>
            )}

            {!settings.online ? (
              offline
            ) : nextOffer ? (
              <div className="space-y-2">
                <h2 className="font-black text-emerald-700">新しい依頼</h2>
                <div className="rounded-3xl ring-2 ring-emerald-500">
                  <MissionCard mission={nextOffer} onOpen={() => open(nextOffer.id)}>
                    <SlideButton
                      key={nextOffer.id}
                      label="スワイプして受注"
                      onComplete={() => actions.start(nextOffer.id)}
                    />
                    <button
                      type="button"
                      onClick={() => setSkippedIds((prev) => [...prev, nextOffer.id])}
                      className="mt-2 w-full p-2 text-sm font-bold text-slate-500"
                    >
                      あとで
                    </button>
                  </MissionCard>
                </div>
              </div>
            ) : (
              <Empty>
                新しい依頼を待っています。
                {offers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSkippedIds([])}
                    className="mt-2 block w-full font-bold text-emerald-700 underline"
                  >
                    「あとで」にした依頼をもう一度見る
                  </button>
                )}
              </Empty>
            )}

            <Card>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500">今週のチャレンジ</p>
                  <p className="font-black">{settings.weeklyGoal}件の承認を目指そう</p>
                </div>
                <p className="text-2xl font-black">
                  {weekDone.length}
                  <span className="text-sm text-slate-400"> / {settings.weeklyGoal}</span>
                </p>
              </div>
              <div className="mt-3">
                <ProgressBar value={weekDone.length} max={settings.weeklyGoal} />
              </div>
              {weekDone.length >= settings.weeklyGoal && (
                <p className="mt-2 text-sm font-bold text-emerald-700">チャレンジ達成！</p>
              )}
            </Card>

            <Card>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500">統合医療クリニック開業まで</p>
                  <p className="font-black">
                    {daysToOpening === null
                      ? "開業準備の進み具合"
                      : daysToOpening > 0
                        ? `目標日まであと ${daysToOpening} 日`
                        : daysToOpening === 0
                          ? "今日が目標日です"
                          : "目標日を過ぎています"}
                  </p>
                </div>
                <p className="text-2xl font-black">
                  {missions.length ? Math.round((approved.length / missions.length) * 100) : 0}%
                </p>
              </div>
              <div className="mt-3">
                <ProgressBar value={approved.length} max={missions.length} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                登録クエスト {missions.length} 件中 {approved.length} 件が承認済み
              </p>
            </Card>

            <Card>
              <div className="flex justify-between text-sm font-black">
                <span>LEVEL {level}</span>
                <span>累計 {xp} XP</span>
              </div>
              <div className="mt-3">
                <ProgressBar value={levelXp} max={100} />
              </div>
              <p className="mt-2 text-xs text-slate-500">次のレベルまであと {100 - levelXp} XP</p>
            </Card>
          </>
        )}

        {/* ---------- 依頼一覧 ---------- */}
        {tab === "offers" && (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black">受けられる依頼</h1>
              <button
                type="button"
                onClick={() => setSortByReward((v) => !v)}
                className="rounded-full bg-white px-4 py-2 text-xs font-bold ring-1 ring-black/10"
              >
                {sortByReward ? "報酬が高い順" : "登録順"}
              </button>
            </div>
            {!settings.online ? (
              offline
            ) : offers.length === 0 ? (
              <Empty>受けられる依頼はありません。「管理」タブから追加できます。</Empty>
            ) : (
              sortedOffers.map((m) => (
                <MissionCard key={m.id} mission={m} onOpen={() => open(m.id)}>
                  <button
                    type="button"
                    onClick={() => actions.start(m.id)}
                    className="w-full rounded-full bg-emerald-600 p-3 font-black text-white"
                  >
                    受注する
                  </button>
                </MissionCard>
              ))
            )}
          </>
        )}

        {/* ---------- 進行中 ---------- */}
        {tab === "active" && (
          <>
            <h1 className="text-2xl font-black">進行状況</h1>
            {revisions.length > 0 && (
              <>
                <h2 className="font-black text-orange-600">修正依頼（{revisions.length}）</h2>
                {list(revisions, "")}
              </>
            )}
            <h2 className="font-black">作業中（{inProgress.length}）</h2>
            {list(inProgress, "作業中のクエストはありません。")}
            <h2 className="pt-2 font-black">審査待ち（{reviewing.length}）</h2>
            {list(reviewing, "審査待ちのクエストはありません。")}
          </>
        )}

        {/* ---------- 報酬 ---------- */}
        {tab === "earnings" && (
          <>
            <h1 className="text-2xl font-black">報酬</h1>
            <Card>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="前の週"
                  onClick={() => setWeekOffset((v) => v - 1)}
                  className="rounded-full bg-slate-100 p-2"
                >
                  <Icon name="left" className="h-5 w-5" />
                </button>
                <p className="text-sm font-bold text-slate-500">
                  {shownWeek.getMonth() + 1}/{shownWeek.getDate()} 〜 {days[6].date.getMonth() + 1}/
                  {days[6].date.getDate()}
                </p>
                <button
                  type="button"
                  aria-label="次の週"
                  disabled={weekOffset >= 0}
                  onClick={() => setWeekOffset((v) => v + 1)}
                  className="rounded-full bg-slate-100 p-2 disabled:opacity-30"
                >
                  <Icon name="right" className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-center text-4xl font-black">{yen(shownTotal)}</p>
              <div className="mt-6 flex h-40 items-end gap-2">
                {days.map((d) => (
                  <div
                    key={d.label}
                    title={`${d.date.getMonth() + 1}/${d.date.getDate()} ${yen(d.total)}`}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <span className="mb-1 text-[10px] font-bold text-slate-500">
                      {d.total > 0
                        ? d.total >= 10000
                          ? `${Number((d.total / 10000).toFixed(1))}万`
                          : d.total.toLocaleString("ja-JP")
                        : ""}
                    </span>
                    <div
                      className={`w-full rounded-t-md ${d.total > 0 ? "bg-emerald-500" : "bg-slate-200"}`}
                      style={{ height: d.total > 0 ? `${(d.total / maxDay) * 75}%` : "4px" }}
                    />
                    <span
                      className={`mt-2 text-xs ${
                        d.date.getTime() === today.getTime()
                          ? "font-black text-slate-900"
                          : "text-slate-400"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <p className="text-xs text-slate-500">振込待ち</p>
                <p className="mt-1 text-2xl font-black text-amber-600">{yen(sumReward(unpaid))}</p>
                <p className="text-xs text-slate-500">{unpaid.length} 件</p>
              </Card>
              <Card>
                <p className="text-xs text-slate-500">振込済み</p>
                <p className="mt-1 text-2xl font-black text-emerald-600">{yen(sumReward(paid))}</p>
                <p className="text-xs text-slate-500">{paid.length} 件</p>
              </Card>
            </div>

            <h2 className="font-black">振込待ちクエスト</h2>
            {list(unpaid, "現在、振込待ちのクエストはありません。")}

            <h2 className="pt-2 font-black">振込履歴</h2>
            {paid.length === 0 ? (
              <Empty>振込済みのクエストはまだありません。</Empty>
            ) : (
              <Card className="divide-y divide-slate-100 !py-1">
                {paid.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => open(m.id)}
                    className="flex w-full items-center justify-between gap-3 py-4 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block break-words font-bold">{m.title}</span>
                      <span className="text-xs text-slate-500">振込日：{m.paidAt ?? "記録なし"}</span>
                    </span>
                    <span className="font-black text-emerald-600">{yen(m.cashReward)}</span>
                  </button>
                ))}
              </Card>
            )}
          </>
        )}

        {/* ---------- 管理（承認者・設定） ---------- */}
        {tab === "manage" && (
          <>
            <h1 className="text-2xl font-black">管理</h1>
            <button
              type="button"
              onClick={() => setForm({ id: null })}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 p-4 font-black text-white"
            >
              <Icon name="plus" className="h-5 w-5" />
              新しいクエストを作成
            </button>

            <h2 className="pt-2 font-black">審査する（{reviewing.length}）</h2>
            {list(reviewing, "審査待ちのクエストはありません。", true)}

            <h2 className="pt-2 font-black">振込する（{unpaid.length}）</h2>
            {list(unpaid, "振込が必要なクエストはありません。", true)}

            <Card className="space-y-4">
              <h2 className="font-black">目標設定</h2>
              <label className="block text-sm font-bold">
                開業目標日
                <input
                  type="date"
                  value={settings.openingDate}
                  onChange={(e) => updateSettings({ openingDate: e.target.value })}
                  className="mt-2 block w-full rounded-xl bg-slate-100 p-3 text-base font-normal"
                />
              </label>
              <label className="block text-sm font-bold">
                今週のチャレンジ（承認件数）
                <select
                  value={settings.weeklyGoal}
                  onChange={(e) => updateSettings({ weeklyGoal: Number(e.target.value) })}
                  className="mt-2 block w-full rounded-xl bg-slate-100 p-3 text-base font-normal"
                >
                  {[1, 2, 3, 4, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} 件
                    </option>
                  ))}
                </select>
              </label>
            </Card>

            <Card>
              <details>
                <summary className="cursor-pointer font-black">
                  すべてのクエスト（{missions.length}）
                </summary>
                <div className="mt-2 divide-y divide-slate-100">
                  {missions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => open(m.id, m.status === "審査待ち" || m.status === "承認済み")}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left"
                    >
                      <span className="min-w-0 break-words text-sm font-bold">{m.title}</span>
                      <Badge className={`shrink-0 ${STATUS_BADGE[m.status]}`}>{m.status}</Badge>
                    </button>
                  ))}
                </div>
              </details>
            </Card>

            <Card>
              <details>
                <summary className="cursor-pointer font-black">
                  削除済みクエスト（{deletedMissions.length}）
                </summary>
                {deletedMissions.length === 0 && (
                  <p className="mt-3 text-sm text-slate-500">削除済みクエストはありません。</p>
                )}
                <div className="mt-2 divide-y divide-slate-100">
                  {deletedMissions.map((m) => (
                    <div key={m.id} className="py-3">
                      <p className="break-words text-sm font-bold">{m.title}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => restoreMission(m)}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
                        >
                          復元する
                        </button>
                        <button
                          type="button"
                          onClick={() => permanentlyDelete(m)}
                          className="rounded-full px-4 py-2 text-xs font-bold text-red-600 ring-1 ring-red-200"
                        >
                          完全に削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </Card>

            <Card className="space-y-3">
              <h2 className="font-black">データとアカウント</h2>
              <p className="text-xs text-slate-500">
                クエストのデータは、この端末のブラウザに保存されています。
              </p>
              <button
                type="button"
                onClick={exportData}
                className="w-full rounded-full bg-slate-100 p-3 text-sm font-bold"
              >
                バックアップを保存する
              </button>
              <label className="block w-full cursor-pointer rounded-full bg-slate-100 p-3 text-center text-sm font-bold">
                バックアップから復元する
                <input type="file" accept=".json,application/json" onChange={importData} className="sr-only" />
              </label>
              <p className="break-all pt-2 text-xs text-slate-500">ログイン中：{user.email}</p>
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-full p-3 text-sm font-bold text-red-600 ring-1 ring-red-200"
              >
                ログアウト
              </button>
            </Card>
          </>
        )}
      </main>

      {/* ---------- 下部タブ ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-current={tab === item.key ? "page" : undefined}
              onClick={() => {
                setTab(item.key);
                window.scrollTo({ top: 0 });
              }}
              className={`relative flex flex-col items-center gap-1 py-3 text-[11px] font-bold ${
                tab === item.key ? "text-slate-950" : "text-slate-400"
              }`}
            >
              <Icon name={item.key} />
              {item.label}
              {item.count > 0 && (
                <span className="absolute left-1/2 top-1.5 ml-2 min-w-5 rounded-full bg-emerald-600 px-1.5 text-[10px] leading-5 text-white">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-full bg-slate-900 px-5 py-3 text-center text-sm font-bold text-white shadow-xl"
        >
          {toast}
        </div>
      )}

      {detail && detailMission && (
        <Sheet
          title={detail.reviewer ? "審査・支払い" : "クエスト詳細"}
          onClose={() => setDetail(null)}
        >
          <MissionDetail
            key={detailMission.id}
            mission={detailMission}
            reviewer={detail.reviewer}
            actions={actions}
          />
        </Sheet>
      )}

      {form && (
        <Sheet
          title={form.id ? "クエストを編集" : "新しいクエスト"}
          onClose={() => setForm(null)}
          closeOnBackdrop={false}
        >
          <MissionForm key={form.id ?? "new"} initial={editingMission} onSave={saveForm} />
        </Sheet>
      )}
    </div>
  );
}
