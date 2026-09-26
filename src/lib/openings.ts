export type Opening = {
  id: string;
  name: string;
  color: "white" | "black";
  level: "beginner" | "intermediate" | "advanced";
  blurb: string;
  chapters: { name: string; moves: string[] }[];
};

export const OPENINGS: Opening[] = [
  {
    id: "london",
    name: "London System",
    color: "white",
    level: "beginner",
    blurb: "A solid pyramid with pawns on c3, d4, e3 and a bishop on f4.",
    chapters: [
      { name: "Main line", moves: ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6", "e3", "c5", "c3", "Nc6", "Nbd2", "Bd6", "Bg3"] },
      { name: "Vs kingside fianchetto", moves: ["d4", "Nf6", "Nf3", "g6", "Bf4", "Bg7", "e3", "O-O", "Be2", "d6", "h3"] },
    ],
  },
  {
    id: "italian",
    name: "Italian Game",
    color: "white",
    level: "beginner",
    blurb: "Giuoco Piano and the classic two-knights fights after Bc4.",
    chapters: [
      { name: "Giuoco Piano", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3", "d6", "O-O", "O-O"] },
      { name: "Two Knights", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Na5"] },
    ],
  },
  {
    id: "ruy",
    name: "Ruy Lopez",
    color: "white",
    level: "intermediate",
    blurb: "The Spanish: Bb5, then a6 and the closed main lines.",
    chapters: [
      { name: "Closed", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6"] },
      { name: "Berlin", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O", "Nxe4", "d4", "Nd6"] },
    ],
  },
  {
    id: "qg",
    name: "Queen's Gambit",
    color: "white",
    level: "intermediate",
    blurb: "1.d4 d5 2.c4 — accepted, declined, and the Slav structures.",
    chapters: [
      { name: "Declined", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3"] },
      { name: "Accepted", moves: ["d4", "d5", "c4", "dxc4", "Nf3", "Nf6", "e3", "e6", "Bxc4", "c5"] },
    ],
  },
  {
    id: "sicilian",
    name: "Sicilian Defense",
    color: "black",
    level: "intermediate",
    blurb: "Black's sharpest reply to 1.e4. Najdorf-shaped Open Sicilian.",
    chapters: [
      { name: "Open / Najdorf shape", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },
      { name: "Dragon shape", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"] },
    ],
  },
  {
    id: "caro",
    name: "Caro-Kann Defense",
    color: "black",
    level: "beginner",
    blurb: "Solid 1...c6 and 2...d5. Classical and Advance.",
    chapters: [
      { name: "Classical", moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5", "Ng3", "Bg6"] },
      { name: "Advance", moves: ["e4", "c6", "d4", "d5", "e5", "Bf5", "Nf3", "e6", "Be2", "c5"] },
    ],
  },
  {
    id: "french",
    name: "French Defense",
    color: "black",
    level: "intermediate",
    blurb: "1...e6 and 2...d5. Advance and Winawer sketches.",
    chapters: [
      { name: "Advance", moves: ["e4", "e6", "d4", "d5", "e5", "c5", "c3", "Nc6", "Nf3", "Qb6"] },
      { name: "Winawer", moves: ["e4", "e6", "d4", "d5", "Nc3", "Bb4", "e5", "c5", "a3", "Bxc3+", "bxc3"] },
    ],
  },
  {
    id: "qgd",
    name: "Queen's Gambit Declined",
    color: "black",
    level: "beginner",
    blurb: "Black's most solid answer to 1.d4 d5 2.c4.",
    chapters: [
      { name: "Orthodox", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3", "Nbd7"] },
      { name: "Exchange", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5", "exd5", "Bg5", "Be7"] },
    ],
  },
];
