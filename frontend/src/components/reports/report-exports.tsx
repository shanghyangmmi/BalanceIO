"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Download, FileText, FileSpreadsheet } from "lucide-react"

import { useRef } from "react";
// @ts-ignore
import * as XLSX from "xlsx-js-style";

export function ReportExports() {
    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        const reportElement = document.getElementById("report-content");
        if (!reportElement) return;

        // Clone the element to manipulate it for export without affecting UI
        const clone = reportElement.cloneNode(true) as HTMLElement;

        // Remove no-print elements if any trapped inside
        const noPrints = clone.querySelectorAll(".no-print");
        noPrints.forEach(el => el.remove());

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Generate worksheet from table
        // We target the table specifically
        const table = clone.querySelector("table");
        if (!table) return;

        const ws = XLSX.utils.table_to_sheet(table);

        // Styling - Autosize columns
        const colWidths = [
            { wch: 30 }, // Account/Desc
            { wch: 20 }, // Amount
            { wch: 20 }, // Amount
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, "Report");

        // Download
        XLSX.writeFile(wb, `Financial_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
                <FileText className="mr-2 h-4 w-4" /> Print / PDF
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handlePrint}>
                        <FileText className="mr-2 h-4 w-4" /> PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportExcel}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (XLSX)
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
