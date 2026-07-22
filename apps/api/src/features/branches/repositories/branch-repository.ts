export interface BranchRecord {
  id: string;
  name: string;
  description: string | null;
  address: string;
  timezone: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OpeningHourRecord {
  id: string;
  branchId: string;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}

export interface BranchRepository {
  findActive(): Promise<BranchRecord[]>;
  findById(id: string): Promise<BranchRecord | null>;
  findOpeningHours(branchId: string): Promise<OpeningHourRecord[]>;
  create(input: Omit<BranchRecord, "id" | "createdAt" | "updatedAt">): Promise<BranchRecord>;
  update(id: string, input: Partial<Omit<BranchRecord, "id" | "createdAt" | "updatedAt">>): Promise<BranchRecord>;
}
