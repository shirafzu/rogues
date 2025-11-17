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

  update() {}
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

window.AttackAbilityWrapper = AttackAbilityWrapper;
window.DodgeAbilityWrapper = DodgeAbilityWrapper;
