import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import {
  Activity, Apple, ArrowLeft, BarChart3, BookOpen, CalendarDays,
  ChevronLeft, ChevronRight, CircleHelp, Copy, Download,
  Edit3, Flame, Home, Plus, Search, Settings, Trash2, Utensils, X,
} from 'lucide-react';
import { db, ensureSettings, seedStarterFoods } from './db';
import { addNutrition, dateLabel, foodNutrition, formatNumber, localDateKey, mealNutrition, shortDate, ZERO_NUTRITION } from './nutrition';
import type { AppSettings, BaseUnit, Food, LogEntry, MealPreset, MealSlot, Nutrition } from './types';
import { DEFAULT_SETTINGS, MEAL_SLOTS } from './types';

type Screen = 'today' | 'foods' | 'meals' | 'history' | 'settings';
type Modal = 'food' | 'meal' | 'log-food' | 'log-meal' | 'settings' | null;

type IngredientDraft = { foodId: number; quantity: string };

const emptyFood: Omit<Food, 'id'> = {
  name: '', category: 'General', baseUnit: 'g', baseAmount: 100,
  nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  notes: '', updatedAt: new Date().toISOString(), archived: false,
};

const slotForHour = (hour: number): MealSlot => hour < 11 ? 'Breakfast' : hour < 16 ? 'Lunch' : hour < 19 ? 'Snacks' : 'Dinner';

function App() {
  const [screen, setScreen] = useState<Screen>('today');
  const [modal, setModal] = useState<Modal>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<MealPreset[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [editingMeal, setEditingMeal] = useState<MealPreset | null>(null);
  const [logFood, setLogFood] = useState<Food | null>(null);
  const [logMeal, setLogMeal] = useState<MealPreset | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [foodRows, mealRows, logRows, appSettings] = await Promise.all([
      db.foods.toArray(), db.meals.toArray(), db.logs.toArray(), db.settings.get('main'),
    ]);
    setFoods(foodRows.sort((a, b) => a.name.localeCompare(b.name)));
    setMeals(mealRows.sort((a, b) => a.name.localeCompare(b.name)));
    setLogs(logRows.sort((a, b) => b.consumedAt.localeCompare(a.consumedAt)));
    setSettings(appSettings ?? DEFAULT_SETTINGS);
  }

  useEffect(() => {
    (async () => {
      await db.open();
      await ensureSettings();
      await seedStarterFoods();
      await refresh();
    })().catch((error) => {
      console.error(error);
      notify('Could not open local database. Try refreshing the app.');
    });
  }, []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  const activeFoods = useMemo(() => foods.filter((food) => !food.archived), [foods]);
  const activeMeals = useMemo(() => meals.filter((meal) => !meal.archived), [meals]);
  const dayLogs = useMemo(() => logs.filter((entry) => entry.dateKey === selectedDate), [logs, selectedDate]);
  const dayTotal = useMemo(() => dayLogs.reduce((sum, entry) => addNutrition(sum, entry.nutrition), { ...ZERO_NUTRITION }), [dayLogs]);
  const mealsBySlot = useMemo(() => MEAL_SLOTS.map((slot) => ({ slot, entries: dayLogs.filter((entry) => entry.mealSlot === slot) })), [dayLogs]);

  function openFoodEditor(food?: Food) {
    setEditingFood(food ?? null);
    setModal('food');
  }
  function openMealEditor(meal?: MealPreset) {
    setEditingMeal(meal ?? null);
    setModal('meal');
  }
  function openFoodLogger(food: Food) {
    setLogFood(food);
    setModal('log-food');
  }
  function openMealLogger(meal: MealPreset) {
    setLogMeal(meal);
    setModal('log-meal');
  }

  async function saveFood(food: Omit<Food, 'id'>, id?: number) {
    const record = { ...food, updatedAt: new Date().toISOString() };
    if (id) await db.foods.update(id, record);
    else await db.foods.add(record);
    await refresh();
    setModal(null);
    notify(id ? 'Food updated' : 'Food added');
  }

  async function archiveFood(food: Food) {
    if (!food.id) return;
    await db.foods.update(food.id, { archived: true, updatedAt: new Date().toISOString() });
    await refresh();
    setModal(null);
    notify('Food archived');
  }

  async function saveMeal(meal: Omit<MealPreset, 'id'>, id?: number) {
    const record = { ...meal, updatedAt: new Date().toISOString() };
    if (id) await db.meals.update(id, record);
    else await db.meals.add(record);
    await refresh();
    setModal(null);
    notify(id ? 'Meal updated' : 'Meal saved');
  }

  async function archiveMeal(meal: MealPreset) {
    if (!meal.id) return;
    await db.meals.update(meal.id, { archived: true, updatedAt: new Date().toISOString() });
    await refresh();
    setModal(null);
    notify('Meal archived');
  }

  async function createLog(entry: Omit<LogEntry, 'id'>) {
    await db.logs.add(entry);
    setSelectedDate(entry.dateKey);
    await refresh();
    setModal(null);
    notify('Added to today');
  }

  async function deleteLog(id?: number) {
    if (!id) return;
    await db.logs.delete(id);
    await refresh();
    notify('Log entry removed');
  }

  async function saveSettings(next: AppSettings) {
    await db.settings.put(next);
    setSettings(next);
    setModal(null);
    notify('Targets saved');
  }

  async function copyYesterday() {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() - 1);
    const previousKey = localDateKey(date);
    const previousLogs = logs.filter((entry) => entry.dateKey === previousKey);
    if (!previousLogs.length) {
      notify('No entries found for the previous day');
      return;
    }
    const now = new Date();
    for (const entry of previousLogs) {
      const consumed = new Date(`${selectedDate}T${new Date(entry.consumedAt).toTimeString().slice(0, 8)}`);
      await db.logs.add({
        itemType: entry.itemType,
        itemId: entry.itemId,
        itemName: entry.itemName,
        mealSlot: entry.mealSlot,
        quantity: entry.quantity,
        quantityLabel: entry.quantityLabel,
        consumedAt: Number.isNaN(consumed.getTime()) ? now.toISOString() : consumed.toISOString(),
        dateKey: selectedDate,
        nutrition: { ...entry.nutrition },
      });
    }
    await refresh();
    notify(`Copied ${previousLogs.length} entries`);
  }

  async function exportBackup() {
    const backup = {
      format: 'daily-plate-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      foods: await db.foods.toArray(),
      meals: await db.meals.toArray(),
      logs: await db.logs.toArray(),
      settings: (await db.settings.get('main')) ?? DEFAULT_SETTINGS,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `daily-plate-backup-${localDateKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Backup exported');
  }

  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      if (parsed.format !== 'daily-plate-backup' || !Array.isArray(parsed.foods) || !Array.isArray(parsed.meals) || !Array.isArray(parsed.logs)) {
        throw new Error('This does not look like a Daily Plate backup.');
      }
      await db.transaction('rw', db.foods, db.meals, db.logs, db.settings, async () => {
        await Promise.all([db.foods.clear(), db.meals.clear(), db.logs.clear()]);
        await db.foods.bulkPut(parsed.foods as Food[]);
        await db.meals.bulkPut(parsed.meals as MealPreset[]);
        await db.logs.bulkPut(parsed.logs as LogEntry[]);
        if (parsed.settings && typeof parsed.settings === 'object') {
          await db.settings.put({ ...(parsed.settings as AppSettings), id: 'main' });
        }
      });
      await refresh();
      notify('Backup imported');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not import backup');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function moveDate(days: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    setSelectedDate(localDateKey(date));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-mark" onClick={() => setScreen('today')} aria-label="Go to today"><Activity size={18} /></button>
        <div className="brand-copy"><span className="brand-name">daily plate</span><span className="brand-caption">YOUR PERSONAL NUTRITION LOG</span></div>
        <div className="topbar-spacer" />
        <button className="icon-button top-date-button" onClick={() => setScreen('history')} aria-label="Open history"><CalendarDays size={19} /></button>
      </header>

      <main className="main-content">
        {screen === 'today' && (
          <>
            <section className="page-heading date-heading">
              <div><div className="eyebrow">YOUR DAILY OVERVIEW</div><h1>{selectedDate === localDateKey() ? 'Today' : dateLabel(selectedDate)}</h1></div>
              <div className="date-switcher">
                <button className="icon-button subtle" onClick={() => moveDate(-1)} aria-label="Previous day"><ChevronLeft size={18} /></button>
                <button className="today-pill" onClick={() => setSelectedDate(localDateKey())}>Today</button>
                <button className="icon-button subtle" onClick={() => moveDate(1)} aria-label="Next day" disabled={selectedDate >= localDateKey()}><ChevronRight size={18} /></button>
              </div>
            </section>
            <NutritionCard total={dayTotal} settings={settings} />
            <section className="quick-actions">
              <button className="primary-button" onClick={() => { setSearch(''); setScreen('foods'); }}><Plus size={17} /> Log food</button>
              <button className="secondary-button" onClick={() => { setSearch(''); setScreen('meals'); }}><BookOpen size={17} /> Log a meal</button>
              <button className="icon-button action-copy" onClick={copyYesterday} title="Copy yesterday's log" aria-label="Copy yesterday's log"><Copy size={17} /></button>
            </section>
            <section className="section-heading"><div><div className="eyebrow">FOOD JOURNAL</div><h2>What you ate</h2></div><span className="muted-count">{dayLogs.length} entries</span></section>
            <div className="slot-list">
              {mealsBySlot.map(({ slot, entries }) => (
                <section className="meal-slot" key={slot}>
                  <div className="slot-heading"><h3>{slot}</h3><span>{formatNumber(entries.reduce((sum, entry) => sum + entry.nutrition.kcal, 0))} kcal</span></div>
                  {entries.length === 0 ? (
                    <button className="empty-slot" onClick={() => { setSearch(''); setScreen(slot === 'Other' ? 'foods' : 'meals'); }}><Plus size={15} /> Add something</button>
                  ) : entries.map((entry) => (
                    <LogRow key={entry.id} entry={entry} onDelete={() => deleteLog(entry.id)} />
                  ))}
                </section>
              ))}
            </div>
          </>
        )}

        {screen === 'foods' && (
          <>
            <section className="page-heading"><div><div className="eyebrow">YOUR INGREDIENT LIBRARY</div><h1>Foods</h1><p>Individual ingredients with nutrition per unit.</p></div><button className="primary-button compact" onClick={() => openFoodEditor()}><Plus size={17} /> Add food</button></section>
            <SearchBox value={search} onChange={setSearch} placeholder="Search your foods..." />
            <div className="library-summary"><span>{activeFoods.length} foods saved</span><span>Tap a food to log it</span></div>
            <div className="library-list">
              {activeFoods.filter((food) => food.name.toLowerCase().includes(search.toLowerCase()) || food.category.toLowerCase().includes(search.toLowerCase())).map((food) => (
                <div className="library-row" key={food.id}>
                  <button className="library-main" onClick={() => openFoodLogger(food)}><span className="food-dot"><Apple size={17} /></span><span className="library-text"><strong>{food.name}</strong><small>{food.category} · per {food.baseAmount}{food.baseUnit}</small></span><span className="library-kcal">{formatNumber(food.nutrition.kcal)} <small>kcal</small></span></button>
                  <button className="row-edit" onClick={() => openFoodEditor(food)} aria-label={`Edit ${food.name}`}><Edit3 size={16} /></button>
                </div>
              ))}
              {activeFoods.length === 0 && <EmptyState title="No foods yet" body="Add your common ingredients to build your personal library." action="Add your first food" onAction={() => openFoodEditor()} />}
            </div>
            <p className="footnote">Starter values are estimates. Edit them using your product labels or own recipes before relying on the totals.</p>
          </>
        )}

        {screen === 'meals' && (
          <>
            <section className="page-heading"><div><div className="eyebrow">YOUR REUSABLE COMBINATIONS</div><h1>Meals</h1><p>Build recipes from foods, then log them in one tap.</p></div><button className="primary-button compact" onClick={() => openMealEditor()}><Plus size={17} /> Create meal</button></section>
            <SearchBox value={search} onChange={setSearch} placeholder="Search your saved meals..." />
            <div className="library-summary"><span>{activeMeals.length} meals saved</span><span>Macros calculated from ingredients</span></div>
            <div className="library-list">
              {activeMeals.filter((meal) => meal.name.toLowerCase().includes(search.toLowerCase()) || meal.category.toLowerCase().includes(search.toLowerCase())).map((meal) => {
                const total = mealNutrition(meal, foods);
                return <div className="library-row" key={meal.id}>
                  <button className="library-main" onClick={() => openMealLogger(meal)}><span className="food-dot meal-dot"><Utensils size={17} /></span><span className="library-text"><strong>{meal.name}</strong><small>{meal.ingredients.length} ingredients · {meal.category}</small></span><span className="library-kcal">{formatNumber(total.kcal)} <small>kcal</small></span></button>
                  <button className="row-edit" onClick={() => openMealEditor(meal)} aria-label={`Edit ${meal.name}`}><Edit3 size={16} /></button>
                </div>;
              })}
              {activeMeals.length === 0 && <EmptyState title="Your meal library is empty" body="Combine foods you eat together. You can save as many presets as you need." action="Create your first meal" onAction={() => openMealEditor()} />}
            </div>
          </>
        )}

        {screen === 'history' && (
          <>
            <section className="page-heading"><div><div className="eyebrow">YOUR INTAKE OVER TIME</div><h1>History</h1><p>Review previous days and repeat a familiar day.</p></div></section>
            <div className="history-date-card"><button className="icon-button subtle" onClick={() => moveDate(-1)} aria-label="Previous day"><ChevronLeft size={19} /></button><div><strong>{dateLabel(selectedDate)}</strong><small>{selectedDate}</small></div><button className="icon-button subtle" onClick={() => moveDate(1)} disabled={selectedDate >= localDateKey()} aria-label="Next day"><ChevronRight size={19} /></button></div>
            <NutritionCard total={dayTotal} settings={settings} />
            <section className="section-heading"><div><div className="eyebrow">DAILY ENTRIES</div><h2>Food log</h2></div><span className="muted-count">{dayLogs.length} entries</span></section>
            <div className="slot-list history-entries">
              {dayLogs.length ? dayLogs.map((entry) => <LogRow key={entry.id} entry={entry} onDelete={() => deleteLog(entry.id)} />) : <div className="empty-panel">Nothing logged on this day.</div>}
            </div>
            <div className="history-actions"><button className="secondary-button full-width" onClick={copyYesterday}><Copy size={16} /> Copy previous day's meals</button></div>
            <section className="section-heading"><div><div className="eyebrow">RECENT DAYS</div><h2>Quick jump</h2></div></section>
            <div className="recent-days">
              {Array.from({ length: 7 }, (_, index) => {
                const date = new Date(`${localDateKey()}T12:00:00`); date.setDate(date.getDate() - index);
                const key = localDateKey(date); const total = logs.filter((entry) => entry.dateKey === key).reduce((sum, entry) => sum + entry.nutrition.kcal, 0);
                return <button key={key} className={`recent-day ${selectedDate === key ? 'selected' : ''}`} onClick={() => setSelectedDate(key)}><span>{index === 0 ? 'Today' : shortDate(key)}</span><strong>{formatNumber(total)}</strong><small>kcal</small></button>;
              })}
            </div>
          </>
        )}

        {screen === 'settings' && (
          <>
            <section className="page-heading"><div><div className="eyebrow">MAKE IT YOURS</div><h1>Settings</h1><p>Nutrition targets and your local data.</p></div></section>
            <div className="settings-panel">
              <div className="settings-title"><div className="settings-icon"><Flame size={18} /></div><div><strong>Daily targets</strong><small>Used to calculate your progress.</small></div><button className="text-button" onClick={() => setModal('settings')}>Edit</button></div>
              <div className="target-list"><TargetRow label="Calories" value={settings.calorieTarget} unit="kcal" /><TargetRow label="Protein" value={settings.proteinTarget} unit="g" /><TargetRow label="Carbs" value={settings.carbsTarget} unit="g" optional /><TargetRow label="Fat" value={settings.fatTarget} unit="g" optional /></div>
            </div>
            <div className="settings-panel">
              <div className="settings-title"><div className="settings-icon"><Download size={18} /></div><div><strong>Backup & restore</strong><small>Your data is stored on this device.</small></div></div>
              <p className="settings-description">Export a JSON backup before changing devices or clearing browser data. Importing a backup replaces the current local data.</p>
              <div className="settings-actions"><button className="secondary-button" onClick={exportBackup}><Download size={16} /> Export backup</button><button className="secondary-button" onClick={() => fileInputRef.current?.click()}><ArrowLeft size={16} className="rotate-up" /> Import backup</button><input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => importBackup(event.target.files?.[0])} /></div>
            </div>
            <div className="settings-panel about-panel"><div className="settings-title"><div className="settings-icon"><CircleHelp size={18} /></div><div><strong>About Daily Plate</strong><small>Personal nutrition logger · Version 0.1</small></div></div><p className="settings-description">Offline-first and local by default. No account, no ads, and no external food database. Nutrition values are only as accurate as the food entries you maintain.</p></div>
          </>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavButton active={screen === 'today'} icon={<Home size={19} />} label="Today" onClick={() => setScreen('today')} />
        <NavButton active={screen === 'foods'} icon={<Apple size={19} />} label="Foods" onClick={() => { setSearch(''); setScreen('foods'); }} />
        <NavButton active={screen === 'meals'} icon={<Utensils size={19} />} label="Meals" onClick={() => { setSearch(''); setScreen('meals'); }} />
        <NavButton active={screen === 'history'} icon={<BarChart3 size={19} />} label="History" onClick={() => setScreen('history')} />
        <NavButton active={screen === 'settings'} icon={<Settings size={19} />} label="Settings" onClick={() => setScreen('settings')} />
      </nav>

      {modal === 'food' && <FoodEditor food={editingFood} onSave={saveFood} onArchive={archiveFood} onClose={() => setModal(null)} />}
      {modal === 'meal' && <MealEditor meal={editingMeal} foods={activeFoods} onSave={saveMeal} onArchive={archiveMeal} onClose={() => setModal(null)} />}
      {modal === 'log-food' && logFood && <FoodLogModal food={logFood} defaultDate={selectedDate} onSave={createLog} onClose={() => setModal(null)} />}
      {modal === 'log-meal' && logMeal && <MealLogModal meal={logMeal} foods={foods} defaultDate={selectedDate} onSave={createLog} onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setModal(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function NutritionCard({ total, settings }: { total: Nutrition; settings: AppSettings }) {
  const kcalPct = settings.calorieTarget > 0 ? Math.min(total.kcal / settings.calorieTarget * 100, 100) : 0;
  const remaining = Math.max(settings.calorieTarget - total.kcal, 0);
  return <section className="nutrition-card">
    <div className="calorie-line"><div><span className="eyebrow">CALORIES CONSUMED</span><div className="calorie-value">{formatNumber(total.kcal)}<span> / {formatNumber(settings.calorieTarget)} kcal</span></div></div><div className="calorie-ring" style={{ '--progress': `${kcalPct}%` } as CSSProperties & { '--progress': string }}><span>{Math.round(kcalPct)}<small>%</small></span></div></div>
    <div className="progress-track"><div className="progress-fill" style={{ width: `${kcalPct}%` }} /></div>
    <div className="remaining-line"><span>{formatNumber(remaining)} kcal remaining</span><span>{formatNumber(total.kcal / Math.max(settings.calorieTarget, 1) * 100)}% of target</span></div>
    <div className="macro-grid">
      <MacroStat label="Protein" value={total.protein} target={settings.proteinTarget} unit="g" tone="protein" />
      <MacroStat label="Carbs" value={total.carbs} target={settings.carbsTarget} unit="g" tone="carbs" />
      <MacroStat label="Fat" value={total.fat} target={settings.fatTarget} unit="g" tone="fat" />
      <MacroStat label="Fiber" value={total.fiber} target={0} unit="g" tone="fiber" />
    </div>
  </section>;
}

function MacroStat({ label, value, target, unit, tone }: { label: string; value: number; target: number; unit: string; tone: string }) {
  const percent = target > 0 ? Math.min(value / target * 100, 100) : 0;
  return <div className="macro-stat"><div className={`macro-dot ${tone}`} /><div className="macro-meta"><span>{label}</span><strong>{formatNumber(value, 1)}<small> {unit}</small></strong>{target > 0 && <div className="mini-track"><div className={`mini-fill ${tone}`} style={{ width: `${percent}%` }} /></div>}</div></div>;
}

function LogRow({ entry, onDelete }: { entry: LogEntry; onDelete: () => void }) {
  const time = new Date(entry.consumedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return <div className="log-row"><div className="log-leading"><span className="log-type-icon">{entry.itemType === 'meal' ? <Utensils size={16} /> : <Apple size={16} />}</span><div className="log-description"><strong>{entry.itemName}</strong><small>{entry.quantityLabel} · {time}</small></div></div><div className="log-nutrition"><strong>{formatNumber(entry.nutrition.kcal)}</strong><small>kcal</small></div><button className="delete-log" onClick={onDelete} aria-label={`Remove ${entry.itemName}`}><X size={15} /></button></div>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-box"><Search size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><div className="empty-illustration"><Utensils size={22} /></div><strong>{title}</strong><p>{body}</p><button className="secondary-button" onClick={onAction}><Plus size={16} /> {action}</button></div>;
}

function TargetRow({ label, value, unit, optional = false }: { label: string; value: number; unit: string; optional?: boolean }) {
  return <div className="target-row"><span>{label}{optional && <small> optional</small>}</span><strong>{value > 0 ? `${formatNumber(value)} ${unit}` : 'Not set'}</strong></div>;
}

function ModalFrame({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-sheet" role="dialog" aria-modal="true"><div className="modal-grabber" /><div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</section></div>;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function FoodEditor({ food, onSave, onArchive, onClose }: { food: Food | null; onSave: (food: Omit<Food, 'id'>, id?: number) => Promise<void>; onArchive: (food: Food) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<Omit<Food, 'id'>>(food ? { name: food.name, category: food.category, baseUnit: food.baseUnit, baseAmount: food.baseAmount, nutrition: { ...food.nutrition }, notes: food.notes, updatedAt: food.updatedAt, archived: food.archived } : { ...emptyFood, nutrition: { ...emptyFood.nutrition } });
  const [saving, setSaving] = useState(false);
  function updateNutrition(key: keyof Nutrition, value: string) {
    setForm((current) => ({ ...current, nutrition: { ...current.nutrition, [key]: Number(value) || 0 } }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || form.baseAmount <= 0) return;
    setSaving(true);
    await onSave({ ...form, name: form.name.trim() }, food?.id);
    setSaving(false);
  }
  return <ModalFrame title={food ? 'Edit food' : 'Add a food'} subtitle="Save an ingredient with nutrition for a known base quantity." onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" form="food-form" disabled={saving}>{saving ? 'Saving...' : 'Save food'}</button></>}>
    <form id="food-form" onSubmit={submit} className="form-stack">
      <Field label="Food name"><input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cooked white rice" /></Field>
      <div className="field-grid"><Field label="Category"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Staples" /></Field><Field label="Base unit"><select value={form.baseUnit} onChange={(e) => { const baseUnit = e.target.value as BaseUnit; setForm({ ...form, baseUnit, baseAmount: baseUnit === 'piece' ? 1 : 100 }); }}><option value="g">Grams (g)</option><option value="ml">Millilitres (ml)</option><option value="piece">Pieces</option></select></Field></div>
      <Field label="Nutrition base quantity" hint="Enter the amount that the nutrition values below describe."><div className="input-with-suffix"><input type="number" min="0.01" step="any" value={form.baseAmount} onChange={(e) => setForm({ ...form, baseAmount: Number(e.target.value) })} /><span>{form.baseUnit}</span></div></Field>
      <div className="form-section-label">NUTRITION FOR {form.baseAmount || '—'} {form.baseUnit.toUpperCase()}</div>
      <div className="nutrient-input-grid"><NutrientField label="Calories" unit="kcal" value={form.nutrition.kcal} onChange={(v) => updateNutrition('kcal', v)} /><NutrientField label="Protein" unit="g" value={form.nutrition.protein} onChange={(v) => updateNutrition('protein', v)} /><NutrientField label="Carbs" unit="g" value={form.nutrition.carbs} onChange={(v) => updateNutrition('carbs', v)} /><NutrientField label="Fat" unit="g" value={form.nutrition.fat} onChange={(v) => updateNutrition('fat', v)} /><NutrientField label="Fiber" unit="g" value={form.nutrition.fiber} onChange={(v) => updateNutrition('fiber', v)} /></div>
      <Field label="Notes (optional)"><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Brand, preparation method, label source..." /></Field>
      {food && <button type="button" className="danger-text-button" onClick={() => onArchive(food)}><Trash2 size={15} /> Archive this food</button>}
    </form>
  </ModalFrame>;
}

function NutrientField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (value: string) => void }) {
  return <label className="nutrient-field"><span>{label}</span><div><input type="number" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} /><small>{unit}</small></div></label>;
}

function MealEditor({ meal, foods, onSave, onArchive, onClose }: { meal: MealPreset | null; foods: Food[]; onSave: (meal: Omit<MealPreset, 'id'>, id?: number) => Promise<void>; onArchive: (meal: MealPreset) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(meal?.name ?? '');
  const [category, setCategory] = useState(meal?.category ?? 'Everyday');
  const [notes, setNotes] = useState(meal?.notes ?? '');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(meal?.ingredients.map((item) => ({ foodId: item.foodId, quantity: String(item.quantity) })) ?? []);
  const [addFoodId, setAddFoodId] = useState(String(foods[0]?.id ?? ''));
  const [addQuantity, setAddQuantity] = useState('100');
  const [saving, setSaving] = useState(false);
  const selectedFood = foods.find((food) => String(food.id) === addFoodId);
  const total = useMemo(() => ingredients.reduce((sum, item) => {
    const food = foods.find((candidate) => candidate.id === item.foodId);
    return food ? addNutrition(sum, foodNutrition(food, Number(item.quantity) || 0)) : sum;
  }, { ...ZERO_NUTRITION }), [ingredients, foods]);

  function addIngredient() {
    const id = Number(addFoodId); const quantity = Number(addQuantity);
    if (!id || quantity <= 0) return;
    setIngredients((current) => [...current, { foodId: id, quantity: String(quantity) }]);
    setAddQuantity(selectedFood?.baseUnit === 'piece' ? '1' : '100');
  }
  function changeIngredient(index: number, quantity: string) {
    setIngredients((current) => current.map((item, i) => i === index ? { ...item, quantity } : item));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const valid = ingredients.map((item) => ({ foodId: item.foodId, quantity: Number(item.quantity) })).filter((item) => item.quantity > 0);
    if (!name.trim() || valid.length === 0) return;
    setSaving(true);
    await onSave({ name: name.trim(), category, ingredients: valid, notes, updatedAt: new Date().toISOString(), archived: false }, meal?.id);
    setSaving(false);
  }

  return <ModalFrame title={meal ? 'Edit meal' : 'Create a meal'} subtitle="Combine your saved foods into a reusable meal preset." onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" form="meal-form" disabled={saving || ingredients.length === 0}>{saving ? 'Saving...' : 'Save meal'}</button></>}>
    <form id="meal-form" className="form-stack" onSubmit={submit}>
      <Field label="Meal name"><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Soya rice bowl" /></Field>
      <Field label="Category"><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Everyday" /></Field>
      <div className="form-section-label">INGREDIENTS</div>
      {ingredients.length === 0 ? <div className="ingredient-empty">No ingredients added yet. Choose a food below.</div> : <div className="ingredient-list">{ingredients.map((item, index) => {
        const food = foods.find((candidate) => candidate.id === item.foodId);
        return <div className="ingredient-row" key={`${item.foodId}-${index}`}><div className="ingredient-name"><strong>{food?.name ?? 'Unavailable food'}</strong><small>{food ? `per ${food.baseAmount}${food.baseUnit}` : ''}</small></div><input aria-label={`Quantity for ${food?.name ?? 'ingredient'}`} type="number" min="0" step="any" value={item.quantity} onChange={(e) => changeIngredient(index, e.target.value)} /><span>{food?.baseUnit}</span><button type="button" className="remove-ingredient" onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))} aria-label="Remove ingredient"><X size={15} /></button></div>;
      })}</div>}
      <div className="add-ingredient-row"><select value={addFoodId} onChange={(e) => { setAddFoodId(e.target.value); const f = foods.find((food) => String(food.id) === e.target.value); setAddQuantity(f?.baseUnit === 'piece' ? '1' : '100'); }}><option value="">Choose food...</option>{foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select><input aria-label="Ingredient quantity" type="number" min="0.01" step="any" value={addQuantity} onChange={(e) => setAddQuantity(e.target.value)} /><span>{selectedFood?.baseUnit ?? 'unit'}</span><button type="button" className="add-small-button" onClick={addIngredient} disabled={!selectedFood || Number(addQuantity) <= 0}><Plus size={16} /></button></div>
      <div className="meal-total-preview"><span>Calculated per meal</span><strong>{formatNumber(total.kcal)} kcal</strong><small>P {formatNumber(total.protein, 1)}g · C {formatNumber(total.carbs, 1)}g · F {formatNumber(total.fat, 1)}g</small></div>
      <Field label="Notes (optional)"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preparation notes or portion details..." /></Field>
      {meal && <button type="button" className="danger-text-button" onClick={() => onArchive(meal)}><Trash2 size={15} /> Archive this meal</button>}
    </form>
  </ModalFrame>;
}

function FoodLogModal({ food, defaultDate, onSave, onClose }: { food: Food; defaultDate: string; onSave: (entry: Omit<LogEntry, 'id'>) => Promise<void>; onClose: () => void }) {
  const [quantity, setQuantity] = useState(food.baseUnit === 'piece' ? '1' : String(food.baseAmount));
  const [slot, setSlot] = useState<MealSlot>(slotForHour(new Date().getHours()));
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const total = foodNutrition(food, Number(quantity) || 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(quantity); if (amount <= 0 || !food.id) return;
    const consumedAt = new Date(`${date}T${time || '12:00'}`).toISOString();
    await onSave({ itemType: 'food', itemId: food.id, itemName: food.name, mealSlot: slot, quantity: amount, quantityLabel: `${formatNumber(amount, 1)} ${food.baseUnit}`, consumedAt, dateKey: date, nutrition: total });
  }
  return <ModalFrame title={`Log ${food.name}`} subtitle={`Nutrition is calculated from ${food.baseAmount}${food.baseUnit}.`} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" form="food-log-form"><Plus size={16} /> Add to log</button></>}>
    <form id="food-log-form" onSubmit={submit} className="form-stack">
      <Field label={`Quantity (${food.baseUnit})`}><input autoFocus type="number" min="0.01" step="any" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
      <Field label="Meal"><select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>{MEAL_SLOTS.map((value) => <option key={value}>{value}</option>)}</select></Field>
      <div className="field-grid"><Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field></div>
      <NutritionPreview nutrition={total} />
    </form>
  </ModalFrame>;
}

function MealLogModal({ meal, foods, defaultDate, onSave, onClose }: { meal: MealPreset; foods: Food[]; defaultDate: string; onSave: (entry: Omit<LogEntry, 'id'>) => Promise<void>; onClose: () => void }) {
  const [servings, setServings] = useState('1');
  const [slot, setSlot] = useState<MealSlot>(slotForHour(new Date().getHours()));
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const total = mealNutrition(meal, foods, Number(servings) || 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(servings); if (amount <= 0 || !meal.id) return;
    const consumedAt = new Date(`${date}T${time || '12:00'}`).toISOString();
    await onSave({ itemType: 'meal', itemId: meal.id, itemName: meal.name, mealSlot: slot, quantity: amount, quantityLabel: `${formatNumber(amount, 2)} serving${amount === 1 ? '' : 's'}`, consumedAt, dateKey: date, nutrition: total });
  }
  return <ModalFrame title={`Log ${meal.name}`} subtitle="Your saved ingredient quantities make up one serving." onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" form="meal-log-form"><Plus size={16} /> Add to log</button></>}>
    <form id="meal-log-form" onSubmit={submit} className="form-stack">
      <Field label="Number of servings"><input autoFocus type="number" min="0.01" step="any" required value={servings} onChange={(e) => setServings(e.target.value)} /></Field>
      <Field label="Meal"><select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>{MEAL_SLOTS.map((value) => <option key={value}>{value}</option>)}</select></Field>
      <div className="field-grid"><Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field></div>
      <NutritionPreview nutrition={total} />
    </form>
  </ModalFrame>;
}

function NutritionPreview({ nutrition }: { nutrition: Nutrition }) {
  return <div className="nutrition-preview"><div><span>ESTIMATED TOTAL</span><strong>{formatNumber(nutrition.kcal)} <small>kcal</small></strong></div><div className="preview-macros"><span>Protein <b>{formatNumber(nutrition.protein, 1)}g</b></span><span>Carbs <b>{formatNumber(nutrition.carbs, 1)}g</b></span><span>Fat <b>{formatNumber(nutrition.fat, 1)}g</b></span></div></div>;
}

function SettingsModal({ settings, onSave, onClose }: { settings: AppSettings; onSave: (settings: AppSettings) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(settings);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave({ ...form, calorieTarget: Math.max(0, form.calorieTarget), proteinTarget: Math.max(0, form.proteinTarget), carbsTarget: Math.max(0, form.carbsTarget), fatTarget: Math.max(0, form.fatTarget) });
  }
  return <ModalFrame title="Daily targets" subtitle="Set targets that make sense for your current goal." onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" form="settings-form">Save targets</button></>}>
    <form id="settings-form" className="form-stack" onSubmit={submit}>
      <NutrientField label="Calories" unit="kcal" value={form.calorieTarget} onChange={(v) => setForm({ ...form, calorieTarget: Number(v) || 0 })} />
      <NutrientField label="Protein" unit="g" value={form.proteinTarget} onChange={(v) => setForm({ ...form, proteinTarget: Number(v) || 0 })} />
      <NutrientField label="Carbohydrates" unit="g" value={form.carbsTarget} onChange={(v) => setForm({ ...form, carbsTarget: Number(v) || 0 })} />
      <NutrientField label="Fat" unit="g" value={form.fatTarget} onChange={(v) => setForm({ ...form, fatTarget: Number(v) || 0 })} />
      <p className="form-hint">Set carbs or fat to zero to hide their target progress. Their intake will still be tracked.</p>
    </form>
  </ModalFrame>;
}

export default App;
