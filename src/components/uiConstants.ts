export type CameraPreset = 'broadcast' | 'behind' | 'side' | 'top' | 'eyes' | 'free';

export const CAMERA_PRESETS: { id: CameraPreset; label: string; key: string }[] = [
  { id: 'broadcast', label: 'TV', key: '1' },
  { id: 'behind', label: 'Behind', key: '2' },
  { id: 'side', label: 'Side', key: '3' },
  { id: 'top', label: 'Top', key: '4' },
  { id: 'eyes', label: "Player's eyes", key: '5' },
  { id: 'free', label: 'Free', key: '6' },
];

/** Frame step for the step buttons / arrow keys, seconds of simulation time. */
export const STEP = 1 / 30;
export const RATES = [0.1, 0.25, 0.5, 1];
