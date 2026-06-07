import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditAction,
  InventoryMovementType,
  Prisma,
  UserRole,
} from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/types";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { CreateInventoryMovementDto } from "./dto/create-inventory-movement.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

const itemInclude = {
  supplier: {
    select: { id: true, name: true },
  },
  _count: {
    select: { movements: true },
  },
} satisfies Prisma.InventoryItemInclude;

const movementInclude = {
  actor: {
    select: { fullName: true, id: true },
  },
  item: {
    select: { id: true, name: true, sku: true, unit: true },
  },
  supplier: {
    select: { id: true, name: true },
  },
} satisfies Prisma.InventoryMovementInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async getSummary() {
    const items = await this.prisma.inventoryItem.findMany({
      select: {
        currentStock: true,
        minimumStock: true,
        unitCost: true,
      },
      where: { deletedAt: null },
    });

    return items.reduce(
      (summary, item) => {
        const currentStock = item.currentStock.toNumber();
        const minimumStock = item.minimumStock.toNumber();
        summary.inventoryValue += currentStock * item.unitCost.toNumber();

        if (currentStock === 0) {
          summary.outOfStock += 1;
        } else if (currentStock <= minimumStock) {
          summary.lowStock += 1;
        }

        return summary;
      },
      {
        inventoryValue: 0,
        lowStock: 0,
        outOfStock: 0,
        totalItems: items.length,
      },
    );
  }

  findItems(query?: string) {
    const search = query?.trim();

    return this.prisma.inventoryItem.findMany({
      include: itemInclude,
      orderBy: [{ name: "asc" }],
      take: 500,
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { sku: { contains: search, mode: "insensitive" as const } },
                {
                  description: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  location: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      },
    });
  }

  findMovements(itemId?: string) {
    return this.prisma.inventoryMovement.findMany({
      include: movementInclude,
      orderBy: { createdAt: "desc" },
      take: 250,
      where: withoutUndefined({ itemId }),
    });
  }

  findSuppliers() {
    return this.prisma.supplier.findMany({
      include: {
        _count: {
          select: { items: { where: { deletedAt: null } } },
        },
      },
      orderBy: { name: "asc" },
      where: { deletedAt: null },
    });
  }

  async createItem(dto: CreateInventoryItemDto, actorId: string) {
    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    try {
      const item = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.inventoryItem.create({
          data: withoutUndefined({
            description: normalizeOptional(dto.description),
            currentStock: dto.openingStock ?? 0,
            location: normalizeOptional(dto.location),
            minimumStock: dto.minimumStock ?? 0,
            name: dto.name.trim(),
            sku: normalizeSku(dto.sku),
            supplierId: dto.supplierId,
            type: dto.type,
            unit: dto.unit.trim(),
            unitCost: dto.unitCost ?? 0,
          }) as Prisma.InventoryItemUncheckedCreateInput,
          include: itemInclude,
        });

        if ((dto.openingStock ?? 0) > 0) {
          await transaction.inventoryMovement.create({
            data: withoutUndefined({
              actorId,
              itemId: created.id,
              notes: "Saldo inicial del producto",
              previousStock: 0,
              quantity: dto.openingStock!,
              resultingStock: dto.openingStock!,
              supplierId: dto.supplierId,
              type: InventoryMovementType.ADJUSTMENT_IN,
              unitCost: dto.unitCost,
            }) as Prisma.InventoryMovementUncheckedCreateInput,
          });
        }

        return created;
      });

      await this.audit.log({
        action: AuditAction.CREATE,
        actorId,
        after: {
          currentStock: item.currentStock,
          name: item.name,
          sku: item.sku,
          type: item.type,
        },
        entity: "InventoryItem",
        entityId: item.id,
      });

      return item;
    } catch (error) {
      handleUniqueSku(error);
    }
  }

  async updateItem(
    id: string,
    dto: UpdateInventoryItemDto,
    actorId: string,
  ) {
    const existing = await this.ensureItemExists(id);

    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    try {
      const item = await this.prisma.inventoryItem.update({
        data: withoutUndefined({
          description: normalizeOptional(dto.description),
          location: normalizeOptional(dto.location),
          minimumStock: dto.minimumStock,
          name: dto.name?.trim(),
          sku: dto.sku === undefined ? undefined : normalizeSku(dto.sku),
          supplierId: dto.supplierId,
          type: dto.type,
          unit: dto.unit?.trim(),
          unitCost: dto.unitCost,
        }) as Prisma.InventoryItemUncheckedUpdateInput,
        include: itemInclude,
        where: { id },
      });

      await this.audit.log({
        action: AuditAction.UPDATE,
        actorId,
        after: itemAuditData(item),
        before: itemAuditData(existing),
        entity: "InventoryItem",
        entityId: id,
      });

      return item;
    } catch (error) {
      handleUniqueSku(error);
    }
  }

  async softDeleteItem(id: string, actorId: string) {
    const existing = await this.ensureItemExists(id);

    if (!existing.currentStock.isZero()) {
      throw new ConflictException(
        "El producto debe quedar sin existencias antes de eliminarlo",
      );
    }

    await this.prisma.inventoryItem.update({
      data: { deletedAt: new Date() },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: itemAuditData(existing),
      entity: "InventoryItem",
      entityId: id,
    });

    return { id };
  }

  async createMovement(
    dto: CreateInventoryMovementDto,
    actor: AuthenticatedUser,
  ) {
    if (
      actor.role === UserRole.DENTIST &&
      dto.type !== InventoryMovementType.CONSUMPTION
    ) {
      throw new BadRequestException(
        "El odontologo solo puede registrar consumo de materiales",
      );
    }

    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    const movement = await this.withTransactionRetry(async (transaction) => {
      const item = await transaction.inventoryItem.findFirst({
        where: { deletedAt: null, id: dto.itemId },
      });

      if (!item) {
        throw new NotFoundException("Producto no encontrado");
      }

      const quantity = new Prisma.Decimal(dto.quantity);
      const isInbound = inboundMovementTypes.has(dto.type);
      const previousStock = item.currentStock;
      const resultingStock = isInbound
        ? previousStock.plus(quantity)
        : previousStock.minus(quantity);

      if (resultingStock.isNegative()) {
        throw new BadRequestException(
          `Existencias insuficientes. Disponible: ${previousStock.toFixed(3)} ${item.unit}`,
        );
      }

      let resultingUnitCost = item.unitCost;
      if (
        dto.type === InventoryMovementType.PURCHASE &&
        dto.unitCost !== undefined
      ) {
        const purchaseCost = new Prisma.Decimal(dto.unitCost);
        const previousValue = previousStock.mul(item.unitCost);
        const purchaseValue = quantity.mul(purchaseCost);
        resultingUnitCost = previousValue
          .plus(purchaseValue)
          .div(resultingStock);
      }

      await transaction.inventoryItem.update({
        data: {
          currentStock: resultingStock,
          unitCost: resultingUnitCost,
        },
        where: { id: item.id },
      });

      return transaction.inventoryMovement.create({
        data: withoutUndefined({
          actorId: actor.id,
          itemId: item.id,
          notes: normalizeOptional(dto.notes),
          previousStock,
          quantity,
          reference: normalizeOptional(dto.reference),
          resultingStock,
          supplierId: dto.supplierId,
          type: dto.type,
          unitCost: dto.unitCost,
        }) as Prisma.InventoryMovementUncheckedCreateInput,
        include: movementInclude,
      });
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId: actor.id,
      after: {
        itemId: movement.itemId,
        quantity: movement.quantity,
        resultingStock: movement.resultingStock,
        type: movement.type,
      },
      entity: "InventoryMovement",
      entityId: movement.id,
    });

    return movement;
  }

  async createSupplier(dto: CreateSupplierDto, actorId: string) {
    const supplier = await this.prisma.supplier.create({
      data: {
        ...supplierData(dto),
        name: dto.name.trim(),
      } as Prisma.SupplierCreateInput,
      include: {
        _count: { select: { items: { where: { deletedAt: null } } } },
      },
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId,
      after: supplierAuditData(supplier),
      entity: "Supplier",
      entityId: supplier.id,
    });

    return supplier;
  }

  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    actorId: string,
  ) {
    const existing = await this.ensureSupplierExists(id);
    const supplier = await this.prisma.supplier.update({
      data: supplierData(dto) as Prisma.SupplierUpdateInput,
      include: {
        _count: { select: { items: { where: { deletedAt: null } } } },
      },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      actorId,
      after: supplierAuditData(supplier),
      before: supplierAuditData(existing),
      entity: "Supplier",
      entityId: id,
    });

    return supplier;
  }

  async softDeleteSupplier(id: string, actorId: string) {
    const existing = await this.ensureSupplierExists(id);
    const activeItems = await this.prisma.inventoryItem.count({
      where: { deletedAt: null, supplierId: id },
    });

    if (activeItems > 0) {
      throw new ConflictException(
        "Desvincula los productos activos antes de eliminar este proveedor",
      );
    }

    await this.prisma.supplier.update({
      data: { deletedAt: new Date() },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: supplierAuditData(existing),
      entity: "Supplier",
      entityId: id,
    });

    return { id };
  }

  private async ensureItemExists(id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      include: itemInclude,
      where: { deletedAt: null, id },
    });

    if (!item) {
      throw new NotFoundException("Producto no encontrado");
    }

    return item;
  }

  private async ensureSupplierExists(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { deletedAt: null, id },
    });

    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }

    return supplier;
  }

  private async withTransactionRetry<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          !(
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2034" &&
            attempt < 3
          )
        ) {
          throw error;
        }
      }
    }

    throw new ConflictException(
      "No se pudo actualizar el stock por operaciones simultaneas",
    );
  }
}

const inboundMovementTypes = new Set<InventoryMovementType>([
  InventoryMovementType.ADJUSTMENT_IN,
  InventoryMovementType.PURCHASE,
  InventoryMovementType.RETURN,
]);

function normalizeOptional(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeSku(value: string | null | undefined) {
  if (value === null) {
    return null;
  }

  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function supplierData(dto: CreateSupplierDto | UpdateSupplierDto) {
  return withoutUndefined({
    address: normalizeOptional(dto.address),
    contactName: normalizeOptional(dto.contactName),
    email:
      dto.email === undefined
        ? undefined
        : normalizeOptional(dto.email)?.toLowerCase(),
    name: dto.name?.trim(),
    notes: normalizeOptional(dto.notes),
    phone: normalizeOptional(dto.phone),
    taxId: normalizeOptional(dto.taxId),
  });
}

function itemAuditData(item: {
  currentStock: Prisma.Decimal;
  minimumStock: Prisma.Decimal;
  name: string;
  sku: string | null;
  type: string;
  unitCost: Prisma.Decimal;
}) {
  return {
    currentStock: item.currentStock.toString(),
    minimumStock: item.minimumStock.toString(),
    name: item.name,
    sku: item.sku,
    type: item.type,
    unitCost: item.unitCost.toString(),
  };
}

function supplierAuditData(supplier: {
  email: string | null;
  name: string;
  phone: string | null;
  taxId: string | null;
}) {
  return {
    email: supplier.email,
    name: supplier.name,
    phone: supplier.phone,
    taxId: supplier.taxId,
  };
}

function handleUniqueSku(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ConflictException("Ya existe un producto con ese SKU");
  }

  throw error;
}
