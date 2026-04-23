import { DealKind, DealStage } from '@prisma/client';
import { RightsSelectionItemDto } from './rights-selection-item.dto';
export declare class UpdateDealDto {
    title?: string;
    kind?: DealKind;
    stage?: DealStage;
    archived?: boolean;
    commercialSnapshotPatch?: Record<string, unknown>;
    rightsSelections?: RightsSelectionItemDto[];
}
