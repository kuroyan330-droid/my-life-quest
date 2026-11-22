
"use client";

import { useEffect, useState } from "react";
type Mission = {
  id: number;
  title: string;
  description: string;
  difficulty: "EASY" | "NORMAL" | "HARD" | "SPECIAL";
  points: number;
  completed: boolean;
};

type Reward = {
  id: number;
  title: string;
  description: string;
  cost: number;
};


const initialMissions: Mission[] = [
  {
    id: 1,
    title: "行政書士を調査する",
    description: "名古屋で共同生活援助の開業に詳しい相談先を探す",
    difficulty: "HARD",
    points: 70,
    completed: false,
  },
  {
    id: 2,
    title: "簿記の勉強",
    description: "簿記2級の学習を30分進める",
    difficulty: "NORMAL",
    points: 30,
    completed: false,
  },
  {
    id: 3,
    title: "ロードバイクで運動",
    description: "自転車で体を動かす",
    difficulty: "NORMAL",
    points: 30,
    completed: false,
  },
];


const initialRewards: Reward[] = [
  {
    id: 1,
    title: "好きなスイーツを食べる",
    description: "頑張った自分への小さなご褒美",
    cost: 50,
  },
  {
    id: 2,
    title: "映画を1本観る",
    description: "ゆっくり映画を楽しむ",
    cost: 100,
  },
  {
    id: 3,
    title: "欲しかった小物を買う",
    description: "前から気になっていたものを購入",
    cost: 300,
  },
  {
    id: 4,
    title: "特別な体験をする",
    description: "旅行やイベントなど特別な時間を楽しむ",
    cost: 1000,
  },
];

export default function Home() {
  const [missions, setMissions] = useState(initialMissions);
  const [xp, setXp] = useState(0);
  const [points, setPoints] = useState(0);
  const [rewards, setRewards] = useState(initialRewards);
  const [newTitle, setNewTitle] = useState("");
const [newDescription, setNewDescription] = useState("");
const [newDifficulty, setNewDifficulty] = useState<Mission["difficulty"]>("NORMAL");

const [editingId, setEditingId] = useState<number | null>(null);
const [isLoaded, setIsLoaded] = useState(false);
useEffect(() => {
  const savedData = localStorage.getItem("myLifeQuest");

  if (savedData) {
    try {
      const data = JSON.parse(savedData);

      if (Array.isArray(data.missions)) {
        setMissions(data.missions);
      }

      if (typeof data.xp === "number") {
        setXp(data.xp);
      }

      if (typeof data.points === "number") {
        setPoints(data.points);
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
    points,
  };

  localStorage.setItem("myLifeQuest", JSON.stringify(data));
}, [missions, xp, points, isLoaded]);
const [editTitle, setEditTitle] = useState("");
const [editDescription, setEditDescription] = useState("");
const [editDifficulty, setEditDifficulty] = useState<Mission["difficulty"]>("NORMAL");
  const level = Math.floor(xp / 100) + 1;
  const levelXp = xp % 100;

 
  const completeMission = (id: number) => {
  const mission = missions.find((item) => item.id === id);

  if (!mission || mission.completed) return;

  setMissions((prev) =>
    prev.map((item) =>
      item.id === id ? { ...item, completed: true } : item
    )
  );

  setXp((prev) => prev + mission.points);
  setPoints((prev) => prev + mission.points);
};
const buyReward = (id: number) => {
  const reward = rewards.find((item) => item.id === id);

  if (!reward) return;

  if (points < reward.cost) {
    alert("ポイントが足りません！");
    return;
  }

  setPoints((prev) => prev - reward.cost);

  alert(`${reward.title}を購入しました！`);
};

const deleteMission = (id: number) => {
  setMissions((prev) =>
    prev.filter((mission) => mission.id !== id)
  );
};

const startEditing = (mission: Mission) => {
  setEditingId(mission.id);
  setEditTitle(mission.title);
  setEditDescription(mission.description);
  setEditDifficulty(mission.difficulty);
};

const saveEdit = () => {
  if (!editTitle.trim() || editingId === null) return;

  const pointsByDifficulty = {
    EASY: 10,
    NORMAL: 30,
    HARD: 70,
    SPECIAL: 150,
  };

  setMissions((prev) =>
    prev.map((mission) =>
      mission.id === editingId
        ? {
            ...mission,
            title: editTitle,
            description: editDescription,
            difficulty: editDifficulty,
            points: pointsByDifficulty[editDifficulty],
          }
        : mission
    )
  );

  setEditingId(null);
  setEditTitle("");
  setEditDescription("");
  setEditDifficulty("NORMAL");
};

  const addMission = () => {
    if (!newTitle.trim()) return;

    const pointsByDifficulty = {
      EASY: 10,
      NORMAL: 30,
      HARD: 70,
      SPECIAL: 150,
    };

    const newMission: Mission = {
      id: Date.now(),
      title: newTitle,
      description: newDescription,
      difficulty: newDifficulty,
      points: pointsByDifficulty[newDifficulty],
      completed: false,
    };

    setMissions((prev) => [...prev, newMission]);

    setNewTitle("");
    setNewDescription("");
    setNewDifficulty("NORMAL");
  };

  const difficultyColor = {
    EASY: "text-green-400",
    NORMAL: "text-blue-400",
    HARD: "text-orange-400",
    SPECIAL: "text-purple-400",
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
          <div className="bg-[#1c2230] rounded-2xl p-5 border border-white/5">
            <p className="text-gray-400 text-sm">所持ポイント</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">
              {points} <span className="text-sm">pt</span>
            </p>
          </div>

          <div className="bg-[#1c2230] rounded-2xl p-5 border border-white/5">
            <p className="text-gray-400 text-sm">達成ミッション</p>
            <p className="text-3xl font-bold text-green-400 mt-2">
              {missions.filter((m) => m.completed).length}
              <span className="text-sm text-gray-400"> / {missions.length}</span>
            </p>
          </div>
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
    <option value="EASY">EASY（10pt）</option>
    <option value="NORMAL">NORMAL（30pt）</option>
    <option value="HARD">HARD（70pt）</option>
    <option value="SPECIAL">SPECIAL（150pt）</option>
  </select>

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
                mission.completed ? "opacity-50" : ""
              }`}
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
      <option value="EASY">EASY（10pt）</option>
      <option value="NORMAL">NORMAL（30pt）</option>
      <option value="HARD">HARD（70pt）</option>
      <option value="SPECIAL">SPECIAL（150pt）</option>
    </select>

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
                </div>

                <span className={`text-xs font-bold ${difficultyColor[mission.difficulty]}`}>
                  {mission.difficulty}
                </span>
              </div>

              <div className="flex justify-between items-center mt-5">
                <span className="text-yellow-400 font-bold">
                  +{mission.points} pt / XP
                </span>

                <div className="flex gap-2">
                  <button
  onClick={() => startEditing(mission)}
  className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-sm font-bold transition"
>
  編集
</button>
                  <button
                    onClick={() => deleteMission(mission.id)}
                    className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-xl text-sm font-bold transition"
                  >
                    削除
                  </button>

                  <button
                    onClick={() => completeMission(mission.id)}
                    disabled={mission.completed}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 px-5 py-2 rounded-xl text-sm font-bold transition"
                  >
                    {mission.completed ? "達成済み ✓" : "ミッション達成"}
                  </button>
                </div>
              </div>
            </div>
      
          ))}
        </section>

        {/* REWARD SHOP */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">🎁 REWARD SHOP</h2>
          <p className="text-sm text-gray-400">
            貯めたポイントで自分へのご褒美を手に入れよう！
          </p>

          <div className="grid gap-4">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="bg-[#1c2230] rounded-2xl p-5 border border-white/5"
              >
                <h3 className="font-bold text-lg">{reward.title}</h3>

                <p className="text-gray-400 text-sm mt-2">
                  {reward.description}
                </p>

                <div className="flex justify-between items-center mt-4">
                  <span className="text-yellow-400 font-bold">
                    {reward.cost} pt
                  </span>

                  <button
                    onClick={() => buyReward(reward.id)}
                    className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl text-sm font-bold"
                  >
                    購入する
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>


        <footer className="text-center text-gray-500 text-xs py-5">
          YOUR LIFE IS YOUR GREATEST QUEST.
        </footer>

      </div>
    </main>
  );
}
