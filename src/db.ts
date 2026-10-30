import Dexie, { type Table } from 'dexie';
import type { AppSettings, Food, LogEntry, MealPreset } from './types';
import { DEFAULT_SETTINGS } from './types';
import { STARTER_FOODS } from './data/foodCatalog';

class MealLoggerDB extends Dexie {
  foods!: Table<Food, number>;
  meals!: Table<MealPreset, number>;
  logs!: Table<LogEntry, number>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('daily-plate-db');
    this.version(1).stores({
      foods: '++id, name, category, archived',
      meals: '++id, name, category, archived',
      logs: '++id, dateKey, consumedAt, mealSlot, itemType, itemId',
      settings: 'id',
    });
  }
}

export const db = new MealLoggerDB();

export async function ensureSettings() {
  const existing = await db.settings.get('main');
  if (!existing) await db.settings.put(DEFAULT_SETTINGS);
}

export async function seedStarterFoods() {
  // Keep the count check and seed write in one transaction (React StrictMode may initialise twice in dev).
  await db.transaction('rw', db.foods, async () => {
    const count = await db.foods.count();
    if (count > 0) return;

    await db.foods.bulkAdd(STARTER_FOODS);
  });
}
