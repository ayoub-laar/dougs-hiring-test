import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BalanceDto,
  MovementDto,
  ValidateMovementsDto,
} from './dto/validate-movements.dto';

export interface SuspectedDuplicate {
  original: MovementDto;
  duplicate: MovementDto;
}

export interface ValidationReason {
  period: {
    start: string;
    end: string;
  };
  expectedDelta: number;
  actualDelta: number;
  difference: number;
  suspectedDuplicates: SuspectedDuplicate[];
}

@Injectable()
export class MovementsService {
  validate(dto: ValidateMovementsDto): void {
    const sortedBalances = [...dto.balances].sort(byDate);
    const sortedMovements = [...dto.movements].sort(byDate);

    const hasDuplicateBalanceDates = sortedBalances.some(
      (b, i) => i > 0 && b.date === sortedBalances[i - 1].date,
    );
    if (hasDuplicateBalanceDates) {
      throw new BadRequestException({
        message: 'Balances must have unique dates',
      });
    }

    const reasons: ValidationReason[] = [];

    for (let i = 1; i < sortedBalances.length; i++) {
      const periodStart = sortedBalances[i - 1];
      const periodEnd = sortedBalances[i];

      const movementsInPeriod = sortedMovements.filter((m) =>
        isInPeriod(m.date, periodStart.date, periodEnd.date),
      );

      const reason = this.checkPeriod(
        periodStart,
        periodEnd,
        movementsInPeriod,
      );
      if (reason) reasons.push(reason);
    }

    if (reasons.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', reasons });
    }
  }

  private checkPeriod(
    periodStart: BalanceDto,
    periodEnd: BalanceDto,
    movements: MovementDto[],
  ): ValidationReason | null {
    const expectedDelta = periodEnd.balance - periodStart.balance;
    const actualDelta = movements.reduce((sum, m) => sum + m.amount, 0);

    if (toCents(actualDelta) === toCents(expectedDelta)) {
      return null;
    }

    return {
      period: { start: periodStart.date, end: periodEnd.date },
      expectedDelta,
      actualDelta,
      difference: actualDelta - expectedDelta,
      suspectedDuplicates: this.findSuspectedDuplicates(movements),
    };
  }

  private findSuspectedDuplicates(
    movements: MovementDto[],
  ): SuspectedDuplicate[] {
    const duplicates: SuspectedDuplicate[] = [];
    const seen = new Map<string, MovementDto>();

    for (const movement of movements) {
      const key = `${movement.date}|${movement.label}|${movement.amount}`;
      const existing = seen.get(key);

      if (existing) {
        duplicates.push({ original: existing, duplicate: movement });
      } else {
        seen.set(key, movement);
      }
    }

    return duplicates;
  }
}

const byDate = (a: { date: string }, b: { date: string }): number =>
  new Date(a.date).getTime() - new Date(b.date).getTime();

const isInPeriod = (date: string, start: string, end: string): boolean => {
  const t = new Date(date).getTime();
  return t > new Date(start).getTime() && t <= new Date(end).getTime();
};

const toCents = (amount: number): number => Math.round(amount * 100);
