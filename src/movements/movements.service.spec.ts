import { BadRequestException } from '@nestjs/common';
import { BalanceDto, MovementDto } from './dto/validate-movements.dto';
import { MovementsService, ValidationReason } from './movements.service';

const movement = (
  id: number,
  date: string,
  label: string,
  amount: number,
): MovementDto => ({ id, date, label, amount });

const balance = (date: string, amount: number): BalanceDto => ({
  date,
  balance: amount,
});

const getReasonsFromError = (error: unknown): ValidationReason[] => {
  const response = (error as BadRequestException).getResponse() as {
    reasons: ValidationReason[];
  };
  return response.reasons;
};

describe('MovementsService', () => {
  let service: MovementsService;

  beforeEach(() => {
    service = new MovementsService();
  });

  it('should accept when movements correctly match balance deltas', () => {
    expect(() =>
      service.validate({
        movements: [
          movement(1, '2026-01-15', 'Salary', 3000),
          movement(2, '2026-01-20', 'Rent', -1000),
          movement(3, '2026-02-10', 'Freelance', 500),
        ],
        balances: [
          balance('2026-01-01', 1000),
          balance('2026-01-31', 3000),
          balance('2026-02-28', 3500),
        ],
      }),
    ).not.toThrow();
  });

  it('should reject when two balances share the same date', () => {
    expect(() =>
      service.validate({
        movements: [],
        balances: [balance('2026-01-31', 1000), balance('2026-01-31', 1500)],
      }),
    ).toThrow(BadRequestException);
  });

  it('should reject with period details when movements sum does not match the balance delta', () => {
    expect.assertions(6);
    try {
      service.validate({
        movements: [movement(1, '2026-01-15', 'Salary', 3000)],
        balances: [balance('2026-01-01', 1000), balance('2026-01-31', 3000)],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const reasons = getReasonsFromError(error);
      expect(reasons).toHaveLength(1);
      expect(reasons[0].period).toEqual({
        start: '2026-01-01',
        end: '2026-01-31',
      });
      expect(reasons[0].expectedDelta).toBe(2000);
      expect(reasons[0].actualDelta).toBe(3000);
      expect(reasons[0].difference).toBe(1000);
    }
  });

  it('should identify suspected duplicates within an invalid period', () => {
    expect.assertions(4);
    try {
      service.validate({
        movements: [
          movement(1, '2026-01-15', 'Salary', 3000),
          movement(2, '2026-01-15', 'Salary', 3000),
        ],
        balances: [balance('2026-01-01', 0), balance('2026-01-31', 3000)],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const reasons = getReasonsFromError(error);
      expect(reasons[0].suspectedDuplicates).toHaveLength(1);
      expect(reasons[0].suspectedDuplicates[0].original).toEqual(
        movement(1, '2026-01-15', 'Salary', 3000),
      );
      expect(reasons[0].suspectedDuplicates[0].duplicate).toEqual(
        movement(2, '2026-01-15', 'Salary', 3000),
      );
    }
  });

  it('should only report periods with anomalies when multiple periods exist', () => {
    expect.assertions(3);
    try {
      service.validate({
        movements: [
          movement(1, '2026-01-15', 'Salary', 1000),
          movement(2, '2026-02-10', 'Salary', 1000),
          movement(3, '2026-02-20', 'Salary', 1000),
        ],
        balances: [
          balance('2026-01-01', 0),
          balance('2026-01-31', 1000),
          balance('2026-02-28', 2000),
        ],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const reasons = getReasonsFromError(error);
      expect(reasons).toHaveLength(1);
      expect(reasons[0].period.end).toBe('2026-02-28');
    }
  });

  it('should handle floating point amounts without precision errors', () => {
    expect(() =>
      service.validate({
        movements: [
          movement(1, '2026-01-10', 'Coffee', -0.1),
          movement(2, '2026-01-11', 'Coffee', -0.2),
        ],
        balances: [balance('2026-01-01', 1), balance('2026-01-31', 0.7)],
      }),
    ).not.toThrow();
  });

  it('should exclude movements on the start date and include movements on the end date', () => {
    expect(() =>
      service.validate({
        movements: [
          movement(1, '2026-01-01', 'Same day as start balance', 500),
          movement(2, '2026-01-15', 'In period', 500),
          movement(3, '2026-01-31', 'Same day as end balance', 500),
        ],
        balances: [balance('2026-01-01', 500), balance('2026-01-31', 1500)],
      }),
    ).not.toThrow();
  });

  it('should ignore movements outside all checkpoint periods', () => {
    expect(() =>
      service.validate({
        movements: [
          movement(1, '2025-12-31', 'Before first checkpoint', 9999),
          movement(2, '2026-01-15', 'In period', 500),
          movement(3, '2026-03-01', 'After last checkpoint', 9999),
        ],
        balances: [balance('2026-01-01', 0), balance('2026-01-31', 500)],
      }),
    ).not.toThrow();
  });
});
