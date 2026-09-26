import type { Metadata } from "next";
import { meta } from "@/lib/seo";

export const metadata: Metadata = meta({
  title: "About",
  description:
    "ChessLab is a local-first chess toolkit. Stockfish runs in your browser. Analyze, train, and play.",
  path: "/about",
});

export default function Page() {
  return (
    <>
      <h1 className="page-title">About ChessLab</h1>
      <p className="lede">
        A local-first lab for chess: analyze games, train tactics, play a coaching bot, and review what went wrong.
      </p>
      <div className="panel" style={{ maxWidth: 640 }}>
        <p style={{ marginBottom: 8 }}>
          Stockfish runs in your browser as WebAssembly. Games are not uploaded. Puzzles and opening names come from
          public Lichess APIs; Chess.com games come from their public archives.
        </p>
        <p>
          Built with Next.js, chess.js, react-chessboard, and Stockfish. Engine licensed under GPL-3.0.
        </p>
      </div>
    </>
  );
}
