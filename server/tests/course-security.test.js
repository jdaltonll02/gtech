import { describe, expect, it } from 'vitest';
import { learnerQuestionOut } from '../src/routes/courses/learning.js';

describe('learner course payloads', () => {
  it('never exposes quiz answer keys or explanations before submission', () => {
    const output = learnerQuestionOut({
      id: 'question-1',
      question_text: 'Which answer is correct?',
      options: ['A', 'B'],
      correct_answer_index: 1,
      correct_answer_indices: [1],
      explanation: 'B is correct because...',
      points: 1,
    });

    expect(output).toEqual({
      id: 'question-1',
      question_text: 'Which answer is correct?',
      options: ['A', 'B'],
      points: 1,
    });
    expect(output).not.toHaveProperty('correct_answer_index');
    expect(output).not.toHaveProperty('correct_answer_indices');
    expect(output).not.toHaveProperty('explanation');
  });
});
