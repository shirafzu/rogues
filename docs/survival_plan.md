# Survival Crafting Plan (Prototype)

## Loop Goal
- Players collect resources during missions (wood, ore, herbs, scrap).
- Resources can be consumed immediately (craft quick items) or extracted (kept for base upgrades).
- Basic base node on map allows depositing resources, simple crafting, acting as extraction point.

## Systems to Implement
1. **Inventory / ResourceSystem**
   - Items defined by type (id, stack limit, weight).
   - Player inventory: limited slots (e.g., 8) with per-slot stack capacities.
   - Weight: total weight slows movement; simple multiplier for movement speed.
   - UI: overlay showing items, total weight, quick craft options.

2. **Resources & Harvestable Objects**
   - Resource types: Wood, Stone Ore, Metal Scrap, Herbs.
   - Harvestable nodes placed on map. Each node has HP, drops resources when destroyed.
   - Resource pickups persist in world until collected.

3. **Crafting System**
   - Recipes consume resources, produce items (e.g., campfire kit, health kit, ammo).
   - UI accessible via base node or overlay button.
   - Limited set of starter recipes: 
     - Campfire Kit = Wood x3 + Ore x1
     - Health Salve = Herb x2 + Scrap x1
     - Arrow Bundle = Wood x1 + Scrap x2

4. **Base/Home Node**
   - Located in map (safe zone). Interacting opens inventory/crafting UI.
   - Acts as extraction point: if player reaches base and confirms, mission ends with inventory extracted.
   - Stores crafted items in persistent stash (WIP stub).

5. **Future Hooks [WIP]**
   - Hunger/thirst affecting stats.
   - Base upgrades unlocking more storage/crafting stations.
   - Multi-step crafting or blueprint system.

## Implementation Order
1. Inventory + item definitions (resource schema, stack/weight rules, UI stub).
2. Harvestable nodes + drop items (spawn resource objects, pickup logic).
3. Crafting system + sample recipes.
4. Resource/crafting UI (minimal overlay).
5. Base node logic (deposit/extract, simple persistence stub).

