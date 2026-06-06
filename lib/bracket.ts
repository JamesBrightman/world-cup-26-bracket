import { MATCHES, type MatchDefinition, type Seed } from "@/lib/data";
import { THIRD_PLACE_TABLE } from "@/lib/third-place-table";

export type Rankings = Record<string, string[]>;
export type Picks = Record<number, string>;
export type ThirdAssignments = Record<number, string>;

export function assignThirdPlaceGroups(
  qualifiedGroups: string[],
): ThirdAssignments | null {
  if (qualifiedGroups.length !== 8) return null;
  const key = [...qualifiedGroups].sort().join("");
  const assignment = THIRD_PLACE_TABLE[key];
  if (!assignment) return null;

  const matchIdsByWinnerColumn = [79, 85, 81, 74, 82, 77, 87, 80];
  return Object.fromEntries(
    matchIdsByWinnerColumn.map((matchId, index) => [matchId, assignment[index]]),
  );
}

function resolveSeed(
  seed: Seed,
  match: MatchDefinition,
  rankings: Rankings,
  picks: Picks,
  thirdAssignments: ThirdAssignments | null,
): string | null {
  if (seed.type === "position") {
    return rankings[seed.group]?.[seed.position - 1] ?? null;
  }
  if (seed.type === "winner") return picks[seed.match] ?? null;
  const group = thirdAssignments?.[match.id];
  return group ? rankings[group]?.[2] ?? null : null;
}

export function resolveMatchTeams(
  match: MatchDefinition,
  rankings: Rankings,
  picks: Picks,
  thirdAssignments: ThirdAssignments | null,
): [string | null, string | null] {
  return [
    resolveSeed(match.home, match, rankings, picks, thirdAssignments),
    resolveSeed(match.away, match, rankings, picks, thirdAssignments),
  ];
}

export function prunePicks(
  picks: Picks,
  rankings: Rankings,
  thirdAssignments: ThirdAssignments | null,
): Picks {
  const valid: Picks = {};
  for (const match of MATCHES) {
    const [home, away] = resolveMatchTeams(match, rankings, valid, thirdAssignments);
    const pick = picks[match.id];
    if (pick && (pick === home || pick === away)) valid[match.id] = pick;
  }
  return valid;
}
