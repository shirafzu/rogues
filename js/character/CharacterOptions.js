window.AVAILABLE_MOVEMENTS = {
  basic: {
    name: "Free Run",
    description: "Standard 360° movement with constant speed.",
    controller: BasicMovementController,
    config: {
      dragThreshold: 20,
      moveSpeed: 6,
    },
    baseColor: 0x4caf50,
  },
  accelerating: {
    name: "Accelerating Run",
    description: "Starts slow and ramps up speed while you drag.",
    controller: AcceleratingMovementController,
    config: {
      dragThreshold: 15,
      moveSpeed: 6,
      maxSpeed: 10,
      accelPerSecond: 4,
      decelPerSecond: 5,
    },
    baseColor: 0xff7043,
  },
  hopping: {
    name: "Kangaroo Hop",
    description: "Short hops with pauses between leaps.",
    controller: HoppingMovementController,
    config: {
      dragThreshold: 10,
      hopSpeed: 14,
      hopDuration: 220,
      pauseDuration: 140,
      moveSpeed: 7,
    },
    baseColor: 0xffb74d,
  },
};

window.AVAILABLE_LONG_DISTANCE_MODES = {
  none: {
    name: "None",
    description: "No long distance travel mode.",
    abilityFactory: null,
  },
  steady: {
    name: "Steady Sprint",
    description: "Auto-run at 1.5x speed in swiped direction for long distance travel.",
    controller: SteadyLongDistanceController,
    abilityFactory: (character) =>
      new LongDistanceAbilityWrapper(character, SteadyLongDistanceController, {
        speedMultiplier: 1.5,
        autoStopDistance: 1500,
      }),
  },
  accelerating: {
    name: "Burst Sprint",
    description: "Auto-run with acceleration (1x to 2x speed) for exploration.",
    controller: AcceleratingLongDistanceController,
    abilityFactory: (character) =>
      new LongDistanceAbilityWrapper(character, AcceleratingLongDistanceController, {
        minSpeedMultiplier: 1.0,
        maxSpeedMultiplier: 2.0,
        accelPerSecond: 3.0,
        autoStopDistance: 1500,
      }),
  },
};

window.AVAILABLE_DODGES = {
  dash: {
    name: "Quick Dash",
    description: "Short burst with brief invincibility.",
    controller: DashDodgeController,
    abilityFactory: (character) =>
      new DodgeAbilityWrapper(character, DashDodgeController, {
        distance: 120,
        duration: 300,
        invincibleDuration: 200,
      }),
  },
  accelerating: {
    name: "Crashing Dash",
    description: "Accelerates and knocks enemies away at the end.",
    controller: AcceleratingDodgeController,
    abilityFactory: (character) =>
      new DodgeAbilityWrapper(character, AcceleratingDodgeController, {
        distance: 220,
        duration: 420,
        invincibleDuration: 350,
        impactRadius: 120,
        impactDamage: 1,
      }),
  },
  chain: {
    name: "Chain Impact",
    description: "Dashes through enemies, chaining to the next target.",
    controller: ChainImpactDodgeController,
    abilityFactory: (character) =>
      new DodgeAbilityWrapper(character, ChainImpactDodgeController, {
        distance: 160,
        duration: 260,
        invincibleDuration: 240,
        chainRadius: 220,
        damagePerHit: 1,
      }),
  },
  blink: {
    name: "Blink",
    description: "Pauses briefly, then teleports forward.",
    controller: BlinkDodgeController,
    abilityFactory: (character) =>
      new DodgeAbilityWrapper(character, BlinkDodgeController, {
        distance: 200,
        duration: 200,
        invincibleDuration: 400,
        preDelay: 120,
        postDelay: 100,
      }),
  },
};

window.AVAILABLE_ATTACKS = {
  aoe: {
    name: "Shockwave",
    description: "Circular slash around the player.",
    controller: MeleeAoEAttackController,
    abilityFactory: (character) =>
      new AttackAbilityWrapper(character, MeleeAoEAttackController, {
        radius: 120,
        cooldown: 250,
      }),
    baseColor: 0x4caf50,
  },
  slash: {
    name: "Alternating Slash",
    description: "Lock-on sword swings alternating left and right.",
    controller: AlternatingSlashAttackController,
    abilityFactory: (character) =>
      new AttackAbilityWrapper(character, AlternatingSlashAttackController, {
        cooldown: 200,
        damage: 2,
      }),
    baseColor: 0xff7043,
  },
  projectile: {
    name: "Arc Shot",
    description: "Fires a projectile toward the nearest foe.",
    controller: ProjectileAttackController,
    abilityFactory: (character) =>
      new AttackAbilityWrapper(character, ProjectileAttackController, {
        cooldown: 180,
        projectileSpeed: 600,
        damage: 1,
      }),
    baseColor: 0x81d4fa,
  },
};
