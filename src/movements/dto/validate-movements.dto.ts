import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsDateString,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

export class MovementDto {
  @IsNumber()
  id: number;

  @IsDateString()
  date: string;

  @IsString()
  label: string;

  @IsNumber()
  amount: number;
}

export class BalanceDto {
  @IsDateString()
  date: string;

  @IsNumber()
  balance: number;
}

export class ValidateMovementsDto {
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MovementDto)
  movements: MovementDto[];

  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => BalanceDto)
  balances: BalanceDto[];
}
