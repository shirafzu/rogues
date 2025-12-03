class MovementController {
  constructor(character, config = {}) {
    this.character = character;
    this.config = {
      dragThreshold: 20,
      ...config,
    };
  }

  update(_delta) {
    // Base class does nothing
  }
}

window.MovementController = MovementController;
