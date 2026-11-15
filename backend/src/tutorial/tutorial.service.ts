import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma, TutorialStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TUTORIAL_MOVES, type TutorialAction } from './tutorial.logic';

/*
 * The onboarding tutorial's status on the server, so it follows the user
 * from device to device. The app shows the tutorial; the server keeps only
 * whether it was skipped or finished.
 */
@Injectable()
export class TutorialService {
  constructor(private readonly prisma: PrismaService) {}

  /** "Skip": NOT_STARTED → DISMISSED; any other status stays as it is. */
  async dismiss(userId: string): Promise<{ tutorialStatus: TutorialStatus }> {
    const tutorialStatus = await this.prisma.$transaction((tx) =>
      this.move(tx, userId, 'dismiss'),
    );
    return { tutorialStatus };
  }

  /**
   * Applies a move and answers with the status the user has after it.
   *
   * The write is conditional: it changes the row only while the status is
   * one the move may start from. A status that does not qualify (e.g.
   * COMPLETED for dismiss) is left alone by the database itself, so no
   * check-then-write gap exists for a parallel request to slip through.
   * The read that follows, in the same transaction, sees the outcome: the
   * new status, or the one that stopped the move.
   */
  private async move(
    tx: Prisma.TransactionClient,
    userId: string,
    action: TutorialAction,
  ): Promise<TutorialStatus> {
    const { from, to } = TUTORIAL_MOVES[action];
    await tx.user.updateMany({
      where: { id: userId, tutorialStatus: { in: [...from] } },
      data: { tutorialStatus: to },
    });
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { tutorialStatus: true },
    });
    // A token whose account is gone: as /auth/me answers, 401.
    if (!user) throw new UnauthorizedException();
    return user.tutorialStatus;
  }
}
