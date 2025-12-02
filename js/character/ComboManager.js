class ComboManager {
  constructor(character, options = {}) {
    this.character = character;
    this.loadouts = options.loadouts || {};
    this.rangeThreshold = options.rangeThreshold ?? 260;
    this.tapCount = 0;
    this.longCount = 0;
    this.lastLoadoutKey = options.defaultLoadout || Object.keys(this.loadouts)[0] || null;
    this.statusTimer = null;
  }

  /**
   * 入力種別に応じて装備を決定し、近接/遠距離を自動判定して発動
   */
  handleInput(kind, context = {}) {
    const loadoutKey = this._selectLoadout(kind);
    if (!loadoutKey) return false;

    const mode = this._shouldUseRanged(context) ? "ranged" : "melee";
    const ability = this._getAbility(loadoutKey, mode, kind);
    if (!ability) return false;

    const executed = this._executeAbility(ability, context);
    if (executed) {
      this.lastLoadoutKey = loadoutKey;
      this._flashStatus(`${loadoutKey}:${mode === "ranged" ? "遠" : "近"}`);
    }
    return executed;
  }

  reset() {
    this.tapCount = 0;
    this.longCount = 0;
  }

  update(_delta) {
    // 今回のプロトタイプでは特に継続処理なし
  }

  _selectLoadout(kind) {
    if (kind === "tap") {
      const key = this.tapCount % 2 === 0 ? "A" : "B";
      this.tapCount += 1;
      return key;
    }
    if (kind === "long") {
      const key = this.longCount % 2 === 0 ? "A" : "B";
      this.longCount += 1;
      return key;
    }
    if (kind === "avoid") {
      return this.lastLoadoutKey || "A";
    }
    return this.lastLoadoutKey || null;
  }

  _shouldUseRanged(context = {}) {
    if (context.forceRanged) return true;
    const scene = this.character.scene;
    const combat = scene?.combatSystem;
    if (!combat || !combat.getNearestEnemySprite || !this.character.sprite) return false;
    const target = combat.getNearestEnemySprite(this.character.sprite);
    if (!target) return false;
    const dist = Phaser.Math.Distance.Between(
      this.character.sprite.x,
      this.character.sprite.y,
      target.x,
      target.y
    );
    this.lastTargetDistance = dist;
    return dist >= this.rangeThreshold;
  }

  _getAbility(loadoutKey, mode, kind) {
    const loadout = this.loadouts[loadoutKey];
    if (!loadout) return null;
    const actionKey = kind === "long" ? "long" : kind === "avoid" ? "avoid" : "tap";
    return loadout[mode]?.[actionKey] || null;
  }

  _executeAbility(ability, context) {
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
    this.statusTimer = this.character.scene.time.delayedCall(650, () => {
      this.character.updateStatusLabel("");
    });
  }
}

/**
 * 剣(A)とフック(B)のロードアウトをまとめて生成
 */
function createDualEquipmentLoadouts(character) {
  return {
    A: {
      name: "Sword",
      melee: {
        tap: new AttackAbilityWrapper(character, MultiHitAttackController, {
          hitCount: 3,
          interval: 90,
          radius: 105,
          damage: 1,
          indicatorColor: 0xfff59d,
        }),
        long: new AttackAbilityWrapper(character, RisingSlashAttackController, {
          radius: 160,
          damage: 2,
          indicatorColor: 0x90caf9,
        }),
        avoid: new DodgeAbilityWrapper(character, DashDodgeController, {
          distance: 150,
          duration: 260,
          invincibleDuration: 200,
        }),
      },
      ranged: {
        tap: new AttackAbilityWrapper(character, ProjectileAttackController, {
          cooldown: 220,
          projectileSpeed: 760,
          damage: 1,
          projectileColor: 0xfff59d,
        }),
        long: new AttackAbilityWrapper(character, LinePierceAttackController, {
          length: 520,
          width: 30,
          damage: 2,
          indicatorColor: 0xffd54f,
        }),
        avoid: new DodgeAbilityWrapper(character, DashDodgeController, {
          distance: 180,
          duration: 240,
          invincibleDuration: 220,
        }),
      },
    },
    B: {
      name: "Hook",
      melee: {
        tap: new AttackAbilityWrapper(character, HookSlamAttackController, {
          radius: 120,
          damage: 1,
          indicatorColor: 0xffab91,
        }),
        long: new AttackAbilityWrapper(character, HookShotAttackController, {
          range: 240,
          damage: 1,
          pullSpeed: 10,
          indicatorColor: 0x9fa8da,
        }),
        avoid: new DodgeAbilityWrapper(character, ChainImpactDodgeController, {
          distance: 160,
          duration: 260,
          invincibleDuration: 220,
          chainRadius: 220,
          damagePerHit: 1,
        }),
      },
      ranged: {
        tap: new AttackAbilityWrapper(character, HookShotAttackController, {
          range: 340,
          damage: 1,
          pullSpeed: 11,
          yankEnemy: true,
          indicatorColor: 0xc5cae9,
        }),
        long: new AttackAbilityWrapper(character, HookShotAttackController, {
          range: 420,
          damage: 2,
          pullSpeed: 12,
          yankEnemy: true,
          indicatorColor: 0xd1c4e9,
        }),
        avoid: new DodgeAbilityWrapper(character, ChainImpactDodgeController, {
          distance: 200,
          duration: 300,
          invincibleDuration: 240,
          chainRadius: 240,
          damagePerHit: 1,
        }),
      },
    },
  };
}

window.ComboManager = ComboManager;
window.createDualEquipmentLoadouts = createDualEquipmentLoadouts;
