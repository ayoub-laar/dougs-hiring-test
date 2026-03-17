import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ValidateMovementsDto } from './dto/validate-movements.dto';
import { MovementsService } from './movements.service';

@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post('validation')
  @HttpCode(200)
  validate(@Body() dto: ValidateMovementsDto): { message: string } {
    this.movementsService.validate(dto);
    return { message: 'Accepted' };
  }
}
