import type { NotificationType } from "@prisma/client";
import { prisma } from "./db";
import { translate, type Locale, type MessageKey } from "./i18n";

/**
 * Notifications store a type plus a params JSON blob, never rendered prose.
 *
 * That is what lets a worker switch to Tamil and see their whole notification
 * history in Tamil, including rows written months earlier. The copy lives in
 * the message catalogs under `notif.<TYPE>.title` / `.body`, so adding a
 * language translates the backlog with it.
 */
function keysFor(type: NotificationType): { title: MessageKey; body: MessageKey } {
  return {
    title: `notif.${type}.title` as MessageKey,
    body: `notif.${type}.body` as MessageKey,
  };
}

function parseParams(json: string | null): Record<string, string> {
  if (!json) return {};
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === "object"
      ? (value as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export function renderNotification(
  locale: Locale,
  type: NotificationType,
  paramsJson: string | null,
): { title: string; body: string } {
  const keys = keysFor(type);
  const params = parseParams(paramsJson);
  return {
    title: translate(locale, keys.title),
    body: translate(locale, keys.body, params),
  };
}

export async function notify(input: {
  userId: string;
  type: NotificationType;
  params?: Record<string, string>;
  linkUrl?: string;
}): Promise<void> {
  const keys = keysFor(input.type);
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      // The catalog keys are persisted alongside the type so a future rename
      // can be migrated rather than guessed at.
      titleKey: keys.title,
      bodyKey: keys.body,
      params: input.params ? JSON.stringify(input.params) : null,
      linkUrl: input.linkUrl ?? null,
    },
  });
}
