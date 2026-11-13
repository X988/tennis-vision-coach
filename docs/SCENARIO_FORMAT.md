# Формат учебного сценария (schemaVersion 1)

Сценарии лежат в `src/content/scenarios/*.json` и проверяются схемой
(`src/engines/scenario.ts`, zod) при загрузке; ошибки содержат путь к полю.

## Система координат корта

- origin — центр сетки на уровне земли;
- **X** — поперёк корта, **положительное — вправо от ученика** (с его задней линии);
- **Y** — вдоль корта, **отрицательное — половина ученика**, положительное — соперника;
- высоты `h`, `apexM` — над кортом; всё в метрах. Задняя линия: Y = ±11,885.

## Поля

```jsonc
{
  "id": "FH_WIDE_FAST_01",          // UPPER_SNAKE_CASE, уникальный
  "version": 1,                     // версия содержания сценария
  "schemaVersion": 1,               // версия формата
  "title": { "ru": "…", "en": "…" },
  "description": { "ru": "…" },
  "surface": "hard",                // hard | clay | grass
  "player": {
    "handedness": "right",          // для какой руки написан; для другой зеркалится (X → −X)
    "backhand": "two_handed",       // two_handed | one_handed
    "start": { "x": 0.2, "y": -12.0 }, // положение таза на старте
    "level": "intermediate"         // beginner | intermediate | advanced
  },
  "incomingBall": {
    "launch": { "x": -1.5, "y": 12.2, "h": 1.0 }, // точка удара соперника (необязательно)
    "speedKmh": 75,                 // скорость мяча ПЕРЕД ОТСКОКОМ (что видит принимающий), 25–220
    "spin": "topspin",              // flat | topspin | slice
    "spinRpm": 2200,                // необязательно; иначе из apexM или по умолчанию для типа
    "bounce": { "x": 3.0, "y": -10.2 }, // первый отскок, y < 0
    "apexM": 2.2                    // необязательно: высшая точка до отскока
  },
  "task": { "shot": "forehand", "goal": "neutral" },  // forehand|backhand; neutral|attacking|defensive
  "learning": {
    "focus": ["split_step", "stance", "contact"],
    "difficulty": 3,                // 1–3
    "coachApproved": false,         // true — только после проверки тренером
    "categories": ["wide", "fast"], // short medium deep wide body fast slow high low
    "decisions": ["first_step", "stance"], // first_step | stance | position | prep_timing
    "errorVariant": "no_split_step",// late_prep | no_split_step | wrong_stance | too_close
    "cameras": ["back", "top"]      // ≥ 2 ракурса: top side back opponent free
  }
}
```

## Семантика мяча

Скорость до отскока, точка отскока и высота траектории вместе определяют полёт:
скорость вылета и угол подбираются решателем, а высота достигается **силой вращения**
в пределах типа (топспин 800–4500 об/мин, слайс −400…−3500, плоский −200…600).
Если комбинация физически невозможна (например, медленный мяч не может лететь низко),
используется ближайший вариант и показывается предупреждение — данные не подменяются молча.

Пример из ТЗ (75 км/ч, отскок 3,0/−10,2, apex 2,3 м): высота 2,3 м достижима только
на пределе вращения, поэтому в библиотеке указано 2,2 м. Из старта (0,2; −12,0) этот мяч
недостижим для среднего уровня — сценарий используется как урок «не успевает».

## Версионирование

- Изменение содержания → увеличить `version`. Записи прогресса хранят `scenarioVersion`.
- Несовместимое изменение формата → новый `schemaVersion` и миграция в `scenario.ts`.
- Правила выбора стойки версионируются отдельно: `COACH_RULES_VERSION` в `decision.ts`.
