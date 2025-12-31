/**
 * StylePool - 样式池
 * 用于缓存和复用 ANSI 样式代码
 *
 * 从官方 Claude Code 源码逆向工程提取 (原名: Wl1)
 */

export class StylePool {
  private styles: Map<string, number> = new Map();
  private stylesById: Map<number, number[]> = new Map();
  private nextId = 1;

  /** 无样式的 ID */
  readonly none: number = 0;

  constructor() {
    // ID 0 表示无样式
    this.stylesById.set(0, []);
  }

  /**
   * 获取样式 ID 对应的 ANSI 代码数组
   */
  get(id: number): number[] {
    return this.stylesById.get(id) || [];
  }

  /**
   * 添加样式并返回其 ID
   * 如果样式已存在，返回现有 ID
   */
  add(styles: number[]): number {
    if (styles.length === 0) return this.none;

    const key = styles.join(',');
    const existing = this.styles.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const id = this.nextId++;
    this.styles.set(key, id);
    this.stylesById.set(id, [...styles]);
    return id;
  }

  /**
   * 重置样式池
   */
  reset(): void {
    this.styles.clear();
    this.stylesById.clear();
    this.stylesById.set(0, []);
    this.nextId = 1;
  }
}