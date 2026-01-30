"use client";

import { useEffect, useState, useRef } from "react";
import { fetchProblem, createProblem } from "../api";
import YouTubePlayer, { YouTubePlayerHandle } from "../components/YoutubePlayer";

type Option = {
  id: string;
  word: string;
};

type Problem = {
  problem_id: string;
  video_id: string;
  context: string[];
  time: [number, number];
  options: Option[];
  answer: string[];
};

// 安全な初期値を設定
const defaultProblem: Problem = {
  problem_id: "0",
  video_id: "",
  context: ["", "", ""],
  time: [0, 0],
  options: [],
  answer: [],
};

export default function Page() {
  const [problem, setProblem] = useState<Problem>(defaultProblem);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);

  const playerRef = useRef<YouTubePlayerHandle>(null);

  /** 初期問題取得 */
  useEffect(() => {
    fetchProblem()
      .then((p) => {
        if (p) setProblem(p);
      })
      .catch(() => setError("問題を取得できませんでした"));
  }, []);

  /** 安全な派生変数 */
  const options = problem.options ?? [];
  const optionCount = options.length;
  const contextBefore = problem.context?.[0] ?? "";
  const contextAfter = problem.context?.[2] ?? "";
  const startTime = problem.time?.[0] ?? 0;
  const endTime = problem.time?.[1] ?? 0;
  const allSelected = optionCount > 0 && selectedOptionIds.length === optionCount;

  /** 単語選択 */
  const handleWordClick = (id: string) => {
    if (selectedOptionIds.includes(id)) return;
    setSelectedOptionIds((prev) => [...prev, id]);
  };

  /** 選択取り消し */
  const handleRemoveSelectedWord = (index: number) => {
    setSelectedOptionIds((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  /** 判定 */
  const handleSubmit = () => {
    if (!problem.answer || problem.answer.length === 0) {
      console.warn("正解データがありません");
      return;
    }

    const selectedWords = selectedOptionIds.map(id => {
      const opt = options.find(o => o.id === id);
      return opt?.word ?? "";
    })

    // 比較
    const isCorrect =
      selectedWords.length === problem.answer.length &&
      selectedWords.every((word, idx) => word === problem.answer[idx]);

    setResult(isCorrect ? "correct" : "incorrect");
  };

  /** リセット */
  const handleReset = () => {
    setSelectedOptionIds([]);
    setResult(null);
  };

  /** 次の問題 */
  const handleNextProblem = async () => {
    try {
      setIsLoadingNext(true);
      setResult(null);
      setSelectedOptionIds([]);

      const next = await createProblem();
      if (next) setProblem(next);
    } catch {
      setError("次の問題を作成できませんでした");
    } finally {
      setIsLoadingNext(false);
    }
  };

  const blankBg =
    result === "correct"
      ? "#dcfce7"
      : result === "incorrect"
      ? "#fee2e2"
      : "#eef2ff";

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: 24,
        background: "#ffffff",
        color: "#111",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* YouTubeプレイヤー */}
      <div style={{ width: "100%", height: 315, marginBottom: 12 }}>
        {problem.video_id ? (
          <YouTubePlayer
            ref={playerRef}
            videoId={problem.video_id}
            start={startTime}
            end={endTime}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#eee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontWeight: 600,
            }}
          >
            動画を読み込み中...
          </div>
        )}
      </div>

      <button
        onClick={() => playerRef.current?.replay()}
        style={{
          marginTop: 12,
          padding: "8px 16px",
          background: "#4f46e5",
          color: "#fff",
          borderRadius: 6,
          fontWeight: 600,
        }}
      >
        もう一度再生
      </button>

      {/* 文脈 */}
      <div style={{ marginTop: 24, fontSize: 18, lineHeight: 1.7 }}>
        <p>{contextBefore}</p>

        {/* 穴埋め */}
        <div
          style={{
            margin: "16px 0",
            padding: "12px",
            border: "2px dashed #4f46e5",
            background: blankBg,
            borderRadius: 8,
            textAlign: "center",
            minHeight: 48,
          }}
        >
          {selectedOptionIds.length === 0 ? (
            <span style={{ fontWeight: 600 }}>_____</span>
          ) : (
            selectedOptionIds.map((id, idx) => {
              const option = options.find((o) => o.id === id);
              if (!option) return null;

              return (
                <span
                  key={`${id}-${idx}`}
                  onClick={() => handleRemoveSelectedWord(idx)}
                  style={{
                    margin: "0 4px",
                    padding: "4px 8px",
                    background: "#fff",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 600,
                    display: "inline-block",
                  }}
                >
                  {option.word}
                </span>
              );
            })
          )}
        </div>

        <p>{contextAfter}</p>
      </div>

      {/* リセット */}
      <button
        onClick={handleReset}
        style={{
          marginTop: 12,
          padding: "6px 12px",
          background: "#f3f4f6",
          border: "1px solid #ccc",
          borderRadius: 6,
          fontWeight: 500,
        }}
      >
        リセット
      </button>

      {/* 選択肢 */}
      <div style={{ marginTop: 32 }}>
        <p style={{ marginBottom: 12, fontWeight: 600 }}>
          単語をクリックして文を完成させてください：
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {options.map((option) => {
            const isSelected = selectedOptionIds.includes(option.id);

            return (
              <span
                key={option.id}
                onClick={() => handleWordClick(option.id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: isSelected ? "#e5e7eb" : "#ffffff",
                  color: isSelected ? "#9ca3af" : "#111",
                  border: "1px solid #ccc",
                  cursor: isSelected ? "not-allowed" : "pointer",
                  userSelect: "none",
                  fontWeight: 500,
                }}
              >
                {option.word}
              </span>
            );
          })}
        </div>
      </div>

      {/* 回答送信 */}
      <div
        style={{
          marginTop: 32,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <button
          disabled={!allSelected}
          onClick={handleSubmit}
          style={{
            padding: "10px 20px",
            borderRadius: 6,
            fontWeight: 700,
            color: "#fff",
            background: allSelected ? "#dc2626" : "#fca5a5",
            cursor: allSelected ? "pointer" : "not-allowed",
          }}
        >
          回答送信
        </button>

        {result && (
          <span
            style={{
              fontWeight: 700,
              color: result === "correct" ? "#16a34a" : "#dc2626",
            }}
          >
            {result === "correct" ? "正解！" : "不正解"}
          </span>
        )}

        {result === "correct" && (
          <button
            onClick={handleNextProblem}
            disabled={isLoadingNext}
            style={{
              padding: "10px 18px",
              borderRadius: 6,
              fontWeight: 700,
              background: "#16a34a",
              color: "#fff",
              opacity: isLoadingNext ? 0.6 : 1,
              cursor: isLoadingNext ? "not-allowed" : "pointer",
            }}
          >
            {isLoadingNext ? "Loading..." : "次の問題"}
          </button>
        )}
      </div>
    </main>
  );
}
