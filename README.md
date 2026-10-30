# Daily Plate — Personal Meal Logger

A mobile-first, local-first nutrition logger. It is designed around a personal library of foods and reusable meal presets rather than barcode scanning or a massive external food database.

## Features in this MVP

- Add and edit individual foods with nutrition per 100 g, 100 ml, or piece.
- Build meal presets from saved foods; quantities and nutrition totals are calculated automatically.
- Log foods or meals to breakfast, lunch, snacks, dinner, or other.
- Choose the consumed date and time, including backfilling previous days.
- Daily calorie, protein, carbohydrate, fat, and fiber totals.
- Daily targets are editable.
- Copy the previous day's entries.
- Export and import a complete JSON backup.
- IndexedDB storage through Dexie. No account or backend required.
- Basic service-worker app-shell caching for installed/visited app use.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build:

```bash
npm run build
npm run preview
```

## Data model

- `Food`: a single ingredient, with a numeric base quantity (`baseAmount`) and nutrition values for that base quantity. Examples: per 100 g, per 100 ml, or per 1 piece.
- `MealPreset`: a named combination of food IDs and ingredient quantities. A preset represents one serving.
- `LogEntry`: a dated food or meal event. It stores a nutrition snapshot so future edits to a food or recipe do not rewrite historical intake.
- `AppSettings`: editable daily calorie and macro targets.

## Before relying on the numbers

Five editable starter foods are included to make the first run easier. Their nutrition figures are approximate reference values, not verified brand-specific data. Replace them with package-label values or your own measured recipe values. For soya chunks, enter the dry weight in the food library and log the dry quantity even if you soak/cook them afterward. For homemade meals, build a preset from the raw/cooked ingredient weights you consistently measure.

## Important current limitation

The service worker caches the app shell and same-origin GET requests. For a fully offline first launch, the app must first be opened while online so the shell and production assets can be cached. IndexedDB data is local to the browser profile; export a JSON backup before clearing site data or changing devices.

## Where to put your personal food catalog

The first-run catalog lives in `src/data/foodCatalog.ts` as `STARTER_FOODS`. Once you have your own 30 foods with confirmed values, replace or extend that array. For an already-used browser database, changing the seed file does not overwrite existing user data; add the new records through the Foods screen or import a backup.

Suggested data-entry convention:

- Weighed solids: store nutrition per 100 g, and log grams.
- Liquids: store nutrition per 100 ml, and log millilitres.
- Countable items: store nutrition per 1 piece, and log pieces.
- Homemade meal: store its ingredients and their weighed quantities in a meal preset. A saved meal is one serving; log 0.5, 1, 1.5, etc. servings as needed.
