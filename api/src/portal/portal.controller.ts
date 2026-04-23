import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PortalService } from './portal.service';

@Controller('portal/rights-owner')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('summary')
  summary(@Query('orgId') orgId?: string) {
    if (!orgId) {
      throw new BadRequestException(
        'Query orgId (rights holder organization id) is required',
      );
    }
    return this.portalService.rightsOwnerSummary(orgId);
  }
}
