export type ReadingPosition = { bookId: string; chapter?: number; order: number };

export type HoidAnswerRequest = {
  question: string;
  reading: ReadingPosition[];
};

export type HoidAnswer = {
  text: string;
  blocked: boolean;
  reason?: string;
};

export interface HoidProvider {
  answer(request: HoidAnswerRequest): Promise<string>;
}
