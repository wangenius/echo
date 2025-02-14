/** 助手
 * @param name 名称
 * @param system 系统提示
 * @param model 模型
 * @param plugins 插件
 */
export interface BotProps {
  /* 名称 */
  name: string;
  /* 系统提示 */
  system: string;
  /* 模型id */
  model: string;
  /* 工具 */
  tools: string[];
  /* 头像 */
  avatar?: string;
}
