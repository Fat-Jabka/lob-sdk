import { Vector2 } from "@lob-sdk/vector";
import { EntityId } from ".";

export enum ObjectiveType {
  Small = 1,
  Big = 2,
}

export interface IObjective {
  id: EntityId;
  position: Vector2;
  player: number;
  team: number;
  type: ObjectiveType;
  logistics?: number;
  manpowerPerTurn?: number;
  goldPerTurn?: number;
}
