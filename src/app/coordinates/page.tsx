"use client";

import { useEffect, useState } from "react";
import { Board } from "@/components/Board";

const FILES = "abcdefgh";

function randSq(): string {
  return `${FILES[Math.floor(Math.random() * 8)]}${1 + Math.floor(Math.random() * 8)}`;
}

export default function Page() {
  const [target, setTarget] = useState("e4");
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          setRunning(false);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const start = () => {
    setScore(0);
    setLeft(30);
    setRunning(true);
    setTarget(randSq());
  };

  return (
    <>
      <h1 className="page-title">Coordinate trainer</h1>
      <p className="lede">Click the named square. Thirty seconds.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn btn-primary" onClick={start} disabled={running}>
          Start
        </button>
        <strong style={{ fontSize: 28 }}>{target}</strong>
        <span>Score {score}</span>
        <span>{left}s</span>
      </div>
      <Board
        fen="8/8/8/8/8/8/8/8 w - - 0 1"
        allowDrag={false}
        onSquareClick={(sq) => {
          if (!running) return;
          if (sq === target) {
            setScore((s) => s + 1);
            setTarget(randSq());
          }
        }}
      />
    </>
  );
}
