import { Module } from '@nestjs/common';
import { CommercialOffersController } from './commercial-offers.controller';
import { CommercialOffersService } from './commercial-offers.service';

@Module({
  controllers: [CommercialOffersController],
  providers: [CommercialOffersService],
})
export class CommercialOffersModule {}
