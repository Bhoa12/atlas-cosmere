import type {
  HoidProgressCoordinator,
  HoidProgressCoordinatorResult,
} from "./progressCoordinator";

/**
 * Atlas' ordinary chapter setter is intentionally forward-only.
 *
 * It does not expose the coordinator's regression/reopen escape hatches.
 * Corrections must be implemented as a separate, explicit UI flow after the
 * reader confirms the change; reopening a completed work remains the dedicated
 * "mark unread" action, which resets numeric works to chapter one.
 */
export function setAtlasChapterProgress(
  coordinator: Pick<HoidProgressCoordinator, "setChapter">,
  bookId: string,
  chapter: number,
): Promise<HoidProgressCoordinatorResult> {
  return coordinator.setChapter(bookId, chapter);
}
