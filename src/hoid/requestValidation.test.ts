import {
  DEFAULT_MAX_HOID_QUESTION_LENGTH,
  DEFAULT_MAX_RAW_HOID_QUESTION_LENGTH,
  validHoidQuestion,
} from './requestValidation';

describe('validHoidQuestion', () => {
  it('removes Unicode format controls before later trust boundaries', () => {
    expect(validHoidQuestion('  Pre\u200Bg\u202Eunta  ')).toBe('Pregunta');
  });

  it('rejects input that becomes empty after control normalization', () => {
    expect(validHoidQuestion('\u200B\u202E')).toBeNull();
  });

  it('keeps the public length contract after normalization', () => {
    expect(validHoidQuestion('x'.repeat(DEFAULT_MAX_HOID_QUESTION_LENGTH))).toHaveLength(DEFAULT_MAX_HOID_QUESTION_LENGTH);
  });

  it('rejects an oversized raw payload before normalization', () => {
    expect(validHoidQuestion('x'.repeat(DEFAULT_MAX_RAW_HOID_QUESTION_LENGTH + 1))).toBeNull();
  });

  it('rejects an invalid raw payload limit', () => {
    expect(validHoidQuestion('Pregunta segura', DEFAULT_MAX_HOID_QUESTION_LENGTH, 0)).toBeNull();
  });
});
