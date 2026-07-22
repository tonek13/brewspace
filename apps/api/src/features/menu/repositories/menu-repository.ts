export interface MenuCategoryRecord {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
}

export interface MenuItemRecord {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  active: boolean;
  available: boolean;
}

export interface MenuOptionValueRecord {
  id: string;
  optionId: string;
  name: string;
  additionalPriceCents: number;
  active: boolean;
}

export interface MenuRepository {
  findCategoriesByBranch(branchId: string): Promise<MenuCategoryRecord[]>;
  findCategoryById(id: string): Promise<MenuCategoryRecord | null>;
  findItemsByCategories(categoryIds: string[]): Promise<MenuItemRecord[]>;
  findItemById(id: string): Promise<MenuItemRecord | null>;
  findOptionValues(valueIds: string[]): Promise<MenuOptionValueRecord[]>;
  createCategory(input: Omit<MenuCategoryRecord, "id">): Promise<MenuCategoryRecord>;
  updateCategory(id: string, patch: Partial<Omit<MenuCategoryRecord, "id">>): Promise<MenuCategoryRecord>;
  createItem(input: Omit<MenuItemRecord, "id">): Promise<MenuItemRecord>;
  updateItem(id: string, patch: Partial<Omit<MenuItemRecord, "id">>): Promise<MenuItemRecord>;
}
