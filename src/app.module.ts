import { Module } from '@nestjs/common';
import { MovementsModule } from './movements/movements.module';

@Module({
  imports: [MovementsModule],
})
export class AppModule {}
