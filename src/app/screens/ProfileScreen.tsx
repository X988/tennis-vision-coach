import { BackhandType, Handedness, Language, Level } from '../../engines/profile';
import { LANGUAGES, useT } from '../i18n';
import { Quality, useStore } from '../store';
import { Slider } from '../ui/Slider';

function Seg<V extends string>({ value, options, onChange }: { value: V; options: { v: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="seg wrap">
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? 'active' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProfileScreen() {
  const t = useT();
  const { profile, setProfile, settings, setSettings } = useStore();
  return (
    <div className="page narrow">
      <h1>{t('profile.title')}</h1>
      <div className="form" data-tour="profile-form">
        <label>{t('profile.handedness')}</label>
        <Seg<Handedness> value={profile.handedness} onChange={(handedness) => setProfile({ handedness })} options={(['right', 'left'] as const).map((v) => ({ v, label: t(`handedness.${v}`) }))} />
        <label>{t('profile.backhand')}</label>
        <Seg<BackhandType> value={profile.backhand} onChange={(backhand) => setProfile({ backhand })} options={(['two_handed', 'one_handed'] as const).map((v) => ({ v, label: t(`backhandType.${v}`) }))} />
        <p className="muted small">{t('profile.backhandNote')}</p>
        <Slider label={t('profile.height')} unit={t('units.cm')} digits={0} min={140} max={205} step={1} value={profile.heightCm} onChange={(heightCm) => setProfile({ heightCm })} />
        <label>{t('profile.level')}</label>
        <Seg<Level> value={profile.level} onChange={(level) => setProfile({ level })} options={(['beginner', 'intermediate', 'advanced'] as const).map((v) => ({ v, label: t(`level.${v}`) }))} />
        <p className="muted small">{t('profile.note')}</p>
        <label>{t('profile.language')}</label>
        <Seg<Language> value={profile.language} onChange={(language) => setProfile({ language })} options={LANGUAGES.map((l) => ({ v: l.id, label: l.label }))} />
        <label>{t('profile.quality')}</label>
        <Seg<Quality>
          value={settings.quality}
          onChange={(quality) => setSettings({ quality })}
          options={[
            { v: 'auto', label: t('profile.qualityAuto') },
            { v: 'high', label: t('profile.qualityHigh') },
            { v: 'low', label: t('profile.qualityLow') },
          ]}
        />
      </div>
    </div>
  );
}
