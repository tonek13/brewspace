import { eq, inArray, asc } from "drizzle-orm";
import type { Database } from "../../../database/client";
import { menuCategories, menuItems, menuItemOptionValues } from "../../../database/schema";
import type {
  MenuRepository,
  MenuCategoryRecord,
  MenuItemRecord,
  MenuOptionValueRecord,
} from "./menu-repository";

export class DrizzleMenuRepository implements MenuRepository {
  constructor(private readonly db: Database) {}

  async findCategoriesByBranch(branchId: string): Promise<MenuCategoryRecord[]> {
    return this.db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.branchId, branchId))
      .orderBy(asc(menuCategories.displayOrder));
  }

  async findCategoryById(id: string): Promise<MenuCategoryRecord | null> {
    const [row] = await this.db.select().from(menuCategories).where(eq(menuCategories.id, id)).limit(1);
    return row ?? null;
  }

  async findItemsByCategories(categoryIds: string[]): Promise<MenuItemRecord[]> {
    if (categoryIds.length === 0) return [];
    return this.db.select().from(menuItems).where(inArray(menuItems.categoryId, categoryIds));
  }

  async findItemById(id: string): Promise<MenuItemRecord | null> {
    const [row] = await this.db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
    return row ?? null;
  }

  async findOptionValues(valueIds: string[]): Promise<MenuOptionValueRecord[]> {
    if (valueIds.length === 0) return [];
    return this.db.select().from(menuItemOptionValues).where(inArray(menuItemOptionValues.id, valueIds));
  }

  async createCategory(input: Omit<MenuCategoryRecord, "id">): Promise<MenuCategoryRecord> {
    const [row] = await this.db.insert(menuCategories).values(input).returning();
    if (!row) throw new Error("Failed to create menu category");
    return row;
  }

  async updateCategory(id: string, patch: Partial<Omit<MenuCategoryRecord, "id">>): Promise<MenuCategoryRecord> {
    const [row] = await this.db.update(menuCategories).set(patch).where(eq(menuCategories.id, id)).returning();
    if (!row) throw new Error("Menu category not found");
    return row;
  }

  async createItem(input: Omit<MenuItemRecord, "id">): Promise<MenuItemRecord> {
    const [row] = await this.db.insert(menuItems).values(input).returning();
    if (!row) throw new Error("Failed to create menu item");
    return row;
  }

  async updateItem(id: string, patch: Partial<Omit<MenuItemRecord, "id">>): Promise<MenuItemRecord> {
    const [row] = await this.db.update(menuItems).set(patch).where(eq(menuItems.id, id)).returning();
    if (!row) throw new Error("Menu item not found");
    return row;
  }
}
