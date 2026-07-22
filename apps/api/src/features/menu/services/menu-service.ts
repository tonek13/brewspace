import type { Redis } from "ioredis";
import { redisKeys } from "../../../infrastructure/redis";
import type { MenuRepository, MenuCategoryRecord, MenuItemRecord } from "../repositories/menu-repository";

export interface BranchMenu {
  categories: (MenuCategoryRecord & { items: MenuItemRecord[] })[];
}

const MENU_CACHE_TTL_SECONDS = 300;

export class MenuService {
  constructor(
    private readonly menuRepository: MenuRepository,
    private readonly redis: Redis,
  ) {}

  async getBranchMenu(branchId: string): Promise<BranchMenu> {
    const cacheKey = redisKeys.menu(branchId);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as BranchMenu;

    const categories = await this.menuRepository.findCategoriesByBranch(branchId);
    const activeCategories = categories.filter((category) => category.active);
    const items = await this.menuRepository.findItemsByCategories(activeCategories.map((c) => c.id));

    const menu: BranchMenu = {
      categories: activeCategories.map((category) => ({
        ...category,
        items: items.filter((item) => item.categoryId === category.id && item.active),
      })),
    };

    await this.redis.set(cacheKey, JSON.stringify(menu), "EX", MENU_CACHE_TTL_SECONDS);
    return menu;
  }

  async invalidateBranchMenu(branchId: string): Promise<void> {
    await this.redis.del(redisKeys.menu(branchId));
  }
}
