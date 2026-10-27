-- Additive relation table for inline images referenced by structured InfoPage.body JSON.
-- No existing tables, rows, columns, or constraints are dropped or rewritten.
CREATE TABLE "InfoPageInlineMedia" (
    "pageId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,

    CONSTRAINT "InfoPageInlineMedia_pkey" PRIMARY KEY ("pageId", "mediaId")
);

CREATE INDEX "InfoPageInlineMedia_pageId_position_idx" ON "InfoPageInlineMedia"("pageId", "position");
CREATE INDEX "InfoPageInlineMedia_mediaId_pageId_idx" ON "InfoPageInlineMedia"("mediaId", "pageId");

ALTER TABLE "InfoPageInlineMedia"
    ADD CONSTRAINT "InfoPageInlineMedia_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "InfoPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InfoPageInlineMedia"
    ADD CONSTRAINT "InfoPageInlineMedia_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
