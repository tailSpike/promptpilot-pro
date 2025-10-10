import prisma from '../lib/prisma';

export interface CreateDocumentParams {
  ownerId: string;
  executionId?: string;
  content: string;
  mimeType?: string;
}

export class DocumentService {
  static MAX_INLINE_LENGTH = Number(process.env.MAX_INLINE_GENERATED_TEXT_LENGTH ?? 100_000);

  static async create(params: CreateDocumentParams) {
    const size = Buffer.byteLength(params.content, 'utf8');
    return prisma.documentBlob.create({
      data: {
        ownerId: params.ownerId,
        executionId: params.executionId,
        content: params.content,
        size,
        mimeType: params.mimeType ?? 'text/plain',
      },
    });
  }

  static async getById(id: string) {
    return prisma.documentBlob.findUnique({ where: { id } });
  }

  static maybeOffloadLargeText(
    text: string | undefined,
    ownerId: string,
    executionId?: string,
  ): Promise<{ inline?: string; ref?: { id: string; size: number; mimeType: string } } | undefined> {
    if (typeof text !== 'string') return Promise.resolve(undefined);
    if (text.length <= this.MAX_INLINE_LENGTH) {
      return Promise.resolve({ inline: text });
    }
    return this.create({ ownerId, executionId, content: text, mimeType: 'text/plain' }).then((doc) => ({
      ref: { id: doc.id, size: doc.size, mimeType: doc.mimeType },
    }));
  }
}

export default DocumentService;
