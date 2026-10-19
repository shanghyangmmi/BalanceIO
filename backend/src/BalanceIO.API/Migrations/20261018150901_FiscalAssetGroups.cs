using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class FiscalAssetGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DisposalJournalEntryId",
                table: "FixedAssets",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FiscalGroup",
                table: "FixedAssets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "FiscalMethod",
                table: "FixedAssets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "FiscalUsefulLifeMonths",
                table: "FixedAssets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DefaultFiscalGroup",
                table: "FixedAssetCategories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DefaultFiscalMethod",
                table: "FixedAssetCategories",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DisposalJournalEntryId",
                table: "FixedAssets");

            migrationBuilder.DropColumn(
                name: "FiscalGroup",
                table: "FixedAssets");

            migrationBuilder.DropColumn(
                name: "FiscalMethod",
                table: "FixedAssets");

            migrationBuilder.DropColumn(
                name: "FiscalUsefulLifeMonths",
                table: "FixedAssets");

            migrationBuilder.DropColumn(
                name: "DefaultFiscalGroup",
                table: "FixedAssetCategories");

            migrationBuilder.DropColumn(
                name: "DefaultFiscalMethod",
                table: "FixedAssetCategories");
        }
    }
}
