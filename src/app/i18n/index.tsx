import { createContext, useCallback, useContext } from 'react';
import type { Language } from '../../engines/profile';
import { en } from './en';
import { Dict, ru } from './ru';
import { uk } from './uk';

const DICTS: Record<Language, Dict> = { ru, uk, en };
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'ru', label: 'Русский' },
  { id: 'uk', label: 'Українська' },
  { id: 'en', label: 'English' },
];

function lookup(d: Dict, key: string): string | undefined {
  let cur: string | Dict | undefined = d;
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export type Params = Record<string, string | number>;
export type T = (key: string, params?: Params) => string;

export function translate(lang: Language, key: string, params?: Params): string {
  const raw = lookup(DICTS[lang], key) ?? lookup(ru, key) ?? key;
  return params ? raw.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`)) : raw;
}

export const LangContext = createContext<Language>('ru');

export function useT(): T {
  const lang = useContext(LangContext);
  return useCallback((key: string, params?: Params) => translate(lang, key, params), [lang]);
}

/** Translate parameters that are themselves keys (e.g. a direction id inside a reason). */
export function reasonText(t: T, r: { key: string; params?: Params }) {
  const params = { ...r.params };
  if (typeof params.correct === 'string') params.correct = t(`dir.${params.correct}`);
  return t(r.key, params);
}
