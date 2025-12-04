import { assistantTools } from '$lib/server/tools';
import type { InferUITools, UIMessage, UIMessagePart } from 'ai';

export type MessageMetadata = {
	[key: string]: unknown;
};

export type MessageData = {
	[key: string]: unknown;
};

type ToolSet = InferUITools<typeof assistantTools>;

export type Message = UIMessage<MessageMetadata, MessageData, ToolSet>;
export type MessagePart = UIMessagePart<MessageData, ToolSet>;
