class HoldRangedAction {
  constructor(options = {}) {
    this.mode = options.mode || "auto"; // auto | charge | aim
    this.abilityFactory = options.abilityFactory;
    this.interval = options.interval ?? 220;
    this.maxShots = options.maxShots ?? 4;
    this.maxChargeMs = options.maxChargeMs ?? 1200;
    this.minChargeMs = options.minChargeMs ?? 200;
    this.active = false;
    this.elapsed = 0;
    this.shots = 0;
    this.nextShotAt = 0;
    this.pointerId = null;
    this.aimDir = { x: 1, y: 0 };
  }

  start(context = {}, runner) {
    if (this.active) return false;
    if (!this.abilityFactory || typeof runner !== "function") return false;
    this.active = true;
    this.elapsed = 0;
    this.shots = 0;
    this.nextShotAt = 0;
    this.pointerId = context.pointerId ?? null;
    this.aimDir = this._getDir(context) || { x: 1, y: 0 };
    // 即時1発出す場合（auto用）
    if (this.mode === "auto") {
      this._fire(context, runner, 0, 1);
      this.shots = 1;
      this.nextShotAt = this.interval;
    }
    return true;
  }

  update(delta, context = {}, runner) {
    if (!this.active) return;
    this.elapsed += delta;
    this.aimDir = this._getDir(context) || this.aimDir;

    if (this.mode === "auto") {
      while (this.shots < this.maxShots && this.elapsed >= this.nextShotAt) {
        this._fire(context, runner, this.shots, 1);
        this.shots += 1;
        this.nextShotAt += this.interval;
      }
    }
  }

  release(context = {}, runner) {
    if (!this.active) return false;
    let fired = false;
    if (this.mode === "charge") {
      const ratio = Math.min(Math.max(this.elapsed, this.minChargeMs), this.maxChargeMs) / this.maxChargeMs;
      fired = this._fire(context, runner, 0, ratio);
    } else if (this.mode === "aim") {
      fired = this._fire(context, runner, 0, 1);
    }
    this.active = false;
    this.pointerId = null;
    return fired;
  }

  _fire(context, runner, idx = 0, power = 1) {
    if (!this.abilityFactory) return false;
    const ability = this.abilityFactory(context, { index: idx, power, dir: this.aimDir, elapsed: this.elapsed });
    if (!ability) return false;
    return runner(ability, context);
  }

  _getDir(context) {
    if (!context.pointer || !this.ownerSprite) return null;
    const sprite = this.ownerSprite;
    const dx = context.pointer.x - sprite.x;
    const dy = context.pointer.y - sprite.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  setOwnerSprite(sprite) {
    this.ownerSprite = sprite;
  }
}

class ComboManager {
  constructor(character, options = {}) {
    this.character = character;
    this.equipments = options.equipments || [];
    this.resetMs = options.resetMs ?? 1200;
    this.rangeThreshold = options.rangeThreshold ?? 260;
    this.indices = { tap: 0, long: 0, avoid: 0, ranged: 0 };
    this.lastActionAt = 0;
    this.statusTimer = null;
    this.activeHold = null;
  }

  _maybeReset(now) {
    if (now - this.lastActionAt > this.resetMs) {
      this.indices = { tap: 0, long: 0, avoid: 0, ranged: 0 };
    }
  }

  _getEquipment(kindKey = "tap") {
    const key = kindKey || "tap";
    const list = this.equipments;
    if (!list || list.length === 0) return null;
    const idx = this.indices[key] % list.length;
    return { equipment: list[idx], index: idx };
  }

  _advance(kindKey = "tap") {
    const key = kindKey || "tap";
    if (this.indices[key] == null) this.indices[key] = 0;
    this.indices[key] = (this.indices[key] + 1) % Math.max(1, this.equipments.length);
  }

  handleAction(kind, context = {}) {
    const now = this.character.scene.time.now;
    this._maybeReset(now);
    const kindKey = kind === "avoid" ? "avoid" : kind === "long" ? "long" : "tap";
    const isForcedRanged = kindKey !== "avoid" && Boolean(context.forceRanged || context.twoFingerRanged);
    const slotKey = isForcedRanged ? "ranged" : kindKey;
    const { equipment } = this._getEquipment(slotKey) || {};
    if (!equipment) return false;

    // 回避は常に近接の回避アクションを使用し、遠距離判定はしない
    const useRanged = kindKey === "avoid" ? false : isForcedRanged;
    const actions = equipment.actions || {};
    const ability =
      useRanged && actions.ranged
        ? actions.ranged
        : actions[kindKey];

    if (!ability) return false;

    const executed = this._runAbility(ability, context);
    if (executed) {
      this._advance(slotKey);
      this.lastActionAt = now;
      const label = this._buildLabel(equipment, useRanged ? "遠" : kindKey === "long" ? "長" : kindKey === "avoid" ? "避" : "短");
      this._flashStatus(label);
    }
    return executed;
  }

  startHold(context = {}) {
    const now = this.character.scene.time.now;
    this._maybeReset(now);
    const { equipment, index } = this._getEquipment("ranged") || {};
    if (!equipment || !equipment.actions?.rangedHold) return false;
    const holdAction = equipment.actions.rangedHold;
    holdAction.setOwnerSprite(this.character.sprite);
    const started = holdAction.start(context, (ability, ctx) => this._runAbility(ability, ctx));
    if (started) {
      this.activeHold = { holdAction, pointerId: context.pointerId, equipmentIndex: index, equipment };
      this._advance("ranged");
      this.lastActionAt = now;
      const label = this._buildLabel(equipment, "遠");
      this._flashStatus(label);
    }
    return started;
  }

  updateHold(delta, context = {}) {
    if (!this.activeHold) return;
    const { holdAction } = this.activeHold;
    if (!holdAction || !holdAction.active) {
      this.activeHold = null;
      return;
    }
    holdAction.setOwnerSprite(this.character.sprite);
    holdAction.update(delta, context, (ability, ctx) => this._runAbility(ability, ctx));
  }

  releaseHold(context = {}) {
    if (!this.activeHold) return false;
    const { holdAction } = this.activeHold;
    holdAction.setOwnerSprite(this.character.sprite);
    const fired = holdAction.release(context, (ability, ctx) => this._runAbility(ability, ctx));
    this.activeHold = null;
    return fired;
  }

  update() {
    // reserved for future use
  }

  _runAbility(ability, context) {
    if (!ability) return false;
    if (typeof this.character.executeAbilityInstance === "function") {
      return this.character.executeAbilityInstance(ability, context);
    }
    return ability.execute(context);
  }

  _flashStatus(text) {
    if (!this.character?.updateStatusLabel) return;
    this.character.updateStatusLabel(text, "#fff176");
    if (this.statusTimer) {
      this.statusTimer.remove(false);
    }
    this.statusTimer = this.character.scene.time.delayedCall(600, () => {
      this.character.updateStatusLabel("");
    });
  }

  _buildLabel(equipment, actionSymbol) {
    const name = equipment?.name || equipment?.key || "Equip";
    return `${name}${actionSymbol}`;
  }
}

function createWeaponEquipments(character) {
  const createAutoRanged = (config = {}) =>
    new HoldRangedAction({
      mode: "auto",
      interval: config.interval ?? 220,
      maxShots: config.maxShots ?? 5,
      abilityFactory: (_ctx, meta = {}) =>
        new AttackAbilityWrapper(character, ProjectileAttackController, {
          cooldown: 0,
          projectileSpeed: config.projectileSpeed ?? 780,
          damage: (config.baseDamage ?? 1) * (meta.power || 1),
          projectileColor: config.projectileColor ?? 0xfff59d,
        }),
    });

  const createChargeRanged = (config = {}) =>
    new HoldRangedAction({
      mode: "charge",
      maxChargeMs: config.maxChargeMs ?? 1200,
      minChargeMs: config.minChargeMs ?? 220,
      abilityFactory: (_ctx, meta = {}) => {
        const power = Phaser.Math.Clamp(meta.power || 0.5, 0.2, 1.2);
        return new AttackAbilityWrapper(character, LinePierceAttackController, {
          length: Phaser.Math.Linear(config.lengthMin ?? 360, config.lengthMax ?? 620, power),
          width: config.width ?? 34,
          damage: Phaser.Math.Linear(config.damageMin ?? 1, config.damageMax ?? 3.2, power),
          indicatorColor: config.indicatorColor ?? 0x80cbc4,
        });
      },
    });

  const createAimRanged = (config = {}) =>
    new HoldRangedAction({
      mode: "aim",
      abilityFactory: (ctx, meta = {}) =>
        new AttackAbilityWrapper(character, HookShotAttackController, {
          range: config.range ?? 520,
          damage: config.damage ?? 2,
          pullSpeed: config.pullSpeed ?? 12,
          yankEnemy: true,
          indicatorColor: config.indicatorColor ?? 0xc5cae9,
          dir: meta.dir || ctx.direction,
        }),
    });

  return [
    {
      key: "A",
      name: "剣",
      actions: {
        tap: new AttackAbilityWrapper(character, MultiHitAttackController, {
          hitCount: 3,
          interval: 90,
          radius: 110,
          damage: 1,
          indicatorColor: 0xfff59d,
        }),
        long: new AttackAbilityWrapper(character, RisingSlashAttackController, {
          radius: 170,
          damage: 2,
          indicatorColor: 0x90caf9,
        }),
        avoid: new DodgeAbilityWrapper(character, DashDodgeController, {
          distance: 160,
          duration: 260,
          invincibleDuration: 200,
        }),
        ranged: new AttackAbilityWrapper(character, ProjectileAttackController, {
          cooldown: 0,
          projectileSpeed: 820,
          damage: 1,
          projectileColor: 0xfff59d,
        }),
        rangedHold: createAutoRanged({
          interval: 200,
          maxShots: 5,
          projectileSpeed: 840,
          baseDamage: 1,
          projectileColor: 0xfff59d,
        }),
      },
    },
    {
      key: "B",
      name: "フック",
      actions: {
        tap: new AttackAbilityWrapper(character, HookSlamAttackController, {
          radius: 120,
          damage: 1,
          indicatorColor: 0xffab91,
        }),
        long: new AttackAbilityWrapper(character, HookShotAttackController, {
          range: 260,
          damage: 1,
          pullSpeed: 10,
          indicatorColor: 0x9fa8da,
        }),
        avoid: new DodgeAbilityWrapper(character, ChainImpactDodgeController, {
          distance: 170,
          duration: 260,
          invincibleDuration: 220,
          chainRadius: 220,
          damagePerHit: 1,
        }),
        ranged: new AttackAbilityWrapper(character, HookShotAttackController, {
          range: 460,
          damage: 2,
          pullSpeed: 12,
          yankEnemy: true,
          indicatorColor: 0xd1c4e9,
        }),
        rangedHold: createAimRanged({
          range: 520,
          damage: 2,
          pullSpeed: 12,
          indicatorColor: 0xd1c4e9,
        }),
      },
    },
    {
      key: "C",
      name: "槍",
      actions: {
        tap: new AttackAbilityWrapper(character, LinePierceAttackController, {
          length: 260,
          width: 30,
          damage: 1.6,
          indicatorColor: 0xb2dfdb,
        }),
        long: new AttackAbilityWrapper(character, LinePierceAttackController, {
          length: 360,
          width: 38,
          damage: 2.2,
          indicatorColor: 0x80cbc4,
        }),
        avoid: new DodgeAbilityWrapper(character, AcceleratingDodgeController, {
          distance: 210,
          duration: 360,
          invincibleDuration: 260,
          impactRadius: 110,
          impactDamage: 1,
        }),
        ranged: new AttackAbilityWrapper(character, LinePierceAttackController, {
          length: 420,
          width: 34,
          damage: 2,
          indicatorColor: 0x4dd0e1,
        }),
        rangedHold: createChargeRanged({
          lengthMin: 420,
          lengthMax: 640,
          damageMin: 1.5,
          damageMax: 3.2,
          indicatorColor: 0x4dd0e1,
        }),
      },
    },
  ];
}

window.ComboManager = ComboManager;
window.createWeaponEquipments = createWeaponEquipments;
window.HoldRangedAction = HoldRangedAction;
