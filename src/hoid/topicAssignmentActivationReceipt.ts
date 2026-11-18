import type { HoidTopicAssignmentActivationReceipt } from "./topicAssignmentActivation";

/**
 * Source-controlled production activation receipt.
 *
 * Keep null until a real protected assignment PR has been reviewed, merged,
 * and its post-merge snapshot has been verified by the trusted source-control
 * adapter. Synthetic test receipts must never be copied here.
 */
export const HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT: HoidTopicAssignmentActivationReceipt | null = null;
