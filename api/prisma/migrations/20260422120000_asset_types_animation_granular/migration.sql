-- Замена animation на детализированные типы; старые animation -> animated_series
CREATE TYPE "AssetType_new" AS ENUM (
  'video',
  'series',
  'animated_series',
  'animated_film',
  'anime_series',
  'anime_film',
  'concert_show'
);

ALTER TABLE "CatalogItem" ALTER COLUMN "assetType" DROP DEFAULT;
ALTER TABLE "CatalogItem" ALTER COLUMN "assetType" TYPE "AssetType_new" USING (
  CASE "assetType"::text
    WHEN 'video' THEN 'video'::"AssetType_new"
    WHEN 'series' THEN 'series'::"AssetType_new"
    WHEN 'animation' THEN 'animated_series'::"AssetType_new"
    WHEN 'concert_show' THEN 'concert_show'::"AssetType_new"
    ELSE 'video'::"AssetType_new"
  END
);

DROP TYPE "AssetType";
ALTER TYPE "AssetType_new" RENAME TO "AssetType";
