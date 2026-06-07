"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  Trash2,
  Trophy,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  assignThirdPlaceGroups,
  prunePicks,
  resolveMatchTeams,
  type Picks,
  type Rankings,
} from "@/lib/bracket";
import {
  GROUPS,
  MATCHES,
  ROUND_ORDER,
  TEAMS,
  type Group,
  type MatchDefinition,
} from "@/lib/data";

type Stage = "groups" | "bracket" | "finish";
type SavedState = {
  rankings: Rankings;
  thirdPlaceGroups: string[];
  picks: Picks;
  goldenBoot: string;
  goldenGlove: string;
};

const STORAGE_KEY = "world-cup-2026-picker:v1";
const MATCH_BY_ID = new Map(MATCHES.map((match) => [match.id, match]));
const GROUP_BY_ID = new Map(GROUPS.map((group) => [group.id, group]));
const GROUP_IDS = new Set(GROUPS.map((group) => group.id));
const TEAM_IDS = new Set(TEAMS.keys());
const CONFETTI_COLORS = ["#f2c94c", "#20d477", "#ffffff", "#e83e4d", "#4f8cff"];
const CONFETTI_PARTICLES = Array.from({ length: 42 }, (_, index) => ({
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  delay: `${(index % 7) * 0.05}s`,
  drift: `${((index * 47) % 220) - 110}px`,
  duration: `${1.9 + (index % 6) * 0.15}s`,
  left: `${(index * 37) % 100}%`,
  spin: `${360 + (index % 5) * 180}deg`,
}));
const FLAG_CODES: Record<string, string> = {
  mex: "mx",
  rsa: "za",
  kor: "kr",
  cze: "cz",
  can: "ca",
  bih: "ba",
  qat: "qa",
  sui: "ch",
  bra: "br",
  mar: "ma",
  hai: "ht",
  sco: "gb-sct",
  usa: "us",
  par: "py",
  aus: "au",
  tur: "tr",
  ger: "de",
  ecu: "ec",
  civ: "ci",
  cuw: "cw",
  ned: "nl",
  jpn: "jp",
  tun: "tn",
  swe: "se",
  bel: "be",
  egy: "eg",
  irn: "ir",
  nzl: "nz",
  esp: "es",
  uru: "uy",
  ksa: "sa",
  cpv: "cv",
  fra: "fr",
  sen: "sn",
  nor: "no",
  irq: "iq",
  arg: "ar",
  aut: "at",
  alg: "dz",
  jor: "jo",
  por: "pt",
  col: "co",
  uzb: "uz",
  cod: "cd",
  eng: "gb-eng",
  cro: "hr",
  gha: "gh",
  pan: "pa",
};
const BRACKET_WINGS = {
  left: [
    { label: "Round of 32", matches: [74, 77, 73, 75, 83, 84, 81, 82] },
    { label: "Round of 16", matches: [89, 90, 93, 94] },
    { label: "Quarter-finals", matches: [97, 98] },
    { label: "Semi-final", matches: [101] },
  ],
  right: [
    { label: "Semi-final", matches: [102] },
    { label: "Quarter-finals", matches: [99, 100] },
    { label: "Round of 16", matches: [91, 92, 95, 96] },
    { label: "Round of 32", matches: [76, 78, 79, 80, 86, 88, 85, 87] },
  ],
} as const;
const STAGES: { id: Stage; label: string; number: number }[] = [
  { id: "groups", label: "Groups", number: 1 },
  { id: "bracket", label: "Knockout", number: 2 },
  { id: "finish", label: "Finish", number: 3 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMatch(matchId: number): MatchDefinition {
  const match = MATCH_BY_ID.get(matchId);
  if (!match) throw new Error(`Unknown match ${matchId}`);
  return match;
}

function getTeam(teamId: string) {
  const team = TEAMS.get(teamId);
  if (!team) throw new Error(`Unknown team ${teamId}`);
  return team;
}

function parseSavedState(value: unknown): SavedState | null {
  if (!isRecord(value)) return null;

  const rankings: Rankings = {};
  if (isRecord(value.rankings)) {
    for (const [groupId, ranking] of Object.entries(value.rankings)) {
      const group = GROUP_BY_ID.get(groupId);
      if (!group || !Array.isArray(ranking)) continue;

      const groupTeamIds = new Set(group.teams.map((team) => team.id));
      rankings[groupId] = [
        ...new Set(
          ranking.filter(
            (teamId): teamId is string =>
              typeof teamId === "string" && groupTeamIds.has(teamId),
          ),
        ),
      ].slice(0, group.teams.length);
    }
  }

  const thirdPlaceGroups = Array.isArray(value.thirdPlaceGroups)
    ? [
        ...new Set(
          value.thirdPlaceGroups.filter(
            (groupId): groupId is string =>
              typeof groupId === "string" &&
              GROUP_IDS.has(groupId) &&
              rankings[groupId]?.length === 4,
          ),
        ),
      ].slice(0, 8)
    : [];

  const rawPicks: Picks = {};
  if (isRecord(value.picks)) {
    for (const [matchId, teamId] of Object.entries(value.picks)) {
      const numericMatchId = Number(matchId);
      if (
        Number.isInteger(numericMatchId) &&
        MATCH_BY_ID.has(numericMatchId) &&
        typeof teamId === "string" &&
        TEAM_IDS.has(teamId)
      ) {
        rawPicks[numericMatchId] = teamId;
      }
    }
  }

  const thirdAssignments = assignThirdPlaceGroups(thirdPlaceGroups);
  return {
    rankings,
    thirdPlaceGroups,
    picks: prunePicks(rawPicks, rankings, thirdAssignments),
    goldenBoot:
      typeof value.goldenBoot === "string" ? value.goldenBoot.slice(0, 80) : "",
    goldenGlove:
      typeof value.goldenGlove === "string"
        ? value.goldenGlove.slice(0, 80)
        : "",
  };
}

function CountryFlag({
  teamId,
  className = "",
}: {
  teamId: string;
  className?: string;
}) {
  const team = TEAMS.get(teamId);
  const flagCode = FLAG_CODES[teamId];
  if (!team || !flagCode) return null;
  return (
    // SVGs are bundled locally so flags also render in exported images.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden="true"
      className={`country-flag ${className}`}
      height="18"
      src={`flags/${flagCode}.svg`}
      width="24"
    />
  );
}

async function waitForPosterAssets(element: HTMLElement) {
  await document.fonts.ready;
  await Promise.all(
    Array.from(element.querySelectorAll("img")).map((image) => {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      return image.decode();
    }),
  );
}

function TeamLabel({
  teamId,
  compact = false,
}: {
  teamId: string;
  compact?: boolean;
}) {
  const team = TEAMS.get(teamId);
  if (!team) return <span>To be decided</span>;
  return (
    <>
      <CountryFlag
        className={compact ? "country-flag--compact" : ""}
        teamId={teamId}
      />
      <span className="truncate font-medium">{team.name}</span>
    </>
  );
}

function SortableRankedTeam({
  teamId,
  index,
  onRemove,
}: {
  teamId: string;
  index: number;
  onRemove: (teamId: string) => void;
}) {
  const team = getTeam(teamId);
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: teamId });

  return (
    <div
      {...listeners}
      className={`ranked-team rank-${index + 1}${isDragging ? " ranked-team--dragging" : ""}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag ${team.name} from position ${index + 1}`}
        className="drag-handle"
        ref={setActivatorNodeRef}
        type="button"
      >
        <GripVertical size={16} />
      </button>
      <span className="rank-number">{index + 1}</span>
      <CountryFlag teamId={team.id} />
      <span className="team-name">{team.name}</span>
      {team.host ? <span className="tag">Host</span> : null}
      {team.debut ? <span className="tag tag--green">Debut</span> : null}
      <button
        aria-label={`Remove ${team.name} from position ${index + 1}`}
        className="remove-ranked-team"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(team.id);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

function GroupCard({
  group,
  ranking,
  onChoose,
  onRemove,
  onReorder,
}: {
  group: Group;
  ranking: string[];
  onChoose: (teamId: string) => void;
  onRemove: (teamId: string) => void;
  onReorder: (ranking: string[]) => void;
}) {
  const remaining = group.teams.filter((team) => !ranking.includes(team.id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ranking.indexOf(String(active.id));
    const newIndex = ranking.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(arrayMove(ranking, oldIndex, newIndex));
    }
  }

  return (
    <article className="group-card">
      <div className="group-card__header">
        <h3>Group {group.id}</h3>
        {ranking.length === 4 ? (
          <span className="done-label">
            <Check size={16} /> Complete
          </span>
        ) : (
          <span className="counter">{ranking.length}/4</span>
        )}
      </div>
      <div className="ranking-list">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={ranking}
            strategy={verticalListSortingStrategy}
          >
            {ranking.map((teamId, index) => (
              <SortableRankedTeam
                index={index}
                key={teamId}
                onRemove={onRemove}
                teamId={teamId}
              />
            ))}
          </SortableContext>
        </DndContext>
        {remaining.map((team) => (
          <button
            className="unranked-team"
            key={team.id}
            onClick={() => onChoose(team.id)}
            type="button"
          >
            <span className="plus">+</span>
            <CountryFlag teamId={team.id} />
            <span className="team-name">{team.name}</span>
            <span className="choose-text">Pick {ranking.length + 1}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function MatchCard({
  match,
  teams,
  selected,
  onPick,
}: {
  match: MatchDefinition;
  teams: [string | null, string | null];
  selected?: string;
  onPick: (teamId: string) => void;
}) {
  return (
    <article className="match-card">
      {teams.map((teamId, index) => (
        <button
          aria-pressed={selected === teamId}
          className={`match-team ${selected === teamId ? "match-team--picked" : ""}`}
          disabled={!teamId}
          key={`${match.id}-${index}`}
          onClick={() => teamId && onPick(teamId)}
          type="button"
        >
          {teamId ? (
            <TeamLabel teamId={teamId} compact />
          ) : (
            <span>Awaiting winner</span>
          )}
          {selected === teamId ? <Check size={14} /> : null}
        </button>
      ))}
    </article>
  );
}

function BracketWing({
  side,
  rankings,
  picks,
  thirdAssignments,
  onPick,
}: {
  side: keyof typeof BRACKET_WINGS;
  rankings: Rankings;
  picks: Picks;
  thirdAssignments: ReturnType<typeof assignThirdPlaceGroups>;
  onPick: (match: MatchDefinition, teamId: string) => void;
}) {
  return BRACKET_WINGS[side].map((round) => (
    <div className={`bracket-column bracket-column--${side}`} key={round.label}>
      <h3>{round.label}</h3>
      <div className="bracket-column__matches">
        {round.matches.map((matchId) => {
          const match = getMatch(matchId);
          return (
            <MatchCard
              key={match.id}
              match={match}
              onPick={(teamId) => onPick(match, teamId)}
              selected={picks[match.id]}
              teams={resolveMatchTeams(
                match,
                rankings,
                picks,
                thirdAssignments,
              )}
            />
          );
        })}
      </div>
    </div>
  ));
}

function PosterMatch({
  match,
  rankings,
  picks,
  thirdAssignments,
}: {
  match: MatchDefinition;
  rankings: Rankings;
  picks: Picks;
  thirdAssignments: ReturnType<typeof assignThirdPlaceGroups>;
}) {
  const teams = resolveMatchTeams(match, rankings, picks, thirdAssignments);
  return (
    <div className="poster-match">
      {teams.map((teamId, index) => (
        <div
          className={
            picks[match.id] === teamId
              ? "poster-match__team poster-match__team--picked"
              : "poster-match__team"
          }
          key={`${match.id}-${index}`}
        >
          {teamId ? <TeamLabel teamId={teamId} compact /> : <span>-</span>}
        </div>
      ))}
    </div>
  );
}

function PosterBracketWing({
  side,
  rankings,
  picks,
  thirdAssignments,
}: {
  side: keyof typeof BRACKET_WINGS;
  rankings: Rankings;
  picks: Picks;
  thirdAssignments: ReturnType<typeof assignThirdPlaceGroups>;
}) {
  return BRACKET_WINGS[side].map((round) => (
    <div className="poster-bracket__column" key={round.label}>
      <h3>{round.label}</h3>
      <div className="poster-bracket__matches">
        {round.matches.map((matchId) => (
          <PosterMatch
            key={matchId}
            match={getMatch(matchId)}
            picks={picks}
            rankings={rankings}
            thirdAssignments={thirdAssignments}
          />
        ))}
      </div>
    </div>
  ));
}

function Poster({
  rankings,
  picks,
  thirdAssignments,
  goldenBoot,
  goldenGlove,
}: {
  rankings: Rankings;
  picks: Picks;
  thirdAssignments: ReturnType<typeof assignThirdPlaceGroups>;
  goldenBoot: string;
  goldenGlove: string;
}) {
  const champion = picks[104] ? TEAMS.get(picks[104]) : null;
  const knockoutRounds = ROUND_ORDER.slice(1).map((round) => ({
    round,
    teams: MATCHES.filter((match) => match.round === round)
      .map((match) => picks[match.id])
      .filter(Boolean),
  }));

  return (
    <div className="poster">
      <header className="poster__header">
        <div>
          <h2>
            World Cup <strong>26</strong> {"Pick'Ems"}
          </h2>
        </div>
        {champion ? (
          <div className="poster__header-champion">
            <span aria-hidden="true">🏆</span> {champion.name}
          </div>
        ) : null}
      </header>
      <section className="poster__groups">
        {GROUPS.map((group) => (
          <div className="poster-group" key={group.id}>
            <h3>Group {group.id}</h3>
            {(rankings[group.id] ?? []).map((teamId, index) => (
              <div className="poster-team" key={teamId}>
                <span>{index + 1}</span>
                <TeamLabel teamId={teamId} compact />
              </div>
            ))}
          </div>
        ))}
      </section>
      <section className="poster__knockout">
        <PosterBracketWing
          picks={picks}
          rankings={rankings}
          side="left"
          thirdAssignments={thirdAssignments}
        />
        <div className="poster-bracket__final">
          <h3>Final</h3>
          <div className="poster-bracket__final-content">
            <PosterMatch
              match={getMatch(104)}
              picks={picks}
              rankings={rankings}
              thirdAssignments={thirdAssignments}
            />
            <Trophy size={34} />
            <div className="poster__champion">
              <span>Champion</span>
              {champion ? (
                <>
                  <CountryFlag
                    className="country-flag--champion"
                    teamId={champion.id}
                  />
                  <strong>{champion.name}</strong>
                </>
              ) : (
                <strong>To be decided</strong>
              )}
            </div>
          </div>
        </div>
        <PosterBracketWing
          picks={picks}
          rankings={rankings}
          side="right"
          thirdAssignments={thirdAssignments}
        />
      </section>
      <section className="poster__knockout-summary">
        <div className="poster__round poster__round--r32">
          <h3>Round of 32 winners</h3>
          <div className="poster__team-grid">
            {MATCHES.filter((match) => match.round === "Round of 32").map(
              (match) => (
                <div className="poster-pick" key={match.id}>
                  {picks[match.id] ? (
                    <TeamLabel teamId={picks[match.id]} compact />
                  ) : (
                    "—"
                  )}
                </div>
              ),
            )}
          </div>
        </div>
        {knockoutRounds.map(({ round, teams }) => (
          <div className="poster__round" key={round}>
            <h3>{round === "Final" ? "Champion" : `${round} winners`}</h3>
            {round === "Final" && champion ? (
              <div className="poster__champion">
                <Trophy size={42} />
                <CountryFlag
                  className="country-flag--champion"
                  teamId={champion.id}
                />
                <strong>{champion.name}</strong>
              </div>
            ) : (
              <div className="poster__team-grid">
                {teams.map((teamId, index) => (
                  <div
                    className="poster-pick"
                    key={`${round}-${teamId}-${index}`}
                  >
                    <TeamLabel teamId={teamId} compact />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
      <footer className="poster__awards">
        <div>
          <span>Golden Boot:</span>
          <strong>{goldenBoot || "—"}</strong>
        </div>
        <div>
          <span>Golden Glove:</span>
          <strong>{goldenGlove || "—"}</strong>
        </div>
      </footer>
    </div>
  );
}

function ChampionConfetti() {
  return (
    <div aria-hidden="true" className="champion-confetti">
      {CONFETTI_PARTICLES.map((particle, index) => (
        <span
          key={index}
          style={
            {
              "--confetti-drift": particle.drift,
              "--confetti-spin": particle.spin,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              backgroundColor: particle.color,
              left: particle.left,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function WorldCupPicker() {
  const [stage, setStage] = useState<Stage>("groups");
  const [rankings, setRankings] = useState<Rankings>({});
  const [thirdPlaceGroups, setThirdPlaceGroups] = useState<string[]>([]);
  const [picks, setPicks] = useState<Picks>({});
  const [goldenBoot, setGoldenBoot] = useState("");
  const [goldenGlove, setGoldenGlove] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [confettiRun, setConfettiRun] = useState(0);
  const [posterPreview, setPosterPreview] = useState({
    height: 0,
    scale: 1,
  });
  const posterShellRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = parseSavedState(JSON.parse(raw));
          if (!saved) throw new Error("Invalid saved prediction");
          setRankings(saved.rankings);
          setThirdPlaceGroups(saved.thirdPlaceGroups);
          setPicks(saved.picks);
          setGoldenBoot(saved.goldenBoot);
          setGoldenGlove(saved.goldenGlove);
        }
      } catch {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Storage may be unavailable in restricted browsing contexts.
        }
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state: SavedState = {
      rankings,
      thirdPlaceGroups,
      picks,
      goldenBoot,
      goldenGlove,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Persistence is optional; the picker remains usable if storage is blocked.
    }
  }, [goldenBoot, goldenGlove, hydrated, picks, rankings, thirdPlaceGroups]);

  useEffect(() => {
    if (stage !== "finish" || !posterShellRef.current || !posterRef.current)
      return;

    const shell = posterShellRef.current;
    const poster = posterRef.current;
    const updatePreview = () => {
      const scale = Math.min(1, shell.clientWidth / 1600);
      setPosterPreview({
        height: poster.scrollHeight * scale,
        scale,
      });
    };
    const observer = new ResizeObserver(updatePreview);
    observer.observe(shell);
    observer.observe(poster);
    updatePreview();
    return () => observer.disconnect();
  }, [stage]);

  useEffect(
    () => () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    },
    [],
  );

  const completedGroups = GROUPS.filter(
    (group) => rankings[group.id]?.length === 4,
  ).length;
  const groupsComplete = completedGroups === GROUPS.length;
  const thirdAssignments = useMemo(
    () => assignThirdPlaceGroups(thirdPlaceGroups),
    [thirdPlaceGroups],
  );
  const bracketReady =
    groupsComplete &&
    thirdPlaceGroups.length === 8 &&
    Boolean(thirdAssignments);
  const bracketComplete = MATCHES.every((match) => Boolean(picks[match.id]));

  function updateRanking(groupId: string, nextRanking: string[]) {
    const next = { ...rankings, [groupId]: nextRanking };
    const assignments = assignThirdPlaceGroups(thirdPlaceGroups);
    setRankings(next);
    setPicks((current) => prunePicks(current, next, assignments));
  }

  function chooseTeam(groupId: string, teamId: string) {
    const current = rankings[groupId] ?? [];
    if (current.length < 4 && !current.includes(teamId)) {
      updateRanking(groupId, [...current, teamId]);
    }
  }

  function toggleThirdPlace(groupId: string) {
    const isSelected = thirdPlaceGroups.includes(groupId);
    if (!isSelected && thirdPlaceGroups.length === 8) return;
    const next = isSelected
      ? thirdPlaceGroups.filter((id) => id !== groupId)
      : [...thirdPlaceGroups, groupId];
    const assignments = assignThirdPlaceGroups(next);
    setThirdPlaceGroups(next);
    setPicks((current) => prunePicks(current, rankings, assignments));
  }

  function pickWinner(match: MatchDefinition, teamId: string) {
    const next = { ...picks, [match.id]: teamId };
    setPicks(prunePicks(next, rankings, thirdAssignments));
    if (match.id === 104 && picks[104] !== teamId) {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
      setConfettiRun((run) => run + 1);
      confettiTimeoutRef.current = setTimeout(() => {
        setConfettiRun(0);
        confettiTimeoutRef.current = null;
      }, 2800);
    }
  }

  async function exportPoster() {
    if (!posterRef.current) return;
    setExportError("");
    setExporting(true);
    try {
      await waitForPosterAssets(posterRef.current);
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 1.5,
        backgroundColor: "#07110f",
        skipAutoScale: true,
      });
      const link = document.createElement("a");
      link.download = "world-cup-2026-prediction.png";
      link.href = dataUrl;
      link.click();
    } catch {
      setExportError("Could not create the image. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function resetAll() {
    if (!window.confirm("Clear your entire prediction and start again?"))
      return;
    setRankings({});
    setThirdPlaceGroups([]);
    setPicks({});
    setGoldenBoot("");
    setGoldenGlove("");
    setStage("groups");
  }

  return (
    <main>
      {confettiRun ? <ChampionConfetti key={confettiRun} /> : null}
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Road to 26 home">
          <span className="brand-mark">26</span>
          <span>{"Pick'Ems"}</span>
        </a>
        <button className="ghost-button" onClick={resetAll} type="button">
          <Trash2 size={15} /> Reset
        </button>
      </header>

      <div id="top" className="hero">
        <h1>
          Call every group.
          <br />
          <em>Crown your World Cup champion.</em>
        </h1>
        <p>
          Rank all 12 groups, build the knockout bracket, and share your
          prediction.
        </p>
      </div>

      <nav className="stage-nav" aria-label="Prediction stages">
        {STAGES.map((item) => {
          const active = stage === item.id;
          const complete =
            item.id === "groups"
              ? bracketReady
              : item.id === "bracket"
                ? bracketComplete
                : false;
          const disabled =
            item.id === "bracket"
              ? !bracketReady
              : item.id === "finish"
                ? !bracketComplete
                : false;
          return (
            <button
              aria-current={active ? "step" : undefined}
              className={active ? "stage-tab stage-tab--active" : "stage-tab"}
              disabled={disabled}
              key={item.id}
              onClick={() => setStage(item.id)}
              type="button"
            >
              <span>{complete ? <Check size={14} /> : item.number}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {stage === "groups" ? (
        <section className="content-section">
          <div className="section-heading">
            <div>
              <h2>Group stage</h2>
              <p className="mobile-ranking-help">
                Tap teams to rank. Drag to reorder.
              </p>
            </div>
            <div className="progress-stat">
              <strong>{completedGroups}</strong>
              <span>of 12 complete</span>
            </div>
          </div>
          <div className="groups-grid">
            {GROUPS.map((group) => (
              <GroupCard
                group={group}
                key={group.id}
                ranking={rankings[group.id] ?? []}
                onChoose={(teamId) => chooseTeam(group.id, teamId)}
                onRemove={(teamId) =>
                  updateRanking(
                    group.id,
                    (rankings[group.id] ?? []).filter((id) => id !== teamId),
                  )
                }
                onReorder={(nextRanking) =>
                  updateRanking(group.id, nextRanking)
                }
              />
            ))}
          </div>

          <section
            className={
              groupsComplete
                ? "third-place-panel"
                : "third-place-panel third-place-panel--locked"
            }
          >
            <div className="third-place-copy">
              <h2>Best third-place teams</h2>
              <p>
                Select the eight third-place finishers you predict will reach
                the Round of 32.
              </p>
            </div>
            <div className="third-place-count">
              <strong>{thirdPlaceGroups.length}</strong>/8 selected
            </div>
            <div className="third-place-grid">
              {GROUPS.map((group) => {
                const teamId = rankings[group.id]?.[2];
                const selected = thirdPlaceGroups.includes(group.id);
                return (
                  <button
                    aria-pressed={selected}
                    className={
                      selected
                        ? "third-team third-team--selected"
                        : "third-team"
                    }
                    disabled={!groupsComplete || !teamId}
                    key={group.id}
                    onClick={() => toggleThirdPlace(group.id)}
                    type="button"
                  >
                    <span className="third-team__group">{group.id}</span>
                    {teamId ? (
                      <TeamLabel teamId={teamId} compact />
                    ) : (
                      <span>Rank group first</span>
                    )}
                    {selected ? <Check size={15} /> : null}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="section-actions">
            <button
              className="primary-button text-lg"
              disabled={!bracketReady}
              onClick={() => {
                setStage("bracket");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              type="button"
            >
              Knockout Stage <ChevronRight size={18} />
            </button>
          </div>
        </section>
      ) : null}

      {stage === "bracket" ? (
        <section className="content-section content-section--wide">
          <div className="section-heading section-heading--center">
            <div>
              <h2>Choose every winner</h2>
              <p>Start at the round of 32 and work toward the final.</p>
            </div>
          </div>
          <div className="bracket-scroll">
            <div className="bracket">
              <BracketWing
                onPick={pickWinner}
                picks={picks}
                rankings={rankings}
                side="left"
                thirdAssignments={thirdAssignments}
              />
              <div className="bracket-final">
                <h3>Final</h3>
                <div className="bracket-final__content">
                  <MatchCard
                    match={getMatch(104)}
                    onPick={(teamId) => pickWinner(getMatch(104), teamId)}
                    selected={picks[104]}
                    teams={resolveMatchTeams(
                      getMatch(104),
                      rankings,
                      picks,
                      thirdAssignments,
                    )}
                  />
                  <Trophy size={38} />
                  <div
                    className={
                      picks[104]
                        ? "bracket-champion bracket-champion--selected"
                        : "bracket-champion"
                    }
                  >
                    <span>Champion</span>
                    {picks[104] ? (
                      <strong>
                        <TeamLabel teamId={picks[104]} />
                      </strong>
                    ) : (
                      <strong>To be decided</strong>
                    )}
                  </div>
                </div>
              </div>
              <BracketWing
                onPick={pickWinner}
                picks={picks}
                rankings={rankings}
                side="right"
                thirdAssignments={thirdAssignments}
              />
            </div>
          </div>
          <div className="section-actions section-actions--split">
            <button
              className="secondary-button"
              onClick={() => setStage("groups")}
              type="button"
            >
              <ChevronLeft size={18} /> Edit groups
            </button>
            <button
              className="primary-button"
              disabled={!bracketComplete}
              onClick={() => {
                setStage("finish");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              type="button"
            >
              Finish up <ChevronRight size={18} />
            </button>
          </div>
        </section>
      ) : null}

      {stage === "finish" ? (
        <section className="content-section finish-section">
          <div className="section-heading section-heading--center">
            <div>
              <h2>Complete your prediction</h2>
              <p>Add award winners, then download your prediction.</p>
            </div>
          </div>
          <div className="award-form">
            <label>
              <span>
                Golden Boot winner <small>Optional</small>
              </span>
              <input
                maxLength={80}
                value={goldenBoot}
                onChange={(event) => setGoldenBoot(event.target.value)}
                placeholder="Player name"
              />
            </label>
            <label>
              <span>
                Golden Glove winner <small>Optional</small>
              </span>
              <input
                maxLength={80}
                value={goldenGlove}
                onChange={(event) => setGoldenGlove(event.target.value)}
                placeholder="Goalkeeper name"
              />
            </label>
          </div>
          <div className="poster-shell" ref={posterShellRef}>
            <div
              className="poster-preview"
              style={{ height: posterPreview.height || undefined }}
            >
              <div
                className="poster-preview__scale"
                style={{
                  transform: `translateX(-50%) scale(${posterPreview.scale})`,
                }}
              >
                <div ref={posterRef}>
                  <Poster
                    goldenBoot={goldenBoot}
                    goldenGlove={goldenGlove}
                    picks={picks}
                    rankings={rankings}
                    thirdAssignments={thirdAssignments}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="section-actions section-actions--split">
            <button
              className="secondary-button"
              onClick={() => setStage("bracket")}
              type="button"
            >
              <ChevronLeft size={18} /> Edit bracket
            </button>
            <button
              className="primary-button"
              disabled={exporting}
              onClick={exportPoster}
              type="button"
            >
              <Download size={18} />{" "}
              {exporting
                ? "Creating image..."
                : "Download your prediction image"}
            </button>
          </div>
          {exportError ? (
            <p className="export-error" role="alert">
              {exportError}
            </p>
          ) : null}
        </section>
      ) : null}

      <footer className="site-footer">
        <span>Unofficial World Cup 2026 predictor</span>
        <span>Groups and bracket verified against FIFA match schedule</span>
      </footer>
    </main>
  );
}
