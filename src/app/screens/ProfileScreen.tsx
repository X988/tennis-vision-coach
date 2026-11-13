import { BackhandType, Handedness, Language, Level } from '../../engines/profile';
import { LANGUAGES, useT } from '../i18n';
import { Quality, useStore } from '../store';
import { Slider } from '../ui/Slider';
import { useVoice } from '../voice/context';
import { PRIORITY } from '../voice/speaker';

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
  const { profile, setProfile, settings, setSettings, setVoice } = useStore();
  const voice = useVoice();
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
        <label>{t('voice.title')}</label>
        {voice.supported ? (
          <>
            <label className="check">
              <input type="checkbox" checked={settings.voice.enabled} onChange={(e) => setVoice({ enabled: e.target.checked })} />
              {t('voice.enabled')}
            </label>
            <Slider label={t('voice.rate')} unit="×" min={0.7} max={1.5} step={0.05} digits={2} value={settings.voice.rate} onChange={(rate) => setVoice({ rate })} />
            <div className="actions">
              <button disabled={!settings.voice.enabled} onClick={() => voice.say(t('voice.sample'), { priority: PRIORITY.tour })}>
                {t('voice.test')}
              </button>
            </div>
            <p className="muted small">{t('voice.note')}</p>
          </>
        ) : (
          <p className="muted small">{t('voice.unsupported')}</p>
        )}
      </div>
    </div>
  );
}
