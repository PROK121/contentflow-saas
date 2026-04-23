import { DealStage, Exclusivity, Platform, Prisma } from '@prisma/client';
export declare function territoryCoveredByLicenseTerm(code: string, licenseTerritory: string): boolean;
export type ParsedRightsSelection = {
    territoryCodes: string[];
    startAt: Date | null;
    endAt: Date | null;
    platforms: Platform[];
    exclusivity: Exclusivity;
};
export declare function parseRightsSelection(raw: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined): ParsedRightsSelection | null;
export declare function territoriesOverlap(a: string[], b: string[]): string[];
export declare function isBlockingRightsConflict(existing: ParsedRightsSelection, proposed: ParsedRightsSelection): boolean;
export declare const CLOSED_DEAL_STAGES: DealStage[];
