/**
 * EntityManager
 * ゲーム内のすべてのキャラクターエンティティを管理
 * 一般的なゲームエンジンのEntity Managerパターンに基づく
 */
class EntityManager {
  constructor() {
    // すべてのエンティティをIDでマッピング
    this.entities = new Map();
    // 削除予定のエンティティ（フレーム終了時に削除）
    this.toDestroy = new Set();
    // 次に割り当てるID
    this.nextId = 1;
  }

  /**
   * 新しいエンティティを追加
   * @param {CharacterController} entity
   * @returns {string} エンティティID
   */
  add(entity) {
    const id = `entity_${this.nextId++}`;
    entity._entityId = id;
    this.entities.set(id, entity);
    return id;
  }

  /**
   * エンティティを削除マーク（即座には削除しない）
   * @param {string|CharacterController} entityOrId
   */
  remove(entityOrId) {
    const id = typeof entityOrId === 'string' ? entityOrId : entityOrId._entityId;
    if (id && this.entities.has(id)) {
      this.toDestroy.add(id);
    }
  }

  /**
   * エンティティを取得
   * @param {string} id
   * @returns {CharacterController|null}
   */
  get(id) {
    return this.entities.get(id) || null;
  }

  /**
   * すべてのアクティブなエンティティを取得
   * @param {Function} filter - オプショナルなフィルタ関数
   * @returns {CharacterController[]}
   */
  getAll(filter = null) {
    const entities = Array.from(this.entities.values());
    return filter ? entities.filter(filter) : entities;
  }

  /**
   * プレイヤーエンティティを取得
   * @returns {CharacterController|null}
   */
  getPlayer() {
    return this.getAll(e => e.kind === 'player')[0] || null;
  }

  /**
   * すべての敵エンティティを取得
   * @returns {CharacterController[]}
   */
  getEnemies() {
    return this.getAll(e => e.kind === 'enemy');
  }

  /**
   * すべてのエンティティを更新
   * @param {number} delta - デルタタイム
   */
  updateAll(delta) {
    for (const entity of this.entities.values()) {
      // 破壊済みまたは破壊予定のエンティティはスキップ
      if (entity.isDestroyed || this.toDestroy.has(entity._entityId)) {
        continue;
      }

      // spriteが無効な場合はスキップし、削除対象にする
      if (!entity.sprite || !entity.sprite.active) {
        this.remove(entity);
        continue;
      }

      entity.update(delta);
    }
  }

  /**
   * 削除マークされたエンティティをクリーンアップ
   * フレーム終了時に呼ぶことで安全に削除
   */
  cleanup() {
    for (const id of this.toDestroy) {
      const entity = this.entities.get(id);
      if (entity) {
        // エンティティを破壊
        entity.destroy();
        // Mapから削除
        this.entities.delete(id);
      }
    }
    this.toDestroy.clear();
  }

  /**
   * すべてのエンティティを削除
   */
  clear() {
    for (const entity of this.entities.values()) {
      entity.destroy();
    }
    this.entities.clear();
    this.toDestroy.clear();
  }

  /**
   * エンティティの数を取得
   * @returns {number}
   */
  count() {
    return this.entities.size;
  }

  /**
   * エンティティが存在するか確認
   * @param {string|CharacterController} entityOrId
   * @returns {boolean}
   */
  has(entityOrId) {
    const id = typeof entityOrId === 'string' ? entityOrId : entityOrId._entityId;
    return id && this.entities.has(id) && !this.toDestroy.has(id);
  }
}

window.EntityManager = EntityManager;
