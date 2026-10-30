export type BaseUnit = 'g' | 'ml' | 'piece';
export type MealSlot = 'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner' | 'Other';
export type ItemType = 'food' | 'meal';

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Food {
  id?: number;
  name: string;
  category: string;
  baseUnit: BaseUnit;
  baseAmount: number;
  nutrition: Nutrition;
  notes: string;
  updatedAt: string;
  archived: boolean;
}

export interface MealIngredient {
  foodId: number;
  quantity: number;
}

export interface MealPreset {
  id?: number;
  name: string;
  category: string;
  ingredients: MealIngredient[];
  notes: string;
  updatedAt: string;
  archived: boolean;
}

export interface NutritionSnapshot extends Nutrition {}

export interface LogEntry {
  id?: number;
  itemType: ItemType;
  itemId: number;
  itemName: string;
  mealSlot: MealSlot;
  quantity: number;
  quantityLabel: string;
  consumedAt: string;
  dateKey: string;
  nutrition: NutritionSnapshot;
}

export interface AppSettings {
  id: 'main';
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'main',
  calorieTarget: 2500,
  proteinTarget: 90,
  carbsTarget: 0,
  fatTarget: 0,
};

export const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Snacks', 'Dinner', 'Other'];
