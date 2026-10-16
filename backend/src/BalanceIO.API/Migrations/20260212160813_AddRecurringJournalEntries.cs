using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurringJournalEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                // Idempotent Drop Indexes
                var indexesToDrop = new[]
                {
                    ("SalesInvoices", "IX_SalesInvoices_CompanyId"),
                    ("PurchaseBills", "IX_PurchaseBills_CompanyId"),
                    ("Products", "IX_Products_CompanyId"),
                    ("JournalEntries", "IX_JournalEntries_CompanyId"),
                    ("Contacts", "IX_Contacts_CompanyId"),
                    ("Accounts", "IX_Accounts_CompanyId")
                };

                foreach (var idx in indexesToDrop)
                {
                    migrationBuilder.Sql(
                        $@"DO $$
                          BEGIN
                            IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = '{idx.Item2}' AND n.nspname = 'public') THEN
                                DROP INDEX ""{idx.Item2}"";
                            END IF;
                          END $$;");
                }

                // Idempotent Create Indexes
                var indexesToCreate = new[]
                {
                    ("SalesInvoices", "IX_SalesInvoices_CompanyId_InvoiceDate", "\"CompanyId\", \"InvoiceDate\""),
                    ("SalesInvoices", "IX_SalesInvoices_CompanyId_Status", "\"CompanyId\", \"Status\""),
                    ("PurchaseBills", "IX_PurchaseBills_CompanyId_BillDate", "\"CompanyId\", \"BillDate\""),
                    ("PurchaseBills", "IX_PurchaseBills_CompanyId_Status", "\"CompanyId\", \"Status\""),
                    ("Products", "IX_Products_CompanyId_Code", "\"CompanyId\", \"Code\""),
                    ("Products", "IX_Products_CompanyId_Name", "\"CompanyId\", \"Name\""),
                    ("JournalLines", "IX_JournalLines_AccountId", "\"AccountId\""),
                    ("JournalEntries", "IX_JournalEntries_CompanyId_Date", "\"CompanyId\", \"Date\""),
                    ("Contacts", "IX_Contacts_CompanyId_Name", "\"CompanyId\", \"Name\""),
                    ("Accounts", "IX_Accounts_CompanyId_Code", "\"CompanyId\", \"Code\"")
                };

                foreach (var idx in indexesToCreate)
                {
                     migrationBuilder.Sql(
                        $@"DO $$
                          BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = '{idx.Item2}' AND n.nspname = 'public') THEN
                                CREATE INDEX ""{idx.Item2}"" ON ""{idx.Item1}"" ({idx.Item3});
                            END IF;
                          END $$;");
                }
            }
            else
            {
                migrationBuilder.DropIndex(
                    name: "IX_SalesInvoices_CompanyId",
                    table: "SalesInvoices");

                migrationBuilder.DropIndex(
                    name: "IX_PurchaseBills_CompanyId",
                    table: "PurchaseBills");

                migrationBuilder.DropIndex(
                    name: "IX_Products_CompanyId",
                    table: "Products");

                migrationBuilder.DropIndex(
                    name: "IX_JournalEntries_CompanyId",
                    table: "JournalEntries");

                migrationBuilder.DropIndex(
                    name: "IX_Contacts_CompanyId",
                    table: "Contacts");

                migrationBuilder.DropIndex(
                    name: "IX_Accounts_CompanyId",
                    table: "Accounts");

                migrationBuilder.CreateIndex(
                    name: "IX_SalesInvoices_CompanyId_InvoiceDate",
                    table: "SalesInvoices",
                    columns: new[] { "CompanyId", "InvoiceDate" });

                migrationBuilder.CreateIndex(
                    name: "IX_SalesInvoices_CompanyId_Status",
                    table: "SalesInvoices",
                    columns: new[] { "CompanyId", "Status" });

                migrationBuilder.CreateIndex(
                    name: "IX_PurchaseBills_CompanyId_BillDate",
                    table: "PurchaseBills",
                    columns: new[] { "CompanyId", "BillDate" });

                migrationBuilder.CreateIndex(
                    name: "IX_PurchaseBills_CompanyId_Status",
                    table: "PurchaseBills",
                    columns: new[] { "CompanyId", "Status" });

                migrationBuilder.CreateIndex(
                    name: "IX_Products_CompanyId_Code",
                    table: "Products",
                    columns: new[] { "CompanyId", "Code" });

                migrationBuilder.CreateIndex(
                    name: "IX_Products_CompanyId_Name",
                    table: "Products",
                    columns: new[] { "CompanyId", "Name" });

                migrationBuilder.CreateIndex(
                    name: "IX_JournalLines_AccountId",
                    table: "JournalLines",
                    column: "AccountId");

                migrationBuilder.CreateIndex(
                    name: "IX_JournalEntries_CompanyId_Date",
                    table: "JournalEntries",
                    columns: new[] { "CompanyId", "Date" });

                migrationBuilder.CreateIndex(
                    name: "IX_Contacts_CompanyId_Name",
                    table: "Contacts",
                    columns: new[] { "CompanyId", "Name" });

                migrationBuilder.CreateIndex(
                    name: "IX_Accounts_CompanyId_Code",
                    table: "Accounts",
                    columns: new[] { "CompanyId", "Code" });
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SalesInvoices_CompanyId_InvoiceDate",
                table: "SalesInvoices");

            migrationBuilder.DropIndex(
                name: "IX_SalesInvoices_CompanyId_Status",
                table: "SalesInvoices");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseBills_CompanyId_BillDate",
                table: "PurchaseBills");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseBills_CompanyId_Status",
                table: "PurchaseBills");

            migrationBuilder.DropIndex(
                name: "IX_Products_CompanyId_Code",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Products_CompanyId_Name",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_JournalLines_AccountId",
                table: "JournalLines");

            migrationBuilder.DropIndex(
                name: "IX_JournalEntries_CompanyId_Date",
                table: "JournalEntries");

            migrationBuilder.DropIndex(
                name: "IX_Contacts_CompanyId_Name",
                table: "Contacts");

            migrationBuilder.DropIndex(
                name: "IX_Accounts_CompanyId_Code",
                table: "Accounts");

            migrationBuilder.CreateIndex(
                name: "IX_SalesInvoices_CompanyId",
                table: "SalesInvoices",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseBills_CompanyId",
                table: "PurchaseBills",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_CompanyId",
                table: "Products",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntries_CompanyId",
                table: "JournalEntries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Contacts_CompanyId",
                table: "Contacts",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_CompanyId",
                table: "Accounts",
                column: "CompanyId");
        }
    }
}
