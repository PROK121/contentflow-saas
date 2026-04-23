-- Удалены music/photo; добавлены animation, concert_show; music/photo → video
CREATE TYPE "AssetType_new" AS ENUM ('video', 'series', 'animation', 'concert_show');

ALTER TABLE "CatalogItem" ALTER COLUMN "assetType" DROP DEFAULT;

ALTER TABLE "CatalogItem" ALTER COLUMN "assetType" TYPE "AssetType_new" USING (
  CASE "assetType"::text
    WHEN 'music' THEN 'video'::"AssetType_new"
    WHEN 'photo' THEN 'video'::"AssetType_new"
    WHEN 'video' THEN 'video'::"AssetType_new"
    WHEN 'series' THEN 'series'::"AssetType_new"
    ELSE 'video'::"AssetType_new"
  END
);

DROP TYPE "AssetType";

ALTER TYPE "AssetType_new" RENAME TO "AssetType";
