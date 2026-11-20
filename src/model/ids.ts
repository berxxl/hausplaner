import { customAlphabet } from "nanoid";

export const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
export const ID_PATTERN = /^[0-9a-z]{8}$/;

const generate = customAlphabet(ID_ALPHABET, 8);

/** Neue zufällige ID; prüft optional gegen vorhandene IDs. */
export function newId(existing?: ReadonlySet<string>): string {
  for (;;) {
    const id = generate();
    if (!existing?.has(id)) return id;
  }
}
