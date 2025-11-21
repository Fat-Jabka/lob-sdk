import { Vector2 } from "@lob-sdk/vector";
import { EntityId } from ".";

export interface IUnit {
  id: EntityId;
  position: Vector2;
  currentFormation: string;
  pendingFormationId: string | null;
  /**
   * Remaining ticks for formation change. Formation changes cannot last more
   * than 1 turn.
   */
  formationChangeTicksRemaining: number;
}
