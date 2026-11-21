import type { Locale } from "./config";
import { de, type Messages } from "./messages/de";
import { en } from "./messages/en";

export type { Messages };

export const dictionaries: Record<Locale, Messages> = { de, en };
