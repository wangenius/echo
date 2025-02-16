/** 消息管理类
 * 负责管理所有的消息历史记录
 */
import { gen } from "@/utils/generator";
import { Message, MessagePrototype } from "@common/types/model";
import { Echo } from "echo-state";

/** 聊天历史记录 */
export interface ChatHistoryItem {
  /** 聊天ID */
  id: string;
  /** 助手名称 */
  bot?: string;
  /** 系统提示词 */
  system: Message;
  /** 聊天记录 */
  list: Message[];
}

/** 全部聊天的历史记录存档
 * @todo: 需要迁移到 indexedDB 中, 目前不支持过量数据存储
 */
export const ChatHistory = new Echo<Record<string, ChatHistoryItem>>(
  {},
  {
    name: "history",
    sync: true,
  }
);

/** 消息历史记录类
 * 负责管理单个聊天的历史记录
 */
export class HistoryMessage implements ChatHistoryItem {
  /** 聊天ID */
  id: string;
  /** 助手名称 */
  bot?: string;
  /** 系统提示词 */
  system: Message;
  /** 聊天记录 */
  list: Message[];

  /** 当前使用的消息历史记录 */
  static current = new Echo<{ id: string; bot?: string }>(
    {
      id: "",
      bot: "",
    },
    {
      name: "current:history",
      sync: true,
    }
  );

  /** 创建一个消息历史记录，id会生成一个新的，即历史记录中会出现一个新的内容 */
  private constructor(history: ChatHistoryItem) {
    this.id = history.id;
    this.system = history.system;
    this.list = history.list;
    this.bot = history.bot;
  }

  /** 创建一个消息历史记录
   * @param system 系统提示词
   * @param bot 助手名称
   * @returns 消息历史记录
   */
  static create(system: string = "", bot?: string): HistoryMessage {
    const history: ChatHistoryItem = {
      id: gen.id(),
      bot,
      system: {
        role: "system",
        content: system,
        type: "system",
        created_at: Date.now(),
      },
      list: [],
    };
    ChatHistory.set({
      [history.id]: history,
    });
    return new HistoryMessage(history);
  }

  /** 获取一个消息历史记录
   * @param id 消息历史记录ID
   * @returns 消息历史记录, 如果id不存在, 则创建一个默认的消息历史记录
   */
  static getHistory(id: string): HistoryMessage {
    const history = ChatHistory.current[id];
    if (!history) {
      throw new Error("History not found");
    }
    return new HistoryMessage(history);
  }

  /** 设置助手名称 */
  setBot(bot: string): void {
    this.bot = bot;
    ChatHistory.set((prev) => {
      const newState = { ...prev };
      newState[this.id].bot = bot;
      return newState;
    });
  }

  /** 设置系统提示词 */
  setSystem(system: string): void {
    this.system = {
      ...this.system,
      content: system,
    };
    ChatHistory.set((prev) => {
      const newState = { ...prev };
      newState[this.id].system = this.system;
      return newState;
    });
  }

  /** 设置聊天记录 */
  setList(list: Message[]): void {
    this.list = list;
    ChatHistory.set((prev) => {
      const newState = { ...prev };
      newState[this.id].list = list;
      return newState;
    });
  }

  /** 添加消息, 返回所有消息
   * @param message 要添加的消息
   * @returns 所有消息, 包括系统消息，但不包括 type 为 assistant:warning 的消息
   */
  push(message: Message[]): MessagePrototype[] {
    this.list = [...this.list, ...message];
    ChatHistory.set((prev) => {
      const newState = { ...prev };
      newState[this.id].list = this.list;
      return newState;
    });

    return [this.system, ...this.list]
      .filter((msg) => msg.type !== "assistant:warning")
      .map((msg) => {
        const result: Record<string, any> = {
          role: msg.role,
          content: msg.content,
        };
        if (msg.name) result.name = msg.name;
        if (msg.function_call) result.function_call = msg.function_call;
        return result as MessagePrototype;
      });
  }

  /** 更新最后一条消息
   * @param updater 更新函数，接收最后一条消息并返回更新后的消息
   * @returns 更新后的消息，如果没有消息则返回undefined
   */
  updateLastMessage(msg: Partial<Message>): Message | undefined {
    const list = this.list;
    if (list.length === 0) return undefined;
    const lastMessage = list[list.length - 1];
    const updatedMessage = {
      ...lastMessage,
      ...msg,
    };

    this.list = [...list.slice(0, -1), updatedMessage];
    ChatHistory.set((prev) => {
      const newState = { ...prev };
      newState[this.id].list = this.list;
      return newState;
    });
    return updatedMessage;
  }

  /** 获取最后一条消息
   * @returns 最后一条消息，如果没有消息则返回undefined
   */
  getLastMessage(): Message | undefined {
    return this.list.length > 0 ? this.list[this.list.length - 1] : undefined;
  }

  /** 获取所有消息（不包括系统消息）
   * @returns 所有消息的数组
   */
  listWithOutType(): MessagePrototype[] {
    return [this.system, ...this.list].map((msg) => {
      const result: Record<string, any> = {
        role: msg.role,
        content: msg.content,
      };
      if (msg.name) result.name = msg.name;
      if (msg.function_call) result.function_call = msg.function_call;
      return result as MessagePrototype;
    });
  }

  /** 清空所有消息历史, 保留系统消息 */
  clear(): void {
    this.list = [];
    ChatHistory.set((prev) => {
      const newState = { ...prev };
      newState[this.id].list = [];
      return newState;
    });
  }

  /** 清空所有消息历史, 包括系统消息 */
  static clearAll(): void {
    ChatHistory.set({}, true);
  }

  /** 移除最后一条消息 */
  removeLast(): void {
    const list = this.list;
    if (list.length === 0) return;
    this.list = list.slice(0, -1);
    ChatHistory.set((prev) => {
      const newState = { ...prev };
      newState[this.id].list = this.list;
      return newState;
    });
  }

  /** 获取消息数量（不包括系统消息）
   * @returns 消息数量
   */
  count(): number {
    return this.list.length;
  }

  /** 替换最后一条消息
   * @param message 新的消息
   */
  replaceLastMessage(message: Message): void {
    const list = this.list;
    if (list.length === 0) return;

    ChatHistory.set((prev) => {
      const newState = { ...prev };
      newState[this.id].list = [...list.slice(0, -1), message];
      return newState;
    });
  }
  /** 删除聊天历史
   * @param id 要删除的聊天历史ID
   */
  static deleteHistory(id: string) {
    // 删除历史记录
    ChatHistory.set((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    }, true);
  }
}
