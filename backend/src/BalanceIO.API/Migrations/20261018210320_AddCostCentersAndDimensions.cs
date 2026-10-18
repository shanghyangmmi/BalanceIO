using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCostCentersAndDimensions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CostCenterId",
                table: "SalesInvoiceLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProjectId",
                table: "SalesInvoiceLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CostCenterId",
                table: "PurchaseBillLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProjectId",
                table: "PurchaseBillLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CostCenterId",
                table: "JournalLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProjectId",
                table: "JournalLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CostCenterId",
                table: "FixedAssets",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CostCenterId",
                table: "EmployeeCompensations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DimensionRule",
                table: "Accounts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "CostCenters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    ManagerContactId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDiscontinued = table.Column<bool>(type: "boolean", nullable: false),
                    DiscontinuedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CostCenters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CostCenters_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CostCenters_Contacts_ManagerContactId",
                        column: x => x.ManagerContactId,
                        principalTable: "Contacts",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CostCenters_CostCenters_ParentId",
                        column: x => x.ParentId,
                        principalTable: "CostCenters",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalesInvoiceLines_CostCenterId",
                table: "SalesInvoiceLines",
                column: "CostCenterId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesInvoiceLines_ProjectId",
                table: "SalesInvoiceLines",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseBillLines_CostCenterId",
                table: "PurchaseBillLines",
                column: "CostCenterId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseBillLines_ProjectId",
                table: "PurchaseBillLines",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalLines_CostCenterId",
                table: "JournalLines",
                column: "CostCenterId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalLines_ProjectId",
                table: "JournalLines",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssets_CostCenterId",
                table: "FixedAssets",
                column: "CostCenterId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeCompensations_CostCenterId",
                table: "EmployeeCompensations",
                column: "CostCenterId");

            migrationBuilder.CreateIndex(
                name: "IX_CostCenters_CompanyId_Code",
                table: "CostCenters",
                columns: new[] { "CompanyId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CostCenters_ManagerContactId",
                table: "CostCenters",
                column: "ManagerContactId");

            migrationBuilder.CreateIndex(
                name: "IX_CostCenters_ParentId",
                table: "CostCenters",
                column: "ParentId");

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeCompensations_CostCenters_CostCenterId",
                table: "EmployeeCompensations",
                column: "CostCenterId",
                principalTable: "CostCenters",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FixedAssets_CostCenters_CostCenterId",
                table: "FixedAssets",
                column: "CostCenterId",
                principalTable: "CostCenters",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_JournalLines_CostCenters_CostCenterId",
                table: "JournalLines",
                column: "CostCenterId",
                principalTable: "CostCenters",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_JournalLines_Projects_ProjectId",
                table: "JournalLines",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseBillLines_CostCenters_CostCenterId",
                table: "PurchaseBillLines",
                column: "CostCenterId",
                principalTable: "CostCenters",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseBillLines_Projects_ProjectId",
                table: "PurchaseBillLines",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SalesInvoiceLines_CostCenters_CostCenterId",
                table: "SalesInvoiceLines",
                column: "CostCenterId",
                principalTable: "CostCenters",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SalesInvoiceLines_Projects_ProjectId",
                table: "SalesInvoiceLines",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeCompensations_CostCenters_CostCenterId",
                table: "EmployeeCompensations");

            migrationBuilder.DropForeignKey(
                name: "FK_FixedAssets_CostCenters_CostCenterId",
                table: "FixedAssets");

            migrationBuilder.DropForeignKey(
                name: "FK_JournalLines_CostCenters_CostCenterId",
                table: "JournalLines");

            migrationBuilder.DropForeignKey(
                name: "FK_JournalLines_Projects_ProjectId",
                table: "JournalLines");

            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseBillLines_CostCenters_CostCenterId",
                table: "PurchaseBillLines");

            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseBillLines_Projects_ProjectId",
                table: "PurchaseBillLines");

            migrationBuilder.DropForeignKey(
                name: "FK_SalesInvoiceLines_CostCenters_CostCenterId",
                table: "SalesInvoiceLines");

            migrationBuilder.DropForeignKey(
                name: "FK_SalesInvoiceLines_Projects_ProjectId",
                table: "SalesInvoiceLines");

            migrationBuilder.DropTable(
                name: "CostCenters");

            migrationBuilder.DropIndex(
                name: "IX_SalesInvoiceLines_CostCenterId",
                table: "SalesInvoiceLines");

            migrationBuilder.DropIndex(
                name: "IX_SalesInvoiceLines_ProjectId",
                table: "SalesInvoiceLines");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseBillLines_CostCenterId",
                table: "PurchaseBillLines");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseBillLines_ProjectId",
                table: "PurchaseBillLines");

            migrationBuilder.DropIndex(
                name: "IX_JournalLines_CostCenterId",
                table: "JournalLines");

            migrationBuilder.DropIndex(
                name: "IX_JournalLines_ProjectId",
                table: "JournalLines");

            migrationBuilder.DropIndex(
                name: "IX_FixedAssets_CostCenterId",
                table: "FixedAssets");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeCompensations_CostCenterId",
                table: "EmployeeCompensations");

            migrationBuilder.DropColumn(
                name: "CostCenterId",
                table: "SalesInvoiceLines");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "SalesInvoiceLines");

            migrationBuilder.DropColumn(
                name: "CostCenterId",
                table: "PurchaseBillLines");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "PurchaseBillLines");

            migrationBuilder.DropColumn(
                name: "CostCenterId",
                table: "JournalLines");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "JournalLines");

            migrationBuilder.DropColumn(
                name: "CostCenterId",
                table: "FixedAssets");

            migrationBuilder.DropColumn(
                name: "CostCenterId",
                table: "EmployeeCompensations");

            migrationBuilder.DropColumn(
                name: "DimensionRule",
                table: "Accounts");
        }
    }
}
