export type ReadingPosition = {
  bookId: string;
  chapter?: number;
  completed?: boolean;
  /** Canonical series order when available. Never use array position as canon. */
  order?: number;
};

export type HoidAnswerRequest = {
  question: string;
  reading: ReadingPosition[];
};

export type HoidAnswer = {
  text: string;
  blocked: boolean;
  reason?: 'reading-position' | 'provider-unavailable' | 'provider-output';
};

export interface HoidProvider {
  answer(request: HoidAnswerRequest): Promise<string>;
}
