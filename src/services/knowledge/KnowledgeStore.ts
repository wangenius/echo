import { Model } from "@/common/types/model";
import { FileMetadata } from "@/page/history/KnowledgeCreator";
import { cmd } from "@/utils/shell";
import { Echo } from "@/utils/echo";
import { gen } from "@/utils/generator";

/* 文本块元数据 */
export interface TextChunkMetadata {
  /* 来源页面 */
  source_page: number | null;
  /* 段落编号 */
  paragraph_number: number | null;
  /* 创建时间 */
  created_at: number;
  /* 更新时间 */
  updated_at: number;
}

/* 文本块 */
export interface TextChunk {
  /* 文本内容 */
  content: string;
  /* 文本向量 */
  embedding: number[];
  /* 文本元数据 */
  metadata: TextChunkMetadata;
}

/* 知识库文件 */
export interface KnowledgeFile {
  /* 文件名称 */
  name: string;
  /* 文件内容 */
  content: string;
  /* 文件类型 */
  file_type: string;
  /* 文本块 */
  chunks: TextChunk[];
  /* 创建时间 */
  created_at: number;
  /* 更新时间 */
  updated_at: number;
}

/* 知识库 */
export interface Knowledge {
  /* 知识库ID */
  id: string;
  /* 知识库名称 */
  name: string;
  /* 知识库版本 */
  version: string;
  /* 知识库文件 */
  files: KnowledgeFile[];
  /* 创建时间 */
  created_at: number;
  /* 更新时间 */
  updated_at: number;
}

/* 搜索结果 */
export interface SearchResult {
  /* 文本内容 */
  content: string;
  /* 相似度 */
  similarity: number;
  /* 文档名称 */
  document_name: string;
  /* 文档ID */
  document_id: string;
}

/* 搜索选项 */
export interface SearchOptions {
  /* 相似度阈值 */
  threshold: number;
  /* 结果数量 */
  limit: number;
}

/* 进度回调接口 */
export interface ProgressCallback {
  /* 当前进度（0-100） */
  progress: number;
  /* 当前状态描述 */
  status: string;
  /* 当前处理的文件名 */
  currentFile?: string;
}

const CHUNK_SIZE = 300;
const KNOWLEDGE_VERSION = "1.0.0";

export class KnowledgeStore {
  private static store = new Echo<Record<string, Knowledge>>(
    {},
    {
      name: "knowledge",
      storageType: "indexedDB",
      sync: true,
    }
  );

  static configStore = new Echo<{
    ContentModel: Model | undefined;
    SearchModel: Model | undefined;
    threshold: number;
    limit: number;
  }>(
    {
      ContentModel: undefined,
      SearchModel: undefined,
      threshold: 0.5,
      limit: 10,
    },
    {
      name: "knowledge_config",
      sync: true,
    }
  );

  static use = this.store.use.bind(this.store);

  static useConfig = this.configStore.use.bind(this.configStore);

  // 设置 API Key
  static setContentModel(model: Model) {
    this.configStore.set((prev) => ({
      ...prev,
      ContentModel: model,
    }));
  }

  static setSearchModel(model: Model) {
    this.configStore.set((prev) => ({
      ...prev,
      SearchModel: model,
    }));
  }

  static setThreshold(threshold: number) {
    this.configStore.set((prev) => ({
      ...prev,
      threshold,
    }));
  }

  static setLimit(limit: number) {
    this.configStore.set((prev) => ({
      ...prev,
      limit,
    }));
  }

  // 文本分块
  private static splitTextIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    const sentences = text
      .split(/[.。!?！？\n]/)
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim());

    let currentChunk = "";
    let currentLength = 0;

    for (const sentence of sentences) {
      // 如果单个句子就超过了chunk大小，则需要强制切分
      if (sentence.length >= CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        // 按字符数直接切分长句子
        for (let i = 0; i < sentence.length; i += CHUNK_SIZE) {
          chunks.push(sentence.slice(i, i + CHUNK_SIZE));
        }
        currentChunk = "";
        currentLength = 0;
        continue;
      }

      // 判断添加当前句子是否会超过块大小
      if (currentLength + sentence.length + 1 > CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = sentence;
        currentLength = sentence.length;
      } else {
        if (currentChunk) {
          currentChunk += " ";
          currentLength += 1;
        }
        currentChunk += sentence;
        currentLength += sentence.length;
      }
    }

    // 处理最后一个块
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // 计算余弦相似度
  private static cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  // 生成文本向量
  private static async textToEmbedding(
    text: string,
    model: Model
  ): Promise<number[]> {
    console.log(this.configStore.current);
    if (!model) {
      throw new Error("未配置模型");
    }
    const response = await fetch(model.api_url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${model.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.model,
        input: [text],
        dimension: "1024",
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 调用失败: ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  // 添加知识库
  static async addKnowledge(
    filePaths: FileMetadata[],
    options?: {
      name?: string;
      onProgress?: (progress: ProgressCallback) => void;
    }
  ): Promise<Knowledge> {
    const model = this.configStore.current.ContentModel;
    if (!model) {
      throw new Error("模型配置出错");
    }

    const processedFiles: KnowledgeFile[] = [];
    const now = Date.now();
    const { onProgress } = options || {};

    // 计算总的处理步骤数（读取文件 + 处理每个文件的块）
    const totalSteps = filePaths.length * 2; // 文件读取和处理两个步骤
    let currentStep = 0;

    // 读取所有文件
    onProgress?.({
      progress: 0,
      status: "正在读取文件...",
    });

    const files = await Promise.all(
      filePaths.map(async (file) => {
        const content = await cmd.invoke<string>("read_file_text", {
          path: file.path,
        });
        currentStep++;
        onProgress?.({
          progress: (currentStep / totalSteps) * 100,
          status: "正在读取文件...",
          currentFile: file.path.split("\\").pop(),
        });
        return { path: file.path, content };
      })
    );

    // 处理每个文件
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      const fileName = file.path.split("\\").pop() || "未知文件";

      onProgress?.({
        progress: ((currentStep + fileIndex) / totalSteps) * 100,
        status: "正在处理文件内容...",
        currentFile: fileName,
      });

      const chunks = this.splitTextIntoChunks(file.content);
      const processedChunks: TextChunk[] = [];
      const totalChunks = chunks.length;

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.textToEmbedding(chunks[i], model);
        processedChunks.push({
          content: chunks[i],
          embedding,
          metadata: {
            source_page: null,
            paragraph_number: i + 1,
            created_at: now,
            updated_at: now,
          },
        });

        // 更新块处理进度
        onProgress?.({
          progress:
            ((currentStep + fileIndex + (i + 1) / totalChunks) / totalSteps) *
            100,
          status: "正在生成文本向量...",
          currentFile: fileName,
        });
      }

      const fileType = file.path.split(".").pop()?.toLowerCase() || "txt";
      processedFiles.push({
        name: fileName,
        content: file.content,
        file_type: fileType,
        chunks: processedChunks,
        created_at: now,
        updated_at: now,
      });
    }

    const knowledge: Knowledge = {
      id: gen.id(),
      name:
        options?.name ||
        processedFiles[0]?.name ||
        `知识库_${new Date().toISOString().split("T")[0]}`,
      version: KNOWLEDGE_VERSION,
      files: processedFiles,
      created_at: now,
      updated_at: now,
    };

    this.store.set((prev) => ({
      ...prev,
      [knowledge.id]: knowledge,
    }));

    onProgress?.({
      progress: 100,
      status: "处理完成",
    });

    return knowledge;
  }

  // 删除知识库
  static deleteKnowledge(id: string): void {
    this.store.set((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  }

  /** 搜索知识库
   * @param query 查询内容
   * @param knowledgeIds 知识库ID, 如果为空则搜索所有知识库
   * @returns 搜索结果
   */
  static async searchKnowledge(
    query: string,
    knowledgeIds: string[] = []
  ): Promise<SearchResult[]> {
    /* 获取模型 */
    const model = this.configStore.current.SearchModel;
    if (!model) {
      throw new Error("模型配置出错");
    }
    /* 获取查询向量 */
    const queryEmbedding = await this.textToEmbedding(query, model);
    const results: SearchResult[] = [];

    /* 搜索所有知识库 */
    for (const doc of Object.values(this.store.current)) {
      /* 如果指定了知识库ID，则只搜索指定知识库, 否则搜索所有知识库 */
      if (knowledgeIds.length > 0 && !knowledgeIds.includes(doc.id)) {
        continue;
      }
      for (const file of doc.files) {
        for (const chunk of file.chunks) {
          const similarity = this.cosineSimilarity(
            queryEmbedding,
            chunk.embedding
          );
          if (similarity > this.configStore.current.threshold) {
            results.push({
              content: chunk.content,
              similarity,
              document_name: `${doc.name}/${file.name}`,
              document_id: doc.id,
            });
          }
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, this.configStore.current.limit);
  }
}
