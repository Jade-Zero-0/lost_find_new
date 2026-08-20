/**
 * OpenAI GPT-Vision 提供商（预留骨架，暂不启用）
 *
 * 未来接入步骤：
 *   1. 安装依赖：npm install openai
 *   2. 设置环境变量：AI_PROVIDER=openai、OPENAI_API_KEY=sk-xxx
 *   3. 按下方 TODO 实现 recognize()，返回与 mock 相同的结构
 *
 * 接口约定（所有 Provider 统一）：
 *   input: { dataUrl?: string, imagePath?: string, imageBuffer?: Buffer }
 *   output: { type: string, color: string, shape: string, feature: string }
 */
export const name = 'openai';

// TODO: 接入 GPT Vision（示例，需要安装 openai 包并设置 OPENAI_API_KEY）
export async function recognize() {
  throw new Error(
    '[ai] OpenAI 视觉识别尚未启用：请安装 openai 依赖、设置 AI_PROVIDER=openai 与 OPENAI_API_KEY，并实现 providers/openai.provider.js 的 recognize()'
  );
}