// AttackController - BaseActionControllerを継承したアクションコントローラー
// 攻撃アクションの基底クラス

class AttackController extends BaseActionController {
  constructor(character, config = {}) {
    super(character, {
      cooldown: 250,
      ...config,
    });
  }

  requestAttack(_pointer) {
    return false;
  }

  // canExecute()とrecordExecution()はBaseActionControllerから継承
}

window.AttackController = AttackController;
