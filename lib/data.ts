export type Team = {
  id: string;
  name: string;
  flag: string;
  host?: boolean;
  debut?: boolean;
};

export type Group = { id: string; teams: Team[] };

const team = (
  id: string,
  name: string,
  flag: string,
  meta: Pick<Team, "host" | "debut"> = {},
): Team => ({ id, name, flag, ...meta });

export const GROUPS: Group[] = [
  { id: "A", teams: [team("mex", "Mexico", "🇲🇽", { host: true }), team("rsa", "South Africa", "🇿🇦"), team("kor", "Korea Republic", "🇰🇷"), team("cze", "Czechia", "🇨🇿")] },
  { id: "B", teams: [team("can", "Canada", "🇨🇦", { host: true }), team("bih", "Bosnia & Herzegovina", "🇧🇦"), team("qat", "Qatar", "🇶🇦"), team("sui", "Switzerland", "🇨🇭")] },
  { id: "C", teams: [team("bra", "Brazil", "🇧🇷"), team("mar", "Morocco", "🇲🇦"), team("hai", "Haiti", "🇭🇹"), team("sco", "Scotland", "🏴")] },
  { id: "D", teams: [team("usa", "USA", "🇺🇸", { host: true }), team("par", "Paraguay", "🇵🇾"), team("aus", "Australia", "🇦🇺"), team("tur", "Türkiye", "🇹🇷")] },
  { id: "E", teams: [team("ger", "Germany", "🇩🇪"), team("ecu", "Ecuador", "🇪🇨"), team("civ", "Côte d’Ivoire", "🇨🇮"), team("cuw", "Curaçao", "🇨🇼", { debut: true })] },
  { id: "F", teams: [team("ned", "Netherlands", "🇳🇱"), team("jpn", "Japan", "🇯🇵"), team("tun", "Tunisia", "🇹🇳"), team("swe", "Sweden", "🇸🇪")] },
  { id: "G", teams: [team("bel", "Belgium", "🇧🇪"), team("egy", "Egypt", "🇪🇬"), team("irn", "IR Iran", "🇮🇷"), team("nzl", "New Zealand", "🇳🇿")] },
  { id: "H", teams: [team("esp", "Spain", "🇪🇸"), team("uru", "Uruguay", "🇺🇾"), team("ksa", "Saudi Arabia", "🇸🇦"), team("cpv", "Cabo Verde", "🇨🇻", { debut: true })] },
  { id: "I", teams: [team("fra", "France", "🇫🇷"), team("sen", "Senegal", "🇸🇳"), team("nor", "Norway", "🇳🇴"), team("irq", "Iraq", "🇮🇶")] },
  { id: "J", teams: [team("arg", "Argentina", "🇦🇷"), team("aut", "Austria", "🇦🇹"), team("alg", "Algeria", "🇩🇿"), team("jor", "Jordan", "🇯🇴", { debut: true })] },
  { id: "K", teams: [team("por", "Portugal", "🇵🇹"), team("col", "Colombia", "🇨🇴"), team("uzb", "Uzbekistan", "🇺🇿", { debut: true }), team("cod", "Congo DR", "🇨🇩")] },
  { id: "L", teams: [team("eng", "England", "🏴"), team("cro", "Croatia", "🇭🇷"), team("gha", "Ghana", "🇬🇭"), team("pan", "Panama", "🇵🇦")] },
];

export const TEAMS = new Map(
  GROUPS.flatMap((group) => group.teams.map((item) => [item.id, item])),
);

export type Seed =
  | { type: "position"; group: string; position: 1 | 2 }
  | { type: "third"; groups: string[] }
  | { type: "winner"; match: number };

export type MatchDefinition = {
  id: number;
  round: "Round of 32" | "Round of 16" | "Quarter-final" | "Semi-final" | "Final";
  home: Seed;
  away: Seed;
};

const position = (group: string, value: 1 | 2): Seed => ({ type: "position", group, position: value });
const third = (groups: string): Seed => ({ type: "third", groups: groups.split("") });
const winner = (match: number): Seed => ({ type: "winner", match });

export const MATCHES: MatchDefinition[] = [
  { id: 73, round: "Round of 32", home: position("A", 2), away: position("B", 2) },
  { id: 74, round: "Round of 32", home: position("E", 1), away: third("ABCDF") },
  { id: 75, round: "Round of 32", home: position("F", 1), away: position("C", 2) },
  { id: 76, round: "Round of 32", home: position("C", 1), away: position("F", 2) },
  { id: 77, round: "Round of 32", home: position("I", 1), away: third("CDFGH") },
  { id: 78, round: "Round of 32", home: position("E", 2), away: position("I", 2) },
  { id: 79, round: "Round of 32", home: position("A", 1), away: third("CEFHI") },
  { id: 80, round: "Round of 32", home: position("L", 1), away: third("EHIJK") },
  { id: 81, round: "Round of 32", home: position("D", 1), away: third("BEFIJ") },
  { id: 82, round: "Round of 32", home: position("G", 1), away: third("AEHIJ") },
  { id: 83, round: "Round of 32", home: position("K", 2), away: position("L", 2) },
  { id: 84, round: "Round of 32", home: position("H", 1), away: position("J", 2) },
  { id: 85, round: "Round of 32", home: position("B", 1), away: third("EFGIJ") },
  { id: 86, round: "Round of 32", home: position("J", 1), away: position("H", 2) },
  { id: 87, round: "Round of 32", home: position("K", 1), away: third("DEIJL") },
  { id: 88, round: "Round of 32", home: position("D", 2), away: position("G", 2) },
  { id: 89, round: "Round of 16", home: winner(74), away: winner(77) },
  { id: 90, round: "Round of 16", home: winner(73), away: winner(75) },
  { id: 91, round: "Round of 16", home: winner(76), away: winner(78) },
  { id: 92, round: "Round of 16", home: winner(79), away: winner(80) },
  { id: 93, round: "Round of 16", home: winner(83), away: winner(84) },
  { id: 94, round: "Round of 16", home: winner(81), away: winner(82) },
  { id: 95, round: "Round of 16", home: winner(86), away: winner(88) },
  { id: 96, round: "Round of 16", home: winner(85), away: winner(87) },
  { id: 97, round: "Quarter-final", home: winner(89), away: winner(90) },
  { id: 98, round: "Quarter-final", home: winner(93), away: winner(94) },
  { id: 99, round: "Quarter-final", home: winner(91), away: winner(92) },
  { id: 100, round: "Quarter-final", home: winner(95), away: winner(96) },
  { id: 101, round: "Semi-final", home: winner(97), away: winner(98) },
  { id: 102, round: "Semi-final", home: winner(99), away: winner(100) },
  { id: 104, round: "Final", home: winner(101), away: winner(102) },
];

export const ROUND_ORDER = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Final"] as const;
