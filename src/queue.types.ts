export const DEFAULT_QUEUE_NAME = "default";
export const QUEUE_EVENT_METADATA = "NEST_QUEUE_EVENT_METADATA";
export const QUEUE_REGISTRY = "NEST_QUEUE_REGISTRY";

export function normalizeQueueName(name?: string): string {
	if (!name) {
		return DEFAULT_QUEUE_NAME;
	}

	return name.trim() || DEFAULT_QUEUE_NAME;
}

export function getQueueToken(name?: string): string {
	return `nestQueue_${normalizeQueueName(name)}`;
}

export function getQueueAdapterToken(name?: string): string {
	return `nestQueueAdapter_${normalizeQueueName(name)}`;
}
