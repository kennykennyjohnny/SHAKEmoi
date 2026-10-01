// Conversation ouverte au centre (P13) : UNE source de vérité, partagée par la
// colonne de gauche sur ordinateur (surbrillance) et l'écran Messages. Mise à
// jour par la conversation elle-même à l'ouverture et à la fermeture.
import { useSyncExternalStore } from 'react';
import type { ChatRef } from './chatData';

let current: ChatRef | null = null;
const listeners = new Set<() => void>();

export function setActiveChat(chat: ChatRef | null) {
  if (current?.kind === chat?.kind && current?.id === chat?.id) return;
  current = chat;
  listeners.forEach((l) => l());
}

export function getActiveChat(): ChatRef | null {
  return current;
}

export function useActiveChat(): ChatRef | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
  );
}
