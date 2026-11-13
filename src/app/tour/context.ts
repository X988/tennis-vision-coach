import { createContext, useContext } from 'react';

export interface TourApi {
  /** True while the guided tour runs: lessons are in training mode and nothing is saved to progress. */
  active: boolean;
  index: number;
  start: () => void;
  stop: (completed: boolean) => void;
  go: (index: number) => void;
}

export const TourContext = createContext<TourApi>({ active: false, index: 0, start: () => undefined, stop: () => undefined, go: () => undefined });
export const useTour = () => useContext(TourContext);
