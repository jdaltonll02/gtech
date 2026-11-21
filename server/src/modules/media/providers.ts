import {config} from '../../config.js';

export type ModerationResult = 'approved' | 'pending';
export interface ModerationProvider { review(photoId: string): Promise<ModerationResult> }
class AutoApproveProvider implements ModerationProvider { review(): Promise<ModerationResult> { return Promise.resolve('approved'); } }
class ManualProvider implements ModerationProvider { review(): Promise<ModerationResult> { return Promise.resolve('pending'); } }

export const getModerationProvider = (): ModerationProvider => config.MODERATION_PROVIDER === 'manual' ? new ManualProvider() : new AutoApproveProvider();
