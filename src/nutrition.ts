import type { Food, MealPreset, Nutrition } from './types';

export const ZERO_NUTRITION: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function scaleNutrition(nutrition: Nutrition, multiplier: number): Nutrition {
  return {
    kcal: nutrition.kcal * multiplier,
    protein: nutrition.protein * multiplier,
    carbs: nutrition.carbs * multiplier,
    fat: nutrition.fat * multiplier,
    fiber: nutrition.fiber * multiplier,
  };
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

export function foodNutrition(food: Food, quantity: number): Nutrition {
  return scaleNutrition(food.nutrition, quantity / food.baseAmount);
}

export function mealNutrition(meal: MealPreset, foods: Food[], servings = 1): Nutrition {
  const byId = new Map(foods.map((food) => [food.id, food]));
  const total = meal.ingredients.reduce((sum, ingredient) => {
    const food = byId.get(ingredient.foodId);
    return food ? addNutrition(sum, foodNutrition(food, ingredient.quantity)) : sum;
  }, { ...ZERO_NUTRITION });
  return scaleNutrition(total, servings);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function shortDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
