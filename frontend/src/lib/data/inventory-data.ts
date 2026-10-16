import { Product } from "../types/inventory";

export const defaultProducts: Product[] = [
    {
        id: "P-001",
        code: "LPT-DELL-XPS",
        name: "Dell XPS 13 Laptop",
        description: "High performance ultrabook",
        unit: "Unit",
        type: 1, // Product
        sellPrice: 25000000,
        buyPrice: 18500000,
        stockOnHand: 5,
        reorderLevel: 2,
        trackInventory: true,
        isActive: true
    },
    {
        id: "P-002",
        code: "MNTR-LG-27",
        name: "LG Monitor 27 inch 4K",
        description: "IPS Display 4K UHD",
        unit: "Unit",
        type: 1, // Product
        sellPrice: 5500000,
        buyPrice: 4200000,
        stockOnHand: 12,
        reorderLevel: 5,
        trackInventory: true,
        isActive: true
    },
    {
        id: "P-003",
        code: "SVC-CONSULT",
        name: "IT Consultation Service",
        description: "Hourly consultation rate",
        unit: "Hour",
        type: 0, // Service
        sellPrice: 1500000,
        buyPrice: 0,
        stockOnHand: 0,
        reorderLevel: 0,
        trackInventory: false,
        isActive: true
    }
];
