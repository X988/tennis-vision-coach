import { useT } from '../i18n';
import { track } from '../analytics/analytics';
import { CameraView, Layers } from '../store';

const VIEWS: CameraView[] = ['back', 'side', 'top', 'opponent', 'free', 'contact'];

export function CameraBar({ view, onView, recommended = [] }: { view: CameraView; onView: (v: CameraView) => void; recommended?: string[] }) {
  const t = useT();
  return (
    <div className="seg wrap" role="group" aria-label={t('camera.title')} data-tour="camera-bar">
      {VIEWS.map((v) => (
        <button key={v} className={`${view === v ? 'active' : ''} ${recommended.includes(v) ? 'rec' : ''}`} onClick={() => {
            onView(v);
            track('camera_change', { view: v });
          }}>
          {t(`camera.${v}`)}
        </button>
      ))}
    </div>
  );
}

export function LayerToggles({ layers, onChange }: { layers: Layers; onChange: (l: Partial<Layers>) => void }) {
  const t = useT();
  return (
    <div className="chips" data-tour="layers">
      {(Object.keys(layers) as (keyof Layers)[]).map((k) => (
        <label key={k} className={`chip ${layers[k] ? 'on' : ''}`}>
          <input type="checkbox" checked={layers[k]} onChange={(e) => {
              onChange({ [k]: e.target.checked });
              track('layer_toggle', { layer: k, on: e.target.checked });
            }} />
          {t(`layers.${k}`)}
        </label>
      ))}
    </div>
  );
}
