window.CHARACTER_PRESETS = {
  default: {
    maxHp: 5,
    movementController: BasicMovementController,
    movementConfig: {
      dragThreshold: 20,
      moveSpeed: 6,
    },
    dodgeController: DashDodgeController,
    dodgeConfig: {
      distance: 100,
      duration: 500,
      invincibleDuration: 260,
    },
    attackController: MeleeAoEAttackController,
    attackConfig: {
      radius: 120,
      cooldown: 250,
    },
  },
  bladeDancer: {
    maxHp: 5,
    movementController: AcceleratingMovementController,
    movementConfig: {
      moveSpeed: 6,
      maxSpeed: 10,
      accelPerSecond: 4,
      decelPerSecond: 5,
    },
    dodgeController: AcceleratingDodgeController,
    dodgeConfig: {
      distance: 200,
      duration: 450,
      invincibleDuration: 320,
      impactRadius: 120,
      impactDamage: 1,
    },
    attackController: AlternatingSlashAttackController,
    attackConfig: {
      cooldown: 220,
      range: 150,
      damage: 2,
    },
  },
  kangarooGunner: {
    maxHp: 4,
    movementController: HoppingMovementController,
    movementConfig: {
      hopSpeed: 14,
      hopDuration: 220,
      pauseDuration: 140,
      moveSpeed: 6,
    },
    dodgeController: ChainImpactDodgeController,
    dodgeConfig: {
      distance: 160,
      duration: 260,
      chainRadius: 220,
      damagePerHit: 1,
      invincibleDuration: 200,
    },
    attackController: ProjectileAttackController,
    attackConfig: {
      cooldown: 200,
      projectileSpeed: 600,
      damage: 1,
    },
  },
  blinkAssassin: {
    maxHp: 4,
    movementController: AcceleratingMovementController,
    movementConfig: {
      moveSpeed: 7,
      maxSpeed: 11,
      accelPerSecond: 5,
      decelPerSecond: 6,
    },
    dodgeController: BlinkDodgeController,
    dodgeConfig: {
      distance: 180,
      duration: 200,
      invincibleDuration: 400,
      preDelay: 100,
      postDelay: 120,
    },
    attackController: ProjectileAttackController,
    attackConfig: {
      cooldown: 160,
      projectileSpeed: 750,
      damage: 2,
      projectileColor: 0xffb74d,
    },
  },
};
