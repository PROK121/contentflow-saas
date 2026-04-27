import { ru } from "./ru";

type Dict = typeof ru;
type Section = keyof Dict;
type Keys<S extends Section> = keyof Dict[S];

export function tr<S extends Section, K extends Keys<S>>(
  section: S,
  key: K,
): Dict[S][K] {
  return ru[section][key];
}

export { ru };

