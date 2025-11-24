class CharacterFactory {
  static createEnemy(scene, options = {}) {
    const preset = {
      maxHp: options.maxHp ?? 3,
      movementController: options.movementController || SeekMovementController,
      movementConfig: {
        moveSpeed: options.moveSpeed ?? 2,
        targetProvider:
          options.targetProvider || (() => scene.playerController?.sprite),
        ...(options.movementConfig || {}),
      },
      dodgeController: options.dodgeController || null,
      attackController: options.attackController || null,
      attackConfig: options.attackConfig || {},
      dodgeConfig: options.dodgeConfig || {},
    };

    const controller = new CharacterController(scene, {
      preset,
      spawn: options.spawn,
      baseColor: options.baseColor ?? 0xf44336,
      damageCooldown: options.damageCooldown ?? 0,
      callbacks: {
        onAttackArea: (area) => scene.combatSystem?.handleEnemyAttackArea(area),
        ...(options.callbacks || {}),
      },
      useInput: options.useInput ?? false,
      kind: "enemy",
      aiController: options.aiController || SensoryAIController,
      aiConfig: options.aiConfig || {},
      attackController: options.attackController || MeleeAoEAttackController,
      attackConfig: options.attackConfig || {},
    });

    return controller;
  }
}

window.CharacterFactory = CharacterFactory;
