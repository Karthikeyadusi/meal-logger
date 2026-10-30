import type { Food } from '../types';

// Approximate reference values to make the first run usable. Replace with your own measured values.
export const STARTER_FOODS: Food[] = [
    { name: 'Cooked white rice', category: 'Staples', baseUnit: 'g', baseAmount: 100, nutrition: { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 }, notes: 'Approximate cooked value; water absorption changes the result.', updatedAt: new Date().toISOString(), archived: false },
    { name: 'Soya chunks (dry)', category: 'Protein', baseUnit: 'g', baseAmount: 100, nutrition: { kcal: 345, protein: 52, carbs: 33, fat: 0.5, fiber: 13 }, notes: 'Use dry weight before soaking/cooking.', updatedAt: new Date().toISOString(), archived: false },
    { name: 'Milk', category: 'Dairy', baseUnit: 'ml', baseAmount: 100, nutrition: { kcal: 60, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0 }, notes: 'Approximate; use the packet label for your milk.', updatedAt: new Date().toISOString(), archived: false },
    { name: 'Plain curd', category: 'Dairy', baseUnit: 'g', baseAmount: 100, nutrition: { kcal: 60, protein: 3.5, carbs: 4.7, fat: 3, fiber: 0 }, notes: 'Approximate; varies with milk and preparation.', updatedAt: new Date().toISOString(), archived: false },
    { name: 'Chapati', category: 'Staples', baseUnit: 'piece', baseAmount: 1, nutrition: { kcal: 120, protein: 3.5, carbs: 18, fat: 3.5, fiber: 2.5 }, notes: 'One medium chapati; size and oil/ghee change the value.', updatedAt: new Date().toISOString(), archived: false },
    ];
