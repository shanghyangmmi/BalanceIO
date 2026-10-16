import { FixedAsset, AssetCategory } from "@/lib/types/assets";

export const defaultAssetCategories: AssetCategory[] = [
    { id: "CAT-IT", name: "Computer Equipment", usefulLifeYears: 4, depreciationMethod: "STRAIGHT_LINE" },
    { id: "CAT-FURN", name: "Furniture & Fixtures", usefulLifeYears: 8, depreciationMethod: "STRAIGHT_LINE" },
    { id: "CAT-VEH", name: "Vehicles", usefulLifeYears: 5, depreciationMethod: "DOUBLE_DECLINING" },
];

export const defaultAssets: FixedAsset[] = [
    {
        id: "FA-001",
        name: "MacBook Pro M3 Max",
        category: "Computer Equipment",
        purchaseDate: new Date("2024-01-15"),
        cost: 45000000,
        salvageValue: 5000000,
        usefulLifeMonths: 48,
        accumulatedDepreciation: 937500, // 1 month approx
        bookValue: 44062500,
        status: "ACTIVE",
        serialNumber: "SN-MAC-001",
        location: "Head Office"
    },
    {
        id: "FA-002",
        name: "Office Desk Set (10x)",
        category: "Furniture & Fixtures",
        purchaseDate: new Date("2023-06-01"),
        cost: 30000000,
        salvageValue: 0,
        usefulLifeMonths: 96,
        accumulatedDepreciation: 2500000, // Approx 8 months
        bookValue: 27500000,
        status: "ACTIVE",
        location: "Warehouse"
    },
    {
        id: "FA-003",
        name: "Delivery Van Daihatsu",
        category: "Vehicles",
        purchaseDate: new Date("2022-01-01"),
        cost: 180000000,
        salvageValue: 20000000,
        usefulLifeMonths: 60,
        accumulatedDepreciation: 72000000,
        bookValue: 108000000,
        status: "ACTIVE",
        serialNumber: "B 1234 XYZ",
        location: "Logistics"
    }
];
