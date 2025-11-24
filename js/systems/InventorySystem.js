// Inventory & Resource definitions for the ROGUES prototype.
// Provides slot-based storage with weight tracking and speed penalties.

const RESOURCE_DEFINITIONS = {
  wood: {
    id: "wood",
    name: "Wood",
    description: "Lightweight lumber pulled from crates or trees.",
    maxStack: 10,
    weight: 1,
  },
  ore: {
    id: "ore",
    name: "Ore",
    description: "Dense mineral chunks. Heavy but valuable.",
    maxStack: 10,
    weight: 2,
  },
  scrap: {
    id: "scrap",
    name: "Scrap",
    description: "Metal scraps used for improvised tech.",
    maxStack: 10,
    weight: 1.5,
  },
  herb: {
    id: "herb",
    name: "Herb",
    description: "Medicinal plants for quick salves.",
    maxStack: 10,
    weight: 0.5,
  },
  campfire_kit: {
    id: "campfire_kit",
    name: "Campfire Kit",
    description: "Create a temporary safe zone with regen aura.",
    maxStack: 5,
    weight: 2,
  },
  health_salve: {
    id: "health_salve",
    name: "Health Salve",
    description: "Single-use heal that restores moderate HP.",
    maxStack: 5,
    weight: 0.5,
  },
  arrow_bundle: {
    id: "arrow_bundle",
    name: "Arrow Bundle",
    description: "Replenish ammo for ranged presets.",
    maxStack: 5,
    weight: 1,
  },
  stone: {
    id: "stone",
    name: "Stone",
    description: "Hard rock suitable for tools or throwing.",
    maxStack: 20,
    weight: 1.5,
  },
  fiber: {
    id: "fiber",
    name: "Fiber",
    description: "Tough plant fibers for binding.",
    maxStack: 20,
    weight: 0.1,
  },
  throwing_stone: {
    id: "throwing_stone",
    name: "Throwing Stone",
    description: "Simple ranged weapon.",
    maxStack: 10,
    weight: 0.5,
  },
  spike_trap: {
    id: "spike_trap",
    name: "Spike Trap",
    description: "Placeable trap that damages enemies.",
    maxStack: 5,
    weight: 2,
  },
};

const QUICK_CRAFT_RECIPES = [
  {
    id: "campfire_kit",
    name: "Campfire Kit",
    description: "Create a temporary safe zone with regen aura.",
    costs: { wood: 3, ore: 1 },
  },
  {
    id: "health_salve",
    name: "Health Salve",
    description: "Single-use heal that restores moderate HP.",
    costs: { herb: 2, scrap: 1 },
  },
  {
    id: "arrow_bundle",
    name: "Arrow Bundle",
    description: "Replenish ammo for ranged presets.",
    costs: { wood: 1, scrap: 2 },
  },
  {
    id: "throwing_stone",
    name: "Throwing Stone",
    description: "Simple ranged weapon.",
    costs: { stone: 1 },
  },
  {
    id: "spike_trap",
    name: "Spike Trap",
    description: "Placeable trap that damages enemies.",
    costs: { wood: 2, scrap: 1 },
  },
];

class InventorySystem {
  constructor(options = {}) {
    this.resourceDefinitions = options.resourceDefinitions || RESOURCE_DEFINITIONS;
    this.slotCount = Math.max(1, options.slotCount ?? 8);
    this.defaultMaxStack = options.defaultMaxStack ?? 10;
    this.slowdownThreshold = options.slowdownThreshold ?? 20;
    const defaultCapacity = Math.max(this.slowdownThreshold + 5, options.weightCapacity ?? 40);
    this.weightCapacity = defaultCapacity;
    this.minSpeedMultiplier = Phaser?.Math?.Clamp
      ? Phaser.Math.Clamp(options.minSpeedMultiplier ?? 0.4, 0.1, 1)
      : Math.min(Math.max(options.minSpeedMultiplier ?? 0.4, 0.1), 1);
    this.slots = Array.from({ length: this.slotCount }, () => null);
    this.changeListeners = new Set();
  }

  destroy() {
    this.changeListeners.clear();
  }

  addChangeListener(listener) {
    if (typeof listener !== "function") return () => { };
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  notifyChange() {
    this.changeListeners.forEach((listener) => {
      try {
        listener(this);
      } catch (err) {
        console.error("[InventorySystem] Listener failed", err);
      }
    });
  }

  getResourceDefinition(resourceId) {
    return this.resourceDefinitions?.[resourceId] || null;
  }

  getSlots() {
    return this.slots.map((slot) => (slot ? { ...slot } : null));
  }

  addResource(resourceId, amount = 1) {
    const resourceDef = this.getResourceDefinition(resourceId);
    if (!resourceDef || amount <= 0) return 0;

    let remaining = amount;
    const maxStack = resourceDef.maxStack ?? this.defaultMaxStack;
    this.slots.forEach((slot) => {
      if (!slot || slot.resourceId !== resourceId || remaining <= 0) return;
      const capacity = maxStack - slot.quantity;
      if (capacity <= 0) return;
      const toAdd = Math.min(capacity, remaining);
      slot.quantity += toAdd;
      remaining -= toAdd;
    });

    if (remaining > 0) {
      for (let i = 0; i < this.slots.length && remaining > 0; i += 1) {
        if (this.slots[i]) continue;
        const toAdd = Math.min(remaining, maxStack);
        this.slots[i] = { resourceId, quantity: toAdd };
        remaining -= toAdd;
      }
    }

    const added = amount - remaining;
    if (added > 0) {
      this.notifyChange();
    }
    return added;
  }

  removeResource(resourceId, amount = 1) {
    if (amount <= 0) return 0;

    let remaining = amount;
    for (let i = 0; i < this.slots.length && remaining > 0; i += 1) {
      const slot = this.slots[i];
      if (!slot || slot.resourceId !== resourceId) continue;
      const toRemove = Math.min(slot.quantity, remaining);
      slot.quantity -= toRemove;
      remaining -= toRemove;
      if (slot.quantity <= 0) {
        this.slots[i] = null;
      }
    }

    const removed = amount - remaining;
    if (removed > 0) {
      this.notifyChange();
    }
    return removed;
  }

  clear() {
    let changed = false;
    for (let i = 0; i < this.slots.length; i += 1) {
      if (this.slots[i]) {
        this.slots[i] = null;
        changed = true;
      }
    }
    if (changed) {
      this.notifyChange();
    }
  }

  getTotalWeight() {
    return this.slots.reduce((sum, slot) => {
      if (!slot) return sum;
      const def = this.getResourceDefinition(slot.resourceId);
      const unitWeight = def?.weight ?? 1;
      return sum + slot.quantity * unitWeight;
    }, 0);
  }

  getMovementSpeedMultiplier(totalWeightOverride) {
    const totalWeight =
      typeof totalWeightOverride === "number" ? totalWeightOverride : this.getTotalWeight();
    if (totalWeight <= this.slowdownThreshold) {
      return 1;
    }
    if (totalWeight >= this.weightCapacity) {
      return this.minSpeedMultiplier;
    }

    const penaltyRange = this.weightCapacity - this.slowdownThreshold;
    const ratio = (totalWeight - this.slowdownThreshold) / Math.max(penaltyRange, 1);
    const multiplier = 1 - (1 - this.minSpeedMultiplier) * ratio;
    return Math.max(this.minSpeedMultiplier, Math.min(1, multiplier));
  }

  getWeightStats() {
    const totalWeight = this.getTotalWeight();
    const multiplier = this.getMovementSpeedMultiplier(totalWeight);
    return {
      totalWeight,
      slowdownThreshold: this.slowdownThreshold,
      capacity: this.weightCapacity,
      minSpeedMultiplier: this.minSpeedMultiplier,
      movementMultiplier: multiplier,
    };
  }

  /**
   * アイテムをクラフトする
   * @param {string} recipeId
   * @returns {boolean} 成功したかどうか
   */
  craftItem(recipeId) {
    const recipe = QUICK_CRAFT_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return false;

    // コスト確認
    const costs = Object.entries(recipe.costs || {});
    for (const [resourceId, amount] of costs) {
      const currentAmount = this.getResourceAmount(resourceId);
      if (currentAmount < amount) return false;
    }

    // コスト消費
    for (const [resourceId, amount] of costs) {
      this.removeResource(resourceId, amount);
    }

    // 成果物を付与（現在はリソースとして定義されているもののみ対応）
    // 将来的には装備品や設置物などの別枠管理が必要になる可能性あり
    // ここでは簡易的に「成果物がリソース定義にあればリソースとして追加、なければ特殊効果」とする
    const resultDef = this.getResourceDefinition(recipeId); // レシピID = リソースIDの場合
    if (resultDef) {
      this.addResource(recipeId, 1);
    } else {
      // リソースでない場合は、呼び出し元で効果を処理するためにイベント発火などが望ましいが
      // プロトタイプなので一旦コンソールログのみ、または成功として返す
      console.log(`Crafted special item: ${recipeId}`);
    }

    this.notifyChange();
    return true;
  }

  /**
   * リソースの所持数を取得
   */
  getResourceAmount(resourceId) {
    return this.slots.reduce((total, slot) => {
      if (slot && slot.resourceId === resourceId) {
        return total + slot.quantity;
      }
      return total;
    }, 0);
  }

  /**
   * アイテムを持っているか確認
   */
  hasItem(itemId, amount = 1) {
    return this.getResourceAmount(itemId) >= amount;
  }

  /**
   * アイテムを消費
   */
  consumeItem(itemId, amount = 1) {
    if (!this.hasItem(itemId, amount)) return false;
    this.removeResource(itemId, amount);
    return true;
  }
}

window.RESOURCE_DEFINITIONS = RESOURCE_DEFINITIONS;
window.QUICK_CRAFT_RECIPES = QUICK_CRAFT_RECIPES;
window.InventorySystem = InventorySystem;
