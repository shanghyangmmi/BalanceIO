using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class MovingAverageCost : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AverageCost",
                table: "Products",
                type: "numeric(19,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InventoryValue",
                table: "Products",
                type: "numeric(19,4)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AverageCost",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "InventoryValue",
                table: "Products");
        }
    }
}
