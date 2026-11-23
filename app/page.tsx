
"use client";

import { useEffect, useState } from "react";
type Mission = {

  id: number;
  title: string;
  description: string;

  difficulty: "EASY" | "NORMAL" | "HARD" | "VERY_HARD" | "EXPERT";
  xp: number;
  cashReward: number;
  status:
    | "未着手"
    | "進行中"
    | "審査待ち"
    | "修正依頼"
    | "承認済み";
  evidence: string;
  reviewComment: string;
  paymentStatus: "未払い" | "支払済み";
};




const initialMissions: Mission[] = [
  {
    id: 1,
    title: "税理士候補を3事務所調査する",
    description:
      "医療機関の支援実績・費用・サービス内容を比較表にまとめる",
    difficulty: "NORMAL",
    xp: 50,
    cashReward: 3000,
    status: "未着手",
    evidence: "",
    reviewComment: "",
    paymentStatus: "未払い",
  },
  {
    id: 2,
    title: "クリニック理念の資料を完成させる",
    description:
      "兄の考えを反映したクリニックの理念・基本方針を資料にまとめる",
    difficulty: "HARD",
    xp: 100,
    cashReward: 10000,
    status: "未着手",
    evidence: "",
    reviewComment: "",
    paymentStatus: "未払い",
  },
];



export default function Home() {
  const [missions, setMissions] = useState(initialMissions);
  const [xp, setXp] = useState(0);
  const [newTitle, setNewTitle] = useState("");
const [newDescription, setNewDescription] = useState("");
const [newDifficulty, setNewDifficulty] = useState<Mission["difficulty"]>("NORMAL");
const [newCashReward, setNewCashReward] = useState(3000);
const [editingId, setEditingId] = useState<number | null>(null);
const [isLoaded, setIsLoaded] = useState(false);
useEffect(() => {
  const savedData = localStorage.getItem("myLifeQuest");

  if (savedData) {
    try {
      const data = JSON.parse(savedData);

     if (Array.isArray(data.missions)) {
setMissions(
  data.missions.map((mission: Mission) => {
    const xpByDifficulty = {
      EASY: 20,
      NORMAL: 50,
      HARD: 100,
      VERY_HARD: 200,
      EXPERT: 300,
    };

    return {
      ...mission,
      xp: mission.xp ?? xpByDifficulty[mission.difficulty] ?? 50,
      cashReward: mission.cashReward ?? 3000,
      status: mission.status ?? "未着手",
      evidence: mission.evidence ?? "",
      reviewComment: mission.reviewComment ?? "",
      paymentStatus: mission.paymentStatus ?? "未払い",
    };
  })
);
}
      if (typeof data.xp === "number") {
        setXp(data.xp);
      }

    
    } catch (error) {
      console.error("保存データの読み込みに失敗しました", error);
    }
  }

  setIsLoaded(true);
}, []);
useEffect(() => {
  if (!isLoaded) return;

const data = {
  missions,
  xp,
};

  localStorage.setItem("myLifeQuest", JSON.stringify(data));
}, [missions, xp, isLoaded]);
const [editTitle, setEditTitle] = useState("");
const [editDescription, setEditDescription] = useState("");
const [editDifficulty, setEditDifficulty] = useState<Mission["difficulty"]>("NORMAL");
const [editCashReward, setEditCashReward] = useState(3000);  
// 振込待ち報酬の合計
const unpaidTotal = missions
  .filter(
    (m) =>
      m.status === "承認済み" &&
      m.paymentStatus === "未払い"
  )
  .reduce((total, m) => total + m.cashReward, 0);

// 振込待ちクエスト数
const unpaidCount = missions.filter(
  (m) =>
    m.status === "承認済み" &&
    m.paymentStatus === "未払い"
).length;

// 振込待ちクエスト一覧
const unpaidMissions = missions.filter(
  (m) =>
    m.status === "承認済み" &&
    m.paymentStatus === "未払い"
);
// 振込済みクエスト一覧
const paidMissions = missions.filter(
  (m) => m.paymentStatus === "支払済み"
);

// 振込済み報酬の合計
const paidTotal = missions
  .filter((m) => m.paymentStatus === "支払済み")
  .reduce((total, m) => total + m.cashReward, 0);

const level = Math.floor(xp / 100) + 1;
  const levelXp = xp % 100;

 const saveEdit = () => {
if (!editTitle.trim() || editingId === null) return;

const targetMission = missions.find(
  (m) => m.id === editingId
);

if (
  !targetMission ||
  (targetMission.status !== "未着手" &&
   targetMission.status !== "進行中" &&
   targetMission.status !== "修正依頼") ||
  targetMission.paymentStatus !== "未払い"
) {
  return;
}
  const xpByDifficulty = {
    EASY: 20,
    NORMAL: 50,
    HARD: 100,
    VERY_HARD: 200,
    EXPERT: 300,
  };

  setMissions((prev) =>
    prev.map((mission) =>
      mission.id === editingId
        ? {
            ...mission,
            title: editTitle,
            description: editDescription,
            difficulty: editDifficulty,
            xp: xpByDifficulty[editDifficulty],
            cashReward: editCashReward,
          }
        : mission
    )
  );

  setEditingId(null);
  setEditTitle("");
  setEditDescription("");
  setEditDifficulty("NORMAL");
};


const deleteMission = (id: number) => {
  const mission = missions.find((m) => m.id === id);

  if (
    !mission ||
    mission.status === "承認済み" ||
    mission.paymentStatus === "支払済み"
  ) return;

  const confirmed = window.confirm(
    `「${mission.title}」を本当に削除しますか？`
  );

  if (!confirmed) return;

  setMissions((prev) =>
    prev.filter((m) => m.id !== id)
  );
};
const startEditing = (mission: Mission) => {
  setEditingId(mission.id);
  setEditTitle(mission.title);
  setEditDescription(mission.description);
  setEditDifficulty(mission.difficulty);
  setEditCashReward(mission.cashReward);
};

const addMission = () => {
  if (!newTitle.trim()) return;

  const xpByDifficulty = {
    EASY: 20,
    NORMAL: 50,
    HARD: 100,
    VERY_HARD: 200,
    EXPERT: 300,
  };

  const newMission: Mission = {
    id: Date.now(),
    title: newTitle,
    description: newDescription,
    difficulty: newDifficulty,
    xp: xpByDifficulty[newDifficulty],
    cashReward: newCashReward,
    status: "未着手",
    evidence: "",
    reviewComment: "",
    paymentStatus: "未払い",
  };

  setMissions((prev) => [...prev, newMission]);

  setNewTitle("");
  setNewDescription("");
  setNewDifficulty("NORMAL");
  setNewCashReward(3000);
};

const submitMission = (id: number) => {
  const mission = missions.find((m) => m.id === id);

  if (
    !mission ||
    (mission.status !== "進行中" &&
      mission.status !== "修正依頼")
  ) return;

  const evidence = window.prompt(
    "提出する成果物の内容やファイルの保存先を入力してください"
  );

  if (!evidence || !evidence.trim()) return;

  setMissions((prev) =>
    prev.map((m) =>
      m.id === id
        ? {
            ...m,
            status: "審査待ち",
            evidence: evidence.trim(),
          }
        : m
    )
  );
};
const approveMission = (id: number) => {
  const mission = missions.find((m) => m.id === id);

  if (!mission || mission.status !== "審査待ち") return;

  setMissions((prev) =>
    prev.map((m) =>
      m.id === id
        ? {
            ...m,
            status: "承認済み",
            
            reviewComment: "成果物を承認しました。",
          }
        : m
    )
  );


  setXp((prev) => prev + mission.xp);
};
const cancelApproval = (id: number) => {
  const mission = missions.find((m) => m.id === id);

  if (
    !mission ||
    mission.status !== "承認済み" ||
    mission.paymentStatus === "支払済み"
  ) return;
  const confirmed = window.confirm(
    "このミッションの承認を取り消しますか？\n獲得したXPも差し引かれます。"
  );

  if (!confirmed) return;

  setMissions((prev) =>
    prev.map((m) =>
      m.id === id
        ? {
            ...m,
            status: "審査待ち",
            reviewComment: "承認が取り消されました。再審査が必要です。",
          }
        : m
    )
  );

  setXp((prev) => Math.max(0, prev - mission.xp));
};
const requestRevision = (id: number) => {
  const comment = window.prompt(
    "修正してほしい内容を入力してください"
  );

  if (!comment || !comment.trim()) return;

  setMissions((prev) =>
    prev.map((mission) =>
      mission.id === id
        ? {
            ...mission,
            status: "修正依頼",
            reviewComment: comment.trim(),
          }
        : mission
    )
  );
};

const difficultyColor = {
  EASY: "text-green-400",
  NORMAL: "text-blue-400",
  HARD: "text-orange-400",
  VERY_HARD: "text-red-400",
  EXPERT: "text-purple-400",
};

  return (
    <main className="min-h-screen bg-[#10131c] text-white px-5 py-8">
      <div className="max-w-3xl mx-auto space-y-7">

        <header className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400 tracking-widest">
              YOUR PERSONAL ADVENTURE
            </p>
            <h1 className="text-3xl font-bold mt-1">
              MY LIFE QUEST
            </h1>
          </div>
          <div className="bg-indigo-500/20 text-indigo-300 px-4 py-2 rounded-xl font-bold">
            LEVEL {level}
          </div>
        </header>

        <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 shadow-xl">
          <p className="text-indigo-100 text-sm">CURRENT EXPERIENCE</p>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-5xl font-bold">{xp}</span>
            <span className="text-indigo-200 mb-2">XP</span>
          </div>

          <div className="flex justify-between text-sm mt-6 mb-2">
            <span>LEVEL {level}</span>
            <span>{levelXp} / 100 XP</span>
          </div>

          <div className="h-3 bg-black/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${levelXp}%` }}
            />
          </div>

          <p className="text-indigo-100 text-xs mt-3">
            次のレベルまであと {100 - levelXp} XP
          </p>
        </section>

     <section className="grid grid-cols-2 gap-4">
  <div className="rounded-xl bg-gray-800 p-4">
    <p className="text-sm text-gray-400">承認済みクエスト</p>
    <p className="mt-2 text-2xl font-bold">
   {missions.filter(
  (m) => m.status === "承認済み"
).length}
      <span className="text-sm text-gray-400"> 件</span>
    </p>
  </div>

  <div className="rounded-xl bg-gray-800 p-4">
    <p className="text-sm text-gray-400">審査待ちクエスト</p>
    <p className="mt-2 text-2xl font-bold">
      {missions.filter((m) => m.status === "審査待ち").length}
      <span className="text-sm text-gray-400"> 件</span>
    </p>
  </div>
</section>
<section className="rounded-2xl bg-[#1c2230] p-5 border border-yellow-500/30">
  <p className="text-sm text-gray-400">
    振込待ちの報酬合計
  </p>
  <p className="text-3xl font-bold text-yellow-400 mt-2">
    ¥{unpaidTotal.toLocaleString()}
  </p>
<div className="flex justify-between items-center mt-3">
  <p className="text-xs text-gray-400">
    振込待ちのクエスト
  </p>
  <p className="text-lg font-bold text-yellow-400">
    {unpaidCount} 件
  </p>
</div>
</section>
<section className="rounded-2xl bg-[#1c2230] p-5 border border-green-500/30">
  <p className="text-sm text-gray-400">
    振込完了した報酬合計
  </p>
  <p className="text-3xl font-bold text-green-400 mt-2">
    ¥{paidTotal.toLocaleString()}
  </p>
  <p className="text-xs text-gray-400 mt-2">
    支払済みのクエストが対象
  </p>
</section>
<section className="bg-[#1c2230] rounded-2xl p-5 border border-yellow-500/30 space-y-3">
  <h2 className="text-lg font-bold text-yellow-400">
    振込待ちクエスト一覧
  </h2>

  {unpaidMissions.length === 0 ? (
    <p className="text-sm text-gray-400">
      現在、振込待ちのクエストはありません。
    </p>
  ) : (
    unpaidMissions.map((mission) => (
      <div
        key={mission.id}
        className="flex justify-between items-center border-b border-white/10 pb-3"
      >
        <div>
          <p className="font-bold">{mission.title}</p>
          <p className="text-sm text-gray-400">
            {mission.paymentStatus}
          </p>
        </div>

        <p className="font-bold text-yellow-400">
          ¥{mission.cashReward.toLocaleString()}
        </p>
      </div>
    ))
  )}
</section>

<section className="bg-[#1c2230] rounded-2xl p-5 border border-green-500/30 space-y-3">
  <h2 className="text-lg font-bold text-green-400">
    振込済みクエスト一覧
  </h2>

  {paidMissions.length === 0 ? (
    <p className="text-sm text-gray-400">
      振込済みのクエストはまだありません。
    </p>
  ) : (
    paidMissions.map((mission) => (
      <div
        key={mission.id}
        className="flex justify-between items-center border-b border-white/10 pb-3"
      >
        <div>
          <p className="font-bold">{mission.title}</p>
          <p className="text-sm text-green-400">
            支払済み
          </p>
        </div>

        <p className="font-bold text-green-400">
          ¥{mission.cashReward.toLocaleString()}
        </p>
      </div>
    ))
  )}
</section>
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">TODAY'S MISSIONS</h2>
            <span className="text-xs text-gray-400">冒険を進めよう</span>
          </div>

<div className="bg-[#1c2230] rounded-2xl p-5 border border-white/5 space-y-4">
  <h3 className="font-bold text-lg">＋ 新しいミッション</h3>

  <input
    value={newTitle}
    onChange={(e) => setNewTitle(e.target.value)}
    placeholder="ミッション名"
    className="w-full bg-[#10131c] border border-white/10 rounded-xl p-3 text-white"
  />

  <textarea
    value={newDescription}
    onChange={(e) => setNewDescription(e.target.value)}
    placeholder="ミッションの説明"
    className="w-full bg-[#10131c] border border-white/10 rounded-xl p-3 text-white"
  />

  <select
    value={newDifficulty}
    onChange={(e) =>
      setNewDifficulty(e.target.value as Mission["difficulty"])
    }
    className="w-full bg-[#10131c] border border-white/10 rounded-xl p-3 text-white"
  >
   <option value="EASY">EASY ★（20 XP）</option>
<option value="NORMAL">NORMAL ★★（50 XP）</option>
<option value="HARD">HARD ★★★（100 XP）</option>
<option value="VERY_HARD">VERY HARD ★★★★（200 XP）</option>
<option value="EXPERT">EXPERT ★★★★★（300 XP）</option>
  </select>

  <div>
    <label className="block text-sm text-gray-400 mb-2">
      現金報酬（円）
    </label>
    <input
      type="number"
      min="0"
      value={newCashReward}
      onChange={(e) => setNewCashReward(Number(e.target.value))}
      className="w-full bg-[#10131c] border border-white/10 rounded-xl p-3 text-white"
    />
  </div>

  <button
    onClick={addMission}
    className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl p-3 font-bold"
  >
    ミッションを追加する
  </button>
</div>

              {missions.map((mission) => (
            <div
              key={mission.id}
              className={`bg-[#1c2230] rounded-2xl p-5 border border-white/5 ${
mission.status === "承認済み"
  ? "opacity-50"
  : ""              }`}
            >{editingId === mission.id && (
  <div className="bg-[#10131c] rounded-xl p-4 mb-4 space-y-3">
    <h3 className="font-bold text-blue-400">ミッションを編集</h3>

    <input
      value={editTitle}
      onChange={(e) => setEditTitle(e.target.value)}
      placeholder="ミッション名"
      className="w-full bg-[#1c2230] border border-white/10 rounded-xl p-3 text-white"
    />

    <textarea
      value={editDescription}
      onChange={(e) => setEditDescription(e.target.value)}
      placeholder="ミッションの説明"
      className="w-full bg-[#1c2230] border border-white/10 rounded-xl p-3 text-white"
    />

    <select
      value={editDifficulty}
      onChange={(e) =>
        setEditDifficulty(e.target.value as Mission["difficulty"])
      }
      className="w-full bg-[#1c2230] border border-white/10 rounded-xl p-3 text-white"
    >
 <option value="EASY">EASY ★（20 XP）</option>
<option value="NORMAL">NORMAL ★★（50 XP）</option>
<option value="HARD">HARD ★★★（100 XP）</option>
<option value="VERY_HARD">VERY HARD ★★★★（200 XP）</option>
<option value="EXPERT">EXPERT ★★★★★（300 XP）</option>
    </select>

    <div>
      <label className="block text-sm text-gray-400 mb-2">
        現金報酬（円）
      </label>
      <input
        type="number"
        min="0"
        value={editCashReward}
        onChange={(e) => setEditCashReward(Number(e.target.value))}
        className="w-full bg-[#1c2230] border border-white/10 rounded-xl p-3 text-white"
      />
    </div>

    <div className="flex gap-2">
      <button
        onClick={saveEdit}
        className="flex-1 bg-blue-600 hover:bg-blue-500 rounded-xl p-3 font-bold"
      >
        保存する
      </button>


      <button
        onClick={() => setEditingId(null)}
        className="flex-1 bg-gray-600 hover:bg-gray-500 rounded-xl p-3 font-bold"
      >
        キャンセル
      </button>
    </div>
  </div>
)}
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-bold text-lg">{mission.title}</p>
                  <p className="text-gray-400 text-sm mt-2">
                    {mission.description}
                  </p>
                  {mission.evidence && (
  <div className="mt-3 rounded-xl bg-black/20 p-3">
    <p className="text-xs text-gray-400 mb-1">
      提出した成果物
    </p>
    <p className="text-sm text-green-300 whitespace-pre-wrap">
      {mission.evidence}
    </p>
  </div>
)}
{mission.reviewComment && (
  <div className="mt-3 rounded-xl bg-blue-900/30 p-3">
    <p className="text-xs text-blue-300 mb-1">
      審査コメント
    </p>
    <p className="text-sm text-white whitespace-pre-wrap">
      {mission.reviewComment}
    </p>
  </div>
)}
                </div>

                <span className={`text-xs font-bold ${difficultyColor[mission.difficulty]}`}>
                  {mission.difficulty}
                </span>
              </div>

              <div className="flex justify-between items-center mt-5">
            <span className="text-yellow-400 font-bold">
  +{mission.xp} XP / ¥{mission.cashReward.toLocaleString()}
</span>
{mission.status === "承認済み" &&
  mission.paymentStatus === "未払い" && (
    <button
      onClick={() => {
        const confirmed = window.confirm(
          "銀行振込が完了しましたか？"
        );

        if (!confirmed) return;

        setMissions((prev) =>
          prev.map((m) =>
            m.id === mission.id
              ? { ...m, paymentStatus: "支払済み" }
              : m
          )
        );
      }}
      className="bg-green-700 hover:bg-green-600 px-3 py-2 rounded-xl text-sm font-bold"
    >
      振込完了にする
    </button>
)}
<span
  className={`text-sm font-bold ${
    mission.paymentStatus === "支払済み"
      ? "text-green-400"
      : "text-yellow-400"
  }`}
>
  支払い：{mission.paymentStatus}
</span>

                <div className="flex gap-2">
{(mission.status === "未着手" ||
  mission.status === "進行中" ||
  mission.status === "修正依頼") &&
  mission.paymentStatus === "未払い" && (
    <button
      onClick={() => startEditing(mission)}
      className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-sm font-bold transition"
    >
      編集
    </button>
)}
               {mission.status !== "承認済み" &&
 mission.paymentStatus !== "支払済み" && (
  <button
    onClick={() => deleteMission(mission.id)}
    className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-xl text-sm font-bold transition"
  >
    削除
  </button>
)}

                <button
  onClick={() => {
    if (mission.status === "未着手") {
      setMissions((prev) =>
        prev.map((m) =>
          m.id === mission.id
            ? { ...m, status: "進行中" }
            : m
        )
      );
   } else if (
  mission.status === "進行中" ||
  mission.status === "修正依頼"
) {
  submitMission(mission.id);
}
  }}
disabled={
  mission.status !== "未着手" &&
  mission.status !== "進行中" &&
  mission.status !== "修正依頼"
}
  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 px-5 py-2 rounded-xl text-sm font-bold transition"
>
  {mission.status === "未着手"
    ? "作業開始"
    : mission.status === "進行中"
    ? "成果物を提出"
: mission.status === "修正依頼"
? "修正して再提出"
: mission.status}</button>
{mission.status === "審査待ち" && (
  <>
    <button
      onClick={() => approveMission(mission.id)}
      className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl text-sm font-bold"
    >
      承認する
    </button>

    <button
      onClick={() => requestRevision(mission.id)}
      className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-xl text-sm font-bold"
    >
      修正依頼
    </button>
  </>
)}
{mission.status === "承認済み" && (
  <button
    onClick={() => cancelApproval(mission.id)}
    className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl text-sm font-bold"
  >
    承認取消
  </button>
)}
                </div>
              </div>
            </div>
      
          ))}
        </section>

  


        <footer className="text-center text-gray-500 text-xs py-5">
          YOUR LIFE IS YOUR GREATEST QUEST.
        </footer>

      </div>
    </main>
  );
  
}
