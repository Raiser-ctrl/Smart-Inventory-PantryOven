
export const INVENTORY_UPDATED_EVENT =
  "pantryoven:inventory-updated";

export type InventoryUpdatedDetail = {
  itemId: string;
};

export function notifyInventoryUpdated(itemId: string) {
  window.dispatchEvent(
    new CustomEvent<InventoryUpdatedDetail>(
      INVENTORY_UPDATED_EVENT,
      {
        detail: { itemId },
      }
    )
  );
}
