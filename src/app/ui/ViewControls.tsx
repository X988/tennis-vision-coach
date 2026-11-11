import { useT } from '../i18n';
import { CameraView, Layers } from '../store';

const VIEWS: CameraView[] = ['back', 'side', 'top', 'opponent', 'free', 'contact'];

export function CameraBar({ view, onView, recommended = [] }: { view: CameraView; onView: (v: CameraView) => void; recommended?: string[] }) {
  const t = useT();
  return (
    <div className="seg wrap" role="group" aria-label={t('camera.title')}>
      {VIEWS.map((v) => (
        <button key={v} className={`${view === v ? 'active' : ''} ${recommended.includes(v) ? 'rec' : ''}`} onClick={() => onView(v)}>
          {t(`camera.${v}`)}
        </button>
      ))}
    </div>
  );
}

export function LayerToggles({ layers, onChange }: { layers: Layers; onChange: (l: Partial<Layers>) => void }) {
  const t = useT();
  return (
    <div className="chips">
      {(Object.keys(layers) as (keyof Layers)[]).map((k) => (
        <label key={k} className={`chip ${layers[k] ? 'on' : ''}`}>
          <input type="checkbox" checked={layers[k]} onChange={(e) => onChange({ [k]: e.target.checked })} />
          {t(`layers.${k}`)}
        </label>
      ))}
    </div>
  );
}
