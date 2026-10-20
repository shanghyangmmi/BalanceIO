export const siteConfig = {
    name: "BalanceIO",
    description: "Professional Accounting Suite",
    version: "0.1.0",

    // Master Connection Config (For Static Export)
    api: {
        baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5210/api",
        timeout: 30000,
    },

    // Brand Identity
    brand: {
        companyName: "BalanceIO",
        shortName: "BalanceIO",
        logo: "/logo.png",
        supportEmail: "support@balanceio.id",
    },

    // Marketing content
    marketing: {
        slogan: "Nothing posts until both sides agree.",
        description: "Accounting for Indonesian companies. A module earns its place only if it posts to the general ledger.",
        // No certification claims here until an audit report exists to back them.
        trustBadge: "MFA, role-based access and an append-only audit trail",
        trustBadgeSecondary: "PSAK, PPN and PPh 21 records",
    },

    // Feature Flags (Toggle functionality)
    features: {
        multiCurrency: false,
        inventory: true,
        fixedAssets: true,
        taxCenter: true,
    },

    links: {
        github: "https://github.com/shanghyangmmi/BalanceIO",
        docs: "https://docs.balanceIO.com",
    },

    contacts: {
        whatsapp: "https://wa.me/6281212968668", // Official WhatsApp
        email: "support@balanceio.id", // Support Email
        instagram: "https://instagram.com/balanceIO", // Official Instagram
        linkedin: "https://linkedin.com/company/balanceIO", // Official LinkedIn
        twitter: "https://twitter.com/balanceIO", // Official Twitter/X
        // Placeholders until the accounts exist. While false the footer shows
        // the icons but does not link them: the handles above are guesses
        // and may belong to someone else. Flip to true once they are live.
        socialLive: false,
    },

    // Demo Account Settings
    demo: {
        email: "demo@balanceio.id",
        password: "password123",
        userPrefix: "BIO", // Prefix for demo user IDs like BIO-8823
        domain: "balanceio.id", // Default email domain for demo users
    },
}

export type SiteConfig = typeof siteConfig
