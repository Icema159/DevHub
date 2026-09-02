export const CONVERSATION_TITLE_FALLBACK = 'New conversation';
export const CONVERSATION_PREVIEW_FALLBACK = 'No messages yet';

export function conversationDisplayTitle(
  title: string | null,
  fallback = CONVERSATION_TITLE_FALLBACK,
): string {
  return title?.trim() || fallback;
}

export function conversationDisplayPreview(preview: string | null): string {
  return preview?.trim() || CONVERSATION_PREVIEW_FALLBACK;
}
