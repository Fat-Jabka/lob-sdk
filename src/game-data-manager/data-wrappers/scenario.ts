import {
  GameTrigger,
  ObjectiveDto,
  PlayerSetup,
  TerrainType,
  AnyInstruction,
  Size,
} from "@lob-sdk/types";
import { Tutorial } from "@lob-sdk/types/tutorial";
import { UnitDtoPartialId } from "./unit";
import { STAT_PRECISION_SCALE } from "./scale";

export type GameLocales = {
  [language: string]: Record<string, string>;
};

export enum GameScenarioType {
  /** Preset scenario with a fixed map and unit placement. */
  Preset = "preset",
  /** Randomly generated scenario. */
  Random = "random",
  /** Hybrid scenario combining preset and random elements. */
  Hybrid = "hybrid",
}

/**
 * Role of a deployment zone — decides which units can deploy there. Units whose
 * template has `canDeployForward: true` go in `forward` zones; the rest go in
 * `main` zones.
 */
export type DeploymentZoneType = "main" | "forward";

export interface TeamDeploymentZone {
  team: number;
  type: DeploymentZoneType;
  /** Top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * All deployment zones that belong to a team. The array may contain N zones of
 * each type; consumers should filter by {@link DeploymentZoneType}.
 */
export interface TeamDeploymentZones {
  team: number;
  zones: TeamDeploymentZone[];
}

/** Returns the first zone of the given type, or undefined if none exist. */
export const getDeploymentZone = (
  tdz: TeamDeploymentZones,
  type: DeploymentZoneType,
): TeamDeploymentZone | undefined =>
  tdz.zones.find((zone) => zone.type === type);

/** Returns all zones of the given type (empty array if none). */
export const getDeploymentZonesOfType = (
  tdz: TeamDeploymentZones,
  type: DeploymentZoneType,
): TeamDeploymentZone[] => tdz.zones.filter((zone) => zone.type === type);

/**
 * Returns the first main zone. Throws if none — callers assume every team has
 * at least one main zone (the default scenario contract).
 */
export const getMainZone = (tdz: TeamDeploymentZones): TeamDeploymentZone => {
  const zone = getDeploymentZone(tdz, "main");
  if (!zone) {
    throw new Error(`Team ${tdz.team} has no main deployment zone`);
  }
  return zone;
};

/**
 * Returns the first forward zone. Throws if none — every team is expected to
 * have at least one forward zone (skirmisher deployment).
 */
export const getForwardZone = (
  tdz: TeamDeploymentZones,
): TeamDeploymentZone => {
  const zone = getDeploymentZone(tdz, "forward");
  if (!zone) {
    throw new Error(`Team ${tdz.team} has no forward deployment zone`);
  }
  return zone;
};

export interface GameMap {
  /** Width of the map in pixels (tile-indexed `terrains`/`heightMap` use TILE_SIZE). */
  width: number;
  /** Height of the map in pixels. */
  height: number;
  deploymentZones?: TeamDeploymentZones[];
  /** Indexed by [x][y] in tiles. */
  terrains: TerrainType[][];
  /** Indexed by [x][y] in tiles. */
  heightMap: number[][];
  seed?: number;
}

interface BaseScenario {
  name: string;
  description: string;
  type: GameScenarioType;
  ranked?: boolean;
  /** Hidden from scenario selection lists. */
  hidden?: boolean;
  triggers?: GameTrigger[];
  /** Default true. If false, disables automatic victory when only one team is alive. */
  conquestVictory?: boolean;
  locales?: GameLocales;
}

/**
 * A preset scenario with a fixed map, unit placement, and objectives.
 * All game elements are predefined and static.
 */
export interface LegacyPresetScenario extends BaseScenario {
  type: GameScenarioType.Preset;
  version?: never;
  map: GameMap;
  players: PlayerSetup[];
  units: UnitDtoPartialId[];
  objectives: ObjectiveDto<false>[];
}

/**
 * A hybrid scenario that combines preset map elements with optional random unit placement.
 */
export interface LegacyHybridScenario extends BaseScenario {
  type: GameScenarioType.Hybrid;
  version?: never;
  map: GameMap;
  units?: UnitDtoPartialId[];
  objectives?: ObjectiveDto<false>[];
  /** If true, skips army auto-deployment. The scenario's `units` define the full roster. */
  fixedArmy?: boolean;
}

export interface RandomTeamDeploymentZones {
  topMainDeploymentZone: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  topForwardDeploymentZone: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  bottomMainDeploymentZone: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  bottomForwardDeploymentZone: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * A randomly generated scenario created procedurally from instructions.
 */
export interface LegacyRandomScenario extends BaseScenario {
  type: GameScenarioType.Random;
  version?: never;
  baseTerrain?: TerrainType;
  defaultDeploymentZones?: RandomTeamDeploymentZones;
  scaledDeploymentZones?: Record<Size, RandomTeamDeploymentZones>;
  instructions: AnyInstruction[];
  deploymentZones?: never;
  randomDeploymentZones?: never;
  map?: never;
  fixedSize?: never;
}

/** Name identifier for a scenario (string). */
export type ScenarioName = string;

/**
 * Feature-based scenario schema. Defined as both an interface (the JSON shape
 * read from disk and the type used across the codebase) and a class with the
 * same name (instantiated at load time to scale player/unit stat fields).
 * TypeScript declaration merging unifies the two so `Scenario` is a single
 * symbol consumers can use as a type or `new` together.
 */
export interface Scenario {
  /** Schema version. Required for new scenarios. Absence => legacy => normalize. */
  version?: number;
  /** Discriminator: new scenarios never carry the legacy `type` field. */
  type?: never;
  /** Discriminator: new scenarios use {@link randomDeploymentZones} instead. */
  defaultDeploymentZones?: never;
  name: string;
  description: string;
  ranked?: boolean;
  /** Hidden from scenario selection lists. */
  hidden?: boolean;
  triggers?: GameTrigger[];
  /** Default true. If false, disables automatic victory when only one team is alive. */
  conquestVictory?: boolean;
  locales?: GameLocales;
  /**
   * Prebaked map (handcrafted via the editor or imported as JSON). When set,
   * the procedural pipeline does not generate terrain — {@link instructions}
   * (if any) run as overlays on top of this map (e.g. objective layers).
   */
  map?: GameMap;
  /**
   * Procedural generation pipeline. Without {@link map}: runs full terrain
   * generation. With {@link map}: instructions act as overlays.
   */
  instructions?: AnyInstruction[];
  /** Base terrain used when the procedural pipeline starts (ignored when {@link map} is set). */
  baseTerrain?: TerrainType;
  /**
   * Pins map dimensions for procedural generation (ignored when {@link map} is
   * set). Use to get deterministic pixel-based {@link deploymentZones}
   * independent of the matchmaking-derived battle type.
   */
  fixedSize?: { tilesX: number; tilesY: number };
  /**
   * Pixel-based deployment zones (used by legacy preset/hybrid scenarios after normalization).
   * Mutually exclusive with {@link randomDeploymentZones}.
   */
  deploymentZones?: TeamDeploymentZones[];
  /** Default percentage-based zones used by procedural scenarios. */
  randomDeploymentZones?: RandomTeamDeploymentZones;
  /** Per-battle-size scaled percentage-based zones. */
  scaledDeploymentZones?: Record<Size, RandomTeamDeploymentZones>;
  /** Player setups. Required for fixed-roster scenarios; optional otherwise. */
  players?: PlayerSetup[];
  /** Pre-placed units (kept regardless of allowDynamicArmy). */
  units?: UnitDtoPartialId[];
  /** Pre-placed objectives. */
  objectives?: ObjectiveDto<false>[];
  /**
   * If true: the matchmaking-driven army composition runs and auto-deploys units
   * on top of {@link units}. If false/absent: {@link units} defines the full
   * roster and no auto-deployment occurs (deployment phase is skipped).
   */
  allowDynamicArmy?: boolean;
  /**
   * When true, the scenario starts at turn 0 with a deployment phase so the
   * player can reposition their pre-placed {@link units} inside the declared
   * deployment zones before the battle begins.
   */
  allowDeploymentPhase?: boolean;
  /**
   * Data-driven tutorial overlays. Evaluated client-side by the TutorialRunner
   * independently of {@link triggers}.
   */
  tutorial?: Tutorial;
}

/**
 * Returns a copy of the player setup with `ammoReserve` and `baseAmmoReserve`
 * multiplied by {@link STAT_PRECISION_SCALE}. Other fields pass through.
 */
function scalePlayer(json: PlayerSetup): PlayerSetup {
  const out: PlayerSetup = {
    player: json.player,
    team: json.team,
    units: json.units,
    role: json.role,
  };
  if (json.ammoReserve !== undefined) {
    out.ammoReserve = json.ammoReserve * STAT_PRECISION_SCALE;
  }
  if (json.baseAmmoReserve !== undefined) {
    out.baseAmmoReserve = json.baseAmmoReserve * STAT_PRECISION_SCALE;
  }
  return out;
}

/**
 * Returns a copy of the unit DTO with `hp`, `org`, `st` (stamina) and `am`
 * (ammo) multiplied by {@link STAT_PRECISION_SCALE}. `su` (supply) is
 * intentionally not scaled — supply uses pure integer arithmetic and is
 * stored at unscaled magnitude across templates and DB.
 */
function scaleUnit(json: UnitDtoPartialId): UnitDtoPartialId {
  const out: UnitDtoPartialId = {
    id: json.id,
    name: json.name,
    status: json.status,
    pos: json.pos,
    player: json.player,
    rotation: json.rotation,
    type: json.type,
    lv: json.lv,
    eff: json.eff,
    ac: json.ac,
    acd: json.acd,
    ph: json.ph,
    pht: json.pht,
    hfdt: json.hfdt,
    f: json.f,
    en: json.en,
    stt: json.stt,
    bh: json.bh,
    su: json.su,
  };
  if (json.hp !== undefined) out.hp = json.hp * STAT_PRECISION_SCALE;
  if (json.org !== undefined) out.org = json.org * STAT_PRECISION_SCALE;
  if (json.st !== undefined) out.st = json.st * STAT_PRECISION_SCALE;
  if (json.am !== undefined) out.am = json.am * STAT_PRECISION_SCALE;
  return out;
}

export class Scenario implements Scenario {
  constructor(json: Scenario) {
    this.version = json.version;
    this.name = json.name;
    this.description = json.description;
    this.ranked = json.ranked;
    this.hidden = json.hidden;
    this.triggers = json.triggers;
    this.conquestVictory = json.conquestVictory;
    this.locales = json.locales;
    this.map = json.map;
    this.instructions = json.instructions;
    this.baseTerrain = json.baseTerrain;
    this.fixedSize = json.fixedSize;
    this.deploymentZones = json.deploymentZones;
    this.randomDeploymentZones = json.randomDeploymentZones;
    this.scaledDeploymentZones = json.scaledDeploymentZones;
    this.objectives = json.objectives;
    this.allowDynamicArmy = json.allowDynamicArmy;
    this.allowDeploymentPhase = json.allowDeploymentPhase;
    this.tutorial = json.tutorial;
    this.players = json.players?.map(scalePlayer);
    this.units = json.units?.map(scaleUnit);
  }
}
