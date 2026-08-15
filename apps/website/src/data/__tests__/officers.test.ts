import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import officers from "../officers.json";
import archiveOfficers from "../officers-2025-2026.json";
import pastBoards from "../pastBoards.json";

const officersDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../images/officers",
);

const ROLE_EMAIL = /^[a-z]+@ieeeatucsd\.org$/;
const KNOWN_TYPES = ["Executives", "Internal", "Events", "Projects"];

const currentNames = [
  "Aiden Bassette",
  "Cameryn Mugol",
  "Ridhi Srikanth",
  "Raymond Rada",
  "Riya Bhatia",
  "Daniel Xu",
  "Hannah Fletcher",
  "Kelly Guan",
  "Oscar Canizales",
  "Gabriel Haresco",
  "Clover Li",
  "Sukhjeet Sekhon",
  "Samuel Park",
  "Johnathon Reidel",
  "Derrick Do",
  "Aryen Singhal",
  "Nishant Sharma",
  "Paul Moore",
  "Ki Diaz",
  "Daniel Hong",
  "Royce Li",
  "Anthony Zheng",
];

const outgoingNames = [
  "Erik Duarte",
  "Wan-Rong Leung",
  "Akhil Ram Shankar",
  "Anupama Nambiar",
  "Charles Nguyen",
  "Aiden Bassette",
  "Anusha Chadalavada",
  "Raymond Rada",
  "Lukas Cao",
  "Gauri Renjith",
  "Ferrari Guan",
  "Angel Rinea Arguilla",
  "Iris Chou",
  "Ridhi Srikanth",
  "Aryen Singhal",
  "Riya Bhatia",
  "Anika Agarwal",
  "Aaditya Pillai",
  "Kelly Guan",
  "Cailey Murad",
  "Andy Smithwick",
  "Shing Hung",
  "Katie Ngo",
  "Daniel Xu",
  "Lauren Vo",
  "Loraine Diosa",
  "Christine Uy",
  "Emma Pan",
  "Cameryn Mugol",
  "Paul Moore",
];

function pictureFilename(picture: string) {
  const base = picture.split("/").pop() || "";
  return base.endsWith(".webp") ? base : `${base}.webp`;
}

function assertRoster(
  roster: typeof officers,
  expectedNames: string[],
  reusedPhotos: Record<string, string>,
) {
  expect(roster.map((officer) => officer.name)).toEqual(expectedNames);

  for (const officer of roster) {
    expect(officer.name).toBe(officer.name.trim());
    expect(officer.name.length).toBeGreaterThan(0);
    expect(officer.position.length).toBeGreaterThan(0);
    expect(officer.email).toMatch(ROLE_EMAIL);
    expect(officer.type.length).toBeGreaterThan(0);
    expect(officer.type.every((type) => KNOWN_TYPES.includes(type))).toBe(true);
    expect(officer.picture).not.toMatch(/placehold\.co/i);
    expect(officer.email).not.toMatch(/@(gmail|yahoo|outlook|ucsd)\./i);

    if (officer.picture) {
      expect(officer.picture.startsWith("/officers/")).toBe(true);
      expect(
        existsSync(join(officersDir, pictureFilename(officer.picture))),
      ).toBe(true);
    }
  }

  for (const [name, picture] of Object.entries(reusedPhotos)) {
    const officer = roster.find((entry) => entry.name === name);
    expect(officer?.picture).toBe(picture);
  }
}

describe("current board roster", () => {
  it("lists the incoming board, keeps Aryen, and skips vacant slots", () => {
    assertRoster(officers, currentNames, {
      "Aiden Bassette": "/officers/aiden.webp",
      "Cameryn Mugol": "/officers/cameryn.webp",
      "Ridhi Srikanth": "/officers/ridhi.webp",
      "Raymond Rada": "/officers/raymond.webp",
      "Daniel Xu": "/officers/daniel.webp",
      "Kelly Guan": "/officers/kelly.webp",
      "Paul Moore": "/officers/paul.webp",
      "Aryen Singhal": "/officers/aryen.webp",
    });

    const aryen = officers.find((officer) => officer.name === "Aryen Singhal");
    expect(aryen?.position).toBe("Technical Chair");

    expect(
      officers.some((officer) => officer.position === "Outreach Chair"),
    ).toBe(false);
    expect(officers.some((officer) => officer.position === "UI/UX Chair")).toBe(
      false,
    );
    expect(
      officers.filter((officer) => officer.position === "Webmaster"),
    ).toHaveLength(1);
  });

  it("maps new roles onto existing board types", () => {
    const projectsChair = officers.find(
      (officer) => officer.name === "Raymond Rada",
    );
    expect(projectsChair?.position).toBe("Vice Chair Projects");
    expect(projectsChair?.type).toEqual(["Executives", "Projects"]);

    const projectSpace = officers.find(
      (officer) => officer.name === "Oscar Canizales",
    );
    expect(projectSpace?.position).toBe("Project Space Chair");
    expect(projectSpace?.type).toEqual(["Projects"]);
  });

  it("leaves people without a real photo blank", () => {
    const riya = officers.find((officer) => officer.name === "Riya Bhatia");
    expect(riya?.picture).toBe("");
  });
});

describe("2025-2026 board archive", () => {
  it("preserves the outgoing board and their existing photos", () => {
    assertRoster(archiveOfficers, outgoingNames, {
      "Erik Duarte": "/officers/erik.webp",
      "Aiden Bassette": "/officers/aiden.webp",
      "Cailey Murad": "/officers/cailey.webp",
      "Paul Moore": "/officers/paul.webp",
    });
  });
});

describe("past boards index", () => {
  it("lists the 2025-2026 board as an archive entry", () => {
    expect(pastBoards).toEqual([
      {
        year: "2025–2026",
        href: "/board/2025-2026",
        summary: "Chair Erik Duarte and the 2025–2026 officer team.",
      },
    ]);
  });
});
