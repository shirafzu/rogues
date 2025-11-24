class AttackAbilityWrapper extends BaseAbility {
  constructor(character, ControllerClass, config = {}) {
    super(character, config);
    this.controller = ControllerClass
      ? new ControllerClass(character, config)
      : null;
  }

  execute(context = {}) {
    if (!this.controller) return false;
    const pointer = context.pointer || context.worldPoint || context;
    return this.controller.requestAttack(pointer);
  }

  update() { }
}

class DodgeAbilityWrapper extends BaseAbility {
  constructor(character, ControllerClass, config = {}) {
    super(character, config);
    this.controller = ControllerClass
      ? new ControllerClass(character, config)
      : null;
  }

  execute(context = {}) {
    if (!this.controller) return false;
    const direction =
      context.direction || context.vector || context.pointer || context;
    if (!direction) return false;
    return this.controller.requestDodge(direction);
  }

  update(delta) {
    if (this.controller) {
      this.controller.update(delta);
    }
  }

  isActive() {
    return this.controller?.isDodging?.() ?? false;
  }

  blocksMovement() {
    return true;
  }
}

class LongDistanceAbilityWrapper extends BaseAbility {
  constructor(character, ControllerClass, config = {}) {
    super(character, config);
    this.controller = ControllerClass
      ? new ControllerClass(character, config)
      : null;
  }

  execute(context = {}) {
    if (!this.controller) return false;
    const direction = context.direction || context.vector || context;
    if (!direction) return false;
    return this.controller.requestLongDistance(direction);
  }

  update(delta) {
    if (this.controller) {
      this.controller.update(delta);
    }
  }

  isActive() {
    return this.controller?.isMoving?.() ?? false;
  }

  blocksMovement() {
    // 長距離移動は通常の移動をブロックする
    return true;
  }

  /**
   * 長距離移動を停止
   */
  stop() {
    if (this.controller) {
      this.controller.stop();
    }
  }
}

class ItemAbilityWrapper extends BaseAbility {
  constructor(character, ControllerClass, config = {}) {
    super(character, config);
    this.controller = ControllerClass
      ? new ControllerClass(character, config)
      : null;
  }

  execute(context = {}) {
    if (!this.controller) return false;
    const pointer = context.pointer || context.worldPoint || context;
    return this.controller.requestUse(pointer);
  }

  update(delta) {
    if (this.controller) {
      this.controller.update(delta);
    }
  }
}

window.AttackAbilityWrapper = AttackAbilityWrapper;
window.DodgeAbilityWrapper = DodgeAbilityWrapper;
window.LongDistanceAbilityWrapper = LongDistanceAbilityWrapper;
window.ItemAbilityWrapper = ItemAbilityWrapper;
