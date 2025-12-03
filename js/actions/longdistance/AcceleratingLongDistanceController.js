/**
 * 加速型長距離移動コントローラー
 */
class AcceleratingLongDistanceController extends LongDistanceController {
  constructor(character, config = {}) {
    super(character, {
      minSpeedMultiplier: 1.0,
      maxSpeedMultiplier: 2.0,
      accelPerSecond: 3.0,
      useAcceleration: true,
      ...config,
    });
  }
}

window.AcceleratingLongDistanceController = AcceleratingLongDistanceController;
