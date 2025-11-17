class BaseAbility {
  constructor(character, config = {}) {
    this.character = character;
    this.config = config;
  }

  execute(_context = {}) {
    return false;
  }

  update(_delta) {}

  isActive() {
    return false;
  }

  blocksMovement() {
    return false;
  }
}

window.BaseAbility = BaseAbility;
