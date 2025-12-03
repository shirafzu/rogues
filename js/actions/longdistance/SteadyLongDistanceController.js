/**
 * 固定速度型長距離移動コントローラー
 */
class SteadyLongDistanceController extends LongDistanceController {
  constructor(character, config = {}) {
    super(character, {
      speedMultiplier: 1.5,
      useAcceleration: false,
      ...config,
    });
  }
}

window.SteadyLongDistanceController = SteadyLongDistanceController;
