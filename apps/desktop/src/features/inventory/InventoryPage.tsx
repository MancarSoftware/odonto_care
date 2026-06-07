import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Check,
  CircleDollarSign,
  History,
  MapPin,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuthenticatedUser } from "@/features/auth/types";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

type InventoryTab = "items" | "movements" | "suppliers";
type StockFilter = "all" | "low" | "out";
type InventoryItemType =
  | "CONSUMABLE"
  | "MATERIAL"
  | "MEDICATION"
  | "INSTRUMENT"
  | "OTHER";
type InventoryMovementType =
  | "PURCHASE"
  | "CONSUMPTION"
  | "RETURN"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "EXPIRED"
  | "DAMAGED";

type ApiSupplier = {
  _count: { items: number };
  address: string | null;
  contactName: string | null;
  email: string | null;
  id: string;
  name: string;
  notes: string | null;
  phone: string | null;
  taxId: string | null;
};

type ApiInventoryItem = {
  _count: { movements: number };
  currentStock: number | string;
  description: string | null;
  id: string;
  location: string | null;
  minimumStock: number | string;
  name: string;
  sku: string | null;
  supplier: { id: string; name: string } | null;
  type: InventoryItemType;
  unit: string;
  unitCost: number | string;
  updatedAt: string;
};

type ApiInventoryMovement = {
  actor: { fullName: string; id: string } | null;
  createdAt: string;
  id: string;
  item: { id: string; name: string; sku: string | null; unit: string };
  notes: string | null;
  previousStock: number | string;
  quantity: number | string;
  reference: string | null;
  resultingStock: number | string;
  supplier: { id: string; name: string } | null;
  type: InventoryMovementType;
  unitCost: number | string | null;
};

type InventorySummary = {
  inventoryValue: number;
  lowStock: number;
  outOfStock: number;
  totalItems: number;
};

type ItemForm = {
  description: string;
  location: string;
  minimumStock: string;
  name: string;
  openingStock: string;
  sku: string;
  supplierId: string;
  type: InventoryItemType;
  unit: string;
  unitCost: string;
};

type MovementForm = {
  itemId: string;
  notes: string;
  quantity: string;
  reference: string;
  supplierId: string;
  type: InventoryMovementType;
  unitCost: string;
};

type SupplierForm = {
  address: string;
  contactName: string;
  email: string;
  name: string;
  notes: string;
  phone: string;
  taxId: string;
};

type InventoryPageProps = {
  currentUser: AuthenticatedUser;
  onUnauthorized: () => void;
  token: string;
};

const itemTypeLabels: Record<InventoryItemType, string> = {
  CONSUMABLE: "Consumible",
  INSTRUMENT: "Instrumental",
  MATERIAL: "Material",
  MEDICATION: "Medicamento",
  OTHER: "Otro",
};

const movementLabels: Record<InventoryMovementType, string> = {
  ADJUSTMENT_IN: "Ajuste de entrada",
  ADJUSTMENT_OUT: "Ajuste de salida",
  CONSUMPTION: "Consumo clinico",
  DAMAGED: "Dano o perdida",
  EXPIRED: "Vencimiento",
  PURCHASE: "Compra",
  RETURN: "Devolucion",
};

const inboundMovements = new Set<InventoryMovementType>([
  "ADJUSTMENT_IN",
  "PURCHASE",
  "RETURN",
]);

export function InventoryPage({
  currentUser,
  onUnauthorized,
  token,
}: InventoryPageProps) {
  const canManage = currentUser.role !== "DENTIST";
  const [activeTab, setActiveTab] = useState<InventoryTab>("items");
  const [editingItem, setEditingItem] = useState<ApiInventoryItem | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<ApiSupplier | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [items, setItems] = useState<ApiInventoryItem[]>([]);
  const [movementQuery, setMovementQuery] = useState("");
  const [movements, setMovements] = useState<ApiInventoryMovement[]>([]);
  const [query, setQuery] = useState("");
  const [selectedMovementItem, setSelectedMovementItem] =
    useState<ApiInventoryItem | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [summary, setSummary] = useState<InventorySummary>({
    inventoryValue: 0,
    lowStock: 0,
    outOfStock: 0,
    totalItems: 0,
  });
  const [supplierQuery, setSupplierQuery] = useState("");
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();

    return items.filter((item) => {
      const stock = stockState(item);
      if (stockFilter !== "all" && stock !== stockFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        item.name,
        item.sku ?? "",
        item.description ?? "",
        item.location ?? "",
        item.supplier?.name ?? "",
        itemTypeLabels[item.type],
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [items, query, stockFilter]);

  const filteredMovements = useMemo(() => {
    const search = movementQuery.trim().toLowerCase();
    if (!search) {
      return movements;
    }

    return movements.filter((movement) =>
      [
        movement.item.name,
        movement.item.sku ?? "",
        movementLabels[movement.type],
        movement.reference ?? "",
        movement.supplier?.name ?? "",
        movement.actor?.fullName ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [movementQuery, movements]);

  const filteredSuppliers = useMemo(() => {
    const search = supplierQuery.trim().toLowerCase();
    if (!search) {
      return suppliers;
    }

    return suppliers.filter((supplier) =>
      [
        supplier.name,
        supplier.taxId ?? "",
        supplier.contactName ?? "",
        supplier.phone ?? "",
        supplier.email ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [supplierQuery, suppliers]);

  async function loadAll() {
    setError(null);
    setIsLoading(true);

    try {
      const [summaryResponse, itemResponse, movementResponse, supplierResponse] =
        await Promise.all([
          apiGet<InventorySummary>("/inventory/summary", token),
          apiGet<ApiInventoryItem[]>("/inventory/items", token),
          apiGet<ApiInventoryMovement[]>("/inventory/movements", token),
          apiGet<ApiSupplier[]>("/inventory/suppliers", token),
        ]);
      setSummary(summaryResponse);
      setItems(itemResponse);
      setMovements(movementResponse);
      setSuppliers(supplierResponse);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateItem(form: ItemForm) {
    await apiPost<ApiInventoryItem>(
      "/inventory/items",
      itemPayload(form, true),
      token,
    );
    setIsItemModalOpen(false);
    await loadAll();
  }

  async function handleUpdateItem(form: ItemForm) {
    if (!editingItem) {
      return;
    }

    await apiPatch<ApiInventoryItem>(
      `/inventory/items/${editingItem.id}`,
      itemPayload(form, false),
      token,
    );
    setEditingItem(null);
    await loadAll();
  }

  async function handleDeleteItem(item: ApiInventoryItem) {
    if (!window.confirm(`Eliminar ${item.name} del catalogo?`)) {
      return;
    }

    try {
      await apiDelete<{ id: string }>(`/inventory/items/${item.id}`, token);
      await loadAll();
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function handleCreateMovement(form: MovementForm) {
    await apiPost<ApiInventoryMovement>(
      "/inventory/movements",
      {
        itemId: form.itemId,
        notes: form.notes.trim() || undefined,
        quantity: Number(form.quantity),
        reference: form.reference.trim() || undefined,
        supplierId: form.supplierId || undefined,
        type: form.type,
        unitCost:
          form.type === "PURCHASE" && form.unitCost
            ? Number(form.unitCost)
            : undefined,
      },
      token,
    );
    setIsMovementModalOpen(false);
    setSelectedMovementItem(null);
    await loadAll();
  }

  async function handleCreateSupplier(form: SupplierForm) {
    await apiPost<ApiSupplier>(
      "/inventory/suppliers",
      supplierPayload(form, true),
      token,
    );
    setIsSupplierModalOpen(false);
    await loadAll();
  }

  async function handleUpdateSupplier(form: SupplierForm) {
    if (!editingSupplier) {
      return;
    }

    await apiPatch<ApiSupplier>(
      `/inventory/suppliers/${editingSupplier.id}`,
      supplierPayload(form, false),
      token,
    );
    setEditingSupplier(null);
    await loadAll();
  }

  async function handleDeleteSupplier(supplier: ApiSupplier) {
    if (!window.confirm(`Eliminar el proveedor ${supplier.name}?`)) {
      return;
    }

    try {
      await apiDelete<{ id: string }>(
        `/inventory/suppliers/${supplier.id}`,
        token,
      );
      await loadAll();
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  function openMovement(item?: ApiInventoryItem) {
    setSelectedMovementItem(item ?? null);
    setIsMovementModalOpen(true);
  }

  function handleRequestError(requestError: unknown) {
    const message =
      requestError instanceof Error
        ? requestError.message
        : "No se pudo completar la operacion";

    if (message.includes("401") || message.toLowerCase().includes("sesion")) {
      onUnauthorized();
      return;
    }

    setError(message);
  }

  const tabs: Array<{
    icon: typeof Package;
    id: InventoryTab;
    label: string;
  }> = [
    { icon: Package, id: "items", label: "Existencias" },
    { icon: History, id: "movements", label: "Movimientos" },
    { icon: Truck, id: "suppliers", label: "Proveedores" },
  ];

  return (
    <div className="mx-auto flex max-w-[1540px] flex-col gap-5">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
            <Boxes className="h-3.5 w-3.5 text-primary" />
            Operacion y abastecimiento
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            Inventario
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controla materiales, costos, consumos y niveles de reposicion.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!items.length}
            onClick={() => openMovement()}
            variant="outline"
          >
            <RefreshCcw className="h-4 w-4" />
            Registrar movimiento
          </Button>
          {canManage && (
            <Button onClick={() => setIsItemModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Package}
          label="Productos activos"
          value={String(summary.totalItems)}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Stock bajo"
          tone={summary.lowStock > 0 ? "warning" : "default"}
          value={String(summary.lowStock)}
        />
        <MetricCard
          icon={X}
          label="Sin existencias"
          tone={summary.outOfStock > 0 ? "danger" : "default"}
          value={String(summary.outOfStock)}
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Valor del inventario"
          value={formatCurrency(summary.inventoryValue)}
        />
      </section>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            variant={activeTab === tab.id ? "default" : "ghost"}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "items" && (
        <ItemsPanel
          canManage={canManage}
          filter={stockFilter}
          isLoading={isLoading}
          items={filteredItems}
          onDelete={handleDeleteItem}
          onEdit={setEditingItem}
          onFilterChange={setStockFilter}
          onMovement={openMovement}
          onQueryChange={setQuery}
          query={query}
        />
      )}

      {activeTab === "movements" && (
        <MovementsPanel
          isLoading={isLoading}
          movements={filteredMovements}
          onCreate={() => openMovement()}
          onQueryChange={setMovementQuery}
          query={movementQuery}
        />
      )}

      {activeTab === "suppliers" && (
        <SuppliersPanel
          canManage={canManage}
          isLoading={isLoading}
          onCreate={() => setIsSupplierModalOpen(true)}
          onDelete={handleDeleteSupplier}
          onEdit={setEditingSupplier}
          onQueryChange={setSupplierQuery}
          query={supplierQuery}
          suppliers={filteredSuppliers}
        />
      )}

      {isItemModalOpen && (
        <ItemModal
          onClose={() => setIsItemModalOpen(false)}
          onSubmit={handleCreateItem}
          suppliers={suppliers}
          title="Nuevo producto"
        />
      )}

      {editingItem && (
        <ItemModal
          initialItem={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={handleUpdateItem}
          suppliers={suppliers}
          title="Editar producto"
        />
      )}

      {isMovementModalOpen && (
        <MovementModal
          currentUser={currentUser}
          initialItem={selectedMovementItem}
          items={items}
          onClose={() => {
            setIsMovementModalOpen(false);
            setSelectedMovementItem(null);
          }}
          onSubmit={handleCreateMovement}
          suppliers={suppliers}
        />
      )}

      {isSupplierModalOpen && (
        <SupplierModal
          onClose={() => setIsSupplierModalOpen(false)}
          onSubmit={handleCreateSupplier}
          title="Nuevo proveedor"
        />
      )}

      {editingSupplier && (
        <SupplierModal
          initialSupplier={editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSubmit={handleUpdateSupplier}
          title="Editar proveedor"
        />
      )}
    </div>
  );
}

function ItemsPanel({
  canManage,
  filter,
  isLoading,
  items,
  onDelete,
  onEdit,
  onFilterChange,
  onMovement,
  onQueryChange,
  query,
}: {
  canManage: boolean;
  filter: StockFilter;
  isLoading: boolean;
  items: ApiInventoryItem[];
  onDelete: (item: ApiInventoryItem) => Promise<void>;
  onEdit: (item: ApiInventoryItem) => void;
  onFilterChange: (filter: StockFilter) => void;
  onMovement: (item: ApiInventoryItem) => void;
  onQueryChange: (query: string) => void;
  query: string;
}) {
  return (
    <Card className="min-h-[580px]">
      <CardHeader className="flex-col items-stretch gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <CardTitle>Catalogo y existencias</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Busca por nombre, SKU, ubicacion o proveedor.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex rounded-lg border border-border bg-muted/40 p-1">
            {(
              [
                ["all", "Todos"],
                ["low", "Stock bajo"],
                ["out", "Agotados"],
              ] as Array<[StockFilter, string]>
            ).map(([value, label]) => (
              <button
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-semibold transition-colors",
                  filter === value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                key={value}
                onClick={() => onFilterChange(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[280px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-11"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar en tiempo real"
              value={query}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <ListSkeleton />}
        {!isLoading && items.length === 0 && (
          <EmptyState
            description="No hay productos que coincidan con la busqueda o el filtro."
            icon={Package}
            title="Sin productos"
          />
        )}
        {!isLoading &&
          items.map((item, index) => (
            <ItemRow
              canManage={canManage}
              index={index}
              item={item}
              key={item.id}
              onDelete={onDelete}
              onEdit={onEdit}
              onMovement={onMovement}
            />
          ))}
      </CardContent>
    </Card>
  );
}

function ItemRow({
  canManage,
  index,
  item,
  onDelete,
  onEdit,
  onMovement,
}: {
  canManage: boolean;
  index: number;
  item: ApiInventoryItem;
  onDelete: (item: ApiInventoryItem) => Promise<void>;
  onEdit: (item: ApiInventoryItem) => void;
  onMovement: (item: ApiInventoryItem) => void;
}) {
  const current = toNumber(item.currentStock);
  const minimum = toNumber(item.minimumStock);
  const state = stockState(item);
  const progress =
    minimum > 0 ? Math.min((current / minimum) * 100, 100) : current > 0 ? 100 : 0;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-4 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(260px,1fr)_180px_150px_140px]"
      initial={{ opacity: 0, y: 6 }}
      transition={{ delay: index * 0.018, duration: 0.2 }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-lg",
            state === "out"
              ? "bg-danger/10 text-danger"
              : state === "low"
                ? "bg-warning/15 text-warning"
                : "bg-primary/10 text-primary",
          )}
        >
          <Package className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-extrabold text-foreground">
              {item.name}
            </div>
            <StockBadge state={state} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
            <span>{item.sku || "Sin SKU"}</span>
            <span>{itemTypeLabels[item.type]}</span>
            <span>{item.supplier?.name ?? "Sin proveedor"}</span>
          </div>
          {item.description && (
            <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Disponible
            </div>
            <div className="mt-1 text-lg font-extrabold text-foreground">
              {formatQuantity(current)}{" "}
              <span className="text-xs font-semibold text-muted-foreground">
                {item.unit}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Min. {formatQuantity(minimum)}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              state === "out"
                ? "bg-danger"
                : state === "low"
                  ? "bg-warning"
                  : "bg-success",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Costo / ubicacion
        </div>
        <div className="mt-2 text-sm font-bold text-foreground">
          {formatCurrency(toNumber(item.unitCost))}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span className="truncate">{item.location || "Sin ubicacion"}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <Button
          aria-label="Registrar movimiento"
          onClick={() => onMovement(item)}
          size="icon"
          title="Registrar movimiento"
          variant="ghost"
        >
          <RefreshCcw className="h-4 w-4" />
        </Button>
        {canManage && (
          <>
            <Button
              aria-label="Editar producto"
              onClick={() => onEdit(item)}
              size="icon"
              title="Editar producto"
              variant="ghost"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              aria-label="Eliminar producto"
              onClick={() => void onDelete(item)}
              size="icon"
              title="Eliminar producto"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function MovementsPanel({
  isLoading,
  movements,
  onCreate,
  onQueryChange,
  query,
}: {
  isLoading: boolean;
  movements: ApiInventoryMovement[];
  onCreate: () => void;
  onQueryChange: (query: string) => void;
  query: string;
}) {
  return (
    <Card className="min-h-[580px]">
      <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Libro de movimientos</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Historial inalterable de entradas y salidas.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-[290px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-11"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Producto, referencia o usuario"
              value={query}
            />
          </div>
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4" />
            Nuevo movimiento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <ListSkeleton />}
        {!isLoading && movements.length === 0 && (
          <EmptyState
            description="Las compras, consumos y ajustes apareceran aqui."
            icon={History}
            title="Sin movimientos"
          />
        )}
        {!isLoading &&
          movements.map((movement, index) => (
            <MovementRow index={index} key={movement.id} movement={movement} />
          ))}
      </CardContent>
    </Card>
  );
}

function MovementRow({
  index,
  movement,
}: {
  index: number;
  movement: ApiInventoryMovement;
}) {
  const inbound = inboundMovements.has(movement.type);
  const Icon = inbound ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(260px,1fr)_170px_170px]"
      initial={{ opacity: 0, y: 6 }}
      transition={{ delay: index * 0.014, duration: 0.2 }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
            inbound ? "bg-success/10 text-success" : "bg-warning/15 text-warning",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-extrabold text-foreground">
              {movement.item.name}
            </div>
            <Badge variant={inbound ? "success" : "warning"}>
              {movementLabels[movement.type]}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{movement.item.sku || "Sin SKU"}</span>
            <span>{movement.reference || "Sin referencia"}</span>
            <span>{movement.supplier?.name ?? "Sin proveedor"}</span>
          </div>
          {movement.notes && (
            <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
              {movement.notes}
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Cambio de stock
        </div>
        <div
          className={cn(
            "mt-2 text-base font-extrabold",
            inbound ? "text-success" : "text-warning",
          )}
        >
          {inbound ? "+" : "-"}
          {formatQuantity(toNumber(movement.quantity))} {movement.item.unit}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatQuantity(toNumber(movement.previousStock))} a{" "}
          {formatQuantity(toNumber(movement.resultingStock))}
        </div>
      </div>

      <div className="md:text-right">
        <div className="text-xs font-semibold text-muted-foreground">
          {formatDateTime(movement.createdAt)}
        </div>
        <div className="mt-2 text-sm font-bold text-foreground">
          {movement.actor?.fullName ?? "Sistema"}
        </div>
        {movement.unitCost !== null && (
          <div className="mt-1 text-xs text-muted-foreground">
            {formatCurrency(toNumber(movement.unitCost))} por unidad
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SuppliersPanel({
  canManage,
  isLoading,
  onCreate,
  onDelete,
  onEdit,
  onQueryChange,
  query,
  suppliers,
}: {
  canManage: boolean;
  isLoading: boolean;
  onCreate: () => void;
  onDelete: (supplier: ApiSupplier) => Promise<void>;
  onEdit: (supplier: ApiSupplier) => void;
  onQueryChange: (query: string) => void;
  query: string;
  suppliers: ApiSupplier[];
}) {
  return (
    <Card className="min-h-[580px]">
      <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Directorio de proveedores</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Contactos y productos abastecidos.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-[290px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-11"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar proveedor o contacto"
              value={query}
            />
          </div>
          {canManage && (
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4" />
              Nuevo proveedor
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {isLoading && <ListSkeleton />}
        {!isLoading && suppliers.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyState
              description="Registra proveedores para vincular compras y productos."
              icon={Truck}
              title="Sin proveedores"
            />
          </div>
        )}
        {!isLoading &&
          suppliers.map((supplier, index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border bg-card p-5"
              initial={{ opacity: 0, y: 6 }}
              key={supplier.id}
              transition={{ delay: index * 0.02, duration: 0.2 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-foreground">
                      {supplier.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {supplier.taxId || "Sin identificacion fiscal"}
                    </div>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      aria-label="Editar proveedor"
                      onClick={() => onEdit(supplier)}
                      size="icon"
                      title="Editar proveedor"
                      variant="ghost"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="Eliminar proveedor"
                      onClick={() => void onDelete(supplier)}
                      size="icon"
                      title="Eliminar proveedor"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <SupplierDatum
                  label="Contacto"
                  value={supplier.contactName || "No registrado"}
                />
                <SupplierDatum
                  label="Productos"
                  value={String(supplier._count.items)}
                />
                <SupplierDatum
                  label="Telefono"
                  value={supplier.phone || "No registrado"}
                />
                <SupplierDatum
                  label="Correo"
                  value={supplier.email || "No registrado"}
                />
              </div>
            </motion.div>
          ))}
      </CardContent>
    </Card>
  );
}

function ItemModal({
  initialItem,
  onClose,
  onSubmit,
  suppliers,
  title,
}: {
  initialItem?: ApiInventoryItem;
  onClose: () => void;
  onSubmit: (form: ItemForm) => Promise<void>;
  suppliers: ApiSupplier[];
  title: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>({
    description: initialItem?.description ?? "",
    location: initialItem?.location ?? "",
    minimumStock: initialItem
      ? String(initialItem.minimumStock)
      : "5",
    name: initialItem?.name ?? "",
    openingStock: "0",
    sku: initialItem?.sku ?? "",
    supplierId: initialItem?.supplier?.id ?? "",
    type: initialItem?.type ?? "CONSUMABLE",
    unit: initialItem?.unit ?? "unidad",
    unitCost: initialItem ? String(initialItem.unitCost) : "0",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.unit.trim()) {
      setError("Nombre y unidad son obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar el producto",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function update<K extends keyof ItemForm>(field: K, value: ItemForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <ModalShell
      onClose={onClose}
      subtitle="Datos comerciales y niveles de reposicion"
      title={title}
    >
      <form className="space-y-5 p-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <Input
              autoFocus
              onChange={(event) => update("name", event.target.value)}
              value={form.name}
            />
          </Field>
          <Field label="SKU / codigo interno">
            <Input
              onChange={(event) => update("sku", event.target.value)}
              placeholder="Ej. RES-COMP-A2"
              value={form.sku}
            />
          </Field>
          <Field label="Tipo">
            <Select
              onChange={(value) =>
                update("type", value as InventoryItemType)
              }
              value={form.type}
            >
              {(Object.keys(itemTypeLabels) as InventoryItemType[]).map(
                (type) => (
                  <option key={type} value={type}>
                    {itemTypeLabels[type]}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Proveedor principal">
            <Select
              onChange={(value) => update("supplierId", value)}
              value={form.supplierId}
            >
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unidad de medida">
            <Input
              onChange={(event) => update("unit", event.target.value)}
              placeholder="unidad, caja, ml, gramo..."
              value={form.unit}
            />
          </Field>
          <Field label="Ubicacion">
            <Input
              onChange={(event) => update("location", event.target.value)}
              placeholder="Gabinete A / Estante 2"
              value={form.location}
            />
          </Field>
          <Field label="Stock minimo">
            <Input
              min="0"
              onChange={(event) => update("minimumStock", event.target.value)}
              step="0.001"
              type="number"
              value={form.minimumStock}
            />
          </Field>
          <Field label="Costo unitario">
            <Input
              min="0"
              onChange={(event) => update("unitCost", event.target.value)}
              step="0.01"
              type="number"
              value={form.unitCost}
            />
          </Field>
          {!initialItem && (
            <Field label="Existencia inicial">
              <Input
                min="0"
                onChange={(event) =>
                  update("openingStock", event.target.value)
                }
                step="0.001"
                type="number"
                value={form.openingStock}
              />
            </Field>
          )}
          <Field className="md:col-span-2" label="Descripcion">
            <Textarea
              onChange={(value) => update("description", value)}
              placeholder="Presentacion, marca o detalles de uso..."
              value={form.description}
            />
          </Field>
        </div>
        {initialItem && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-muted-foreground">
            Las existencias se modifican desde Registrar movimiento para
            conservar la auditoria.
          </div>
        )}
        {error && <ErrorMessage message={error} />}
        <ModalActions
          isSubmitting={isSubmitting}
          onClose={onClose}
          submitLabel="Guardar producto"
        />
      </form>
    </ModalShell>
  );
}

function MovementModal({
  currentUser,
  initialItem,
  items,
  onClose,
  onSubmit,
  suppliers,
}: {
  currentUser: AuthenticatedUser;
  initialItem: ApiInventoryItem | null;
  items: ApiInventoryItem[];
  onClose: () => void;
  onSubmit: (form: MovementForm) => Promise<void>;
  suppliers: ApiSupplier[];
}) {
  const dentist = currentUser.role === "DENTIST";
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MovementForm>({
    itemId: initialItem?.id ?? items[0]?.id ?? "",
    notes: "",
    quantity: "1",
    reference: "",
    supplierId: initialItem?.supplier?.id ?? "",
    type: dentist ? "CONSUMPTION" : "PURCHASE",
    unitCost: initialItem ? String(initialItem.unitCost) : "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedItem = items.find((item) => item.id === form.itemId);
  const availableTypes = dentist
    ? (["CONSUMPTION"] as InventoryMovementType[])
    : (Object.keys(movementLabels) as InventoryMovementType[]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.itemId || Number(form.quantity) <= 0) {
      setError("Selecciona un producto e ingresa una cantidad valida");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar el movimiento",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function update<K extends keyof MovementForm>(
    field: K,
    value: MovementForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <ModalShell
      onClose={onClose}
      subtitle="El saldo se actualizara al confirmar"
      title="Registrar movimiento"
    >
      <form className="space-y-5 p-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field className="md:col-span-2" label="Producto">
            <Select
              onChange={(value) => {
                const item = items.find((candidate) => candidate.id === value);
                setForm((current) => ({
                  ...current,
                  itemId: value,
                  supplierId: item?.supplier?.id ?? current.supplierId,
                  unitCost: item ? String(item.unitCost) : current.unitCost,
                }));
              }}
              value={form.itemId}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {formatQuantity(toNumber(item.currentStock))}{" "}
                  {item.unit}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de movimiento">
            <Select
              onChange={(value) =>
                update("type", value as InventoryMovementType)
              }
              value={form.type}
            >
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {movementLabels[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Cantidad${selectedItem ? ` (${selectedItem.unit})` : ""}`}>
            <Input
              autoFocus
              min="0.001"
              onChange={(event) => update("quantity", event.target.value)}
              step="0.001"
              type="number"
              value={form.quantity}
            />
          </Field>
          {form.type === "PURCHASE" && (
            <>
              <Field label="Costo unitario de compra">
                <Input
                  min="0"
                  onChange={(event) => update("unitCost", event.target.value)}
                  step="0.01"
                  type="number"
                  value={form.unitCost}
                />
              </Field>
              <Field label="Proveedor">
                <Select
                  onChange={(value) => update("supplierId", value)}
                  value={form.supplierId}
                >
                  <option value="">Sin proveedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <Field label="Referencia">
            <Input
              onChange={(event) => update("reference", event.target.value)}
              placeholder="Factura, orden o responsable"
              value={form.reference}
            />
          </Field>
          <Field className="md:col-span-2" label="Notas">
            <Textarea
              onChange={(value) => update("notes", value)}
              placeholder="Motivo o contexto del movimiento..."
              value={form.notes}
            />
          </Field>
        </div>
        {selectedItem && !inboundMovements.has(form.type) && (
          <div className="rounded-lg border border-border bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
            Disponible:{" "}
            <strong className="text-foreground">
              {formatQuantity(toNumber(selectedItem.currentStock))}{" "}
              {selectedItem.unit}
            </strong>
          </div>
        )}
        {error && <ErrorMessage message={error} />}
        <ModalActions
          isSubmitting={isSubmitting}
          onClose={onClose}
          submitLabel="Confirmar movimiento"
        />
      </form>
    </ModalShell>
  );
}

function SupplierModal({
  initialSupplier,
  onClose,
  onSubmit,
  title,
}: {
  initialSupplier?: ApiSupplier;
  onClose: () => void;
  onSubmit: (form: SupplierForm) => Promise<void>;
  title: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>({
    address: initialSupplier?.address ?? "",
    contactName: initialSupplier?.contactName ?? "",
    email: initialSupplier?.email ?? "",
    name: initialSupplier?.name ?? "",
    notes: initialSupplier?.notes ?? "",
    phone: initialSupplier?.phone ?? "",
    taxId: initialSupplier?.taxId ?? "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("El nombre del proveedor es obligatorio");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar el proveedor",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function update<K extends keyof SupplierForm>(
    field: K,
    value: SupplierForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <ModalShell
      onClose={onClose}
      subtitle="Datos comerciales y de contacto"
      title={title}
    >
      <form className="space-y-5 p-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre comercial">
            <Input
              autoFocus
              onChange={(event) => update("name", event.target.value)}
              value={form.name}
            />
          </Field>
          <Field label="RUC / identificacion fiscal">
            <Input
              onChange={(event) => update("taxId", event.target.value)}
              value={form.taxId}
            />
          </Field>
          <Field label="Persona de contacto">
            <Input
              onChange={(event) => update("contactName", event.target.value)}
              value={form.contactName}
            />
          </Field>
          <Field label="Telefono">
            <Input
              onChange={(event) => update("phone", event.target.value)}
              value={form.phone}
            />
          </Field>
          <Field label="Correo">
            <Input
              onChange={(event) => update("email", event.target.value)}
              type="email"
              value={form.email}
            />
          </Field>
          <Field label="Direccion">
            <Input
              onChange={(event) => update("address", event.target.value)}
              value={form.address}
            />
          </Field>
          <Field className="md:col-span-2" label="Notas">
            <Textarea
              onChange={(value) => update("notes", value)}
              placeholder="Condiciones, horarios o informacion adicional..."
              value={form.notes}
            />
          </Field>
        </div>
        {error && <ErrorMessage message={error} />}
        <ModalActions
          isSubmitting={isSubmitting}
          onClose={onClose}
          submitLabel="Guardar proveedor"
        />
      </form>
    </ModalShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  icon: typeof Package;
  label: string;
  tone?: "default" | "warning" | "danger";
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-lg",
            tone === "danger"
              ? "bg-danger/10 text-danger"
              : tone === "warning"
                ? "bg-warning/15 text-warning"
                : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-extrabold text-foreground">
            {value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StockBadge({ state }: { state: StockFilter }) {
  if (state === "out") {
    return <Badge variant="danger">Agotado</Badge>;
  }

  if (state === "low") {
    return <Badge variant="warning">Stock bajo</Badge>;
  }

  return <Badge variant="success">Disponible</Badge>;
}

function SupplierDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ModalShell({
  children,
  onClose,
  subtitle,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/20 px-4 py-8 backdrop-blur-sm">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="my-auto w-full max-w-[760px] rounded-lg border border-border bg-card shadow-soft"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-lg font-extrabold text-foreground">{title}</div>
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          </div>
          <Button
            aria-label="Cerrar"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function ModalActions({
  isSubmitting,
  onClose,
  submitLabel,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-border pt-5">
      <Button onClick={onClose} type="button" variant="outline">
        Cancelar
      </Button>
      <Button disabled={isSubmitting} type="submit">
        <Check className="h-4 w-4" />
        {isSubmitting ? "Guardando..." : submitLabel}
      </Button>
    </div>
  );
}

function Field({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  children,
  onChange,
  value,
}: {
  children: ReactNode;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <select
      className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function Textarea({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <textarea
      className="min-h-24 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground caret-primary outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
      {message}
    </div>
  );
}

function EmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof Package;
  title: string;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-4 text-sm font-bold text-foreground">{title}</div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          className="h-24 animate-pulse rounded-lg border border-border bg-muted"
          key={index}
        />
      ))}
    </div>
  );
}

function itemPayload(form: ItemForm, includeOpeningStock: boolean) {
  const optionalValue = (value: string) =>
    value.trim() || (includeOpeningStock ? undefined : null);

  return {
    description: optionalValue(form.description),
    location: optionalValue(form.location),
    minimumStock: Number(form.minimumStock || 0),
    name: form.name.trim(),
    ...(includeOpeningStock
      ? { openingStock: Number(form.openingStock || 0) }
      : {}),
    sku: optionalValue(form.sku),
    supplierId: form.supplierId || (includeOpeningStock ? undefined : null),
    type: form.type,
    unit: form.unit.trim(),
    unitCost: Number(form.unitCost || 0),
  };
}

function supplierPayload(form: SupplierForm, isCreate: boolean) {
  const optionalValue = (value: string) =>
    value.trim() || (isCreate ? undefined : null);

  return {
    address: optionalValue(form.address),
    contactName: optionalValue(form.contactName),
    email: optionalValue(form.email),
    name: form.name.trim(),
    notes: optionalValue(form.notes),
    phone: optionalValue(form.phone),
    taxId: optionalValue(form.taxId),
  };
}

function stockState(item: ApiInventoryItem): StockFilter {
  const current = toNumber(item.currentStock);
  if (current <= 0) {
    return "out";
  }

  if (current <= toNumber(item.minimumStock)) {
    return "low";
  }

  return "all";
}

function toNumber(value: number | string | null) {
  return value === null ? 0 : Number(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-EC", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
