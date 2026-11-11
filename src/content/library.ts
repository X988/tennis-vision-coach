/** Built-in scenario library: every JSON in ./scenarios is validated at load. */
import { ScenarioSpec, validateScenario } from '../engines/scenario';

const files = import.meta.glob('./scenarios/*.json', { eager: true, import: 'default' });

export interface LibraryLoad {
  scenarios: ScenarioSpec[];
  errors: { file: string; errors: string[] }[];
}

export function loadLibrary(): LibraryLoad {
  const scenarios: ScenarioSpec[] = [];
  const errors: LibraryLoad['errors'] = [];
  for (const [file, data] of Object.entries(files)) {
    const r = validateScenario(data);
    if (r.ok) scenarios.push(r.value);
    else errors.push({ file, errors: r.errors });
  }
  scenarios.sort((a, b) => a.learning.difficulty - b.learning.difficulty || a.id.localeCompare(b.id));
  return { scenarios, errors };
}

export const LIBRARY = loadLibrary();
