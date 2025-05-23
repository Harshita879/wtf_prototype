// declarations.d.ts
declare module 'langchain/embeddings/openai' {
  export class OpenAIEmbeddings {
    constructor(opts: { openAIApiKey: string });
    embedQuery(text: string): Promise<number[]>;
  }
}

declare module 'langchain/util/math' {
  /** simple cosine sim signature */
  export function cosineSimilarity(a: number[], b: number[]): number;
}
