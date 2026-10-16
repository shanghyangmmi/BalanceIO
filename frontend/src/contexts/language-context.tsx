"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "en" | "id";

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
    en: {
        // Navigation Groups
        "nav.modules": "Modules",
        "nav.moduleHub": "Module hub",
        "nav.dailyWork": "Daily work",
        "nav.records": "Records",
        "nav.tax": "Tax",
        "nav.purchases": "Purchases",
        "nav.journalApprovals": "Journal Approvals",
        "nav.projects": "Projects",
        "nav.overview": "Overview",
        "nav.accounting": "Accounting",
        "nav.operations": "Operations",
        "nav.management": "Management",

        // Navigation Items
        "nav.dashboard": "Dashboard",
        "nav.financialReports": "Financial Reports",
        "nav.chartOfAccounts": "Chart of Accounts",
        "nav.journalEntries": "Journal Entries",
        "nav.generalLedger": "General Ledger",
        "nav.sales": "Sales",
        "nav.expenses": "Expenses",
        "nav.inventory": "Inventory",
        "nav.fixedAssets": "Assets",
        "nav.taxCompliance": "Tax Compliance",
        "nav.financialDocuments": "Financial Documents",
        "nav.contacts": "Contacts",
        "nav.settings": "Settings",
        "nav.reports": "Reports",
        "nav.logout": "Log out",
        "nav.signOut": "Sign Out",
        "nav.profile": "Profile",
        "nav.billing": "Billing",
        "nav.team": "Team",
        "nav.language": "Language",

        // Settings tabs
        "settings.title": "Settings",
        "settings.companyProfile": "Company Profile",
        "settings.userManagement": "User Management",
        "settings.exchangeRates": "Exchange Rates",
        "settings.subscription": "Subscription",

        // Common actions
        "common.save": "Save",
        "common.cancel": "Cancel",
        "common.edit": "Edit",
        "common.delete": "Delete",
        "common.add": "Add",
        "common.search": "Search",
        "common.loading": "Loading...",
        "common.sync": "Sync",
        "common.export": "Export",
        "common.import": "Import",
        "common.invite": "Invite",
        "common.upgrade": "Upgrade",
        "common.current": "Current",
        "common.back": "Back",
        "common.view": "View",
        "common.print": "Print",
        "common.download": "Download",
        "common.new": "New",
        "common.all": "All",
        "common.status": "Status",
        "common.rowsPerPage": "Rows per page",
        "common.previous": "Previous",
        "common.next": "Next",

        // Notifications
        "toast.success": "Success",
        "toast.error": "Error",
        "toast.saved": "Changes saved successfully",
        "toast.deleted": "Deleted successfully",
        "toast.synced": "Synced successfully",
        "toast.languageChanged": "Language changed",

        // Exchange Rates
        "exchangeRates.title": "Exchange Rates",
        "exchangeRates.kursBI": "BI Rate",
        "exchangeRates.kursKMK": "Tax Rate (KMK)",
        "exchangeRates.buyRate": "Buy Rate",
        "exchangeRates.sellRate": "Sell Rate",
        "exchangeRates.middleRate": "Middle Rate",
        "exchangeRates.selectCurrency": "Select currency",
        "exchangeRates.multiDateWarning": "To compare multiple dates, please select one currency first.",
        "exchangeRates.biDescription": "Bank Indonesia middle rate used for standard accounting. Updated every business day.",
        "exchangeRates.kmkDescription": "KMK rate used for tax and customs purposes. Issued weekly by Ministry of Finance.",

        // Subscription
        "subscription.title": "Subscription",
        "subscription.currentPlan": "Current Plan",
        "subscription.paymentMethod": "Payment Method",
        "subscription.paymentHistory": "Payment History",
        "subscription.addPayment": "Add Payment Method",

        // User Management
        "users.title": "User Management",
        "users.inviteUser": "Invite User",
        "users.role": "Role",
        "users.changeRole": "Change Role",
        "users.transferOwnership": "Transfer Ownership",
        "users.removeUser": "Remove User",

        // Admin
        "admin.title": "Admin Panel",
        "admin.dashboard": "Dashboard",
        "admin.users": "Users",
        "admin.companies": "Companies",
        "admin.subscriptions": "Subscriptions",
        "admin.backToApp": "Back to App",

        // Auth
        "auth.login": "Login",
        "auth.register": "Register",
        "auth.email": "Email",
        "auth.password": "Password",
        "auth.forgotPassword": "Forgot Password?",
    },
    id: {
        // Navigation Groups
        "nav.modules": "Modul",
        "nav.moduleHub": "Peta modul",
        "nav.dailyWork": "Kerja harian",
        "nav.records": "Data",
        "nav.tax": "Pajak",
        "nav.purchases": "Pembelian",
        "nav.journalApprovals": "Persetujuan Jurnal",
        "nav.projects": "Proyek",
        "nav.overview": "Ringkasan",
        "nav.accounting": "Akuntansi",
        "nav.operations": "Operasional",
        "nav.management": "Manajemen",

        // Navigation Items
        "nav.dashboard": "Dasbor",
        "nav.financialReports": "Laporan Keuangan",
        "nav.chartOfAccounts": "Bagan Akun",
        "nav.journalEntries": "Jurnal Umum",
        "nav.generalLedger": "Buku Besar",
        "nav.sales": "Penjualan",
        "nav.expenses": "Pengeluaran",
        "nav.inventory": "Persediaan",
        "nav.fixedAssets": "Aset",
        "nav.taxCompliance": "Kepatuhan Pajak",
        "nav.financialDocuments": "Dokumen Keuangan",
        "nav.contacts": "Kontak",
        "nav.settings": "Pengaturan",
        "nav.reports": "Laporan",
        "nav.logout": "Keluar",
        "nav.signOut": "Keluar",
        "nav.profile": "Profil",
        "nav.billing": "Tagihan",
        "nav.team": "Tim",
        "nav.language": "Bahasa",

        // Settings tabs
        "settings.title": "Pengaturan",
        "settings.companyProfile": "Profil Perusahaan",
        "settings.userManagement": "Manajemen Pengguna",
        "settings.exchangeRates": "Kurs Valuta Asing",
        "settings.subscription": "Langganan",

        // Common actions
        "common.save": "Simpan",
        "common.cancel": "Batal",
        "common.edit": "Ubah",
        "common.delete": "Hapus",
        "common.add": "Tambah",
        "common.search": "Cari",
        "common.loading": "Memuat...",
        "common.sync": "Sinkronkan",
        "common.export": "Ekspor",
        "common.import": "Impor",
        "common.invite": "Undang",
        "common.upgrade": "Upgrade",
        "common.current": "Saat ini",
        "common.back": "Kembali",
        "common.view": "Lihat",
        "common.print": "Cetak",
        "common.download": "Unduh",
        "common.new": "Baru",
        "common.all": "Semua",
        "common.status": "Status",
        "common.rowsPerPage": "Baris per halaman",
        "common.previous": "Sebelumnya",
        "common.next": "Berikutnya",

        // Notifications
        "toast.success": "Berhasil",
        "toast.error": "Gagal",
        "toast.saved": "Perubahan berhasil disimpan",
        "toast.deleted": "Berhasil dihapus",
        "toast.synced": "Berhasil disinkronkan",
        "toast.languageChanged": "Bahasa diubah",

        // Exchange Rates
        "exchangeRates.title": "Kurs Valuta Asing",
        "exchangeRates.kursBI": "Kurs BI",
        "exchangeRates.kursKMK": "Kurs Pajak (KMK)",
        "exchangeRates.buyRate": "Kurs Beli",
        "exchangeRates.sellRate": "Kurs Jual",
        "exchangeRates.middleRate": "Kurs Tengah",
        "exchangeRates.selectCurrency": "Pilih mata uang",
        "exchangeRates.multiDateWarning": "Untuk membandingkan beberapa tanggal, pilih satu mata uang terlebih dahulu.",
        "exchangeRates.biDescription": "Kurs tengah Bank Indonesia digunakan untuk pencatatan akuntansi standar. Diperbarui setiap hari kerja.",
        "exchangeRates.kmkDescription": "Kurs KMK digunakan untuk keperluan perpajakan dan bea cukai. Diterbitkan mingguan oleh Kementerian Keuangan.",

        // Subscription
        "subscription.title": "Langganan",
        "subscription.currentPlan": "Paket Saat Ini",
        "subscription.paymentMethod": "Metode Pembayaran",
        "subscription.paymentHistory": "Riwayat Pembayaran",
        "subscription.addPayment": "Tambah Metode Pembayaran",

        // User Management
        "users.title": "Manajemen Pengguna",
        "users.inviteUser": "Undang Pengguna",
        "users.role": "Peran",
        "users.changeRole": "Ubah Peran",
        "users.transferOwnership": "Transfer Kepemilikan",
        "users.removeUser": "Hapus Pengguna",

        // Admin
        "admin.title": "Panel Admin",
        "admin.dashboard": "Dasbor",
        "admin.users": "Pengguna",
        "admin.companies": "Perusahaan",
        "admin.subscriptions": "Langganan",
        "admin.backToApp": "Kembali ke Aplikasi",

        // Auth
        "auth.login": "Masuk",
        "auth.register": "Daftar",
        "auth.email": "Email",
        "auth.password": "Kata Sandi",
        "auth.forgotPassword": "Lupa Kata Sandi?",
    },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>("en");

    useEffect(() => {
        // Load saved language from localStorage
        const saved = localStorage.getItem("language") as Language;
        if (saved && (saved === "en" || saved === "id")) {
            setLanguageState(saved);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem("language", lang);
    };

    const t = (key: string): string => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}

export { translations };
export type { Language };
