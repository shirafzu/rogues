# ROGUES Prototype - Implementation Overview (Nov 16)

## Core Systems
- **CharacterController**: Owns sprite, movement controller, ability map, inventory/preset hooks. Input mapping (tap/flick) triggers abilities (wrappers for attack/dodge). Movement controllers are pluggable (basic, accelerating, hopping, seek).
- **Abilities** (js/abilities): `AttackAbilityWrapper` and `DodgeAbilityWrapper` adapt legacy controllers to a unified `BaseAbility` interface. Each ability handles `execute/context`, `update`, `isActive`, `blocksMovement`. CharacterController tracks active abilities and blocks movement when needed.
- **CombatSystem**: Resolves attack areas, applies damage/knockback、crate removal, nearest-target queries, radial pushes (for chain impact), and ignite hooks.
- **FireChemicalSystem**: Handles burning visuals, periodic damage, and spread (wind-aware). Exposed via `ignite(entity)` and `update({ enemies, crates, damageEnemy, damageCrate })`.
- **Movement variants**: Basic, Accelerating, Hopping, Seek. Seek used for enemies via `CharacterFactory`.
- **Dodge variants**: Dash, Accelerating impact, Chain Impact, Blink.
- **Attack variants**: AoE Shockwave, Alternating Slash, Projectile.
- **Character Options UI**: Users select movement/dodge/attack from `AVAILABLE_*` definitions; MainScene builds ability map accordingly.

## Main Scene Flow
1. Builds walls, base nodes, crates, and enemies (CharacterFactory + SeekMovement).
2. Shows customization overlay before play. After selection, instantiates CharacterController and ability wrappers.
3. Update loop: `playerController.update(delta)` → `updateEnemies` → `fireSystem.update` → `clampPlayerToBounds`.
4. Input: taps trigger attack ability, flicks trigger dodge ability. Combat resolution handled by CombatSystem.

## Survival Crafting Plan (Prototype)
- Resources to collect: wood, ore, scrap, herbs.
- Player inventory: slots + stack limits + weight modifier. Base node allows deposit/craft/extract.
- Harvestables: destructible nodes that drop resources. Pickups persist until collected.
- Crafting: simple recipes (Campfire Kit, Health Salve, Arrow Bundle) accessible from base or overlay.
- Base node: in-map safe zone with UI entry point and extraction trigger.
- Roadmap: hunger/thirst, base upgrades, multi-step crafting.
- Implementation order: (1) Inventory + item definitions, (2) harvestables/pickups, (3) crafting recipes, (4) UI overlay, (5) base node logic (deposit/extract stub).

## Next Steps
1. Implement Inventory/Resource system + UI overlay.
2. Add harvestable nodes/drop logic, integrate with Combat/Physics.
3. Add CraftingSystem and sample recipes.
4. Create base node interactions and extraction loop.
5. Extend chemical systems (water/electric/ oil) and enemy AI behaviors.
