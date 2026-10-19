using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxComplianceAndNsfpRanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FakturPajakNumber",
                table: "SalesInvoices",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NsfpStatus",
                table: "SalesInvoices",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WithholdingTaxAmount",
                table: "PurchaseBills",
                type: "numeric(19,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "WithholdingTaxRate",
                table: "PurchaseBills",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "WithholdingTaxType",
                table: "PurchaseBills",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "JoinDate",
                table: "Contacts",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "TerminationDate",
                table: "Contacts",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TaxInvoiceNumberRanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    EndNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CurrentNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    AllocatedDate = table.Column<DateOnly>(type: "date", nullable: false),
                    IsExhausted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaxInvoiceNumberRanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaxInvoiceNumberRanges_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaxInvoiceNumberRanges_CompanyId_Year_IsExhausted",
                table: "TaxInvoiceNumberRanges",
                columns: new[] { "CompanyId", "Year", "IsExhausted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaxInvoiceNumberRanges");

            migrationBuilder.DropColumn(
                name: "FakturPajakNumber",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "NsfpStatus",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "WithholdingTaxAmount",
                table: "PurchaseBills");

            migrationBuilder.DropColumn(
                name: "WithholdingTaxRate",
                table: "PurchaseBills");

            migrationBuilder.DropColumn(
                name: "WithholdingTaxType",
                table: "PurchaseBills");

            migrationBuilder.DropColumn(
                name: "JoinDate",
                table: "Contacts");

            migrationBuilder.DropColumn(
                name: "TerminationDate",
                table: "Contacts");
        }
    }
}
