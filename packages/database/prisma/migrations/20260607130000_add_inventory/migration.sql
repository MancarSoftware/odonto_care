CREATE TYPE "InventoryItemType" AS ENUM (
  'CONSUMABLE',
  'MATERIAL',
  'MEDICATION',
  'INSTRUMENT',
  'OTHER'
);

CREATE TYPE "InventoryMovementType" AS ENUM (
  'PURCHASE',
  'CONSUMPTION',
  'RETURN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'EXPIRED',
  'DAMAGED'
);

CREATE TABLE "suppliers" (
  "id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "tax_id" VARCHAR(60),
  "contact_name" VARCHAR(160),
  "phone" VARCHAR(40),
  "email" VARCHAR(180),
  "address" VARCHAR(240),
  "notes" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_items" (
  "id" UUID NOT NULL,
  "supplier_id" UUID,
  "sku" VARCHAR(80),
  "name" VARCHAR(180) NOT NULL,
  "type" "InventoryItemType" NOT NULL,
  "description" TEXT,
  "unit" VARCHAR(40) NOT NULL,
  "location" VARCHAR(120),
  "current_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "minimum_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "unit_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_items_current_stock_check" CHECK ("current_stock" >= 0),
  CONSTRAINT "inventory_items_minimum_stock_check" CHECK ("minimum_stock" >= 0),
  CONSTRAINT "inventory_items_unit_cost_check" CHECK ("unit_cost" >= 0)
);

CREATE TABLE "inventory_movements" (
  "id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "supplier_id" UUID,
  "actor_id" UUID,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "previous_stock" DECIMAL(14,3) NOT NULL,
  "resulting_stock" DECIMAL(14,3) NOT NULL,
  "unit_cost" DECIMAL(14,2),
  "reference" VARCHAR(140),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_movements_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "inventory_movements_previous_stock_check" CHECK ("previous_stock" >= 0),
  CONSTRAINT "inventory_movements_resulting_stock_check" CHECK ("resulting_stock" >= 0),
  CONSTRAINT "inventory_movements_unit_cost_check" CHECK ("unit_cost" IS NULL OR "unit_cost" >= 0)
);

CREATE UNIQUE INDEX "inventory_items_sku_key" ON "inventory_items"("sku");
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");
CREATE INDEX "suppliers_deleted_at_idx" ON "suppliers"("deleted_at");
CREATE INDEX "inventory_items_name_type_idx" ON "inventory_items"("name", "type");
CREATE INDEX "inventory_items_supplier_id_idx" ON "inventory_items"("supplier_id");
CREATE INDEX "inventory_items_deleted_at_idx" ON "inventory_items"("deleted_at");
CREATE INDEX "inventory_movements_item_id_created_at_idx" ON "inventory_movements"("item_id", "created_at");
CREATE INDEX "inventory_movements_type_created_at_idx" ON "inventory_movements"("type", "created_at");
CREATE INDEX "inventory_movements_supplier_id_created_at_idx" ON "inventory_movements"("supplier_id", "created_at");

ALTER TABLE "inventory_items"
ADD CONSTRAINT "inventory_items_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
